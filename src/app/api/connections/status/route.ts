import { type NextRequest, NextResponse } from "next/server";
import {
	type AvailableApp,
	createComposioClient,
	getAllToolsForApps,
	getAnyConnectedApps,
} from "@/lib/composio-config";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const workspaceId = searchParams.get("workspaceId");
		const memberId = searchParams.get("memberId");

		if (!workspaceId) {
			return NextResponse.json(
				{ error: "workspaceId required" },
				{ status: 400 }
			);
		}

		const composio = createComposioClient();

		const entityId = memberId
			? `member_${memberId}`
			: `workspace_${workspaceId}`;

		const connectedApps = await getAnyConnectedApps(
			composio,
			workspaceId,
			entityId
		);

		let totalTools = 0;
		const connectedAppNames = connectedApps
			.filter((app) => app.connected)
			.map((app) => app.app) as AvailableApp[];

		if (connectedAppNames.length > 0) {
			try {
				const allTools = await getAllToolsForApps(
					composio,
					entityId,
					connectedAppNames,
					true
				);
				totalTools = allTools.length;
			} catch (error) {
				console.warn("[Connections Status] Failed to get tool count:", error);
				totalTools = 0;
			}
		}

		return NextResponse.json({
			success: true,
			connected: connectedApps.filter((app) => app.connected),
			totalTools,
			workspaceId,
			memberId,
			entityId,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("[Connections Status] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				connected: [],
				totalTools: 0,
			},
			{ status: 500 }
		);
	}
}
