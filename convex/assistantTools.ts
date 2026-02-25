/**
 * AI Assistant Tools - replaces deterministic intent matching with AI-driven tool selection
 *
 * Each tool is a Convex query/action that the AI can call based on user intent.
 * The LLM reads the tool descriptions and decides which to invoke.
 */

import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, query } from "./_generated/server";

// Helper functions
function startOfDayMs(date: Date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function endOfDayMs(date: Date) {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d.getTime();
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

// =============================================================================
// CALENDAR & MEETINGS TOOLS
// =============================================================================

export const getMyCalendarToday = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		events: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				time: v.optional(v.string()),
				date: v.number(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const todayStart = startOfDayMs(now);
		const todayEnd = endOfDayMs(now);

		const allEvents = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const todayEvents = allEvents.filter((event) => {
			const eventDate = new Date(event.date).getTime();
			return eventDate >= todayStart && eventDate <= todayEnd;
		});

		return {
			events: todayEvents.map((e) => ({
				id: e._id,
				title: e.title,
				time: e.time,
				date: new Date(e.date).getTime(),
			})),
			count: todayEvents.length,
		};
	},
});

export const getMyCalendarTomorrow = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		events: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				time: v.optional(v.string()),
				date: v.number(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const tomorrow = addDays(now, 1);
		const tomorrowStart = startOfDayMs(tomorrow);
		const tomorrowEnd = endOfDayMs(tomorrow);

		const allEvents = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const tomorrowEvents = allEvents.filter((event) => {
			const eventDate = new Date(event.date).getTime();
			return eventDate >= tomorrowStart && eventDate <= tomorrowEnd;
		});

		return {
			events: tomorrowEvents.map((e) => ({
				id: e._id,
				title: e.title,
				time: e.time,
				date: new Date(e.date).getTime(),
			})),
			count: tomorrowEvents.length,
		};
	},
});

export const getMyCalendarThisWeek = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		events: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				time: v.optional(v.string()),
				date: v.number(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const thisWeekEnd = addDays(now, 7);

		const allEvents = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const thisWeekEvents = allEvents.filter((event) => {
			const eventDate = new Date(event.date).getTime();
			return (
				eventDate >= startOfDayMs(now) &&
				eventDate <= endOfDayMs(thisWeekEnd)
			);
		});

		return {
			events: thisWeekEvents.map((e) => ({
				id: e._id,
				title: e.title,
				time: e.time,
				date: new Date(e.date).getTime(),
			})),
			count: thisWeekEvents.length,
		};
	},
});

export const getMyCalendarNextWeek = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		events: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				time: v.optional(v.string()),
				date: v.number(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const nextWeekStart = addDays(now, 7);
		const nextWeekEnd = addDays(now, 14);

		const allEvents = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const nextWeekEvents = allEvents.filter((event) => {
			const eventDate = new Date(event.date).getTime();
			return (
				eventDate >= startOfDayMs(nextWeekStart) &&
				eventDate <= endOfDayMs(nextWeekEnd)
			);
		});

		return {
			events: nextWeekEvents.map((e) => ({
				id: e._id,
				title: e.title,
				time: e.time,
				date: new Date(e.date).getTime(),
			})),
			count: nextWeekEvents.length,
		};
	},
});

// =============================================================================
// TASKS TOOLS
// =============================================================================

export const getMyTasksToday = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		tasks: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.optional(v.string()),
				status: v.string(),
				priority: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const todayStart = startOfDayMs(now);
		const todayEnd = endOfDayMs(now);

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.filter((q) => q.eq(q.field("completed"), false))
			.collect();

		const todayTasks = allTasks.filter((task) => {
			if (!task.dueDate) return false;
			return task.dueDate >= todayStart && task.dueDate <= todayEnd;
		});

		return {
			tasks: todayTasks.map((t) => ({
				id: t._id,
				title: t.title,
				description: t.description,
				status: t.status || "todo",
				priority: t.priority,
				dueDate: t.dueDate,
			})),
			count: todayTasks.length,
		};
	},
});

export const getMyTasksTomorrow = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		tasks: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.optional(v.string()),
				status: v.string(),
				priority: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const tomorrow = addDays(now, 1);
		const tomorrowStart = startOfDayMs(tomorrow);
		const tomorrowEnd = endOfDayMs(tomorrow);

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.filter((q) => q.eq(q.field("completed"), false))
			.collect();

		const tomorrowTasks = allTasks.filter((task) => {
			if (!task.dueDate) return false;
			return task.dueDate >= tomorrowStart && task.dueDate <= tomorrowEnd;
		});

		return {
			tasks: tomorrowTasks.map((t) => ({
				id: t._id,
				title: t.title,
				description: t.description,
				status: t.status || "todo",
				priority: t.priority,
				dueDate: t.dueDate,
			})),
			count: tomorrowTasks.length,
		};
	},
});

export const getMyTasksThisWeek = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		tasks: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.optional(v.string()),
				status: v.string(),
				priority: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const now = new Date();
		const thisWeekEnd = addDays(now, 7);

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.filter((q) => q.eq(q.field("completed"), false))
			.collect();

		const thisWeekTasks = allTasks.filter((task) => {
			if (!task.dueDate) return false;
			return task.dueDate >= startOfDayMs(now) && task.dueDate <= endOfDayMs(thisWeekEnd);
		});

		return {
			tasks: thisWeekTasks.map((t) => ({
				id: t._id,
				title: t.title,
				description: t.description,
				status: t.status || "todo",
				priority: t.priority,
				dueDate: t.dueDate,
			})),
			count: thisWeekTasks.length,
		};
	},
});

export const getMyAllTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		includeCompleted: v.optional(v.boolean()),
	},
	returns: v.object({
		tasks: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.optional(v.string()),
				status: v.string(),
				priority: v.optional(v.string()),
				dueDate: v.optional(v.number()),
				completed: v.boolean(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		let query = ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId));

		if (!args.includeCompleted) {
			query = query.filter((q) => q.eq(q.field("completed"), false));
		}

		const tasks = await query.collect();

		return {
			tasks: tasks.map((t) => ({
				id: t._id,
				title: t.title,
				description: t.description,
				status: t.status || "todo",
				priority: t.priority,
				dueDate: t.dueDate,
				completed: t.completed || false,
			})),
			count: tasks.length,
		};
	},
});

// =============================================================================
// CHANNEL & MESSAGING TOOLS
// =============================================================================

export const searchChannels = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.optional(v.string()),
	},
	returns: v.object({
		channels: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		let filteredChannels = channels;
		if (args.query) {
			const queryLower = args.query.toLowerCase();
			filteredChannels = channels.filter((ch) =>
				ch.name.toLowerCase().includes(queryLower)
			);
		}

		return {
			channels: filteredChannels.map((ch) => ({
				id: ch._id,
				name: ch.name,
			})),
			count: filteredChannels.length,
		};
	},
});

export const getChannelSummary: ReturnType<typeof action> = action({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.id("channels"),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		summary: v.string(),
		messageCount: v.number(),
		channelName: v.string(),
	}),
	handler: async (
		ctx,
		args
	): Promise<{
		summary: string;
		messageCount: number;
		channelName: string;
	}> => {
		// Get channel info
		const channel = (await ctx.runQuery(api.channels.getById, {
			id: args.channelId,
		})) as { name: string } | null;

		if (!channel) {
			return {
				summary: "Channel not found",
				messageCount: 0,
				channelName: "unknown",
			};
		}

		// Get recent messages
		const results = (await ctx.runQuery(api.messages.get, {
			channelId: args.channelId,
			paginationOpts: { numItems: args.limit || 40, cursor: null },
		})) as { page: Array<{ body: string }> };

		const messageCount = results.page.length;

		if (messageCount === 0) {
			return {
				summary: `No messages found in #${channel.name}.`,
				messageCount: 0,
				channelName: channel.name,
			};
		}

		// Format messages for AI summary
		const messageContext: string = results.page
			.slice(-10)
			.map((m) => {
				const body =
					typeof m.body === "string" ? m.body : JSON.stringify(m.body);
				return body.substring(0, 200);
			})
			.join("\n");

		// Return data for AI to summarize
		return {
			summary: messageContext,
			messageCount,
			channelName: channel.name,
		};
	},
});

// =============================================================================
// WORKSPACE OVERVIEW TOOLS
// =============================================================================

export const getWorkspaceOverview = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		channelCount: v.number(),
		memberCount: v.number(),
		taskCount: v.number(),
		upcomingEvents: v.number(),
	}),
	handler: async (ctx, args) => {
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("userId"), args.userId))
			.filter((q) => q.eq(q.field("completed"), false))
			.collect();
		const events = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const now = Date.now();
		const upcomingEvents = events.filter(
			(e) => new Date(e.date).getTime() >= now
		);

		return {
			channelCount: channels.length,
			memberCount: members.length,
			taskCount: tasks.length,
			upcomingEvents: upcomingEvents.length,
		};
	},
});

// =============================================================================
// BOARD & CARDS TOOLS
// =============================================================================

export const getMyCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		cards: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.optional(v.string()),
				listName: v.string(),
				channelName: v.string(),
				dueDate: v.optional(v.number()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		if (!member) {
			return { cards: [], count: 0 };
		}

		// Get all channels in workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const cards = [];

		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			for (const list of lists) {
				const listCards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.collect();

				for (const card of listCards) {
					// Check if user is assigned (if assignees exist)
					if (card.assignees && Array.isArray(card.assignees)) {
						if (card.assignees.includes(member._id)) {
							cards.push({
								id: card._id,
								title: card.title,
								description: card.description,
								listName: list.title,
								channelName: channel.name,
								dueDate: card.dueDate,
							});
						}
					} else {
						// Include cards without assignees
						cards.push({
							id: card._id,
							title: card.title,
							description: card.description,
							listName: list.title,
							channelName: channel.name,
							dueDate: card.dueDate,
						});
					}
				}
			}
		}

		return {
			cards,
			count: cards.length,
		};
	},
});

// =============================================================================
// SEMANTIC SEARCH TOOL (fallback for general questions)
// =============================================================================

export const semanticSearch: ReturnType<typeof action> = action({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		results: v.array(
			v.object({
				id: v.string(),
				text: v.string(),
				type: v.string(),
				score: v.number(),
			})
		),
		count: v.number(),
	}),
	handler: async (
		ctx,
		args
	): Promise<{
		results: Array<{ id: string; text: string; type: string; score: number }>;
		count: number;
	}> => {
		// Use existing RAG semantic search
		const searchResult = (await ctx.runAction(api.ragchat.semanticSearch, {
			workspaceId: args.workspaceId,
			query: args.query,
			limit: args.limit || 10,
		})) as {
			results: Array<{
				entryId: string;
				score: number;
				content: Array<{ text: string; metadata?: Record<string, unknown> }>;
			}>;
		};

		const mappedResults = searchResult.results.map((r) => {
			const firstContent = r.content?.[0];
			const contentType =
				firstContent && typeof firstContent.metadata?.contentType === "string"
					? String(firstContent.metadata?.contentType)
					: "content";
			return {
				id: r.entryId,
				text: firstContent?.text ?? "",
				type: contentType,
				score: r.score ?? 0,
			};
		});

		return {
			results: mappedResults,
			count: mappedResults.length,
		};
	},
});
