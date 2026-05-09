/**
 * Internal workspace tools for the Proddy agent.
 * Wraps assistantTools (calendar, tasks, channels, etc.) with createTool for @convex-dev/agent.
 */

import type { ToolCtx } from "@convex-dev/agent";
import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

export type AssistantCtx = ToolCtx & {
	workspaceId: Id<"workspaces">;
	userId: Id<"users">;
};

export const getMyCalendarToday = createTool({
	description:
		"Get the user's calendar events for today. Returns all meetings and events scheduled for the current day.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyCalendarToday, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyCalendarTomorrow = createTool({
	description:
		"Get the user's calendar events for tomorrow. Returns all meetings and events scheduled for the next day.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyCalendarTomorrow, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyCalendarThisWeek = createTool({
	description:
		"Get the user's calendar events for this week (the next 7 days starting from today). Use when the user asks about 'this week' or 'upcoming week'.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyCalendarThisWeek, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyCalendarNextWeek = createTool({
	description:
		"Get the user's calendar events for next week (7-14 days from now). Returns all meetings scheduled in the upcoming week.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyCalendarNextWeek, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyTasksToday = createTool({
	description:
		"Get tasks assigned to the user that are due today. Returns incomplete tasks with today's due date.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyTasksToday, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyTasksTomorrow = createTool({
	description:
		"Get tasks assigned to the user that are due tomorrow. Returns incomplete tasks with tomorrow's due date.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyTasksTomorrow, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyTasksThisWeek = createTool({
	description:
		"Get tasks assigned to the user that are due this week (next 7 days). Use when user asks about 'this week' or 'upcoming' tasks.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyTasksThisWeek, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyAllTasks = createTool({
	description:
		"Get all tasks assigned to the user. Results are ranked for visible triage, so overdue, in-progress, on-hold, and higher-priority work appears first.",
	args: z.object({
		includeCompleted: z
			.boolean()
			.optional()
			.describe("Whether to include completed tasks (default: false)"),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyAllTasks, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			includeCompleted: args.includeCompleted,
		});
	},
});

export const searchTasks = createTool({
	description:
		"Search tasks directly in the workspace database by keyword or topic. Use this before semantic search for task/topic questions like 'what is blocked for release'.",
	args: z.object({
		query: z.string().describe("Keyword or topic to search for in tasks."),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of matching tasks to return (default: 12)."),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.searchTasks, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			query: args.query,
			limit: args.limit,
		});
	},
});

export const getWorkspaceMembers = createTool({
	description:
		"List accepted workspace members with their IDs, names, emails, and roles. Use this before drafting a task for another person so you can resolve the assignee member ID.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.members.get, {
			workspaceId: ctx.workspaceId,
		});
	},
});

export const draftTaskForConfirmation = createTool({
	description:
		"Draft a task and save it for confirmation. Use this for task-creation requests so the user can review and change fields before anything is created. Include assigneeMemberId when the task belongs to another accepted workspace member. For follow-up edits to an existing draft, title is optional and unchanged fields should be reused from the current draft.",
	args: z.object({
		title: z
			.string()
			.optional()
			.describe(
				"The task title. Optional when revising an existing pending draft."
			),
		description: z.string().optional().describe("Optional task description."),
		dueDate: z
			.number()
			.optional()
			.describe("Optional due date as a Unix timestamp in milliseconds."),
		priority: z
			.enum(["low", "medium", "high"])
			.optional()
			.describe("Optional task priority."),
		assigneeMemberId: z
			.string()
			.optional()
			.describe(
				"Optional member ID for another accepted workspace member. Resolve it with getWorkspaceMembers first."
			),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runMutation(
			api.assistantConversations.savePendingTaskDraft,
			{
				workspaceId: ctx.workspaceId,
				userId: ctx.userId,
				title: args.title,
				description: args.description,
				dueDate: args.dueDate,
				priority: args.priority,
				assigneeMemberId: args.assigneeMemberId as
					| Id<"members">
					| undefined,
			}
		);
	},
});

export const getRecentNotes = createTool({
	description:
		"Get recent notes directly from the workspace. Use this first when the user asks if there are any notes or asks for recent notes.",
	args: z.object({
		limit: z
			.number()
			.optional()
			.describe("Maximum number of notes to return (default: 10)."),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getRecentNotes, {
			workspaceId: ctx.workspaceId,
			limit: args.limit,
		});
	},
});

export const searchNotes = createTool({
	description:
		"Search notes directly in the workspace database by keyword or topic. Use this before semantic search for note questions like 'what notes mention onboarding'.",
	args: z.object({
		query: z.string().describe("Keyword or topic to search for in notes."),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of matching notes to return (default: 10)."),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.searchNotes, {
			workspaceId: ctx.workspaceId,
			query: args.query,
			limit: args.limit,
		});
	},
});

export const searchChannels = createTool({
	description:
		"Search for channels in the workspace by name. Returns matching channels with their IDs. Only use for finding/browsing channel information within the workspace. For Slack operations, use runSlackTool instead.",
	args: z.object({
		query: z
			.string()
			.optional()
			.describe(
				"Channel name to search for (without # symbol). Leave empty to get all channels."
			),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.searchChannels, {
			workspaceId: ctx.workspaceId,
			query: args.query,
		});
	},
});

export const getChannelSummary = createTool({
	description:
		"Get a summary of recent messages in a specific channel. Requires a channel ID - if user provides a channel name (e.g., '#general'), FIRST call searchChannels to find the ID, then use that ID here.",
	args: z.object({
		channelId: z
			.string()
			.describe(
				"Channel ID (get this from searchChannels if you only have the channel name)"
			),
		limit: z
			.number()
			.optional()
			.describe("Max number of messages to analyze (default: 40)"),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getChannelSummary, {
			workspaceId: ctx.workspaceId,
			channelId: args.channelId as Id<"channels">,
			limit: args.limit,
		});
	},
});

export const getChannelDebug = createTool({
	description:
		"Return the raw recent messages the assistant can see for a channel. Use this only when debugging why a channel summary appears empty.",
	args: z.object({
		channelId: z.string().describe("The ID of the channel to inspect."),
		limit: z
			.number()
			.optional()
			.describe("Maximum number of raw messages to return (default: 20)."),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getChannelDebug, {
			workspaceId: ctx.workspaceId,
			channelId: args.channelId as Id<"channels">,
			limit: args.limit,
		});
	},
});

export const getWorkspaceOverview = createTool({
	description:
		"Get high-level overview statistics for the workspace. Returns counts of channels, members, tasks, and upcoming events.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getWorkspaceOverview, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getWorkspaceGeneralSummary = createTool({
	description:
		"Get a compact catch-up summary across recent channel activity, high-priority tasks, and recent notes. Use this first for broad workspace questions like 'what happened in general'.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getWorkspaceGeneralSummary, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const getMyCards = createTool({
	description:
		"Get all cards (from Kanban boards) assigned to the user across all channels. Returns card details including board/list location.",
	args: z.object({}),
	handler: async (ctx: AssistantCtx): Promise<unknown> => {
		return await ctx.runQuery(api.assistantTools.getMyCards, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
		});
	},
});

export const semanticSearch = createTool({
	description:
		"Perform hybrid retrieval across workspace content (messages, notes, tasks, cards, events) by combining direct keyword search with semantic search. Use only after direct notes, tasks, channel, or general summary tools do not provide enough information.",
	args: z.object({
		query: z.string().describe("Search query"),
		limit: z
			.number()
			.optional()
			.describe("Max results to return (default: 10)"),
	}),
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantTools.semanticSearch, {
			workspaceId: ctx.workspaceId,
			query: args.query,
			limit: args.limit,
		});
	},
});
