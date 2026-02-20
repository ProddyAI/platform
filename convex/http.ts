import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Slack OAuth callback handler
http.route({
	path: "/import/slack/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		// Get app URL from environment variables
		const siteUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";

		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth error - safely parse workspaceId for redirect
		if (error) {
			let workspaceId = "";
			try {
				if (state) {
					const parsed = JSON.parse(base64UrlDecode(state));
					workspaceId = parsed.workspaceId || "";
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
			return new Response("Missing code or state parameter", { status: 400 });
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
				throw new Error("Invalid state parameter");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("Slack OAuth state decode failed:", message);
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
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
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

// Todoist OAuth callback handler
http.route({
	path: "/import/todoist/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		// Get app URL from environment variables
		const siteUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";

		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth error
		if (error) {
			let workspaceId = "";
			try {
				if (state) {
					const parsed = JSON.parse(base64UrlDecode(state));
					workspaceId = parsed.workspaceId || "";
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
			return new Response("Missing code or state parameter", { status: 400 });
		}

		// Parse state parameter
		let workspaceId: string;
		let memberId: string;
		try {
			const normalizedState = normalizeStateParam(state);
			const parsed = JSON.parse(base64UrlDecode(normalizedState));
			workspaceId = parsed.workspaceId;
			memberId = parsed.memberId;

			if (!workspaceId || !memberId) {
				throw new Error("Invalid state parameter");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("Todoist OAuth state decode failed:", message);
			return new Response("Invalid state parameter", { status: 400 });
		}

		try {
			// Exchange code for access token
			const clientId = process.env.TODOIST_CLIENT_ID;
			const clientSecret = process.env.TODOIST_CLIENT_SECRET;
			const redirectUri = `${siteUrl}/api/import/todoist/callback`;

			if (!clientId || !clientSecret) {
				throw new Error("Todoist OAuth not configured");
			}

			// Exchange code for token
			const tokenResponse = await fetch(
				"https://todoist.com/oauth/access_token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						client_id: clientId,
						client_secret: clientSecret,
						code,
						redirect_uri: redirectUri,
					}),
				}
			);

			if (!tokenResponse.ok) {
				throw new Error("Failed to exchange OAuth code");
			}

			const tokenData = await tokenResponse.json();

			if (!tokenData.access_token) {
				throw new Error("Invalid token response from Todoist");
			}

			// Store the connection
			await ctx.runMutation(
				internal.importIntegrations.storeTodoistConnection,
				{
					workspaceId: workspaceId as Id<"workspaces">,
					memberId: memberId as Id<"members">,
					accessToken: tokenData.access_token,
					refreshToken: undefined, // Todoist doesn't provide refresh tokens
					scope: tokenData.scope || "data:read,data:write",
					userId: tokenData.uid || tokenData.user_id || "unknown",
					userName: tokenData.full_name || tokenData.username || "Todoist User",
				}
			);

			// Redirect back to manage page with success
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?tab=import&success=todoist_connected`,
				},
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("Todoist OAuth error:", errorMessage);
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?tab=import&error=${encodeURIComponent(errorMessage)}`,
				},
			});
		}
	}),
});

// Linear OAuth callback handler
http.route({
	path: "/import/linear/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const siteUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";

		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		if (error) {
			let workspaceId = "";
			try {
				if (state) {
					const parsed = JSON.parse(base64UrlDecode(state));
					workspaceId = parsed.workspaceId || "";
				}
			} catch (_e) {}

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
			return new Response("Missing code or state", { status: 400 });
		}

		let workspaceId: string;
		let memberId: string;
		try {
			const normalizedState = normalizeStateParam(state);
			const parsed = JSON.parse(base64UrlDecode(normalizedState));
			workspaceId = parsed.workspaceId;
			memberId = parsed.memberId;

			if (!workspaceId || !memberId) {
				throw new Error("Invalid state");
			}
		} catch (error) {
			console.error("Linear OAuth state decode failed:", error);
			return new Response("Invalid state", { status: 400 });
		}

		try {
			const clientId = process.env.LINEAR_CLIENT_ID;
			const clientSecret = process.env.LINEAR_CLIENT_SECRET;
			const redirectUri = `${siteUrl}/api/import/linear/callback`;

			if (!clientId || !clientSecret) {
				throw new Error("Linear OAuth not configured");
			}

			// Exchange code for token
			const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					grant_type: "authorization_code",
					redirect_uri: redirectUri,
				}),
			});

			if (!tokenResponse.ok) {
				throw new Error("Failed to exchange OAuth code");
			}

			const tokenData = await tokenResponse.json();

			if (!tokenData.access_token) {
				throw new Error("Invalid token response");
			}

			// Get organization info
			const orgResponse = await fetch("https://api.linear.app/graphql", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${tokenData.access_token}`,
				},
				body: JSON.stringify({
					query: `{ organization { id name } }`,
				}),
			});

			const orgData = await orgResponse.json();
			const org = orgData.data?.organization || {};

			// Store the connection
			await ctx.runMutation(internal.importIntegrations.storeLinearConnection, {
				workspaceId: workspaceId as Id<"workspaces">,
				memberId: memberId as Id<"members">,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				expiresAt: tokenData.expires_in
					? Date.now() + tokenData.expires_in * 1000
					: undefined,
				scope: tokenData.scope || "read",
				organizationId: org.id || "unknown",
				organizationName: org.name || "Linear Organization",
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: `${siteUrl}/workspace/${workspaceId}/manage?tab=import&success=linear_connected`,
				},
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("Linear OAuth error:", errorMessage);
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
	if (!value.includes("%")) return value;
	try {
		return decodeURIComponent(value);
	} catch (_error) {
		return value;
	}
}

function base64UrlDecode(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	if (typeof atob === "function") {
		return atob(padded);
	}
	if (typeof Buffer !== "undefined") {
		return Buffer.from(padded, "base64").toString("utf8");
	}
	throw new Error("Base64 decode not supported");
}
