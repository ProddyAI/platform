import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import OpenAI from "openai";
import {
	type AssistantExternalApp,
	buildAssistantResponseMetadata,
	buildAssistantSystemPrompt,
	classifyAssistantQuery,
} from "../src/lib/assistant-orchestration";
import { api, components } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

type ToolHandlerType = "query" | "mutation" | "action";

type ToolDefinition = {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, { type: string; description?: string }>;
		required?: string[];
	};
	handlerType: ToolHandlerType;
	handler: unknown;
	contextParams?: {
		needsWorkspaceId?: boolean;
		needsUserId?: boolean;
	};
	externalApp?: AssistantExternalApp;
};

// Define tools that AI can use (handles are created inside the action)
const TOOL_DEFINITIONS: ToolDefinition[] = [
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
			"Get the user's calendar events for next week (7-14 days from now). Returns all meetings scheduled in the upcoming week.",
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
			"Get tasks assigned to the user that are due today. Returns incomplete tasks with today's due date.",
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
			"Get tasks assigned to the user that are due tomorrow. Returns incomplete tasks with tomorrow's due date.",
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
			"Get all tasks assigned to the user. Can optionally include completed tasks. Use this for general task queries like 'what are my tasks' or 'show all my work'.",
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
			"Search for channels in the workspace by name. Returns matching channels with their IDs. ALWAYS use this first when the user mentions a channel by name (e.g., '#general', '#engineering') to get the channel ID before calling other channel tools.",
		parameters: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description:
						"Channel name to search for (without # symbol). Leave empty to get all channels.",
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
			"Get a summary of recent messages in a specific channel. Requires a channel ID - if user provides a channel name (e.g., '#general'), FIRST call searchChannels to find the ID, then use that ID here.",
		parameters: {
			type: "object" as const,
			properties: {
				channelId: {
					type: "string",
					description:
						"Channel ID (get this from searchChannels if you only have the channel name)",
				},
				limit: {
					type: "number",
					description: "Max number of messages to analyze (default: 40)",
				},
			},
			required: ["channelId"],
		},
		handlerType: "action" as const,
		handler: api.assistantTools.getChannelSummary,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "getWorkspaceOverview",
		description:
			"Get high-level overview statistics for the workspace. Returns counts of channels, members, tasks, and upcoming events.",
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
			"Get all cards (from Kanban boards) assigned to the user across all channels. Returns card details including board/list location.",
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
			"Perform semantic search across all workspace content (messages, notes, tasks, cards). Use this for general questions that don't fit other tools.",
		parameters: {
			type: "object" as const,
			properties: {
				query: { type: "string", description: "Search query" },
				limit: {
					type: "number",
					description: "Max results to return (default: 10)",
				},
			},
			required: ["query"],
		},
		handlerType: "action" as const,
		handler: api.assistantTools.semanticSearch,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "runGmailTool",
		description:
			"Use Gmail to send emails, read inbox messages, or search email threads. Provide a clear instruction like 'send email to alice@example.com about the roadmap'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want Gmail to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runGmailTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "GMAIL",
	},
	{
		name: "runSlackTool",
		description:
			"Use Slack to post messages, reply in threads, or get channel info. Provide a clear instruction like 'post in #general that the deploy is done'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want Slack to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runSlackTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "SLACK",
	},
	{
		name: "runGithubTool",
		description:
			"Use GitHub to create issues, comment on PRs, or search repositories. Provide a clear instruction like 'create an issue in repo X about bug Y'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want GitHub to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runGithubTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "GITHUB",
	},
	{
		name: "runNotionTool",
		description:
			"Use Notion to create or update pages and databases. Provide a clear instruction like 'create a page titled Q1 Plan with these bullets'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want Notion to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runNotionTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "NOTION",
	},
	{
		name: "runClickupTool",
		description:
			"Use ClickUp to create or update tasks. Provide a clear instruction like 'create a task in List A titled Fix onboarding bug'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want ClickUp to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runClickupTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "CLICKUP",
	},
	{
		name: "runLinearTool",
		description:
			"Use Linear to create or update issues. Provide a clear instruction like 'create a bug issue in Team X titled Login fails on Safari'.",
		parameters: {
			type: "object" as const,
			properties: {
				instruction: {
					type: "string",
					description: "What you want Linear to do",
				},
			},
			required: ["instruction"],
		},
		handlerType: "action" as const,
		handler: api.assistantComposioTools.runLinearTool,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
		externalApp: "LINEAR",
	},
];

function selectToolsForQuery(
	toolDefinitions: ToolDefinition[],
	requestedExternalApps: AssistantExternalApp[]
): ToolDefinition[] {
	const internalTools = toolDefinitions.filter((tool) => !tool.externalApp);
	if (requestedExternalApps.length === 0) {
		return internalTools;
	}

	const appSet = new Set(requestedExternalApps);
	const matchingExternalTools = toolDefinitions.filter(
		(tool) => tool.externalApp && appSet.has(tool.externalApp)
	);
	return [...internalTools, ...matchingExternalTools];
}

// =============================================================================
// Chat Integration with database-chat component
// =============================================================================

export const createConversation = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		title: v.optional(v.string()),
		forceNew: v.optional(v.boolean()),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();

		if (existing?.conversationId && !args.forceNew) {
			return existing.conversationId;
		}

		const conversationId = await ctx.runMutation(
			components.databaseChat.conversations.create,
			{
				externalId: `workspace_${args.workspaceId}_user_${args.userId}_${Date.now()}`,
				title: args.title ?? "Chat with Proddy",
			}
		);

		if (existing && args.forceNew) {
			// Update existing record instead of creating duplicate
			await ctx.db.patch(existing._id, {
				conversationId,
				lastMessageAt: Date.now(),
			});
		} else {
			await ctx.db.insert("assistantConversations", {
				workspaceId: args.workspaceId,
				userId: args.userId,
				conversationId,
				lastMessageAt: Date.now(),
			});
		}

		return conversationId;
	},
});

export const getMessages = query({
	args: { conversationId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, args) => {
		return await ctx.runQuery(components.databaseChat.messages.list, {
			conversationId: args.conversationId as any,
		});
	},
});

export const listConversations = query({
	args: { workspaceId: v.id("workspaces"), userId: v.id("users") },
	returns: v.array(v.any()),
	handler: async (ctx, args) => {
		return await ctx.runQuery(components.databaseChat.conversations.list, {
			externalId: `workspace_${args.workspaceId}_user_${args.userId}`,
		});
	},
});

export const getStreamState = query({
	args: { conversationId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.runQuery(components.databaseChat.stream.getStream, {
			conversationId: args.conversationId as any,
		});
	},
});

export const getStreamDeltas = query({
	args: { streamId: v.string(), cursor: v.number() },
	handler: async (ctx, args) => {
		return await ctx.runQuery(components.databaseChat.stream.listDeltas, {
			streamId: args.streamId as any,
			cursor: args.cursor,
		});
	},
});

export const abortStream = mutation({
	args: { conversationId: v.string(), reason: v.optional(v.string()) },
	handler: async (ctx, args) => {
		return await ctx.runMutation(
			components.databaseChat.stream.abortByConversation,
			{
				conversationId: args.conversationId as any,
				reason: args.reason ?? "User cancelled",
			}
		);
	},
});

// =============================================================================
// Main AI Assistant Action
// =============================================================================

export const sendMessage = action({
	args: {
		conversationId: v.string(),
		message: v.string(),
		workspaceId: v.optional(v.id("workspaces")),
		userId: v.optional(v.id("users")),
	},
	returns: v.object({
		success: v.boolean(),
		content: v.optional(v.string()),
		error: v.optional(v.string()),
		metadata: v.optional(v.any()),
	}),
	handler: async (
		ctx,
		args
	): Promise<{
		success: boolean;
		content?: string;
		error?: string;
		metadata?: unknown;
	}> => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			return { success: false, error: "OPENAI_API_KEY not configured" };
		}

		const conversationMeta = await ctx.runQuery(
			api.assistantConversations.getByConversationId,
			{ conversationId: args.conversationId }
		);

		const resolvedWorkspaceId =
			args.workspaceId ?? conversationMeta?.workspaceId ?? null;
		const resolvedUserId =
			args.userId ?? conversationMeta?.userId ?? (await getAuthUserId(ctx));

		if (!resolvedWorkspaceId || !resolvedUserId) {
			return {
				success: false,
				error: "Missing workspace or user context for this conversation.",
			};
		}

		const queryIntent = classifyAssistantQuery(args.message);
		const selectedToolDefinitions = selectToolsForQuery(
			TOOL_DEFINITIONS,
			queryIntent.requestedExternalApps
		);

		try {
			// Save user message
			await ctx.runMutation(components.databaseChat.messages.add, {
				conversationId: args.conversationId as any,
				role: "user",
				content: args.message,
			});

			// Get conversation history
			const rawMessages = await ctx.runQuery(
				components.databaseChat.messages.list,
				{ conversationId: args.conversationId as any }
			);

			// Build messages array with system prompt
			const messages = [
				{
					role: "system",
					content: buildAssistantSystemPrompt({
						externalToolsAllowed: queryIntent.requiresExternalTools,
					}),
				},
				...rawMessages.map((m: any) => ({
					role: m.role,
					content: m.content,
				})),
			];

			// Create stream for delta-based streaming
			const streamId = await ctx.runMutation(
				components.databaseChat.stream.create,
				{
					conversationId: args.conversationId as any,
				}
			);

			const openai = new OpenAI({
				apiKey: apiKey,
			});

			// Format tools for OpenAI
			const openaiTools: OpenAI.Chat.ChatCompletionTool[] =
				selectedToolDefinitions.map((t) => ({
					type: "function" as const,
					function: {
						name: t.name,
						description: t.description,
						parameters: t.parameters,
					},
				}));

			// Call OpenAI with tools
			const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
				tools: openaiTools,
				temperature: 0.7,
				max_tokens: 2000,
			});

			let responseText =
				completion.choices[0]?.message?.content || "No response generated";
			const toolCalls = completion.choices[0]?.message?.tool_calls;
			let externalToolUsed = false;

			// Execute tool calls if any
			if (toolCalls && toolCalls.length > 0) {
				for (const toolCall of toolCalls) {
					if (toolCall.type === "function") {
						try {
							const toolName = toolCall.function.name;
							const toolArgs = JSON.parse(toolCall.function.arguments);

							// Find the tool definition
							const tool = selectedToolDefinitions.find(
								(t) => t.name === toolName
							);
							if (tool) {
								if (tool.externalApp) {
									externalToolUsed = true;
								}
								// Inject context parameters based on tool's needs
								const fullArgs: Record<string, any> = { ...toolArgs };

								if (tool.contextParams?.needsWorkspaceId) {
									fullArgs.workspaceId = resolvedWorkspaceId;
								}
								if (tool.contextParams?.needsUserId) {
									fullArgs.userId = resolvedUserId;
								}

								let result: unknown;
								if (tool.handlerType === "query") {
									result = await ctx.runQuery(tool.handler as any, fullArgs);
								} else {
									result = await ctx.runAction(tool.handler as any, fullArgs);
								}
								const toolResultResponse =
									typeof result === "object" &&
									result !== null &&
									"response" in result &&
									typeof (result as { response?: unknown }).response ===
										"string"
										? (result as { response: string }).response
										: null;
								const noSideEffectsMessage =
									toolResultResponse?.includes("No changes were made.") ??
									false;
								if (tool.externalApp && noSideEffectsMessage) {
									responseText = toolResultResponse ?? responseText;
									continue;
								}

								// Call again with tool result
								const followUpMessages = [
									...messages,
									completion.choices[0].message,
									{
										role: "tool" as const,
										tool_call_id: toolCall.id,
										content: JSON.stringify(result),
									},
								];

								const followUpCompletion = await openai.chat.completions.create(
									{
										model: "gpt-4o-mini",
										messages: followUpMessages as any,
										temperature: 0.7,
										max_tokens: 2000,
									}
								);

								responseText =
									followUpCompletion.choices[0]?.message?.content ||
									responseText;
							}
						} catch (error) {
							console.error(
								`Tool execution error for ${toolCall.function.name}:`,
								error
							);
						}
					}
				}
			}

			// Finish streaming
			await ctx.runMutation(components.databaseChat.stream.finish, {
				streamId,
			});

			// Save assistant response
			await ctx.runMutation(components.databaseChat.messages.add, {
				conversationId: args.conversationId as any,
				role: "assistant",
				content: responseText,
			});

			await ctx.runMutation(api.assistantConversations.upsertConversation, {
				workspaceId: resolvedWorkspaceId,
				userId: resolvedUserId,
				conversationId: args.conversationId,
				lastMessageAt: Date.now(),
			});

			const metadata = buildAssistantResponseMetadata({
				assistantType: "convex",
				executionPath: "convex-assistant",
				intent: queryIntent,
				tools: {
					internalEnabled: true,
					externalEnabled: selectedToolDefinitions.some((tool) =>
						Boolean(tool.externalApp)
					),
					externalUsed: externalToolUsed,
					connectedApps: [],
				},
			});

			return { success: true, content: responseText, metadata };
		} catch (error) {
			console.error("[Assistant] Error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
