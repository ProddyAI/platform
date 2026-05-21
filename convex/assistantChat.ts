import { getAuthUserId } from "@convex-dev/auth/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import OpenAI from "openai";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";
import { resolvePreflightContext } from "./assistant/preflightResolver";
import {
	type AssistantProfileRecord,
	buildAssistantProfilePrompt,
} from "./assistant/profile";
import {
	buildTaskDraftFailureMessage,
	formatPendingTaskDraftConfirmation,
	isPendingTaskCancellation,
	isPendingTaskConfirmation,
} from "./assistant/taskDrafts";
import {
	executeToolHandler,
	toOpenAIChatMessages,
} from "./assistant/toolExecutor";
import { resolveAssistantToolLoop } from "./assistant/toolLoop";
import {
	collectSourceRefsFromToolResult,
	createFallbackResponseFromToolResult,
	dedupeSourceRefs,
} from "./assistant/toolResults";
import { validateRelativeDueDateSelection } from "./assistant/relativeDate";

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
	handler: FunctionReference<"query" | "mutation" | "action", "public">;
	contextParams?: {
		needsWorkspaceId?: boolean;
		needsUserId?: boolean;
	};
};

function buildCurrentDateContext() {
	const now = new Date();
	const utcIso = now.toISOString();
	const localFormatter = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		timeZoneName: "short",
	});
	const localTimezone =
		Intl.DateTimeFormat().resolvedOptions().timeZone || "local timezone";

	return [
		"Current date context:",
		`- Local runtime time: ${localFormatter.format(now)} (${localTimezone})`,
		`- UTC timestamp: ${utcIso}`,
		"- Always interpret relative dates like today, tomorrow, and yesterday using this current date context, not training-time assumptions.",
	].join("\n");
}

function buildSystemPrompt(options?: {
	hasPendingTaskDraft?: boolean;
	pendingTaskDraftSummary?: string;
	pendingTaskDraftAssigneeMemberId?: string;
	pendingTaskDraftAssigneeName?: string;
	preflightContext?: string;
	assistantProfile?: AssistantProfileRecord;
}) {
	const pendingTaskInstructions =
		options?.hasPendingTaskDraft && options.pendingTaskDraftSummary
			? `You currently have a pending task draft for this user:
${options.pendingTaskDraftSummary}

${
	options.pendingTaskDraftAssigneeMemberId
		? `Current pending draft assignee member ID: ${options.pendingTaskDraftAssigneeMemberId}
Current pending draft assignee name: ${options.pendingTaskDraftAssigneeName ?? "Unknown"}
If the user asks for revisions without changing the assignee, keep assigning the task to this same member.`
		: "If the user asks for revisions without naming a different assignee, keep this as a self-assigned draft."
}

If the user wants changes, update the draft by calling draftTaskForConfirmation again with the revised fields.
Do not create the task in the same turn as drafting it. Wait for an explicit confirmation reply in a later user message.`
			: "";
	const personalizationPrompt = options?.assistantProfile
		? buildAssistantProfilePrompt(options.assistantProfile)
		: "";
	const preflightPrompt = options?.preflightContext?.trim()
		? options.preflightContext.trim()
		: "";

	return `You are Proddy, a personal work assistant for team workspaces.

Your role:
- Help users manage their calendar, meetings, tasks, and workspace activities
- Provide summaries of channels and conversations
- Answer questions about workspace data
- Use connected external services (GitHub, Gmail, Slack, etc.) when asked
- Be concise, actionable, and friendly

Guidelines:
- Use the available tools to fetch real-time data
- Format responses with clear headings and bullet points
- When showing dates/times, use readable formats
- If you don't have information, say so clearly
- Never invent data - only use what the tools return
- If a tool returns notes, messages, or summaries, use that returned data directly and do not say you lack access
- Prefer direct workspace tools for notes, tasks, channel activity, and general catch-up; use semantic search only as a fallback
- For note matches, include titles, channel names when available, and a useful snippet
- For task lists, keep the answer compact and put overdue, in-progress, on-hold, urgent, or blocking work first
- For task creation requests, first draft the task with draftTaskForConfirmation and ask the user to confirm or change it before anything is created
- When a task is for another person, first use getWorkspaceMembers to find an accepted workspace member ID, then pass that member ID into draftTaskForConfirmation
- Never assign a task to someone who has only been invited but has not joined the workspace yet
- For broad catch-up questions like "what happened in general", summarize concrete updates when data exists
- Reuse recent conversation context for short follow-ups like "what about release?"
- Never answer with "No response generated"; if nothing relevant is found, say "I couldn't find anything relevant yet."
- ALWAYS use integration tools (runGithubTool, runGmailTool, runSlackTool, etc.) when the user asks about those services - do NOT say you can't access them

Available capabilities:
- Calendar: View today's/tomorrow's/next week's meetings
- Tasks: Check tasks due today/tomorrow or all tasks, and search tasks by topic
- Task drafting: Prepare a task draft for confirmation before creating anything, including assignments to accepted workspace members
- Members: List accepted workspace members so tasks can be assigned to the right person
- Notes: List recent notes and search notes by topic
- Channels: Search channels, get channel summaries
- Boards: View assigned cards across all boards
- Workspace: Get overview statistics and a general workspace catch-up summary
- Search: Semantic search across messages, notes, tasks as fallback only
- GitHub: List repos, create issues, and manage PRs with runGithubTool
- GitHub repository policy: "my repos" means repositories for the authenticated user, not starred repositories and not public search results
- Gmail: Send email, read inbox, and search messages with runGmailTool
- Slack: Send messages and browse channels with runSlackTool
- Notion: Create and read pages and databases with runNotionTool
- ClickUp: Create and manage tasks with runClickupTool
- Linear: Create and manage issues with runLinearTool

${buildCurrentDateContext()}

${preflightPrompt}

${personalizationPrompt}

${pendingTaskInstructions}

When a user asks about their schedule, tasks, or workspace, use the appropriate tools to fetch current data.`;
}
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
		name: "getMyTasksThisWeek",
		description:
			"Get tasks assigned to the user that are due this week (the next 7 days starting from today). Use when the user asks about this week's or upcoming tasks.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyTasksThisWeek,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyTasksNextWeek",
		description:
			"Get tasks assigned to the user that are due next week (7-14 days from now). Returns incomplete tasks within that date window only.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getMyTasksNextWeek,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getMyAllTasks",
		description:
			"Get all tasks assigned to the user. Results are ranked for visible triage, so overdue, in-progress, on-hold, and higher-priority work appears first.",
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
		name: "searchTasks",
		description:
			"Search tasks directly in the workspace database by keyword or topic. Use this before semantic search for task/topic questions like 'what is blocked for release' or 'tasks about onboarding'.",
		parameters: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description: "Keyword or topic to search for in tasks",
				},
				limit: {
					type: "number",
					description: "Max number of matching tasks to return (default: 12)",
				},
			},
			required: ["query"],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.searchTasks,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getWorkspaceMembers",
		description:
			"List accepted workspace members with their IDs, names, emails, and roles. Use this before drafting a task for another person so you can resolve the assignee member ID. Pending invites do not appear here.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.members.get,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "draftTaskForConfirmation",
		description:
			"Draft a task and save it for confirmation. Use this for any request to create a task. This tool does not create the task yet; it prepares a preview so the user can confirm or request changes first. If the task belongs to another accepted workspace member, include assigneeMemberId. For follow-up edits to an existing draft, title is optional and unchanged fields should be reused from the current draft.",
		parameters: {
			type: "object" as const,
			properties: {
				title: {
					type: "string",
					description:
						"The task title. Optional when revising an existing pending draft.",
				},
				description: {
					type: "string",
					description: "Optional task description.",
				},
				dueDate: {
					type: "number",
					description: "Optional due date as a Unix timestamp in milliseconds.",
				},
				priority: {
					type: "string",
					description: "Optional priority. Must be one of: low, medium, high.",
				},
				assigneeMemberId: {
					type: "string",
					description:
						"Optional member ID for another accepted workspace member. Find this with getWorkspaceMembers first.",
				},
			},
			required: [],
		},
		handlerType: "mutation" as const,
		handler: api.assistantConversations.savePendingTaskDraft,
		contextParams: { needsWorkspaceId: true, needsUserId: true },
	},
	{
		name: "getRecentNotes",
		description:
			"Get recent notes in the workspace. Use this first when the user asks whether there are notes, asks for recent notes, or wants a list of notes.",
		parameters: {
			type: "object" as const,
			properties: {
				limit: {
					type: "number",
					description: "Max number of recent notes to return (default: 10)",
				},
			},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getRecentNotes,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "searchNotes",
		description:
			"Search notes directly in the workspace database by topic or keyword. Use this before semantic search for notes about onboarding, release planning, documentation, and similar topics.",
		parameters: {
			type: "object" as const,
			properties: {
				query: {
					type: "string",
					description: "Topic or keyword to search for in notes",
				},
				limit: {
					type: "number",
					description: "Max number of matching notes to return (default: 10)",
				},
			},
			required: ["query"],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.searchNotes,
		contextParams: { needsWorkspaceId: true },
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
		handlerType: "query" as const,
		handler: api.assistantTools.getChannelSummary,
		contextParams: { needsWorkspaceId: true },
	},
	{
		name: "getChannelDebug",
		description:
			"Return the raw recent messages the assistant can see for a channel. Use this only when debugging why a channel summary appears empty.",
		parameters: {
			type: "object" as const,
			properties: {
				channelId: {
					type: "string",
					description: "The ID of the channel to inspect.",
				},
				limit: {
					type: "number",
					description:
						"Maximum number of raw messages to return (default: 20).",
				},
			},
			required: ["channelId"],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getChannelDebug,
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
		name: "getWorkspaceGeneralSummary",
		description:
			"Get a compact catch-up summary across recent channel activity, high-priority tasks, and recent notes. Use this first for broad workspace questions like 'what happened in general'.",
		parameters: {
			type: "object" as const,
			properties: {},
			required: [],
		},
		handlerType: "query" as const,
		handler: api.assistantTools.getWorkspaceGeneralSummary,
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
			"Perform hybrid retrieval across workspace content (messages, notes, tasks, cards, events) by combining direct keyword search with semantic search. Use this only after direct notes, tasks, channel, or general summary tools do not provide enough information.",
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
	},
	{
		name: "runGithubTool",
		description:
			"Use GitHub to list repositories for the authenticated user, list repositories starred by the authenticated user, create issues, comment on PRs, or manage repository data. For requests like 'list my repos', pass an instruction that explicitly says to list repositories for the authenticated user. For requests like 'my starred repositories', pass an instruction that explicitly says to list repositories starred by the authenticated user. Do not use public repository search unless the user explicitly asks for search.",
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
	},
];

async function getDatabaseChatConversation(
	ctx: QueryCtx | MutationCtx | ActionCtx,
	conversationId: string | null | undefined
) {
	if (!conversationId) {
		return null;
	}

	try {
		return await ctx.runQuery(components.databaseChat.conversations.get, {
			conversationId,
		});
	} catch (error) {
		console.warn(
			"[Assistant] Stored database-chat conversation ID is invalid:",
			conversationId,
			error
		);
		return null;
	}
}

export const createConversation = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		title: v.optional(v.string()),
		forceNew: v.optional(v.boolean()),
	},
	returns: v.string(),
	handler: async (ctx, args) => {
		if (args.forceNew) {
			const conversationId = await ctx.runMutation(
				components.databaseChat.conversations.create,
				{
					externalId: `workspace_${args.workspaceId}_user_${args.userId}_${Date.now()}`,
					title: args.title ?? "New Chat",
				}
			);

			const now = Date.now();
			await ctx.db.insert("assistantConversations", {
				workspaceId: args.workspaceId,
				userId: args.userId,
				conversationId,
				title: args.title ?? "New Chat",
				lastMessageAt: now,
				createdAt: now,
			});

			return conversationId;
		}

		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.order("desc")
			.first();

		const existingConversation = existing?.conversationId
			? await getDatabaseChatConversation(ctx, existing.conversationId)
			: null;

		if (existingConversation) {
			return existingConversation._id;
		}

		const conversationId = await ctx.runMutation(
			components.databaseChat.conversations.create,
			{
				externalId: `workspace_${args.workspaceId}_user_${args.userId}_${Date.now()}`,
				title: args.title ?? "New Chat",
			}
		);

		const now = Date.now();
		await ctx.db.insert("assistantConversations", {
			workspaceId: args.workspaceId,
			userId: args.userId,
			conversationId,
			title: args.title ?? "New Chat",
			lastMessageAt: now,
			createdAt: now,
		});

		return conversationId;
	},
});

export const getMessages = query({
	args: { conversationId: v.string() },
	returns: v.array(v.any()),
	handler: async (ctx, args) => {
		const conversation = await getDatabaseChatConversation(
			ctx,
			args.conversationId
		);
		if (!conversation) {
			return [];
		}

		return await ctx.runQuery(components.databaseChat.messages.list, {
			conversationId: conversation._id,
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
		const conversation = await getDatabaseChatConversation(
			ctx,
			args.conversationId
		);
		if (!conversation) {
			return null;
		}

		return await ctx.runQuery(components.databaseChat.stream.getStream, {
			conversationId: conversation._id,
		});
	},
});

export const getStreamDeltas = query({
	args: { streamId: v.string(), cursor: v.number() },
	handler: async (ctx, args) => {
		return await ctx.runQuery(components.databaseChat.stream.listDeltas, {
			streamId: args.streamId,
			cursor: args.cursor,
		});
	},
});

export const abortStream = mutation({
	args: { conversationId: v.string(), reason: v.optional(v.string()) },
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const conversation = await getDatabaseChatConversation(
			ctx,
			args.conversationId
		);
		if (!conversation) {
			return false;
		}

		return await ctx.runMutation(
			components.databaseChat.stream.abortByConversation,
			{
				conversationId: conversation._id,
				reason: args.reason ?? "User cancelled",
			}
		);
	},
});

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
	}),
	handler: async (
		ctx,
		args
	): Promise<{ success: boolean; content?: string; error?: string }> => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			return { success: false, error: "OPENAI_API_KEY not configured" };
		}
		let streamId: string | null = null;

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

		let activeConversationId = args.conversationId;
		const existingConversation = await getDatabaseChatConversation(
			ctx,
			activeConversationId
		);

		if (!existingConversation) {
			activeConversationId = await ctx.runMutation(
				api.assistantChat.createConversation,
				{
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
					title: "Assistant Chat",
					forceNew: true,
				}
			);
		}

		const latestConversationMeta = await ctx.runQuery(
			api.assistantConversations.getByWorkspaceAndUser,
			{
				workspaceId: resolvedWorkspaceId,
				userId: resolvedUserId,
			}
		);
		const pendingTaskDraft =
			latestConversationMeta?.conversationId === activeConversationId
				? latestConversationMeta.pendingTaskDraft
				: undefined;

		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: resolvedUserId as Id<"users">,
				workspaceId: resolvedWorkspaceId as Id<"workspaces">,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed to record AI request:", e);
		}

		try {
			await ctx.runMutation(components.databaseChat.messages.add, {
				conversationId: activeConversationId,
				role: "user",
				content: args.message,
			});

			let assistantProfile: Awaited<
				ReturnType<
					typeof ctx.runMutation<typeof api.assistantProfiles.recordSignal>
				>
			> | null = null;
			try {
				assistantProfile = await ctx.runMutation(
					api.assistantProfiles.recordSignal,
					{
						workspaceId: resolvedWorkspaceId,
						userId: resolvedUserId,
						message: args.message,
					}
				);
			} catch (signalErr) {
				console.warn("[Assistant] recordSignal failed (non-fatal):", signalErr);
			}

			if (pendingTaskDraft && isPendingTaskConfirmation(args.message)) {
				const created = await ctx.runMutation(
					api.assistantConversations.createTaskFromPendingDraft,
					{
						workspaceId: resolvedWorkspaceId,
						userId: resolvedUserId,
					}
				);
				const assigneeSuffix =
					created.assigneeName?.trim() &&
					pendingTaskDraft?.assigneeUserId !== resolvedUserId
						? ` for ${created.assigneeName.trim()}`
						: "";
				const responseText = `Created the task "${created.title}"${assigneeSuffix}.`;

				await ctx.runMutation(components.databaseChat.messages.add, {
					conversationId: activeConversationId,
					role: "assistant",
					content: responseText,
				});
				await ctx.runMutation(api.assistantConversations.upsertConversation, {
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
					conversationId: activeConversationId,
					lastMessageAt: Date.now(),
				});

				return { success: true, content: responseText };
			}

			if (pendingTaskDraft && isPendingTaskCancellation(args.message)) {
				await ctx.runMutation(
					api.assistantConversations.clearPendingTaskDraft,
					{
						workspaceId: resolvedWorkspaceId,
						userId: resolvedUserId,
					}
				);
				const responseText = "Canceled the pending task draft.";

				await ctx.runMutation(components.databaseChat.messages.add, {
					conversationId: activeConversationId,
					role: "assistant",
					content: responseText,
				});
				await ctx.runMutation(api.assistantConversations.upsertConversation, {
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
					conversationId: activeConversationId,
					lastMessageAt: Date.now(),
				});

				return { success: true, content: responseText };
			}

			const rawMessages = await ctx.runQuery(
				components.databaseChat.messages.list,
				{ conversationId: activeConversationId }
			);
			const preflightContext = await resolvePreflightContext({
				ctx,
				workspaceId: resolvedWorkspaceId,
				userId: resolvedUserId,
				message: args.message,
			});

			if (preflightContext.earlyResponse) {
				const responseText = preflightContext.earlyResponse;
				await ctx.runMutation(components.databaseChat.messages.add, {
					conversationId: activeConversationId,
					role: "assistant",
					content: responseText,
				});
				await ctx.runMutation(api.assistantConversations.upsertConversation, {
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
					conversationId: activeConversationId,
					lastMessageAt: Date.now(),
				});

				return { success: true, content: responseText };
			}

			const messages = [
				{
					role: "system",
					content: buildSystemPrompt({
						hasPendingTaskDraft: Boolean(pendingTaskDraft),
						pendingTaskDraftSummary: pendingTaskDraft
							? formatPendingTaskDraftConfirmation(pendingTaskDraft)
							: undefined,
						pendingTaskDraftAssigneeMemberId:
							pendingTaskDraft?.assigneeMemberId,
						pendingTaskDraftAssigneeName: pendingTaskDraft?.assigneeName,
						preflightContext: preflightContext.promptText,
						assistantProfile: assistantProfile ?? undefined,
					}),
				},
				...rawMessages.map((m) => ({
					role: m.role,
					content: m.content,
				})),
			];

			streamId = await ctx.runMutation(components.databaseChat.stream.create, {
				conversationId: activeConversationId,
			});

			const openai = new OpenAI({
				apiKey: apiKey,
			});

			const openaiTools: OpenAI.Chat.ChatCompletionTool[] =
				TOOL_DEFINITIONS.map((t) => ({
					type: "function" as const,
					function: {
						name: t.name,
						description: t.description,
						parameters: t.parameters,
					},
				}));

			const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
				tools: openaiTools,
				temperature: 0.7,
				max_tokens: 2000,
			});

			let responseText =
				completion.choices[0]?.message?.content ||
				"I couldn't find anything relevant yet.";
			const toolCalls = completion.choices[0]?.message?.tool_calls;
			const collectedSourceRefs: string[] = [...preflightContext.sourceRefs];

			if (
				!completion.choices[0]?.message?.content?.trim() &&
				(!toolCalls || toolCalls.length === 0)
			) {
				try {
					const search = await ctx.runAction(
						api.assistantTools.semanticSearch,
						{
							workspaceId: resolvedWorkspaceId,
							query: args.message,
							limit: 5,
						}
					);
					const results: Array<{
						id: string;
						text: string;
						type: string;
						score: number;
						sourceRefs: string[];
					}> = search.results ?? [];
					if (results.length) {
						for (const r of results) {
							for (const ref of r.sourceRefs) {
								if (typeof ref === "string" && ref.trim())
									collectedSourceRefs.push(ref.trim());
							}
						}
						const lines = results
							.slice(0, 5)
							.map((r, i) => {
								const text = String(r.text ?? "").trim();
								const snippet =
									text.length > 160 ? `${text.slice(0, 160)}…` : text;
								return `- (${i + 1}) ${snippet || "(no snippet)"}`;
							})
							.join("\n");
						responseText = `I found a few relevant items:\n${lines}`.trim();
					} else {
						responseText =
							"I couldn't find anything relevant in your workspace yet.";
					}
				} catch (fallbackError) {
					console.error(
						"[Assistant] Semantic search fallback failed",
						fallbackError,
						{ conversationId: args.conversationId, message: args.message }
					);
				}
			}

			if (toolCalls && toolCalls.length > 0) {
				const loopResult = await resolveAssistantToolLoop({
					initialAssistantMessage: completion.choices[0].message,
					baseMessages: messages as Array<{
						role: "system" | "user" | "assistant";
						content: string;
					}>,
					initialResponseText: responseText,
					createCompletion: async (followUpMessages) => {
						const followUpCompletion = await openai.chat.completions.create({
							model: "gpt-4o-mini",
							messages: toOpenAIChatMessages(followUpMessages),
							tools: openaiTools,
							temperature: 0.7,
							max_tokens: 2000,
						});

						return followUpCompletion.choices[0]?.message ?? {};
					},
					executeToolCall: async (toolCall) => {
						const toolName = toolCall.function?.name ?? "";
						const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
						if (!tool) {
							return {
								result: {
									success: false,
									error: `Unknown tool: ${toolName}`,
								},
								fallbackText: null,
								sourceRefs: [],
							};
						}

						try {
							const parsedArgs = JSON.parse(
								toolCall.function?.arguments ?? "{}"
							);
							const fullArgs: Record<string, unknown> = { ...parsedArgs };

							if (toolName === "draftTaskForConfirmation") {
								const relativeDateValidation = validateRelativeDueDateSelection(
									{
										message: args.message,
										dueDate:
											typeof fullArgs.dueDate === "number"
												? fullArgs.dueDate
												: undefined,
									}
								);
								if (relativeDateValidation) {
									return {
										result: {
											success: false,
											error: relativeDateValidation,
										},
										sourceRefs: [],
										fallbackText: relativeDateValidation,
									};
								}
							}

							if (tool.contextParams?.needsWorkspaceId) {
								fullArgs.workspaceId = resolvedWorkspaceId;
							}
							if (tool.contextParams?.needsUserId) {
								fullArgs.userId = resolvedUserId;
							}

							const result = await executeToolHandler(
								ctx,
								tool.handlerType,
								tool.handler,
								fullArgs
							);

							return {
								result,
								sourceRefs: collectSourceRefsFromToolResult(toolName, result),
								fallbackText: createFallbackResponseFromToolResult(
									toolName,
									result
								),
							};
						} catch (error) {
							const message =
								error instanceof Error
									? error.message
									: "Tool execution failed";
							return {
								result: {
									success: false,
									error: message,
								},
								sourceRefs: [],
								fallbackText:
									toolName === "draftTaskForConfirmation"
										? buildTaskDraftFailureMessage(message)
										: `I hit an issue while using ${toolName}. Please try again.`,
							};
						}
					},
				});

				for (const ref of loopResult.sourceRefs) {
					collectedSourceRefs.push(ref);
				}
				responseText = loopResult.responseText;
			}

			if (collectedSourceRefs.length) {
				const unique = dedupeSourceRefs(collectedSourceRefs).slice(0, 5);
				responseText = `${responseText.trim()}\n\nSources:\n${unique
					.map((s) => `- ${s}`)
					.join("\n")}`.trim();
			}

			await ctx.runMutation(components.databaseChat.stream.finish, {
				streamId,
			});

			await ctx.runMutation(components.databaseChat.messages.add, {
				conversationId: activeConversationId,
				role: "assistant",
				content: responseText,
			});

			await ctx.runMutation(api.assistantConversations.upsertConversation, {
				workspaceId: resolvedWorkspaceId,
				userId: resolvedUserId,
				conversationId: activeConversationId,
				lastMessageAt: Date.now(),
			});

			await ctx.scheduler.runAfter(
				0,
				internal.assistantTitles.autoGenerateTitleIfNeeded,
				{
					conversationId: activeConversationId,
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
				}
			);

			return { success: true, content: responseText };
		} catch (error) {
			console.error("[Assistant] Error:", error);
			if (streamId) {
				try {
					await ctx.runMutation(components.databaseChat.stream.finish, {
						streamId,
					});
				} catch (streamError) {
					console.warn(
						"[Assistant] Failed to close stream after error:",
						streamError
					);
				}
			}
			try {
				const responseText =
					error instanceof Error
						? buildTaskDraftFailureMessage(error.message)
						: "I ran into an issue while processing that request. Please try again.";
				await ctx.runMutation(components.databaseChat.messages.add, {
					conversationId: activeConversationId,
					role: "assistant",
					content: responseText,
				});
				await ctx.runMutation(api.assistantConversations.upsertConversation, {
					workspaceId: resolvedWorkspaceId,
					userId: resolvedUserId,
					conversationId: activeConversationId,
					lastMessageAt: Date.now(),
				});
			} catch (persistError) {
				console.warn(
					"[Assistant] Failed to persist error response:",
					persistError
				);
			}
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
