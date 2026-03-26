import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { createDodoWebhookHandler } from '@dodopayments/convex';

const http = httpRouter();

auth.addHttpRoutes(http);

// ─── Dodo Payments Webhook ─────────────────────────────────────────────────────
// Securely handles Dodo Payments webhook events with signature verification.
// Ensure DODO_PAYMENTS_WEBHOOK_SECRET is configured in Convex dashboard env vars.
http.route({
	path: '/dodopayments-webhook',
	method: 'POST',
	handler: createDodoWebhookHandler({
		onPaymentSucceeded: async (ctx, payload) => {
			// Persist/handle payment success if needed
			// Using internal.webhooks.* mutations to avoid schema changes during migration
			try {
				await ctx.runMutation(internal.webhooks.createPayment, {
					paymentId: payload.data.payment_id,
					businessId: payload.business_id,
					customerEmail: payload.data.customer?.email ?? null,
					amount: payload.data.total_amount,
					currency: payload.data.currency,
					status: payload.data.status ?? 'unknown',
					raw: JSON.stringify(payload),
				});
			} catch (e) {
				console.error('Dodo onPaymentSucceeded handler failed', e);
				throw e;
			}
		},
		onSubscriptionActive: async (ctx, payload) => {
			// Map back to workspace using metadata if present
			const workspaceId = payload.data?.metadata?.workspace_id as
				| Id<'workspaces'>
				| undefined;

			try {
				await ctx.runMutation(internal.webhooks.createSubscription, {
					workspaceId,
					subscriptionId: payload.data.subscription_id,
					status: payload.data.status,
					raw: JSON.stringify(payload),
				});
			} catch (e) {
				console.error('Dodo onSubscriptionActive handler failed', e);
				throw e;
			}
		},
		onSubscriptionUpdated: async (ctx, payload) => {
			const workspaceId = payload.data?.metadata?.workspace_id as
				| Id<'workspaces'>
				| undefined;

			try {
				await ctx.runMutation(internal.webhooks.updateSubscription, {
					workspaceId,
					subscriptionId: payload.data.subscription_id,
					status: payload.data.status,
					raw: JSON.stringify(payload),
				});
			} catch (e) {
				console.error('Dodo onSubscriptionUpdated handler failed', e);
				throw e;
			}
		},
		onSubscriptionCancelled: async (ctx, payload) => {
			const workspaceId = payload.data?.metadata?.workspace_id as
				| Id<'workspaces'>
				| undefined;

			try {
				await ctx.runMutation(internal.webhooks.cancelSubscription, {
					workspaceId,
					raw: JSON.stringify(payload),
				});
			} catch (e) {
				console.error('Dodo onSubscriptionCancelled handler failed', e);
				throw e;
			}
		},
	}),
});

// Slack OAuth callback handler
http.route({
	path: '/import/slack/callback',
	method: 'GET',
	handler: httpAction(async (ctx, request) => {
		// Early validation of SITE_URL configuration
		const siteUrl = process.env.SITE_URL;
		if (!siteUrl) {
			return new Response('Configuration error', { status: 500 });
		}

		const url = new URL(request.url);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const error = url.searchParams.get('error');

		// Handle OAuth error - safely parse workspaceId for redirect
		if (error) {
			let workspaceId = '';
			try {
				if (state) {
					const parsed = JSON.parse(base64UrlDecode(state));
					workspaceId = parsed.workspaceId || '';
				}
			} catch (_e) {
				// If state parsing fails, redirect to a safe default
			}

			const redirectPath = workspaceId
				? `/workspace/${workspaceId}/manage?tab=import&error=${encodeURIComponent(error)}`
				: `/manage?error=${encodeURIComponent(error)}`;

			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}${redirectPath}`,
				},
			});
		}

		if (!code || !state) {
			return new Response('Missing code or state parameter', { status: 400 });
		}

		// Parse state parameter using base64-encoded JSON
		let workspaceId: string;
		let memberId: string;
		try {
			const normalizedState = normalizeStateParam(state);
			const parsed = JSON.parse(base64UrlDecode(normalizedState));
			workspaceId = parsed.workspaceId;
			memberId = parsed.memberId;

			if (!workspaceId || !memberId) {
				throw new Error('Invalid state parameter');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('Slack OAuth state decode failed:', message);
			return new Response('Invalid state parameter', { status: 400 });
		}

		try {
			// Exchange code for access token
			const clientId = process.env.SLACK_CLIENT_ID;
			const clientSecret = process.env.SLACK_CLIENT_SECRET;
			const redirectUri = `${siteUrl}/api/import/slack/callback`;

			if (!clientId || !clientSecret) {
				throw new Error('Slack OAuth not configured');
			}

			// Create AbortController for timeout handling
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

			let tokenResponse;
			try {
				tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						code,
						client_id: clientId,
						client_secret: clientSecret,
						redirect_uri: redirectUri,
					}),
					signal: controller.signal,
				});
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') {
					throw new Error('OAuth token exchange timeout');
				}
				throw error;
			} finally {
				clearTimeout(timeoutId);
			}

			const tokenData = await tokenResponse.json();

			if (!tokenData.ok) {
				throw new Error(tokenData.error || 'Failed to exchange OAuth code');
			}

			// Validate required token fields
			if (
				!tokenData.access_token ||
				!tokenData.team ||
				!tokenData.team.id ||
				!tokenData.team.name
			) {
				throw new Error('Invalid token response from Slack');
			}

			// Store the connection
			await ctx.runMutation(internal.importIntegrations.storeSlackConnection, {
				workspaceId: workspaceId as Id<'workspaces'>,
				memberId: memberId as Id<'members'>,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token || undefined,
				expiresAt:
					tokenData.expires_in && typeof tokenData.expires_in === 'number'
						? Date.now() + tokenData.expires_in * 1000
						: undefined,
				scope: tokenData.scope,
				teamId: tokenData.team.id,
				teamName: tokenData.team.name,
			});

			// Redirect back to manage page with success
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?tab=import&success=slack_connected`,
				},
			});
		} catch (error) {
			// Sanitize error logging to avoid leaking sensitive data
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			console.error('Slack OAuth error:', errorMessage);
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?tab=import&error=${encodeURIComponent(errorMessage)}`,
				},
			});
		}
	}),
});

export default http;

function normalizeStateParam(value: string): string {
	if (!value.includes('%')) return value;
	try {
		return decodeURIComponent(value);
	} catch (_error) {
		return value;
	}
}

function base64UrlDecode(value: string): string {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	if (typeof atob === 'function') {
		return atob(padded);
	}
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(padded, 'base64').toString('utf8');
	}
	throw new Error('Base64 decode not supported');
}
