import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { composio, initializeComposio } from "@/lib/composio";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Validate composioAuthConfigId format
const validateAuthConfigFormat = (composioAuthConfigId: string): boolean => {
  // Accept any valid UUID or identifier format from Composio API
  return Boolean(composioAuthConfigId && composioAuthConfigId.length > 0);
};

/**
 * Handle POST requests to initiate an authorization flow or complete a Composio connection for a member-scoped entity.
 *
 * Expects a JSON body with `action` ("authorize" or "complete"), `userId`, `toolkit`, `workspaceId`, and optional `memberId`.
 *
 * - When `action === "authorize"`: creates a Composio connection for the member (entityId `member_{memberId}`), returns a `redirectUrl` and `connectionId` for OAuth redirection, and conditionally persists an auth config linked to the member if available.
 * - When `action === "complete"`: retrieves the most relevant connected account for the member, returns the `connectedAccount`, and conditionally persists the auth config and connected account record linked to the member.
 *
 * Returns a JSON response that either contains a success payload (`success: true`) with `redirectUrl`/`connectionId` (authorize) or `connectedAccount` (complete), or an `error` message with an appropriate HTTP status (400 for bad requests/authorization failures, 404 when no connected account is found, 500 for internal failures).
 */
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
      // Use member-scoped entity ID for user-specific connections
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

/**
 * Unified GET handler for integration-related operations: fetch auth configs and connected accounts, check connection status, or fetch available tools.
 *
 * @param req - The incoming NextRequest whose query parameters determine the action (`action`) and required identifiers (`workspaceId`, `userId`, `toolkit`, `composioAccountId`, optional `memberId`).
 * @returns A NextResponse JSON payload matching the requested action:
 * - For `action=fetch-data`: `{ success: true, authConfigs: Array, connectedAccounts: Array }`
 * - For `action=check-status`: `{ connected: true|false, status: string, account?: object, error?: string }`
 * - For `action=fetch-tools`: `{ success: true, tools: Array, toolkit: string, entityId: string }`
 * - For invalid requests or failures: `{ error: string, receivedAction?: string }` (with appropriate HTTP status codes).
 */
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
            connectedBy: memberId ? (memberId as Id<"members">) : ("system" as Id<"members">), // Use memberId if available
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

/**
 * Disconnects a connected account: removes the Composio connection and optionally deletes the local connected-account record.
 *
 * Expects a JSON body with `workspaceId`, `composioAccountId`, and `memberId`. If `connectedAccountId` is provided and appears to be a local DB id (longer than 10 characters and not starting with `ca_`), the corresponding connected-account record is deleted for the given `memberId`. The function attempts the Composio deletion first and continues to clean up the database even if the external deletion fails.
 *
 * @param req - Incoming NextRequest containing the JSON payload
 * @returns On success, an object with `success: true`, `message`, and `composioDeleted` (`true` if Composio deletion succeeded, `false` otherwise). Returns a 400 response when required fields are missing, or a 500 response when database deletion or unexpected errors occur.
 */
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