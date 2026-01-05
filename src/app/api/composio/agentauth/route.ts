import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { composio, initializeComposio } from "@/lib/composio";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Validate composioAuthConfigId format
const validateAuthConfigFormat = (composioAuthConfigId: string): boolean => {
  // Accept any valid UUID or identifier format from Composio API
  return Boolean(composioAuthConfigId && composioAuthConfigId.length > 0);
};

// Unified POST endpoint for authorization and completion
export async function POST(req: NextRequest) {
  try {
    console.log("[AgentAuth] POST request received");
    const body = await req.json();
    console.log("[AgentAuth] Request body:", body);

    const { action, userId, toolkit, workspaceId, memberId } = body;

    if (!userId || !toolkit || !workspaceId) {
      console.log("[AgentAuth] Missing required fields:", {
        userId,
        toolkit,
        workspaceId,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { apiClient } = initializeComposio();

    if (action === "authorize") {
			// Verify ownership: ensure the authenticated user has permission to act on this memberId
			if (!memberId) {
				console.error("[AgentAuth] Missing memberId for authorization");
				return NextResponse.json(
					{ error: "Missing memberId" },
					{ status: 400 },
				);
			}

			// Verify authentication and that the authenticated user owns the provided memberId
			if (!isAuthenticatedNextjs()) {
				return NextResponse.json(
					{ error: "Authentication required" },
					{ status: 401 },
				);
			}

			// Get the authenticated user's information
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			}

			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return NextResponse.json(
					{ error: "User not found" },
					{ status: 404 },
				);
			}

			// Get the member for this workspace and verify ownership
			const member = await convex.query(api.members._getMemberById, {
				memberId: memberId as Id<"members">,
			});

			if (!member) {
				return NextResponse.json(
					{ error: "Member not found" },
					{ status: 404 },
				);
			}

			if (member.userId !== currentUser._id) {
				return NextResponse.json(
					{ error: "Unauthorized: Cannot authorize connection for another user's member" },
					{ status: 403 },
				);
			}

      const entityId = `member_${memberId}`;
      console.log(
        `[AgentAuth] Authorizing member ${memberId} (entityId: ${entityId}) for ${toolkit}`,
      );

      try {
        // Step 1: Create entity and initiate connection using the API client
        const connection = await apiClient.createConnection(entityId, toolkit);

        // The API returns a redirectUrl for OAuth
        const redirectUrl = connection.redirectUrl;

        if (!redirectUrl) {
          console.error("No redirect URL received from Composio:", connection);
          return NextResponse.json(
            { error: "No redirect URL received from authorization" },
            { status: 400 },
          );
        }

        // Store auth config in database for tracking
        if (memberId) {
          try {
            // Store the auth config linked to this toolkit (persist the real authConfigId)
            const { APP_CONFIGS } = await import("@/lib/composio-config");
            const appKey = toolkit.toUpperCase() as keyof typeof APP_CONFIGS;
            const toolkitAuthConfigId = APP_CONFIGS[appKey]?.authConfigId;

            // Only store auth config if authConfigId is available
            if (toolkitAuthConfigId) {
              await convex.mutation(api.integrations.storeAuthConfig, {
                workspaceId: workspaceId as Id<"workspaces">,
                memberId: memberId as Id<"members">,
                toolkit: toolkit as any,
                name: `${toolkit.charAt(0).toUpperCase() + toolkit.slice(1)} Config`,
                type: "use_composio_managed_auth",
                composioAuthConfigId: toolkitAuthConfigId,
                isComposioManaged: true,
                createdBy: memberId as Id<"members">,
              });
              console.log(`[AgentAuth] Auth config stored for ${toolkit}`);
            } else {
              console.warn(
                `[AgentAuth] No auth config ID found for ${toolkit}`,
              );
            }
          } catch (error) {
            console.warn("Failed to store auth config:", error);
          }
        }

        return NextResponse.json({
          success: true,
          redirectUrl,
          connectionId: connection.connectionId || connection.id,
          message: `Redirect user to ${toolkit} authorization`,
        });
      } catch (error) {
        console.error("Authorization error:", error);
        return NextResponse.json(
          {
            error: `Failed to authorize toolkit: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 400 },
        );
      }
    }

    if (action === "complete") {
      // Use member-scoped entity ID for user-specific connections
      const entityId = `member_${memberId}`;
      console.log(
        `[AgentAuth] Completing connection for member ${memberId} (entityId: ${entityId}) and ${toolkit}`,
      );

      try {
        // Step 2: Get connections to verify connection using API client
        const connectionsResponse = await apiClient.getConnections(entityId);
        const connectedAccounts = connectionsResponse.items || [];

        // Find the most recent connection for this toolkit
        const normalizedToolkit = String(toolkit ?? "").toLowerCase();
        const connectedAccount =
          connectedAccounts.find((account: any) => {
            // Normalize account fields for comparison
            const appName = String(account.appName ?? "").toLowerCase();
            const integrationId = String(
              account.integrationId ?? "",
            ).toLowerCase();
            const slug = String(account.slug ?? "").toLowerCase();

            // Try to match by appName, integrationId, or slug
            return (
              appName === normalizedToolkit ||
              integrationId === normalizedToolkit ||
              slug === normalizedToolkit
            );
          }) || connectedAccounts[0]; // Fallback to most recent if no exact match

        if (!connectedAccount) {
          return NextResponse.json(
            { error: "No connected account found" },
            { status: 404 },
          );
        }

        // Store connected account in database
        if (memberId) {
          try {
            // Get or create auth config for this toolkit
            let authConfigId;
            try {
              const existingAuthConfig = await convex.query(
                api.integrations.getAuthConfigByToolkit,
                {
                  workspaceId: workspaceId as Id<"workspaces">,
                  toolkit: toolkit as any,
                },
              );
              authConfigId = existingAuthConfig?._id;
            } catch (error) {
              // Auth config doesn't exist, create it
            }

            if (!authConfigId) {
              authConfigId = await convex.mutation(
                api.integrations.storeAuthConfig,
                {
                  workspaceId: workspaceId as Id<"workspaces">,
                  memberId: memberId as Id<"members">,
                  toolkit: toolkit as any,
                  name: `${toolkit.charAt(0).toUpperCase() + toolkit.slice(1)} Config`,
                  type: "use_composio_managed_auth",
                  composioAuthConfigId: connectedAccount.id,
                  isComposioManaged: true,
                  createdBy: memberId as Id<"members">,
                },
              );
            }

            // Store connected account
            // Use member-scoped entity ID for user-specific connections
            await convex.mutation(api.integrations.storeConnectedAccount, {
              workspaceId: workspaceId as Id<"workspaces">,
              memberId: memberId as Id<"members">,
              authConfigId: authConfigId,
              userId: entityId,
              composioAccountId: connectedAccount.id,
              toolkit: toolkit as any, // Toolkit type validation
              status: "ACTIVE",
              metadata: connectedAccount,
              connectedBy: memberId as Id<"members">,
            });

            console.log(`[AgentAuth] Connected account stored for ${toolkit}`);
          } catch (error) {
            console.warn("Failed to store connected account:", error);
          }
        }

        return NextResponse.json({
          success: true,
          connectedAccount,
          message: `${toolkit} connected successfully`,
        });
      } catch (error) {
        console.error("Connection completion error:", error);
        return NextResponse.json(
          {
            error: `Failed to complete connection: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[AgentAuth] Error:", error);
    return NextResponse.json(
      { error: "AgentAuth operation failed" },
      { status: 500 },
    );
  }
}

// Get auth configs, connected accounts, tools, or check status (unified GET endpoint)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const workspaceId = searchParams.get("workspaceId");
    const userId = searchParams.get("userId");
    const toolkit = searchParams.get("toolkit");
    const composioAccountId = searchParams.get("composioAccountId");

    const { apiClient } = initializeComposio();

    // Fetch auth configs and connected accounts for workspace
    if (action === "fetch-data" && workspaceId) {
      const memberId = searchParams.get("memberId"); // Optional: filter by member
      console.log(
        `[AgentAuth] Fetching integration data for workspace: ${workspaceId}${memberId ? ` and member: ${memberId}` : ""}`,
      );

      try {
        // Fetch auth configs from database (member-specific if memberId provided)
        const authConfigs = await convex.query(
          api.integrations.getAuthConfigsPublic,
          {
            workspaceId: workspaceId as Id<"workspaces">,
            memberId: memberId ? (memberId as Id<"members">) : undefined,
          },
        );

        // UPDATED: Fetch real connected accounts from Composio using member-specific entity ID
        const { createComposioClient, getAnyConnectedApps } = await import(
          "@/lib/composio-config"
        );
        const composioClient = createComposioClient();
        
        // If memberId is provided, use member-specific entity ID
        const entityId = memberId ? `member_${memberId}` : undefined;
        const realConnectedApps = await getAnyConnectedApps(
          composioClient,
          workspaceId,
          entityId, // Pass member-specific entity ID if available
        );

        // Transform the real connected apps to match the expected format
        const connectedAccounts = realConnectedApps
          .filter((app: any) => app.connected)
          .map((app: any) => ({
            _id: app.connectionId, // Use connection ID as _id
            workspaceId: workspaceId as Id<"workspaces">,
            memberId: memberId ? (memberId as Id<"members">) : undefined,
            authConfigId: `auth_${app.app.toLowerCase()}`, // Generate a fake auth config ID
            userId: app.entityId || (memberId ? `member_${memberId}` : `workspace_${workspaceId}`),
            composioAccountId: app.connectionId,
            toolkit: app.app.toLowerCase(), // Convert to lowercase to match expected format
            status: "ACTIVE", // Since these are filtered as connected
            metadata: {},
            isDisabled: false,
            connectedAt: Date.now(), // Use current time as fallback
            connectedBy: memberId ? (memberId as Id<"members">) : undefined, // Use memberId if available, undefined for system connections
          }));

        console.log(
          `[AgentAuth] Found ${authConfigs.length} auth configs and ${connectedAccounts.length} connected accounts`,
        );

        return NextResponse.json({
          success: true,
          authConfigs,
          connectedAccounts,
        });
      } catch (convexError) {
        console.error("[AgentAuth] Error fetching data:", convexError);
        // Return empty arrays if there's an error
        return NextResponse.json({
          success: true,
          authConfigs: [],
          connectedAccounts: [],
        });
      }
    }

    // Check connection status
    if (action === "check-status" && composioAccountId) {
      console.log(
        `[AgentAuth] Checking status for account: ${composioAccountId}`,
      );

      try {
        const connectedAccount =
          await apiClient.getConnectionStatus(composioAccountId);

        return NextResponse.json({
          connected: true,
          status: connectedAccount.status,
          account: connectedAccount,
        });
      } catch (error) {
        console.error("Status check error:", error);
        return NextResponse.json({
          connected: false,
          status: "NOT_FOUND",
          error: "Account not found",
        });
      }
    }

    // Fetch tools for connected toolkit (Step 2 from documentation)
    if (action === "fetch-tools" && workspaceId && toolkit && userId) {
      // Use member-scoped entity ID for user-specific connections
      const entityId = userId; // userId should be member_{memberId}

      console.log(
        `[AgentAuth] Fetching tools for user ${userId} (entityId: ${entityId}) and toolkit ${toolkit}`,
      );

      try {
        // Use API client to get tools for the workspace entity and toolkit
        const toolsResponse = await apiClient.getTools(entityId, [toolkit]);
        const tools = toolsResponse.items || toolsResponse;

        return NextResponse.json({
          success: true,
          tools: tools,
          toolkit,
          entityId,
        });
      } catch (error) {
        console.error("Tools fetch error:", error);
        return NextResponse.json(
          {
            error: `Failed to fetch tools: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 500 },
        );
      }
    }

    // Default response for testing
    return NextResponse.json(
      {
        error: "Invalid action or missing required parameters",
        receivedAction: action,
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("[AgentAuth] GET Error:", error);
    return NextResponse.json(
      { error: "AgentAuth GET operation failed" },
      { status: 500 },
    );
  }
}

// Disconnect account (unified DELETE endpoint)
export async function DELETE(req: NextRequest) {
  try {
    const { workspaceId, connectedAccountId, composioAccountId, memberId } =
      await req.json();

    console.log(`[AgentAuth DELETE] Request received:`, {
      workspaceId,
      connectedAccountId,
      composioAccountId,
      memberId,
    });

    if (!workspaceId || !composioAccountId || !memberId) {
      console.error(`[AgentAuth DELETE] Missing required fields`);
      return NextResponse.json(
        { error: "workspaceId, composioAccountId, and memberId are required" },
        { status: 400 },
      );
    }

    console.log(`[AgentAuth DELETE] Disconnecting account: ${composioAccountId} for member: ${memberId}`);

    const { apiClient } = initializeComposio();

    // First, disconnect from Composio using the API client with member-specific entity ID
    let composioDeleteSuccess = false;
    try {
      console.log(`[AgentAuth DELETE] Calling Composio API to delete connection: ${composioAccountId}`);
      await apiClient.deleteConnection(composioAccountId);
      composioDeleteSuccess = true;
      console.log(
        `[AgentAuth DELETE] ✓ Successfully deleted from Composio: ${composioAccountId}`,
      );
    } catch (error) {
      console.error("[AgentAuth DELETE] ✗ Error disconnecting from Composio:", error);
      console.error("[AgentAuth DELETE] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue to delete from database even if Composio delete fails
    }

    // Delete the connected account record from database (member-specific)
    if (
      connectedAccountId &&
      connectedAccountId.length > 10 &&
      !connectedAccountId.startsWith("ca_")
    ) {
      try {
        console.log(`[AgentAuth DELETE] Deleting database record: ${connectedAccountId} for member: ${memberId}`);
        await convex.mutation(api.integrations.deleteConnectedAccount, {
          connectedAccountId: connectedAccountId as Id<"connected_accounts">,
          memberId: memberId as Id<"members">,
        });
        console.log(
          `[AgentAuth DELETE] ✓ Database record deleted for ${connectedAccountId}`,
        );
      } catch (error) {
        console.error("[AgentAuth DELETE] ✗ Error deleting database record:", error);
        console.error("[AgentAuth DELETE] Database error details:", {
          message: error instanceof Error ? error.message : String(error),
          connectedAccountId,
          memberId,
        });
        return NextResponse.json(
          { error: "Failed to delete connection from database" },
          { status: 500 },
        );
      }
    } else {
      console.log(
        `[AgentAuth DELETE] No valid database ID provided (got: ${connectedAccountId}), skipping database deletion`,
      );
    }

    console.log(`[AgentAuth DELETE] ✓ Account disconnected successfully (Composio: ${composioDeleteSuccess})`);

    return NextResponse.json({
      success: true,
      message: "Account disconnected successfully",
      composioDeleted: composioDeleteSuccess,
    });
  } catch (error) {
    console.error("[AgentAuth DELETE] Unexpected error:", error);
    console.error("[AgentAuth DELETE] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 },
    );
  }
}
