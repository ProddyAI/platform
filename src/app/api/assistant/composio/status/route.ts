import { type NextRequest, NextResponse } from "next/server";
import {
	type AvailableApp,
	createComposioClient,
	getAllToolsForApps,
	getAnyConnectedApps,
} from "@/lib/composio-config";

export const dynamic = "force-dynamic";

/**
 * Handle GET requests to report connected apps and total available tools for a workspace or member.
 *
 * Returns a JSON response describing connected apps and the total tool count for the resolved entity (member if `memberId` is provided, otherwise workspace). Requires a `workspaceId` query parameter; an optional `memberId` query parameter narrows the entity to a member. If `workspaceId` is missing the handler responds with HTTP 400 and an error message. On success the payload includes `success`, `connected`, `totalTools`, `workspaceId`, `memberId`, `entityId`, and `timestamp`. On unexpected errors the handler responds with HTTP 500 and a payload containing `success: false`, an `error` message, and empty `connected`/`totalTools`.
 *
 * @returns JSON payload describing connection status and tool count for the requested entity.
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const workspaceId = searchParams.get("workspaceId");
		const memberId = searchParams.get("memberId"); // Optional: get member-specific connections

		if (!workspaceId) {
			return NextResponse.json(
				{ error: "workspaceId required" },
				{ status: 400 }
			);
		}

		const composio = createComposioClient();

		// Use member-specific entity ID if memberId is provided, otherwise workspace-level
		const entityId = memberId
			? `member_${memberId}`
			: `workspace_${workspaceId}`;

		// Get connected apps using member-specific or workspace entity ID
		const connectedApps = await getAnyConnectedApps(
			composio,
			workspaceId,
			entityId
		);

		// Get total tool count if there are connected apps
		let totalTools = 0;
		const connectedAppNames = connectedApps
			.filter((app) => app.connected)
			.map((app) => app.app) as AvailableApp[];

		if (connectedAppNames.length > 0) {
			try {
				// Composio tools response can exceed Next.js data cache limit (2MB).
				// Use a no-store fetch so Next.js doesn't try to cache the large response.
				const originalFetch = globalThis.fetch;
				globalThis.fetch = ((url: RequestInfo | URL, init?: RequestInit) =>
					originalFetch(url, { ...init, cache: "no-store" })) as typeof fetch;
				try {
					const allTools = await getAllToolsForApps(
						composio,
						entityId,
						connectedAppNames,
						true // use cache (in-memory only; fetch cache disabled above)
					);
					totalTools = allTools.length;
				} finally {
					globalThis.fetch = originalFetch;
				}
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
			{ status: 500 }
		);
	}
}
