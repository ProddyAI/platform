import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
	AVAILABLE_APPS,
	type AvailableApp,
	createComposioClient,
	initiateAppConnection,
} from "@/lib/composio-config";

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

		// Verify user is a member of the workspace
		const members = await convex.query(api.members.get, {
			workspaceId: workspaceId as Id<"workspaces">,
		});

		if (!members || members.length === 0) {
			return NextResponse.json(
				{ error: "Access denied: Not a member of this workspace" },
				{ status: 403 }
			);
		}

		const memberId = members[0]._id;

		if (!Object.values(AVAILABLE_APPS).includes(app)) {
			return NextResponse.json(
				{
					error: `Invalid app. Must be one of: ${Object.values(AVAILABLE_APPS).join(", ")}`,
				},
				{ status: 400 }
			);
		}

		console.log(
			`[Connection Initiate] Starting connection for ${app} in workspace ${workspaceId}`
		);

		// Use consistent workspace entity ID pattern
		const entityId = `workspace_${workspaceId}`;
		const composio = createComposioClient();

		// Initiate connection using the composio-config function
		const result = await initiateAppConnection(
			composio,
			entityId,
			app as AvailableApp,
			redirectUrl ||
				`${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback?workspaceId=${workspaceId}&app=${app}`
		);

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		// Store auth config in database for tracking (consistent with agentauth)
		try {
			await convex.mutation(api.integrations.storeAuthConfig, {
				workspaceId: workspaceId as Id<"workspaces">,
				toolkit: app as any,
				name: `${app.charAt(0).toUpperCase() + app.slice(1)} Config`,
				type: "use_composio_managed_auth",
				composioAuthConfigId:
					result.connectionId || `composio_${app}_${Date.now()}`,
				isComposioManaged: true,
				createdBy: memberId as Id<"members">,
			});

			console.log(`[Connection Initiate] Auth config stored for ${app}`);
		} catch (error) {
			console.warn("Failed to store auth config:", error);
			// Don't fail the whole request if database storage fails
		}

		return NextResponse.json({
			success: true,
			app,
			redirectUrl: result.redirectUrl,
			connectionId: result.connectionId,
			entityId,
			message: `Redirect to ${app} for authorization`,
		});
	} catch (error) {
		console.error("[Connection Initiate] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to initiate connection",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
