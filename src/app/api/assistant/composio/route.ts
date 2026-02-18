import { type NextRequest, NextResponse } from "next/server";
import {
	buildActionableErrorPayload,
	logRouteError,
	sanitizeErrorMessage,
} from "@/lib/assistant-error-utils";
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
		logRouteError({
			route: "Composio API",
			stage: "status_fetch_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Failed to fetch Composio status.",
				nextStep:
					"Confirm the integration is configured and retry the status request.",
				code: "COMPOSIO_STATUS_FETCH_FAILED",
			}),
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
				return NextResponse.json(
					buildActionableErrorPayload({
						message: `Could not start ${app} authorization.`,
						nextStep: "Verify your app configuration and retry connection.",
						code: "COMPOSIO_CONNECT_FAILED",
						recoverable: true,
						fallbackResponse: sanitizeErrorMessage(
							result.error || "Authorization could not be started."
						),
					}),
					{ status: 400 }
				);
			}
		}

		return NextResponse.json(
			{ error: "Invalid action. Use action=connect" },
			{ status: 400 }
		);
	} catch (error) {
		logRouteError({
			route: "Composio API",
			stage: "connect_request_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Failed to process Composio request.",
				nextStep:
					"Retry the request. If this continues, check Composio API key and auth config settings.",
				code: "COMPOSIO_REQUEST_FAILED",
			}),
			{ status: 500 }
		);
	}
}
