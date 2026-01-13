// Server-only runtime guard
if (typeof window !== "undefined") {
	throw new Error(
		"composio.ts contains server-only code and cannot be imported in the browser. " +
			"This file uses server credentials that must not be exposed to the client."
	);
}

import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import OpenAI from "openai";

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
	throw new Error(
		"OPENAI_API_KEY environment variable is required but not set. " +
			"Please configure your OpenAI API key in the environment variables."
	);
}

// Configure timeout (default 30 seconds, configurable via env var)
const openaiTimeoutMs = process.env.OPENAI_TIMEOUT_MS
	? parseInt(process.env.OPENAI_TIMEOUT_MS, 10)
	: 30000;

// Initialize OpenAI client (server-only)
export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	timeout: openaiTimeoutMs,
});

// Validate Composio API key
if (!process.env.COMPOSIO_API_KEY) {
	throw new Error(
		"COMPOSIO_API_KEY environment variable is required but not set. " +
			"Please configure your Composio API key in the environment variables."
	);
}

// Initialize Composio client with OpenAI provider (server-only)
export const composio = new Composio({
	apiKey: process.env.COMPOSIO_API_KEY,
	provider: new OpenAIProvider(),
});

export default composio;

/**
 * Initialize and return the shared Composio instance along with a convenience API client for managing connections, tools, and connection status.
 *
 * The returned `apiClient` exposes: `createConnection(userId, appName)`, `getConnections(userId)`, `getConnectionStatus(connectionId)`, `getTools(entityId, appNames)`, and `deleteConnection(connectionId)`.
 *
 * @returns An object containing `composio` (the shared Composio instance) and `apiClient` (a wrapper providing connection and tool management methods)
 */
export function initializeComposio() {
	if (!process.env.COMPOSIO_API_KEY) {
		throw new Error("COMPOSIO_API_KEY environment variable is required");
	}

	// Use the shared singleton Composio instance instead of creating a new one
	const composioInstance = composio;

	/**
	 * Cleans up old connections, keeping only the most recent ACTIVE connection.
	 * Deletes connections in INITIATED, FAILED, EXPIRED status, and older ACTIVE connections.
	 */
	async function cleanupOldConnections(
		userId: string,
		authConfigId: string,
		keepConnectionId?: string
	) {
		try {
			console.log(
				`[Composio] Cleaning up old connections for user ${userId} with auth config ${authConfigId}`
			);

			// List all connections for this user and auth config
			const accounts = await (composioInstance as any).connectedAccounts?.list?.({
				userIds: [userId],
				authConfigIds: [authConfigId],
			});

			const allAccounts = accounts?.items || [];
			console.log(`[Composio] Found ${allAccounts.length} total connections`);

			// Sort by creation date (newest first)
			const sortedAccounts = [...allAccounts].sort(
				(a: any, b: any) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);

			// Determine which connections to delete
			const accountsToDelete = sortedAccounts.filter((acc: any) => {
				// Keep the specified connection ID if provided
				if (keepConnectionId && acc.id === keepConnectionId) {
					console.log(`[Composio] Keeping new connection: ${acc.id}`);
					return false;
				}

				// Delete failed/expired/initiated connections
				if (
					acc.status === "INITIATED" ||
					acc.status === "FAILED" ||
					acc.status === "EXPIRED"
				) {
					return true;
				}

				// Keep only the newest ACTIVE connection (delete older ones)
				if (acc.status === "ACTIVE") {
					const newerActiveExists = sortedAccounts.some(
						(other: any) =>
							other.status === "ACTIVE" &&
							other.id !== acc.id &&
							new Date(other.createdAt).getTime() >
								new Date(acc.createdAt).getTime()
					);
					return newerActiveExists;
				}

				return false;
			});

			console.log(
				`[Composio] Will delete ${accountsToDelete.length} old connections`
			);

			// Delete each old connection
			for (const acc of accountsToDelete) {
				try {
					await (composioInstance as any).connectedAccounts?.delete?.(acc.id);
					console.log(
						`[Composio] Deleted old connection: ${acc.id} (status: ${acc.status})`
					);
				} catch (deleteError) {
					console.error(
						`[Composio] Failed to delete connection ${acc.id}:`,
						deleteError
					);
					// Continue with other deletions even if one fails
				}
			}

			console.log(`[Composio] Cleanup complete`);
		} catch (error) {
			console.error("[Composio] Error during cleanup:", error);
			// Don't fail the connection process if cleanup fails
		}
	}

	// Create API client wrapper for common operations
	const apiClient = {
		// Create connection for a user and app
		async createConnection(userId: string, appName: string) {
			try {
				console.log(
					`[Composio] Creating connection for user ${userId} with app ${appName}`
				);

				// Import APP_CONFIGS to get auth config ID
				const { APP_CONFIGS } = await import("./composio-config");

				// Convert appName to uppercase to match our config keys
				const appKey = appName.toUpperCase() as keyof typeof APP_CONFIGS;
				const appConfig = APP_CONFIGS[appKey];

				if (!appConfig) {
					console.error(
						`[Composio] App config not found for ${appName}. Available apps:`,
						Object.keys(APP_CONFIGS)
					);
					throw new Error(
						`App ${appName} not found in configuration. Available apps: ${Object.keys(APP_CONFIGS).join(", ")}`
					);
				}

				const authConfigId = appConfig.authConfigId;

				if (!authConfigId) {
					const envVarName = `${appKey}_AUTH_CONFIG_ID`;
					console.error(
						`[Composio] Missing auth config ID for ${appName}. Environment variable ${envVarName} is not set.`
					);
					throw new Error(
						`Auth config ID not found for ${appName}. Please set the ${envVarName} environment variable in your production environment. Check your Composio dashboard for the auth config ID.`
					);
				}

				console.log(
					`[Composio] Auth config ID found for ${appName}. Initiating connection...`
				);

			// STEP 1: Allow multiple connections during initiation to prevent errors
			// Try to initiate connection using auth config ID with allowMultiple flag
			const connection = await (
				composioInstance as any
			).connectedAccounts?.initiate?.(userId, authConfigId, {
				allowMultiple: true, // Required to allow new connection even if old ones exist
			});

				if (!connection) {
					console.error(
						`[Composio] Connection initiation failed - no connection object returned`
					);
					throw new Error(
						"Failed to create connection - method not available or returned null"
					);
				}

				console.log(`[Composio] Connection created successfully:`, {
					hasRedirectUrl: !!(connection.redirectUrl || connection.authUrl),
					hasConnectionId: !!(connection.id || connection.connectionId),
				});

				// STEP 2: Clean up old connections asynchronously (non-blocking)
				const connectionId = connection.id || connection.connectionId;
				if (connectionId) {
					cleanupOldConnections(userId, authConfigId, connectionId).catch(
						(error) => {
							console.error(
								"[Composio] Background cleanup failed (non-critical):",
								error
							);
						}
					);
				}

				return {
					redirectUrl: connection.redirectUrl || connection.authUrl,
					connectionId: connection.id || connection.connectionId,
					id: connection.id || connection.connectionId,
				};
			} catch (error) {
				console.error("[Composio] Error creating connection:", error);
				console.error("[Composio] Error details:", {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				});
				throw error;
			}
		},

		// Get connections for a user
		async getConnections(userId: string) {
			try {
				const connections =
					(await (composioInstance as any).connectedAccounts?.list?.({
						userIds: [userId],
					})) ||
					(await (composioInstance as any).connections?.list?.({
						entityId: userId,
					}));

				return connections;
			} catch (error) {
				console.error("Error getting connections:", error);
				throw error;
			}
		},

		// Get connection status
		async getConnectionStatus(connectionId: string) {
			try {
				const connection =
					(await (composioInstance as any).connectedAccounts?.get?.(
						connectionId
					)) ||
					(await (composioInstance as any).connections?.get?.(connectionId));

				return connection;
			} catch (error) {
				console.error("Error getting connection status:", error);
				throw error;
			}
		},

		// Get tools for entity and apps
		async getTools(entityId: string, appNames: string[]) {
			try {
				const tools = await composioInstance.tools.get(entityId, {
					appNames: appNames,
				} as any);

				return { items: Array.isArray(tools) ? tools : [tools] };
			} catch (error) {
				console.error("Error getting tools:", error);
				return { items: [] };
			}
		},

		// Delete connection
		async deleteConnection(connectionId: string) {
			// Try different methods to delete the connection with proper fallback
			let result;
			let lastError;

			// Try first method: connectedAccounts.delete
			try {
				if (
					typeof (composioInstance as any).connectedAccounts?.delete ===
					"function"
				) {
					result = await (composioInstance as any).connectedAccounts.delete(
						connectionId
					);
					if (result !== undefined) {
						return result;
					}
				}
			} catch (error) {
				console.warn(
					"deleteConnection: connectedAccounts.delete failed:",
					error
				);
				lastError = error;
			}

			// Try second method: connections.delete
			try {
				if (
					typeof (composioInstance as any).connections?.delete === "function"
				) {
					result = await (composioInstance as any).connections.delete(
						connectionId
					);
					if (result !== undefined) {
						return result;
					}
				}
			} catch (error) {
				console.warn("deleteConnection: connections.delete failed:", error);
				lastError = error;
			}

			// Try third method: connectedAccounts.remove
			try {
				if (
					typeof (composioInstance as any).connectedAccounts?.remove ===
					"function"
				) {
					result = await (composioInstance as any).connectedAccounts.remove(
						connectionId
					);
					if (result !== undefined) {
						return result;
					}
				}
			} catch (error) {
				console.warn(
					"deleteConnection: connectedAccounts.remove failed:",
					error
				);
				lastError = error;
			}

			// If all methods failed, throw the last error
			if (lastError) {
				console.error("Error deleting connection:", lastError);
				throw lastError;
			}

			// If no methods were available or returned undefined
			return undefined;
		},
	};

	return {
		composio: composioInstance,
		apiClient,
	};
}

// Helper function to get OpenAI-compatible tools for an entity with specific apps
export async function getOpenAITools(entityId: string, appNames: string[]) {
	if (!appNames.length) {
		return [];
	}

	try {
		// Get tools using the correct API according to TypeScript definitions
		const tools = await composio.tools.get(entityId, {
			appNames: appNames,
		} as any);
		return tools;
	} catch (error) {
		console.error("Error fetching Composio OpenAI tools:", error);
		return [];
	}
}

// Helper function to execute tools using Composio
export async function executeComposioAction(
	_entityId: string,
	actionName: string,
	params: Record<string, unknown>
) {
	try {
		const result = await composio.tools.execute(actionName, params);
		return result;
	} catch (error) {
		console.error("Error executing Composio action:", error);
		throw error;
	}
}

// Helper function to handle tool calls from OpenAI response
export async function handleOpenAIToolCalls(
	response: unknown,
	entityId: string
) {
	try {
		// Use the provider's handle_tool_calls method
		const result = await (
			composio.provider as unknown as {
				handleToolCalls: (
					response: unknown,
					entityId: string
				) => Promise<unknown>;
			}
		).handleToolCalls(response, entityId);
		return result;
	} catch (error) {
		console.error("Error handling OpenAI tool calls:", error);
		throw error;
	}
}

// Helper function to get Composio tools for OpenAI function calling format
export async function getComposioToolsForOpenAI(
	entityId: string,
	appNames: string[]
) {
	if (!appNames.length) {
		return [];
	}

	try {
		const tools = await composio.tools.get(entityId, {
			appNames: appNames,
		} as any);
		// Tools from Composio with OpenAI provider are already in the correct format
		return tools;
	} catch (error) {
		console.error("Error fetching Composio tools for OpenAI:", error);
		return [];
	}
}

// Create a simple example function following the documentation pattern
export async function createOpenAICompletion(
	entityId: string,
	appNames: string[],
	message: string
) {
	try {
		// Get tools for the entity
		const tools = await getComposioToolsForOpenAI(entityId, appNames);

		// Create OpenAI completion with tools
		const response = await openaiClient.chat.completions.create({
			model: "gpt-4",
			tools: tools as any,
			messages: [{ role: "user", content: message }],
		});

		// Handle tool calls if any
		if (response.choices[0].message.tool_calls) {
			const result = await handleOpenAIToolCalls(response, entityId);
			return result;
		}

		return response.choices[0].message.content;
	} catch (error) {
		console.error(
			"Error creating OpenAI completion with Composio tools:",
			error
		);
		throw error;
	}
}
