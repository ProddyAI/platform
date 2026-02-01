import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { initializeComposio } from "@/lib/composio";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
	try {
		// Check authentication first
		if (!isAuthenticatedNextjs()) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			);
		}

		// Get the auth token to make authenticated Convex calls
		const token = convexAuthNextjsToken();
		if (!token) {
			return NextResponse.json(
				{ error: "Invalid authentication token" },
				{ status: 401 }
			);
		}

		// Set the token for authenticated Convex operations
		convex.setAuth(token);

		const { workspaceId, app, redirectUrl } = await req.json();

		if (!workspaceId || !app) {
			return NextResponse.json(
				{ error: "workspaceId and app are required" },
				{ status: 400 }
			);
		}

		// Get the current user from the authenticated session
		const currentUser = await convex.query(api.users.current);
		if (!currentUser) {
			return NextResponse.json({ error: "User not found" }, { status: 401 });
		}

		// Get current user's member in this workspace (so we store the connection under the connecting user)
		const currentMember = await convex.query(api.members.current, {
			workspaceId: workspaceId as Id<"workspaces">,
		});

		if (!currentMember?._id) {
			return NextResponse.json(
				{ error: "Access denied: Not a member of this workspace" },
				{ status: 403 }
			);
		}

		const memberId = currentMember._id;

		console.log(
			`[Connection Complete] Completing ${app} connection for workspace ${workspaceId}`
		);

		// Use consistent workspace entity ID pattern
		const entityId = `workspace_${workspaceId}`;
		const { apiClient } = initializeComposio();

		// Get connections to verify the connection was established
		const connectionsResponse = await apiClient.getConnections(entityId);
		const connectedAccounts = connectionsResponse.items || [];

		// Find the most recent connection for this app
		const connectedAccount = connectedAccounts.find((account: any) => {
			return (
				account.appName?.toLowerCase() === app.toLowerCase() ||
				account.integrationId?.toLowerCase() === app.toLowerCase() ||
				account.toolkit?.slug?.toLowerCase() === app.toLowerCase()
			);
		});

		if (!connectedAccount) {
			return NextResponse.json(
				{
					error: "Connection not found",
					details: `No active connection found for ${app}. Please try connecting again.`,
				},
				{ status: 404 }
			);
		}

		console.log(
			`[Connection Complete] Found connection: ${connectedAccount.id} for ${app}`
		);

		// Store connected account in database (consistent with agentauth)
		try {
			// Get or create auth config for this app
			let authConfigId;
			try {
				const existingAuthConfig = await convex.query(
					api.integrations.getAuthConfigByToolkit,
					{
						workspaceId: workspaceId as Id<"workspaces">,
						toolkit: app as any,
					}
				);
				authConfigId = existingAuthConfig?._id;
			} catch (_error) {
				console.log("Auth config doesn't exist, will create new one");
			}

			if (!authConfigId) {
				authConfigId = await convex.mutation(api.integrations.storeAuthConfig, {
					workspaceId: workspaceId as Id<"workspaces">,
					toolkit: app as any,
					name: `${app.charAt(0).toUpperCase() + app.slice(1)} Config`,
					type: "use_composio_managed_auth",
					composioAuthConfigId: connectedAccount.id,
					isComposioManaged: true,
					createdBy: memberId as Id<"members">,
				});
			}

			// Store connected account (with memberId so Convex chatbot and status can find it for this member)
			await convex.mutation(api.integrations.storeConnectedAccount, {
				workspaceId: workspaceId as Id<"workspaces">,
				memberId: memberId as Id<"members">,
				authConfigId: authConfigId,
				userId: entityId,
				composioAccountId: connectedAccount.id,
				toolkit: app as any,
				status: "ACTIVE",
				metadata: connectedAccount,
				connectedBy: memberId as Id<"members">,
			});

			console.log(`[Connection Complete] Connected account stored for ${app}`);
		} catch (error) {
			console.warn("Failed to store connected account:", error);
			// Don't fail the whole request if database storage fails
		}

		return NextResponse.json({
			success: true,
			connectedAccount,
			app,
			connectionId: connectedAccount.id,
			entityId,
			message: `${app} connected successfully`,
			redirectUrl:
				redirectUrl || `/workspace/${workspaceId}/settings/integrations`,
		});
	} catch (error) {
		console.error("[Connection Complete] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to complete connection",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
