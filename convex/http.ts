import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Slack OAuth callback handler
http.route({
	path: "/import/slack/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		// Early validation of SITE_URL configuration
		const siteUrl = process.env.SITE_URL;
		if (!siteUrl) {
			return new Response("Configuration error", { status: 500 });
		}

		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth error - safely parse workspaceId for redirect
		if (error) {
			let workspaceId = "";
			try {
				if (state) {
					const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
					workspaceId = parsed.workspaceId || "";
				}
			} catch (e) {
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
			return new Response("Missing code or state parameter", { status: 400 });
		}

		// Parse state parameter using base64-encoded JSON
		let workspaceId: string;
		let memberId: string;
		try {
			const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
			workspaceId = parsed.workspaceId;
			memberId = parsed.memberId;

			if (!workspaceId || !memberId) {
				throw new Error("Invalid state parameter");
			}
		} catch (e) {
			return new Response("Invalid state parameter", { status: 400 });
		}

		try {
			// Exchange code for access token
			const clientId = process.env.SLACK_CLIENT_ID;
			const clientSecret = process.env.SLACK_CLIENT_SECRET;
			const redirectUri = `${siteUrl}/api/import/slack/callback`;

			if (!clientId || !clientSecret) {
				throw new Error("Slack OAuth not configured");
			}

			// Create AbortController for timeout handling
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

			let tokenResponse;
			try {
				tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
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
				if (error instanceof Error && error.name === "AbortError") {
					throw new Error("OAuth token exchange timeout");
				}
				throw error;
			} finally {
				clearTimeout(timeoutId);
			}

			const tokenData = await tokenResponse.json();

			if (!tokenData.ok) {
				throw new Error(tokenData.error || "Failed to exchange OAuth code");
			}

			// Validate required token fields
			if (
				!tokenData.access_token ||
				!tokenData.team ||
				!tokenData.team.id ||
				!tokenData.team.name
			) {
				throw new Error("Invalid token response from Slack");
			}

			// Store the connection
			await ctx.runMutation(internal.importIntegrations.storeSlackConnection, {
				workspaceId: workspaceId as Id<"workspaces">,
				memberId: memberId as Id<"members">,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token || undefined,
				expiresAt:
					tokenData.expires_in && typeof tokenData.expires_in === "number"
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
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("Slack OAuth error:", errorMessage);
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
