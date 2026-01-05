import { NextRequest, NextResponse } from "next/server";
import {
  createComposioClient,
  getAnyConnectedApps,
  getAllToolsForApps,
  type AvailableApp,
} from "@/lib/composio-config";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const memberId = searchParams.get("memberId"); // Optional: get member-specific connections

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId required" },
        { status: 400 },
      );
    }

    const composio = createComposioClient();

    // Use member-specific entity ID if memberId is provided, otherwise workspace-level
    const entityId = memberId ? `member_${memberId}` : `workspace_${workspaceId}`;

    // Get connected apps using member-specific or workspace entity ID
    const connectedApps = await getAnyConnectedApps(composio, workspaceId, entityId);

    // Get total tool count if there are connected apps
    let totalTools = 0;
    const connectedAppNames = connectedApps
      .filter((app) => app.connected)
      .map((app) => app.app) as AvailableApp[];

    if (connectedAppNames.length > 0) {
      try {
        // Get all available tools using the entity ID (member-specific or workspace)
        const allTools = await getAllToolsForApps(
          composio,
          entityId,
          connectedAppNames,
          true, // use cache
        );
        totalTools = allTools.length;
      } catch (error) {
        console.warn("[Connections Status] Failed to get tool count:", error);
        // Don't fail the whole request if tool fetching fails
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
      { status: 500 },
    );
  }
}
