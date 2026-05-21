import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import {
	buildActionableErrorPayload,
	buildComposioFailureGuidance,
	logRouteError,
	sanitizeErrorMessage,
} from "@/lib/assistant-error-utils";
import { initializeComposio } from "@/lib/composio";

const convexUrl =
	process.env.NEXT_PUBLIC_CONVEX_URL || "https://dummy.convex.cloud";
const convex = new ConvexHttpClient(convexUrl);

// Validate composioAuthConfigId format
const _validateAuthConfigFormat = (composioAuthConfigId: string): boolean => {
	// Accept any valid UUID or identifier format from Composio API
	return Boolean(composioAuthConfigId && composioAuthConfigId.length > 0);
};

/**
 * Verify that the currently authenticated user owns the specified member.
 *
 * @param memberId - The ID of the member to verify ownership for
 * @returns `{ success: true, member }` when the authenticated user owns the member; otherwise `{ success: false, response }` where `response` is a `NextResponse` containing a 401 (unauthenticated), 404 (user or member not found), or 403 (unauthorized) error
 */
async function verifyMemberOwnership(
	memberId: string,
	convexClient: ConvexHttpClient
): Promise<
	| { success: true; member: Doc<"members"> }
	| { success: false; response: NextResponse }
> {
	// Verify authentication
	const isAuthenticated = await isAuthenticatedNextjs();
	if (!isAuthenticated) {
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			),
		};
	}

	// Get the authenticated user's information
	const token = await convexAuthNextjsToken();
	if (token && typeof token === "string") {
		convexClient.setAuth(token);
	}

	const currentUser = await convexClient.query(api.users.current);
	if (!currentUser) {
		return {
			success: false,
			response: NextResponse.json({ error: "User not found" }, { status: 404 }),
		};
	}

	// Get the member for this workspace and verify ownership
	const member = await convexClient.query(api.members.getMemberById, {
		memberId: memberId as Id<"members">,
	});

	if (!member) {
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Member not found" },
				{ status: 404 }
			),
		};
	}

	if (member.userId !== currentUser._id) {
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Unauthorized: Cannot act on another user's member" },
				{ status: 403 }
			),
		};
	}

	return { success: true, member };
}

/**
 * Handle POST requests to initiate toolkit authorization or complete a toolkit connection for a member-scoped entity.
 *
 * Expects a JSON body with fields: `action` ("authorize" or "complete"), `userId`, `toolkit`, `workspaceId`, and (for member-scoped flows) `memberId`. For `authorize` the handler creates a Composio connection and returns a `redirectUrl` and connection identifier; it also attempts to persist a related auth config. For `complete` the handler retrieves the Composio connection, selects the most relevant connected account for the toolkit, and attempts to store a connected account record.
 *
 * @param req - Incoming NextRequest whose JSON body must include `action`, `userId`, `toolkit`, and `workspaceId`. When acting on a specific member, `memberId` is required and must belong to the authenticated user.
 * @returns On success returns a JSON object with `success: true` and either:
 *  - for `authorize`: `redirectUrl`, `connectionId`, and `message`, or
 *  - for `complete`: `connectedAccount` and `message`.
 * On failure returns a JSON error object `{ error: string }` and an appropriate HTTP status.
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		const { action, userId, toolkit, workspaceId, memberId } = body;

		if (!userId || !toolkit || !workspaceId) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const { apiClient } = initializeComposio();

		if (action === "authorize") {
			// Verify ownership: ensure the authenticated user has permission to act on this memberId
			if (!memberId) {
				logRouteError({
					route: "AgentAuth",
					stage: "missing_member_id_authorize",
					error: new Error("Missing memberId for authorization"),
					level: "warn",
				});
				return NextResponse.json(
					{ error: "Missing memberId" },
					{ status: 400 }
				);
			}

			// Verify authentication and member ownership
			const verifyResult = await verifyMemberOwnership(memberId, convex);
			if (!verifyResult.success) {
				return verifyResult.response;
			}

			const entityId = `member_${memberId}`;

			try {
				// Build a callback URL that redirects back to the manage page
				// with query params so the frontend can call `complete`
				const appUrl =
					process.env.NEXT_PUBLIC_APP_URL ||
					process.env.SITE_URL ||
					"https://localhost:3000";
				const callbackUrl = `${appUrl}/workspace/${workspaceId}/manage?connected=true&toolkit=${encodeURIComponent(toolkit)}&memberId=${encodeURIComponent(memberId)}&userId=${encodeURIComponent(entityId)}`;

				// Step 1: Create entity and initiate connection using the API client
				const connection = await apiClient.createConnection(
					entityId,
					toolkit,
					callbackUrl
				);

				// The API returns a redirectUrl for OAuth
				const redirectUrl = connection.redirectUrl;

				if (!redirectUrl) {
					logRouteError({
						route: "AgentAuth",
						stage: "missing_redirect_url",
						error: new Error("No redirect URL from Composio"),
						context: { toolkit },
					});
					return NextResponse.json(
						buildActionableErrorPayload({
							message: "Authorization URL was not returned by Composio.",
							nextStep:
								"Retry authorization. If this continues, verify the toolkit auth configuration.",
							code: "AGENTAUTH_REDIRECT_URL_MISSING",
							recoverable: true,
						}),
						{ status: 400 }
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
								toolkit,
								name: `${toolkit.charAt(0).toUpperCase() + toolkit.slice(1)} Config`,
								type: "use_composio_managed_auth",
								composioAuthConfigId: toolkitAuthConfigId,
								isComposioManaged: true,
								createdBy: memberId as Id<"members">,
							});
						} else {
							logRouteError({
								route: "AgentAuth",
								stage: "auth_config_id_missing",
								error: new Error("No auth config ID found"),
								level: "warn",
								context: { toolkit },
							});
						}
					} catch (error) {
						logRouteError({
							route: "AgentAuth",
							stage: "store_auth_config_failed",
							error,
							level: "warn",
							context: { toolkit, workspaceId, memberId },
						});
					}
				}

				return NextResponse.json({
					success: true,
					redirectUrl,
					connectionId: connection.connectionId || connection.id,
					message: `Redirect user to ${toolkit} authorization`,
				});
			} catch (error) {
				logRouteError({
					route: "AgentAuth",
					stage: "authorization_failed",
					error,
					context: { toolkit, workspaceId, memberId },
				});
				return NextResponse.json(
					buildActionableErrorPayload({
						message: `Failed to authorize ${toolkit}.`,
						nextStep: buildComposioFailureGuidance(),
						code: "AGENTAUTH_AUTHORIZE_FAILED",
						recoverable: true,
						fallbackResponse: sanitizeErrorMessage(
							error instanceof Error ? error.message : "Unknown error"
						),
					}),
					{ status: 400 }
				);
			}
		}

		if (action === "complete") {
			// Verify ownership: ensure the authenticated user has permission to act on this memberId
			if (!memberId) {
				logRouteError({
					route: "AgentAuth",
					stage: "missing_member_id_complete",
					error: new Error("Missing memberId for connection completion"),
					level: "warn",
				});
				return NextResponse.json(
					{ error: "Missing memberId" },
					{ status: 400 }
				);
			}

			// Verify authentication and member ownership
			const verifyResult = await verifyMemberOwnership(memberId, convex);
			if (!verifyResult.success) {
				return verifyResult.response;
			}

			// Use member-scoped entity ID for user-specific connections
			const entityId = `member_${memberId}`;

			try {
				// Step 2: Get connections to verify connection using API client
				const connectionsResponse = await apiClient.getConnections(entityId);
				const connectedAccounts = Array.isArray(connectionsResponse)
					? connectionsResponse
					: Array.isArray((connectionsResponse as { items?: unknown }).items)
						? (connectionsResponse as { items: Array<Record<string, unknown>> })
								.items
						: [];

				// Find the most recent connection for this toolkit
				const normalizedToolkit = String(toolkit ?? "").toLowerCase();
				type ComposioConnectionRecord = {
					id?: string;
					connectionId?: string;
					appName?: string;
					integrationId?: string;
					slug?: string;
				};
				const connectedAccount =
					connectedAccounts.find((account: Record<string, unknown>) => {
						// Normalize account fields for comparison
						const appName = String(account.appName ?? "").toLowerCase();
						const integrationId = String(
							account.integrationId ?? ""
						).toLowerCase();
						const slug = String(account.slug ?? "").toLowerCase();

						// Try to match by appName, integrationId, or slug
						return (
							appName === normalizedToolkit ||
							integrationId === normalizedToolkit ||
							slug === normalizedToolkit
						);
					}) ?? connectedAccounts[0]; // Fallback to most recent if no exact match
				const resolvedConnection = connectedAccount as
					| ComposioConnectionRecord
					| undefined;
				const composioAccountId =
					resolvedConnection?.id ?? resolvedConnection?.connectionId;

				if (!resolvedConnection || !composioAccountId) {
					return NextResponse.json(
						{ error: "No connected account found" },
						{ status: 404 }
					);
				}

				// Store connected account in database
				if (memberId) {
					try {
						// Get or create auth config for this toolkit
						let authConfigId: Id<"auth_configs"> | undefined;
						try {
							// First try member-scoped lookup, then fall back to workspace-scoped
							let existingAuthConfig = await convex.query(
								api.integrations.getMyAuthConfigByToolkit,
								{
									workspaceId: workspaceId as Id<"workspaces">,
									toolkit,
								}
							);
							if (!existingAuthConfig) {
								existingAuthConfig = await convex.query(
									api.integrations.getAuthConfigByToolkit,
									{
										workspaceId: workspaceId as Id<"workspaces">,
										toolkit,
									}
								);
							}
							authConfigId = existingAuthConfig?._id;
						} catch (_error) {
							// Auth config doesn't exist, create it
						}

						if (!authConfigId) {
							const { APP_CONFIGS } = await import("@/lib/composio-config");
							const appKey = toolkit.toUpperCase() as keyof typeof APP_CONFIGS;
							const toolkitAuthConfigId = APP_CONFIGS[appKey]?.authConfigId;
							if (!toolkitAuthConfigId) {
								return NextResponse.json(
									{
										error: `No auth config ID found for toolkit: ${toolkit}`,
									},
									{ status: 400 }
								);
							}

							authConfigId = await convex.mutation(
								api.integrations.storeAuthConfig,
								{
									workspaceId: workspaceId as Id<"workspaces">,
									memberId: memberId as Id<"members">,
									toolkit,
									name: `${toolkit.charAt(0).toUpperCase() + toolkit.slice(1)} Config`,
									type: "use_composio_managed_auth",
									composioAuthConfigId: toolkitAuthConfigId,
									isComposioManaged: true,
									createdBy: memberId as Id<"members">,
								}
							);
						}

						if (!authConfigId) {
							throw new Error(
								"Failed to resolve auth config id for connected account"
							);
						}

						// Check if a connected account already exists for this member+toolkit
						const existingConnectedAccount = await convex.query(
							api.integrations.getMyConnectedAccountByToolkit,
							{
								workspaceId: workspaceId as Id<"workspaces">,
								toolkit: toolkit as string,
							}
						);

						if (existingConnectedAccount) {
							// Refresh the existing record with the latest Composio identity data.
							await convex.mutation(
								api.integrations.updateConnectedAccountStatus,
								{
									connectedAccountId: existingConnectedAccount._id,
									status: "ACTIVE",
									lastUsed: Date.now(),
									composioAccountId,
									metadata: resolvedConnection,
								}
							);
						} else {
							// Store connected account (new record)
							// Use member-scoped entity ID for user-specific connections
							await convex.mutation(api.integrations.storeConnectedAccount, {
								workspaceId: workspaceId as Id<"workspaces">,
								memberId: memberId as Id<"members">,
								authConfigId,
								userId: entityId,
								composioAccountId,
								toolkit,
								status: "ACTIVE",
								metadata: resolvedConnection,
								connectedBy: memberId as Id<"members">,
							});
						}
					} catch (error) {
						logRouteError({
							route: "AgentAuth",
							stage: "store_connected_account_failed",
							error,
							level: "warn",
							context: { toolkit, workspaceId, memberId },
						});
					}
				}

				return NextResponse.json({
					success: true,
					connectedAccount,
					message: `${toolkit} connected successfully`,
				});
			} catch (error) {
				logRouteError({
					route: "AgentAuth",
					stage: "connection_completion_failed",
					error,
					context: { toolkit, workspaceId, memberId },
				});
				return NextResponse.json(
					buildActionableErrorPayload({
						message: `Failed to complete ${toolkit} connection.`,
						nextStep: buildComposioFailureGuidance(),
						code: "AGENTAUTH_COMPLETE_FAILED",
						recoverable: true,
						fallbackResponse: sanitizeErrorMessage(
							error instanceof Error ? error.message : "Unknown error"
						),
					}),
					{ status: 500 }
				);
			}
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	} catch (error) {
		logRouteError({
			route: "AgentAuth",
			stage: "post_request_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Agent auth request failed.",
				nextStep: buildComposioFailureGuidance(),
				code: "AGENTAUTH_POST_FAILED",
			}),
			{ status: 500 }
		);
	}
}

/**
 * Handle GET requests for fetching auth configs and connected accounts, checking connection status, or retrieving tools.
 *
 * Supports the following query actions via request URL search params:
 * - `action=fetch-data` (requires `workspaceId`, optional `memberId`): returns public auth configs and connected accounts for the workspace (optionally filtered by member).
 * - `action=check-status` (requires `composioAccountId`): returns connection status and account info for the given composio connection ID.
 * - `action=fetch-tools` (requires `workspaceId`, `toolkit`, `userId` where `userId` must be `member_{memberId}`): returns available tools for the specified entity and toolkit.
 *
 * @param req - NextRequest whose URL search params must include `action` and the action-specific params: `workspaceId`, `userId`, `toolkit`, `composioAccountId`, and optional `memberId`.
 * @returns For `fetch-data`: `{ success: true, authConfigs: Array, connectedAccounts: Array }`. For `check-status`: `{ connected: boolean, status: string, account?: object }`. For `fetch-tools`: `{ success: true, tools: Array, toolkit: string, entityId: string }`. For invalid requests or on errors: JSON error objects with appropriate HTTP status codes.
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

			try {
				// Fetch auth configs from database (member-specific if memberId provided)
				const authConfigs = await convex.query(
					api.integrations.getAuthConfigsPublic,
					{
						workspaceId: workspaceId as Id<"workspaces">,
						memberId: memberId ? (memberId as Id<"members">) : undefined,
					}
				);

				// Fetch connected accounts from Convex DB (member-specific, not global Composio API)
				// This is the source of truth — only apps the user explicitly connected appear here
				const connectedAccountsFromDB = await convex.query(
					api.integrations.getConnectedAccountsPublic,
					{
						workspaceId: workspaceId as Id<"workspaces">,
						memberId: memberId ? (memberId as Id<"members">) : undefined,
					}
				);

				return NextResponse.json({
					success: true,
					authConfigs,
					connectedAccounts: connectedAccountsFromDB,
				});
			} catch (convexError) {
				logRouteError({
					route: "AgentAuth",
					stage: "fetch_data_failed",
					error: convexError,
					level: "warn",
					context: { workspaceId },
				});
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
			try {
				const connectedAccount =
					await apiClient.getConnectionStatus(composioAccountId);

				return NextResponse.json({
					connected: true,
					status: connectedAccount.status,
					account: connectedAccount,
				});
			} catch (error) {
				logRouteError({
					route: "AgentAuth",
					stage: "status_check_failed",
					error,
					level: "warn",
					context: { composioAccountId },
				});
				return NextResponse.json({
					connected: false,
					status: "NOT_FOUND",
					error: "Account not found",
				});
			}
		}

		// Fetch tools for connected toolkit (Step 2 from documentation)
		if (action === "fetch-tools" && workspaceId && toolkit && userId) {
			// Validate userId format (should be member_{memberId})
			const memberIdPattern = /^member_[A-Za-z0-9-_]+$/;
			if (!memberIdPattern.test(userId)) {
				logRouteError({
					route: "AgentAuth",
					stage: "invalid_user_id_format",
					error: new Error("Invalid userId format"),
					level: "warn",
					context: { userId },
				});
				return NextResponse.json(
					{
						error: "Invalid userId format. Expected format: member_{memberId}",
					},
					{ status: 400 }
				);
			}

			// Use member-scoped entity ID for user-specific connections
			const entityId = userId; // userId should be member_{memberId}

			try {
				// Use API client to get tools for the workspace entity and toolkit
				const toolsResponse = await apiClient.getTools(entityId, [toolkit]);
				const tools = toolsResponse.items || toolsResponse;

				return NextResponse.json({
					success: true,
					tools,
					toolkit,
					entityId,
				});
			} catch (error) {
				logRouteError({
					route: "AgentAuth",
					stage: "fetch_tools_failed",
					error,
					context: { toolkit, workspaceId, userId },
				});
				return NextResponse.json(
					buildActionableErrorPayload({
						message: `Failed to fetch tools for ${toolkit}.`,
						nextStep: buildComposioFailureGuidance(),
						code: "AGENTAUTH_FETCH_TOOLS_FAILED",
						recoverable: true,
						fallbackResponse: sanitizeErrorMessage(
							error instanceof Error ? error.message : "Unknown error"
						),
					}),
					{ status: 500 }
				);
			}
		}

		// Default response for testing
		return NextResponse.json(
			{
				error: "Invalid action or missing required parameters",
				receivedAction: action,
			},
			{ status: 400 }
		);
	} catch (error) {
		logRouteError({
			route: "AgentAuth",
			stage: "get_request_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Agent auth query failed.",
				nextStep:
					"Retry the request and confirm all required query parameters.",
				code: "AGENTAUTH_GET_FAILED",
			}),
			{ status: 500 }
		);
	}
}

/**
 * Handle DELETE requests to disconnect a Composio-connected account and remove its corresponding local record.
 *
 * Expects a JSON body with `workspaceId`, `composioAccountId`, and `memberId` (required) and `connectedAccountId` (optional).
 * Verifies that the requester owns the specified member; if verification fails, returns the verification response.
 * Attempts to delete the connection from Composio (best-effort) and then deletes the local connected account record when
 * `connectedAccountId` appears to be a stored database ID. Continues with database cleanup even if Composio deletion fails.
 *
 * @returns A JSON NextResponse; on success `{ success: true, message: "Account disconnected successfully", composioDeleted: boolean }`.
 *          On error returns a JSON error object with an appropriate HTTP status (e.g., 400 for missing params, 500 for server errors,
 *          or the response produced by the member ownership verification).
 */
export async function DELETE(req: NextRequest) {
	try {
		const { workspaceId, connectedAccountId, composioAccountId, memberId } =
			await req.json();

		if (!workspaceId || !composioAccountId || !memberId) {
			return NextResponse.json(
				{ error: "workspaceId, composioAccountId, and memberId are required" },
				{ status: 400 }
			);
		}

		// Verify authentication and member ownership
		const verifyResult = await verifyMemberOwnership(memberId, convex);
		if (!verifyResult.success) {
			return verifyResult.response;
		}

		const { apiClient } = initializeComposio();

		// First, disconnect from Composio using the API client with member-specific entity ID
		let composioDeleteSuccess = false;
		try {
			await apiClient.deleteConnection(composioAccountId);
			composioDeleteSuccess = true;
		} catch (error) {
			logRouteError({
				route: "AgentAuth DELETE",
				stage: "composio_disconnect_failed",
				error,
				context: { composioAccountId, memberId, workspaceId },
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
				await convex.mutation(api.integrations.deleteConnectedAccount, {
					connectedAccountId: connectedAccountId as Id<"connected_accounts">,
					memberId: memberId as Id<"members">,
				});
			} catch (error) {
				logRouteError({
					route: "AgentAuth DELETE",
					stage: "database_disconnect_failed",
					error,
					context: { connectedAccountId, memberId, workspaceId },
				});
				return NextResponse.json(
					buildActionableErrorPayload({
						message: "Failed to remove local connection record.",
						nextStep:
							"Retry disconnect. If this continues, refresh the integrations page and retry.",
						code: "AGENTAUTH_DB_DISCONNECT_FAILED",
					}),
					{ status: 500 }
				);
			}
		}

		return NextResponse.json({
			success: true,
			message: "Account disconnected successfully",
			composioDeleted: composioDeleteSuccess,
		});
	} catch (error) {
		logRouteError({
			route: "AgentAuth DELETE",
			stage: "delete_request_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Failed to disconnect account.",
				nextStep: buildComposioFailureGuidance(),
				code: "AGENTAUTH_DELETE_FAILED",
			}),
			{ status: 500 }
		);
	}
}
