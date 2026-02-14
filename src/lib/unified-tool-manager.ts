import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { ConvexHttpClient } from "convex/browser";
import { tool } from "ai";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

/**
 * Internal Convex tool definition
 */
interface ConvexToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, any>;
		required?: string[];
	};
	handlerType: "query" | "action" | "mutation";
	handler: any; // Convex API reference
	contextParams?: {
		needsWorkspaceId?: boolean;
		needsUserId?: boolean;
	};
	externalApp?: string;
}

/**
 * Convert JSON Schema parameters to Zod schema
 */
function jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
	const shape: Record<string, z.ZodTypeAny> = {};
	const properties = jsonSchema?.properties ?? {};
	const propertyEntries = Object.entries(properties);

	if (propertyEntries.length === 0) {
		return z.object({
			_unused: z
				.string()
				.optional()
				.describe("No parameters required."),
		});
	}

	if (propertyEntries.length > 0) {
		for (const [key, prop] of propertyEntries as any) {
			let zodType: z.ZodTypeAny;

			switch (prop.type) {
				case "string":
					zodType = z.string();
					break;
				case "number":
					zodType = z.number();
					break;
				case "boolean":
					zodType = z.boolean();
					break;
				case "array":
					zodType = z.array(z.any());
					break;
				case "object":
					zodType = z.record(z.any());
					break;
				default:
					zodType = z.any();
			}

			if (prop.description) {
				zodType = zodType.describe(prop.description);
			}

			// Make optional if not in required array
			if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
				zodType = zodType.optional();
			}

			shape[key] = zodType;
		}
	}

	return z.object(shape);
}

/**
 * Internal Convex tool definitions
 */
export const INTERNAL_TOOL_DEFINITIONS: ConvexToolDefinition[] = [
	{
		name: "getMyCalendarToday",
		description:
			"Get the user's calendar events for today. Returns all meetings and events scheduled for the current day.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyCalendarToday,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyCalendarTomorrow",
		description:
			"Get the user's calendar events for tomorrow. Returns all meetings and events scheduled for the next day.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyCalendarTomorrow,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyCalendarNextWeek",
		description:
			"Get the user's calendar events for next week (7-14 days from now).",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyCalendarNextWeek,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyTasksToday",
		description:
			"Get tasks assigned to the user that are due today.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyTasksToday,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyTasksTomorrow",
		description:
			"Get tasks assigned to the user that are due tomorrow.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyTasksTomorrow,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyAllTasks",
		description:
			"Get all tasks assigned to the user. Can optionally include completed tasks.",
		parameters: {
			type: "object" as const,
			properties: {
				includeCompleted: {
					type: "boolean",
					description: "Whether to include completed tasks (default: false)",
				},
			},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyAllTasks,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "searchChannels",
		description:
			"Search for channels in the workspace by name. Returns matching channels with their IDs.",
		parameters: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description: "Channel name to search for (without # symbol). Leave empty to get all channels.",
				},
			},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.searchChannels,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "getChannelSummary",
		description:
			"Get a summary of recent activity in a channel. Useful for catching up on channel discussions.",
		parameters: {
			type: "object" as const,
			properties: {
				channelId: {
					type: "string",
					description: "The ID of the channel to summarize. Use searchChannels first to get the channel ID.",
				},
			},
			required: ["channelId"],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getChannelSummary,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "getWorkspaceOverview",
		description:
			"Get a comprehensive overview of the workspace including recent activity, tasks, and meetings.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getWorkspaceOverview,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyCards",
		description:
			"Get cards assigned to the user across all boards in the workspace.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyCards,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "semanticSearch",
		description:
			"Perform semantic search across workspace content (messages, notes, tasks, etc.). Use for finding relevant information.",
		parameters: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description: "The search query in natural language",
				},
			},
			required: ["query"],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.semanticSearch,
		contextParams: { needsWorkspaceId: true },
	},
];

/**
 * Unified tool manager that combines internal Convex tools and external Composio tools
 */
export class UnifiedToolManager {
	private convex: ConvexHttpClient;
	private composio: Composio<any> | null = null;
	private workspaceId: Id<"workspaces">;
	private userId?: Id<"users">;
	private workspaceEntityId?: string;

	constructor(config: {
		convex: ConvexHttpClient;
		composio?: Composio<any>;
		workspaceId: Id<"workspaces">;
		userId?: Id<"users">;
		workspaceEntityId?: string;
	}) {
		this.convex = config.convex;
		this.composio = config.composio || null;
		this.workspaceId = config.workspaceId;
		this.userId = config.userId;
		this.workspaceEntityId = config.workspaceEntityId;
	}

	/**
	 * Get internal Convex tools as AI SDK tools
	 */
	async getInternalTools(): Promise<Record<string, any>> {
		const tools: Record<string, any> = {};

		for (const toolDef of INTERNAL_TOOL_DEFINITIONS) {
			const zodSchema = jsonSchemaToZod(toolDef.parameters);

			tools[toolDef.name] = tool({
				description: toolDef.description,
				parameters: zodSchema,
				execute: async (params: any) => {
					try {
						// Inject context parameters
						const fullArgs: Record<string, any> = { ...params };

						if (toolDef.contextParams?.needsWorkspaceId) {
							fullArgs.workspaceId = this.workspaceId;
						}
						if (toolDef.contextParams?.needsUserId) {
							fullArgs.userId = this.userId;
						}

						let result: unknown;
						if (toolDef.handlerType === "query") {
							result = await this.convex.query(toolDef.handler, fullArgs);
						} else if (toolDef.handlerType === "mutation") {
							result = await this.convex.mutation(toolDef.handler, fullArgs);
						} else {
							result = await this.convex.action(toolDef.handler, fullArgs);
						}

						return result;
					} catch (error: any) {
						console.error(`Error executing internal tool ${toolDef.name}:`, error);
						return {
							success: false,
							error: error.message || "Tool execution failed",
						};
					}
				},
			} as any);
		}

		return tools;
	}

	/**
	 * Get external Composio tools as AI SDK tools
	 */
	async getExternalTools(requestedApps: string[]): Promise<Record<string, any>> {
		if (!this.composio || !this.workspaceEntityId) {
			return {};
		}

		try {
			const tools = await (this.composio as any).getTools({
				apps: requestedApps,
			}, this.workspaceEntityId);

			return tools;
		} catch (error) {
			console.error("Failed to fetch Composio tools:", error);
			return {};
		}
	}

	/**
	 * Get all tools (internal + external) as AI SDK tools
	 */
	async getAllTools(options: {
		includeInternal?: boolean;
		includeExternal?: boolean;
		requestedApps?: string[];
	} = {}): Promise<Record<string, any>> {
		const {
			includeInternal = true,
			includeExternal = true,
			requestedApps = [],
		} = options;

		const allTools: Record<string, any> = {};

		// Get internal tools
		if (includeInternal) {
			const internalTools = await this.getInternalTools();
			Object.assign(allTools, internalTools);
		}

		// Get external tools
		if (includeExternal && requestedApps.length > 0) {
			const externalTools = await this.getExternalTools(requestedApps);
			Object.assign(allTools, externalTools);
		}

		return allTools;
	}
}
