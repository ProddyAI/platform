import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Slack OAuth callback handler
http.route({
	path: "/import/slack/callback",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const error = url.searchParams.get("error");

		// Handle OAuth error
		if (error) {
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${process.env.SITE_URL}/workspace/${state?.split("_")[0]}/manage?tab=import&error=${encodeURIComponent(error)}`,
				},
			});
		}

		if (!code || !state) {
			return new Response("Missing code or state parameter", { status: 400 });
		}

		// Parse state parameter
		const [workspaceId, memberId] = state.split("_");

		try {
			// Exchange code for access token
			const clientId = process.env.SLACK_CLIENT_ID;
			const clientSecret = process.env.SLACK_CLIENT_SECRET;
			const redirectUri = `${process.env.SITE_URL}/api/import/slack/callback`;

			if (!clientId || !clientSecret) {
				throw new Error("Slack OAuth not configured");
			}

			const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
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
			});

			const tokenData = await tokenResponse.json();

			if (!tokenData.ok) {
				throw new Error(tokenData.error || "Failed to exchange OAuth code");
			}

			// Store the connection
			await ctx.runMutation(internal.importIntegrations.storeSlackConnection, {
				workspaceId: workspaceId as any,
				memberId: memberId as any,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				expiresAt: tokenData.expires_in
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
					Location: `${process.env.SITE_URL}/workspace/${workspaceId}/manage?tab=import&success=slack_connected`,
				},
			});
		} catch (error) {
			console.error("Slack OAuth error:", error);
			return new Response(null, {
				status: 302,
				headers: {
					Location: `${process.env.SITE_URL}/workspace/${workspaceId}/manage?tab=import&error=${encodeURIComponent(
						error instanceof Error ? error.message : "Unknown error"
					)}`,
				},
			});
		}
	}),
});

export default http;

