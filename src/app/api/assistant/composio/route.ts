import { type NextRequest, NextResponse } from "next/server";
import {
	APP_CONFIGS,
	AVAILABLE_APPS,
	type AvailableApp,
	createComposioClient,
	getConnectedApps,
	initiateAppConnection,
} from "@/lib/composio-config";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const action = searchParams.get("action");
		const workspaceId = searchParams.get("workspaceId");

		if (!workspaceId) {
			return NextResponse.json(
				{ error: "workspaceId is required" },
				{ status: 400 }
			);
		}

		const userId = `workspace_${workspaceId}`;
		const composio = createComposioClient();

		if (action === "status") {
			// Get connection status for all available apps
			const connectedApps = await getConnectedApps(composio, userId);

			return NextResponse.json({
				success: true,
				availableApps: Object.values(AVAILABLE_APPS),
				appConfigs: APP_CONFIGS,
				connectedApps,
			});
		}

		return NextResponse.json(
			{ error: "Invalid action. Use action=status" },
			{ status: 400 }
		);
	} catch (error) {
		console.error("Composio API error:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch Composio status",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const { action, workspaceId, app, redirectUrl } = await req.json();

		if (!workspaceId || !action) {
			return NextResponse.json(
				{ error: "workspaceId and action are required" },
				{ status: 400 }
			);
		}

		const userId = `workspace_${workspaceId}`;
		const composio = createComposioClient();

		if (action === "connect") {
			if (!app || !Object.values(AVAILABLE_APPS).includes(app)) {
				return NextResponse.json(
					{
						error: `Invalid app. Must be one of: ${Object.values(AVAILABLE_APPS).join(", ")}`,
					},
					{ status: 400 }
				);
			}

			const result = await initiateAppConnection(
				composio,
				userId,
				app as AvailableApp,
				redirectUrl
			);

			if (result.success) {
				return NextResponse.json({
					success: true,
					app,
					redirectUrl: result.redirectUrl,
					connectionId: result.connectionId,
					message: `Redirect to ${app} for authorization`,
				});
			} else {
				return NextResponse.json({ error: result.error }, { status: 400 });
			}
		}

		return NextResponse.json(
			{ error: "Invalid action. Use action=connect" },
			{ status: 400 }
		);
	} catch (error) {
		console.error("Composio API error:", error);
		return NextResponse.json(
			{
				error: "Failed to process Composio request",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
