/**
 * AI Assistant Tools - replaces deterministic intent matching with AI-driven tool selection
 *
 * Each tool is a Convex query/action that the AI can call based on user intent.
 * The LLM reads the tool descriptions and decides which to invoke.
 */

import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, query } from "./_generated/server";
import { extractTextFromRichText } from "./richText";

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

function compactText(text: string, maxLength = 180) {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength - 3).trimEnd()}...`
		: normalized;
}

function getTaskPriorityScore(priority?: string) {
	switch (priority) {
		case "high":
			return 3;
		case "medium":
			return 2;
		case "low":
			return 1;
		default:
			return 0;
	}
}

function getTaskStatusScore(status?: string, dueDate?: number) {
	const now = Date.now();
	const normalizedStatus = status ?? "not_started";
	if (dueDate && dueDate < now) return 5;
	switch (normalizedStatus) {
		case "in_progress":
			return 4;
		case "on_hold":
			return 3;
		case "not_started":
			return 2;
		case "completed":
			return 1;
		default:
			return 0;
	}
}

function sortTasksForAssistant<T extends { status?: string; dueDate?: number; priority?: string }>(
	tasks: T[]
) {
	return [...tasks].sort((a, b) => {
		const statusDelta =
			getTaskStatusScore(b.status, b.dueDate) -
			getTaskStatusScore(a.status, a.dueDate);
		if (statusDelta !== 0) return statusDelta;

		const priorityDelta =
			getTaskPriorityScore(b.priority) - getTaskPriorityScore(a.priority);
		if (priorityDelta !== 0) return priorityDelta;

		const dueA = a.dueDate ?? Number.MAX_SAFE_INTEGER;
		const dueB = b.dueDate ?? Number.MAX_SAFE_INTEGER;
		if (dueA !== dueB) return dueA - dueB;

		return 0;
	});
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
				eventDate >= startOfDayMs(now) && eventDate <= endOfDayMs(thisWeekEnd)
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
			return (
				task.dueDate >= startOfDayMs(now) &&
				task.dueDate <= endOfDayMs(thisWeekEnd)
			);
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

		const tasks = sortTasksForAssistant(await query.collect());

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
// NOTES TOOLS
// =============================================================================

export const getRecentNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		notes: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				channelName: v.optional(v.string()),
				snippet: v.optional(v.string()),
				updatedAt: v.optional(v.number()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const notes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(args.limit ?? 10);

		const typedNotes = notes as Doc<"notes">[];
		const channelIds = Array.from(
			new Set(typedNotes.map((note) => note.channelId))
		) as Id<"channels">[];
		const channels = await Promise.all(
			channelIds.map((channelId) => ctx.db.get(channelId))
		);
		const channelMap = new Map(
			channels
				.filter((channel): channel is Doc<"channels"> => Boolean(channel))
				.map((channel) => [channel._id, channel.name] as const)
		);

		return {
			notes: typedNotes.map((note) => ({
				id: note._id,
				title: note.title,
				channelName: channelMap.get(note.channelId),
				snippet: compactText(extractTextFromRichText(note.content), 140) || undefined,
				updatedAt: note.updatedAt,
			})),
			count: notes.length,
		};
	},
});

export const searchNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		notes: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				channelName: v.optional(v.string()),
				snippet: v.optional(v.string()),
				updatedAt: v.optional(v.number()),
				sourceRefs: v.array(v.string()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const noteResults = (await ctx.runQuery(api.search.searchNotes, {
			workspaceId: args.workspaceId,
			query: args.query,
			limit: args.limit ?? 10,
		})) as Array<{
			_id: Id<"notes">;
			title: string;
			channelId: Id<"channels">;
		}>;

		const noteDocs = await Promise.all(
			noteResults.map((note) => ctx.db.get(note._id))
		);
		const noteMap = new Map(
			noteDocs
				.filter((note): note is Doc<"notes"> => Boolean(note))
				.map((note) => [note._id, note] as const)
		);

		const channelIds = Array.from(
			new Set(noteResults.map((note) => note.channelId))
		) as Id<"channels">[];
		const channels = await Promise.all(
			channelIds.map((channelId) => ctx.db.get(channelId))
		);
		const channelMap = new Map(
			channels
				.filter((channel): channel is Doc<"channels"> => Boolean(channel))
				.map((channel) => [channel._id, channel.name] as const)
		);

		return {
			notes: noteResults.map((note) => ({
				id: note._id,
				title: note.title,
				channelName: channelMap.get(note.channelId),
				snippet:
					compactText(
						extractTextFromRichText(noteMap.get(note._id)?.content ?? ""),
						160
					) || undefined,
				updatedAt: noteMap.get(note._id)?.updatedAt,
				sourceRefs: [
					`Note: ${note.title}`,
					...(channelMap.get(note.channelId)
						? [`Channel: #${channelMap.get(note.channelId)}`]
						: []),
				],
			})),
			count: noteResults.length,
		};
	},
});

export const searchTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		query: v.string(),
		limit: v.optional(v.number()),
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
				matchContext: v.optional(v.string()),
			})
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		const taskResults = (await ctx.runQuery(api.search.searchTasks, {
			workspaceId: args.workspaceId,
			query: args.query,
			limit: args.limit ?? 12,
		})) as Array<{
			_id: Id<"tasks">;
			title: string;
			description?: string;
		}>;

		const taskDocs = await Promise.all(
			taskResults.map((task) => ctx.db.get(task._id))
		);
		const visibleTasks = sortTasksForAssistant(
			taskDocs.filter((task): task is Doc<"tasks"> => {
				if (!task) return false;
				return (
					task.userId === args.userId && task.workspaceId === args.workspaceId
				);
			})
		);

		return {
			tasks: visibleTasks.map((task) => ({
				id: task._id,
				title: task.title,
				description: task.description,
				status: task.status || "not_started",
				priority: task.priority,
				dueDate: task.dueDate,
				completed: task.completed,
				matchContext: compactText(task.description ?? "", 140) || undefined,
			})),
			count: visibleTasks.length,
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

export const getChannelDebug = query({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.id("channels"),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		channelName: v.string(),
		messageCount: v.number(),
		recentMessages: v.array(
			v.object({
				id: v.string(),
				body: v.string(),
				authorName: v.optional(v.string()),
				memberId: v.string(),
				creationTime: v.number(),
			})
		),
	}),
	handler: async (ctx, args) => {
		const channel = await ctx.db.get(args.channelId);
		if (!channel || channel.workspaceId !== args.workspaceId) {
			return {
				channelName: "unknown",
				messageCount: 0,
				recentMessages: [],
			};
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
			.order("desc")
			.take(args.limit ?? 20);

		const topLevelMessages = messages.filter((message) => !message.parentMessageId);
		const memberIds = Array.from(
			new Set(topLevelMessages.map((message) => message.memberId))
		);
		const members = await Promise.all(memberIds.map((memberId) => ctx.db.get(memberId)));
		const memberMap = new Map(
			members
				.filter((member): member is Doc<"members"> => Boolean(member))
				.map((member) => [member._id, member] as const)
		);
		const userIds = Array.from(
			new Set(
				members
					.filter((member): member is Doc<"members"> => Boolean(member))
					.map((member) => member.userId)
			)
		);
		const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId)));
		const userMap = new Map(
			users
				.filter((user): user is Doc<"users"> => Boolean(user))
				.map((user) => [user._id, user] as const)
		);

		const recentMessages = topLevelMessages
			.reverse()
			.map((message) => {
				const member = memberMap.get(message.memberId);
				const user = member ? userMap.get(member.userId) : null;
				return {
					id: message._id,
					body: compactText(extractTextFromRichText(message.body), 220),
					authorName: user?.name,
					memberId: message.memberId,
					creationTime: message._creationTime,
				};
			});

		return {
			channelName: channel.name,
			messageCount: recentMessages.length,
			recentMessages,
		};
	},
});

export const getChannelSummary = query({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.id("channels"),
		limit: v.optional(v.number()),
	},
	returns: v.object({
		summary: v.string(),
		messageCount: v.number(),
		channelName: v.string(),
		recentMessages: v.array(
			v.object({
				id: v.string(),
				body: v.string(),
				authorName: v.optional(v.string()),
				creationTime: v.number(),
			})
		),
	}),
	handler: async (ctx, args): Promise<{
		summary: string;
		messageCount: number;
		channelName: string;
		recentMessages: Array<{
			id: string;
			body: string;
			authorName?: string;
			creationTime: number;
		}>;
	}> => {
		const debug = await ctx.runQuery(api.assistantTools.getChannelDebug, {
			workspaceId: args.workspaceId,
			channelId: args.channelId,
			limit: args.limit,
		});

		if (debug.messageCount === 0) {
			return {
				summary:
					debug.channelName === "unknown"
						? "Channel not found"
						: `No messages found in #${debug.channelName}.`,
				messageCount: 0,
				channelName: debug.channelName,
				recentMessages: [],
			};
		}

		const messageContext: string = debug.recentMessages
			.slice(-10)
			.map((message) =>
				message.authorName
					? `${message.authorName}: ${message.body}`
					: message.body
			)
			.join("\n");

		return {
			summary: messageContext,
			messageCount: debug.messageCount,
			channelName: debug.channelName,
			recentMessages: debug.recentMessages.map((message) => ({
				id: message.id,
				body: message.body,
				authorName: message.authorName,
				creationTime: message.creationTime,
			})),
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

export const getWorkspaceGeneralSummary = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		highPriorityTasks: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				status: v.string(),
				priority: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})
		),
		recentNotes: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				channelName: v.optional(v.string()),
				snippet: v.optional(v.string()),
			})
		),
		recentMessages: v.array(
			v.object({
				channelName: v.string(),
				authorName: v.string(),
				body: v.string(),
				creationTime: v.number(),
			})
		),
		channelCount: v.number(),
		taskCount: v.number(),
	}),
	handler: async (ctx, args) => {
		const [allTasks, noteResult, recentMessages, overview] = await Promise.all([
			ctx.db
				.query("tasks")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.filter((q) => q.eq(q.field("userId"), args.userId))
				.filter((q) => q.eq(q.field("completed"), false))
				.collect(),
			ctx.runQuery(api.assistantTools.getRecentNotes, {
				workspaceId: args.workspaceId,
				limit: 4,
			}) as Promise<{
				notes: Array<{
					id: string;
					title: string;
					channelName?: string;
					snippet?: string;
				}>;
			}>,
			ctx.runQuery(api.messages.getRecentWorkspaceChannelMessages, {
				workspaceId: args.workspaceId,
				limit: 8,
			}) as Promise<
				Array<{
					channelName: string;
					authorName: string;
					body: string;
					_creationTime: number;
				}>
			>,
			ctx.runQuery(api.assistantTools.getWorkspaceOverview, {
				workspaceId: args.workspaceId,
				userId: args.userId,
			}),
		]);

		const highPriorityTasks = sortTasksForAssistant(allTasks)
			.slice(0, 5)
			.map((task) => ({
				id: task._id,
				title: task.title,
				status: task.status || "not_started",
				priority: task.priority,
				dueDate: task.dueDate,
			}));

		return {
			highPriorityTasks,
			recentNotes: noteResult.notes.slice(0, 4),
			recentMessages: recentMessages.map((message: {
				channelName: string;
				authorName: string;
				body: string;
				_creationTime: number;
			}) => ({
				channelName: message.channelName,
				authorName: message.authorName,
				body: compactText(extractTextFromRichText(message.body), 160),
				creationTime: message._creationTime,
			})),
			channelCount: overview.channelCount,
			taskCount: overview.taskCount,
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
				sourceRefs: v.array(v.string()),
			})
		),
		count: v.number(),
	}),
	handler: async (
		ctx,
		args
	): Promise<{
		results: Array<{
			id: string;
			text: string;
			type: string;
			score: number;
			sourceRefs: string[];
		}>;
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
			entries?: Array<{
				entryId: string;
				key?: string;
				title?: string;
				metadata?: Record<string, unknown>;
			}>;
		};

		const entriesById = new Map(
			(searchResult.entries ?? []).map((entry) => [entry.entryId, entry] as const)
		);
		const createSnippet = (text: string) => {
			const normalized = text.replace(/\s+/g, " ").trim();
			if (!normalized) return "";
			return normalized.length > 80
				? `${normalized.slice(0, 77).trimEnd()}...`
				: normalized;
		};
		const getSourceTypeLabel = (contentType: string) => {
			switch (contentType) {
				case "task":
					return "Task";
				case "note":
					return "Note";
				case "message":
					return "Message";
				case "card":
					return "Board Card";
				case "event":
					return "Calendar Event";
				default:
					return "Workspace Item";
			}
		};
		const dedupe = (items: string[]): string[] => {
			const seen = new Set<string>();
			const out: string[] = [];
			for (const item of items) {
				const cleaned = item.trim();
				if (!cleaned) continue;
				if (seen.has(cleaned)) continue;
				seen.add(cleaned);
				out.push(cleaned);
			}
			return out;
		};

		const mappedResults = searchResult.results.map((r) => {
			const firstContent = r.content?.[0];
			const entry = entriesById.get(r.entryId);
			const contentType =
				firstContent && typeof firstContent.metadata?.contentType === "string"
					? String(firstContent.metadata?.contentType)
					: typeof entry?.metadata?.sourceType === "string"
						? String(entry.metadata?.sourceType)
						: "content";
			const contentMeta =
				firstContent?.metadata && typeof firstContent.metadata === "object"
					? firstContent.metadata
					: {};
			const entryMeta =
				entry?.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
			const sourceTypeLabel = getSourceTypeLabel(contentType);
			const primaryLabel =
				entry?.title?.trim() ||
				createSnippet(firstContent?.text ?? "") ||
				String(entry?.key ?? "").trim() ||
				r.entryId;
			const sourceRefs = dedupe([
				`${sourceTypeLabel}: ${primaryLabel}`,
				typeof contentMeta.documentReference === "string"
					? `Document Ref: ${contentMeta.documentReference}`
					: "",
				typeof contentMeta.sourceChain === "string"
					? `Source Chain: ${contentMeta.sourceChain}`
					: "",
			]);
			return {
				id: r.entryId,
				text: firstContent?.text ?? "",
				type: contentType,
				score: r.score ?? 0,
				sourceRefs,
			};
		});

		return {
			results: mappedResults,
			count: mappedResults.length,
		};
	},
});
