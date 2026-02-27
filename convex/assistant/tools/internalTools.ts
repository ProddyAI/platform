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
		"Get all tasks assigned to the user. Can optionally include completed tasks. Use for general task queries like 'what are my tasks' or 'show all my work'.",
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
		return await ctx.runAction(api.assistantTools.getChannelSummary, {
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
		"Perform semantic search across all workspace content (messages, notes, tasks, cards). Use for general questions that don't fit other tools.",
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
