// Server-only runtime guard
if (typeof window !== "undefined") {
  throw new Error(
    "composio.ts contains server-only code and cannot be imported in the browser. " +
      "This file uses server credentials that must not be exposed to the client.",
  );
}

import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import OpenAI from "openai";

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY environment variable is required but not set. " +
      "Please configure your OpenAI API key in the environment variables.",
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
      "Please configure your Composio API key in the environment variables.",
  );
}

// Initialize Composio client with OpenAI provider (server-only)
export const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new OpenAIProvider(),
});

export default composio;

// Initialize function that returns both composio instance and API client wrapper
export function initializeComposio() {
  if (!process.env.COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY environment variable is required");
  }

  // Use the shared singleton Composio instance instead of creating a new one
  const composioInstance = composio;

  // Create API client wrapper for common operations
  const apiClient = {
    // Create connection for a user and app
    async createConnection(userId: string, appName: string) {
      try {
        // Import APP_CONFIGS to get auth config ID
        const { APP_CONFIGS } = await import("./composio-config");

        // Convert appName to uppercase to match our config keys
        const appKey = appName.toUpperCase() as keyof typeof APP_CONFIGS;
        const authConfigId = APP_CONFIGS[appKey]?.authConfigId;

        if (!authConfigId) {
          throw new Error(
            `Auth config ID not found for ${appName}. Please check your environment variables. Available apps: ${Object.keys(APP_CONFIGS).join(", ")}`,
          );
        }

        console.log(
          `[Composio API] Creating connection for ${appName} with auth config ID: ${authConfigId}`,
        );

        // Try to initiate connection using auth config ID
        const connection = await (
          composioInstance as any
        ).connectedAccounts?.initiate?.(userId, authConfigId, {
          allowMultiple: true, // Allow multiple connected accounts per user
        });

        if (!connection) {
          throw new Error("Failed to create connection - method not available");
        }

        return {
          redirectUrl: connection.redirectUrl || connection.authUrl,
          connectionId: connection.id || connection.connectionId,
          id: connection.id || connection.connectionId,
        };
      } catch (error) {
        console.error("Error creating connection:", error);
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
            connectionId,
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
      try {
        console.log(`[Composio API] Deleting connection: ${connectionId}`);
        
        // Try different methods to delete the connection
        const result = 
          (await (composioInstance as any).connectedAccounts?.delete?.(connectionId)) ||
          (await (composioInstance as any).connections?.delete?.(connectionId)) ||
          (await (composioInstance as any).connectedAccounts?.remove?.(connectionId));
        
        console.log(`[Composio API] Connection deleted successfully: ${connectionId}`);
        return result;
      } catch (error) {
        console.error("Error deleting connection:", error);
        throw error;
      }
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
  entityId: string,
  actionName: string,
  params: Record<string, unknown>,
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
  entityId: string,
) {
  try {
    // Use the provider's handle_tool_calls method
    const result = await (
      composio.provider as unknown as {
        handleToolCalls: (
          response: unknown,
          entityId: string,
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
  appNames: string[],
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
  message: string,
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
      error,
    );
    throw error;
  }
}
