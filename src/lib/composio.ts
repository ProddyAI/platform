import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
	throw new Error("OPENAI_API_KEY is required");
}

const openaiTimeoutMs = process.env.OPENAI_TIMEOUT_MS
	? parseInt(process.env.OPENAI_TIMEOUT_MS, 10)
	: 30000;

export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
	timeout: openaiTimeoutMs,
});

if (!process.env.COMPOSIO_API_KEY) {
	throw new Error("COMPOSIO_API_KEY is required");
}

export const composio = new Composio({
	apiKey: process.env.COMPOSIO_API_KEY,
	provider: new OpenAIProvider(),
});

export default composio;

export function initializeComposio() {
	if (!process.env.COMPOSIO_API_KEY) {
		throw new Error("COMPOSIO_API_KEY is required");
	}

	const composioInstance = composio;

	const apiClient = {
		async createConnection(userId: string, appName: string) {
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
				throw new Error(
					`Auth config ID not found for ${appName}. Please set ${envVarName}`
				);
			}

			const connection = await composioInstance.connectedAccounts?.initiate?.(
				userId,
				authConfigId,
				{
					allowMultiple: true,
				}
			);

			if (!connection) {
				throw new Error("Failed to create connection");
			}

			const { cleanupOldConnections } = await import("./composio-config");
			const connectionId =
				(connection as any).id || (connection as any).connectionId;
			if (connectionId) {
				cleanupOldConnections(
					composioInstance,
					userId,
					authConfigId,
					connectionId
				).catch(() => {});
			}

			return {
				redirectUrl:
					(connection as any).redirectUrl || (connection as any).authUrl,
				connectionId:
					(connection as any).id || (connection as any).connectionId,
				id: (connection as any).id || (connection as any).connectionId,
			};
		},

		async getConnections(userId: string) {
			return (
				(await composioInstance.connectedAccounts?.list?.({
					userIds: [userId],
				})) ||
				(await (composioInstance as any).connections?.list?.({
					entityId: userId,
				}))
			);
		},

		async getConnectionStatus(connectionId: string) {
			return (
				(await composioInstance.connectedAccounts?.get?.(connectionId)) ||
				(await (composioInstance as any).connections?.get?.(connectionId))
			);
		},

		async getTools(entityId: string, appNames: string[]) {
			try {
				const tools = await composioInstance.tools.get(entityId, {
					appNames: appNames,
				} as any);

				return { items: Array.isArray(tools) ? tools : [tools] };
			} catch {
				return { items: [] };
			}
		},

		async deleteConnection(connectionId: string) {
			return await (composioInstance as any).connectedAccounts?.delete?.(
				connectionId
			);
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
}
