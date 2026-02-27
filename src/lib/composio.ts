import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";

/**
 * Represents a Composio connection with properties that may vary across SDK versions
 */
interface ComposioConnection {
	id?: string;
	connectionId?: string;
	redirectUrl?: string;
	authUrl?: string;
}

/**
 * Result type for connection deletion operations
 */
type ConnectedAccountDeleteResult = boolean | undefined | { success: boolean };

if (!process.env.OPENAI_API_KEY) {
	throw new Error("OPENAI_API_KEY is required");
}

if (!process.env.COMPOSIO_API_KEY) {
	throw new Error("COMPOSIO_API_KEY is required");
}

export const composio = new Composio({
	apiKey: process.env.COMPOSIO_API_KEY,
	provider: new VercelProvider(),
});

export default composio;

/**
 * Helper to resolve the appropriate list method for connected accounts
 * Handles SDK version compatibility between connectedAccounts.list and connections.list
 */
function resolveComposioListMethod(composioInstance: Composio<any>) {
	if (composioInstance.connectedAccounts?.list) {
		return async (userId: string) => {
			return await composioInstance.connectedAccounts.list({
				userIds: [userId],
			});
		};
	}
	// Fallback for older SDK versions
	return async (userId: string) => {
		const connectionsApi = composioInstance as any;
		return await connectionsApi.connections?.list?.({
			entityId: userId,
		});
	};
}

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

			const connection = (await composioInstance.connectedAccounts?.initiate?.(
				userId,
				authConfigId,
				{
					allowMultiple: true,
				}
			)) as ComposioConnection | undefined;

			if (!connection) {
				throw new Error("Failed to create connection");
			}

			const { cleanupOldConnections } = await import("./composio-config");
			const connectionId = connection.id ?? connection.connectionId;
			if (connectionId) {
				cleanupOldConnections(
					composioInstance,
					userId,
					authConfigId,
					connectionId
				).catch(() => {});
			}

			return {
				redirectUrl: connection.redirectUrl ?? connection.authUrl,
				connectionId: connection.id ?? connection.connectionId,
				id: connection.id ?? connection.connectionId,
			};
		},

		async getConnections(userId: string) {
			const listMethod = resolveComposioListMethod(composioInstance);
			return await listMethod(userId);
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
			} catch (err) {
				console.error("Error fetching Composio tools:", err);
				return { items: [] };
			}
		},

		async deleteConnection(
			connectionId: string
		): Promise<ConnectedAccountDeleteResult> {
			// Try modern API first
			const result =
				await composioInstance.connectedAccounts?.delete?.(connectionId);

			// Fallback to legacy API if modern API returns undefined or doesn't exist
			if (result === undefined) {
				const connectionsApi = composioInstance as any;
				return await connectionsApi.connections?.delete?.(connectionId);
			}

			return result;
		},
	};

	return {
		composio: composioInstance,
		apiClient,
	};
}
