if (typeof window !== "undefined") {
	throw new Error(
		"composio.ts contains server-only code and cannot be imported in the browser. " +
			"This file uses server credentials that must not be exposed to the client."
	);
}

import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
	throw new Error(
		"OPENAI_API_KEY environment variable is required but not set. " +
			"Please configure your OpenAI API key in the environment variables."
	);
}

const openaiTimeoutMs = process.env.OPENAI_TIMEOUT_MS
	? parseInt(process.env.OPENAI_TIMEOUT_MS, 10)
	: 30000;

export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	timeout: openaiTimeoutMs,
});

if (!process.env.COMPOSIO_API_KEY) {
	throw new Error(
		"COMPOSIO_API_KEY environment variable is required but not set. " +
			"Please configure your Composio API key in the environment variables."
	);
}

export const composio = new Composio({
	apiKey: process.env.COMPOSIO_API_KEY,
	provider: new OpenAIProvider(),
});

export default composio;

export function initializeComposio() {
	if (!process.env.COMPOSIO_API_KEY) {
		throw new Error("COMPOSIO_API_KEY environment variable is required");
	}

	const composioInstance = composio;

	const apiClient = {
		async createConnection(userId: string, appName: string) {
			try {
				console.log(
					`[Composio] Creating connection for user ${userId} with app ${appName}`
				);

				const { APP_CONFIGS } = await import("./composio-config");

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

				const connection = await (
					composioInstance as any
				).connectedAccounts?.initiate?.(userId, authConfigId);

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
