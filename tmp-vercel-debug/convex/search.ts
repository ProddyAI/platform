import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") return String(body);
	try {
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: { insert?: string }) =>
					typeof op.insert === "string" ? op.insert : ""
				)
				.join("")
				.trim();
		}
	} catch {
		return body.replace(/<[^>]*>/g, "").trim();
	}
	return body.trim();
}

async function getCurrentMember(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
	const userId = await getAuthUserId(ctx);
	if (!userId) return null;
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();
}

export const searchMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member) return [];

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm) return [];

		const limit = args.limit ?? 20;
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const channelMap = new Map(channels.map((c) => [c._id, c.name]));
		const results: Array<{
			_id: Id<"messages">;
			channelId: Id<"channels"> | undefined;
			channelName: string;
			_creationTime: number;
			text: string;
		}> = [];

		for (const channel of channels) {
			const messages = await ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();
			for (const msg of messages) {
				const text = extractTextFromRichText(msg.body);
				if (text.toLowerCase().includes(searchTerm)) {
					results.push({
						_id: msg._id,
						channelId: msg.channelId,
						channelName: channelMap.get(channel._id) ?? "",
						_creationTime: msg._creationTime,
						text,
					});
					if (results.length >= limit) return results;
				}
			}
		}

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		for (const conv of conversations) {
			if (conv.memberOneId !== member._id && conv.memberTwoId !== member._id)
				continue;
			const messages = await ctx.db
				.query("messages")
				.withIndex("by_conversation_id", (q) =>
					q.eq("conversationId", conv._id)
				)
				.collect();
			for (const msg of messages) {
				const text = extractTextFromRichText(msg.body);
				if (text.toLowerCase().includes(searchTerm)) {
					results.push({
						_id: msg._id,
						channelId: undefined,
						channelName: "Direct message",
						_creationTime: msg._creationTime,
						text,
					});
					if (results.length >= limit) return results;
				}
			}
		}
		return results;
	},
});

export const searchNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member) return [];

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm) return [];

		const limit = args.limit ?? 20;
		const notes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const results: Array<{
			_id: Id<"notes">;
			title: string;
			channelId: Id<"channels">;
		}> = [];
		for (const note of notes) {
			const contentText = extractTextFromRichText(note.content);
			if (
				note.title.toLowerCase().includes(searchTerm) ||
				contentText.toLowerCase().includes(searchTerm)
			) {
				results.push({
					_id: note._id,
					title: note.title,
					channelId: note.channelId,
				});
				if (results.length >= limit) return results;
			}
		}
		return results;
	},
});

export const searchTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member) return [];

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm) return [];

		const limit = args.limit ?? 20;
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const results: Array<{
			_id: Id<"tasks">;
			title: string;
			description?: string;
		}> = [];
		for (const task of tasks) {
			const desc = task.description ?? "";
			if (
				task.title.toLowerCase().includes(searchTerm) ||
				desc.toLowerCase().includes(searchTerm)
			) {
				results.push({
					_id: task._id,
					title: task.title,
					description: task.description,
				});
				if (results.length >= limit) return results;
			}
		}
		return results;
	},
});

export const searchCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member) return [];

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm) return [];

		const limit = args.limit ?? 20;
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const results: Array<{
			_id: Id<"cards">;
			title: string;
			description?: string;
			listId: Id<"lists">;
			channelId: Id<"channels">;
		}> = [];

		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();
			for (const list of lists) {
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.collect();
				for (const card of cards) {
					const desc = card.description ?? "";
					if (
						card.title.toLowerCase().includes(searchTerm) ||
						desc.toLowerCase().includes(searchTerm)
					) {
						results.push({
							_id: card._id,
							title: card.title,
							description: card.description,
							listId: card.listId,
							channelId: channel._id,
						});
						if (results.length >= limit) return results;
					}
				}
			}
		}
		return results;
	},
});

export const searchCalendarEvents = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member) return [];

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm) return [];

		const limit = args.limit ?? 20;
		const events = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const results: Array<{
			_id: Id<"events">;
			title: string;
			date: number;
			time?: string;
		}> = [];
		for (const event of events) {
			const titleMatch = event.title.toLowerCase().includes(searchTerm);
			const timeMatch = event.time?.toLowerCase().includes(searchTerm);
			if (titleMatch || timeMatch) {
				results.push({
					_id: event._id,
					title: event.title,
					date: event.date,
					time: event.time,
				});
				if (results.length >= limit) return results;
			}
		}
		return results;
	},
});

export const searchAll = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);
		if (!member)
			return { messages: [], notes: [], tasks: [], cards: [], events: [] };

		const searchTerm = args.query.toLowerCase().trim();
		if (!searchTerm)
			return { messages: [], notes: [], tasks: [], cards: [], events: [] };

		const limit = args.limit ?? 20;

		const messages: Array<{
			_id: Id<"messages">;
			channelId: Id<"channels"> | undefined;
			channelName: string;
			_creationTime: number;
			text: string;
		}> = [];
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		const channelMap = new Map(channels.map((c) => [c._id, c.name]));
		for (const channel of channels) {
			const msgs = await ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();
			for (const msg of msgs) {
				const text = extractTextFromRichText(msg.body);
				if (text.toLowerCase().includes(searchTerm)) {
					messages.push({
						_id: msg._id,
						channelId: msg.channelId,
						channelName: channelMap.get(channel._id) ?? "",
						_creationTime: msg._creationTime,
						text,
					});
					if (messages.length >= limit) break;
				}
			}
			if (messages.length >= limit) break;
		}
		if (messages.length < limit) {
			const conversations = await ctx.db
				.query("conversations")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect();
			for (const conv of conversations) {
				if (conv.memberOneId !== member._id && conv.memberTwoId !== member._id)
					continue;
				const msgs = await ctx.db
					.query("messages")
					.withIndex("by_conversation_id", (q) =>
						q.eq("conversationId", conv._id)
					)
					.collect();
				for (const msg of msgs) {
					const text = extractTextFromRichText(msg.body);
					if (text.toLowerCase().includes(searchTerm)) {
						messages.push({
							_id: msg._id,
							channelId: undefined,
							channelName: "Direct message",
							_creationTime: msg._creationTime,
							text,
						});
						if (messages.length >= limit) break;
					}
				}
				if (messages.length >= limit) break;
			}
		}

		const notes: Array<{
			_id: Id<"notes">;
			title: string;
			channelId: Id<"channels">;
		}> = [];
		const allNotes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		for (const note of allNotes) {
			const contentText = extractTextFromRichText(note.content);
			if (
				note.title.toLowerCase().includes(searchTerm) ||
				contentText.toLowerCase().includes(searchTerm)
			) {
				notes.push({
					_id: note._id,
					title: note.title,
					channelId: note.channelId,
				});
				if (notes.length >= limit) break;
			}
		}

		const tasks: Array<{
			_id: Id<"tasks">;
			title: string;
			description?: string;
		}> = [];
		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		for (const task of allTasks) {
			const desc = task.description ?? "";
			if (
				task.title.toLowerCase().includes(searchTerm) ||
				desc.toLowerCase().includes(searchTerm)
			) {
				tasks.push({
					_id: task._id,
					title: task.title,
					description: task.description,
				});
				if (tasks.length >= limit) break;
			}
		}

		const cards: Array<{
			_id: Id<"cards">;
			title: string;
			description?: string;
			listId: Id<"lists">;
			channelId: Id<"channels">;
		}> = [];
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();
			for (const list of lists) {
				const cardList = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.collect();
				for (const card of cardList) {
					const desc = card.description ?? "";
					if (
						card.title.toLowerCase().includes(searchTerm) ||
						desc.toLowerCase().includes(searchTerm)
					) {
						cards.push({
							_id: card._id,
							title: card.title,
							description: card.description,
							listId: card.listId,
							channelId: channel._id,
						});
						if (cards.length >= limit) break;
					}
				}
				if (cards.length >= limit) break;
			}
			if (cards.length >= limit) break;
		}

		const events: Array<{
			_id: Id<"events">;
			title: string;
			date: number;
			time?: string;
		}> = [];
		const allEvents = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		for (const event of allEvents) {
			const titleMatch = event.title.toLowerCase().includes(searchTerm);
			const timeMatch = event.time?.toLowerCase().includes(searchTerm);
			if (titleMatch || timeMatch) {
				events.push({
					_id: event._id,
					title: event.title,
					date: event.date,
					time: event.time,
				});
				if (events.length >= limit) break;
			}
		}

		return { messages, notes, tasks, cards, events };
	},
});
