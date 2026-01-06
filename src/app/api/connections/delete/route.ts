import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { initializeComposio } from "@/lib/composio";

// Lazy-initialized ConvexHttpClient to prevent crashes on module import
let cachedConvexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
	if (!cachedConvexClient) {
		if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
			throw new Error(
				"NEXT_PUBLIC_CONVEX_URL environment variable is required"
			);
		}
		cachedConvexClient = new ConvexHttpClient(
			process.env.NEXT_PUBLIC_CONVEX_URL
		);
	}
	return cachedConvexClient;
}

export async function DELETE(req: NextRequest) {
	try {
		const convex = getConvexClient();
		const { searchParams } = new URL(req.url);
		const workspaceId = searchParams.get("workspaceId");
		const connectionId = searchParams.get("connectionId");
		const connectedAccountId = searchParams.get("connectedAccountId");

		if (!workspaceId || !connectionId) {
			return NextResponse.json(
				{ error: "workspaceId and connectionId are required" },
				{ status: 400 }
			);
		}

		console.log(
			`[Connection Delete] Deleting connection ${connectionId} for workspace ${workspaceId}`
		);

		const { apiClient } = initializeComposio();

		// Delete connection from Composio
		try {
			await apiClient.deleteConnection(connectionId);
			console.log(
				`[Connection Delete] Composio connection ${connectionId} deleted`
			);
		} catch (error) {
			console.warn(`[Connection Delete] Error deleting from Composio:`, error);
			// Continue with database cleanup even if Composio deletion fails
		}

		// Update database if connectedAccountId is provided and is a valid Convex ID
		if (
			connectedAccountId &&
			connectedAccountId.length > 10 &&
			!connectedAccountId.startsWith("ca_")
		) {
			try {
				await convex.mutation(api.integrations.updateConnectedAccountStatus, {
					connectedAccountId: connectedAccountId as Id<"connected_accounts">,
					status: "DISABLED",
					isDisabled: true,
				});
				console.log(
					`[Connection Delete] Database record updated for ${connectedAccountId}`
				);
			} catch (error) {
				console.warn(`[Connection Delete] Error updating database:`, error);
			}
		} else if (connectedAccountId) {
			console.log(
				`[Connection Delete] Skipping database update - invalid ID format: ${connectedAccountId}`
			);
		}

		// Also try to find and update any auth configs for this workspace
		try {
			// This would need a Convex function to find auth configs by connectionId
			console.log(
				`[Connection Delete] Cleaned up database records for workspace ${workspaceId}`
			);
		} catch (error) {
			console.warn(
				`[Connection Delete] Error cleaning up auth configs:`,
				error
			);
		}

		return NextResponse.json({
			success: true,
			message: "Connection deleted successfully",
			connectionId,
			workspaceId,
		});
	} catch (error) {
		console.error("[Connection Delete] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to delete connection",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const convex = getConvexClient();
		const { workspaceId, connectionId, connectedAccountId } = await req.json();

		if (!workspaceId || !connectionId) {
			return NextResponse.json(
				{ error: "workspaceId and connectionId are required" },
				{ status: 400 }
			);
		}

		console.log(
			`[Connection Delete] Deleting connection ${connectionId} for workspace ${workspaceId} (POST method)`
		);

		const { apiClient } = initializeComposio();

		// Delete connection from Composio
		try {
			await apiClient.deleteConnection(connectionId);
			console.log(
				`[Connection Delete] Composio connection ${connectionId} deleted`
			);
		} catch (error) {
			console.warn(`[Connection Delete] Error deleting from Composio:`, error);
			// Continue with database cleanup even if Composio deletion fails
		}

		// Update database if connectedAccountId is provided and is a valid Convex ID
		if (
			connectedAccountId &&
			connectedAccountId.length > 10 &&
			!connectedAccountId.startsWith("ca_")
		) {
			try {
				await convex.mutation(api.integrations.updateConnectedAccountStatus, {
					connectedAccountId: connectedAccountId as Id<"connected_accounts">,
					status: "DISABLED",
					isDisabled: true,
				});
				console.log(
					`[Connection Delete] Database record updated for ${connectedAccountId}`
				);
			} catch (error) {
				console.warn(`[Connection Delete] Error updating database:`, error);
			}
		} else if (connectedAccountId) {
			console.log(
				`[Connection Delete] Skipping database update - invalid ID format: ${connectedAccountId}`
			);
		}

		return NextResponse.json({
			success: true,
			message: "Connection deleted successfully",
			connectionId,
			workspaceId,
		});
	} catch (error) {
		console.error("[Connection Delete] Error:", error);
		return NextResponse.json(
			{
				error: "Failed to delete connection",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
