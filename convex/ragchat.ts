import { getAuthUserId } from "@convex-dev/auth/server";
import { RAG } from "@convex-dev/rag";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";

type FilterTypes = {
	workspaceId: string;
	contentType: string;
	channelId: string;
};
const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY || "",
});

const rag = new RAG<FilterTypes>(components.rag as any, {
	filterNames: ["workspaceId", "contentType", "channelId"],
	textEmbeddingModel: openrouter.textEmbeddingModel(
		"openai/text-embedding-ada-002"
	) as any,
	embeddingDimension: 1536,
});

const NO_CHANNEL_FILTER_VALUE = "__none__";

function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") {
		return String(body);
	}
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

export const indexContent = action({
	args: {
		workspaceId: v.id("workspaces"),
		contentId: v.string(),
		contentType: v.union(
			v.literal("message"),
			v.literal("task"),
			v.literal("note"),
			v.literal("card"),
			v.literal("event")
		),
		text: v.string(),
		metadata: v.any(),
	},
	handler: async (ctx, args) => {
		if (!args.text || args.text.trim().length < 3) return;
		if (!process.env.OPENAI_API_KEY) return;
		const channelIdFilterValue = (() => {
			const metadata = args.metadata as unknown;
			if (!metadata || typeof metadata !== "object") {
				return NO_CHANNEL_FILTER_VALUE;
			}
			const maybeChannelId = (metadata as { channelId?: unknown }).channelId;
			if (typeof maybeChannelId === "string" && maybeChannelId.length > 0) {
				return maybeChannelId;
			}
			return NO_CHANNEL_FILTER_VALUE;
		})();
		const filterValues: Array<{
			name: "workspaceId" | "contentType" | "channelId";
			value: string;
		}> = [
			{ name: "workspaceId", value: args.workspaceId as string },
			{ name: "contentType", value: args.contentType },
			{ name: "channelId", value: channelIdFilterValue },
		];
		await rag.add(ctx, {
			namespace: args.workspaceId,
			key: args.contentId,
			text: args.text,
			filterValues,
		});
	},
});

export const getWorkspaceMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit);
	},
});

export const getWorkspaceNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit);
	},
});

export const getWorkspaceTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit);
	},
});

export const getWorkspaceCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		const result: Array<{ card: any; list: any; channel: any }> = [];
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();
			for (const list of lists) {
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.take(Math.ceil(limit / Math.max(channels.length, 1)));
				for (const card of cards) {
					result.push({ card, list, channel });
					if (result.length >= limit) return result;
				}
			}
		}
		return result;
	},
});

export const autoIndexMessage = action({
	args: { messageId: v.id("messages") },
	handler: async (ctx, args) => {
		const message = await ctx.runQuery(api.messages.getById, {
			id: args.messageId,
		});
		if (message) {
			await ctx.runAction(api.ragchat.indexContent, {
				workspaceId: message.workspaceId,
				contentId: message._id,
				contentType: "message",
				text: extractTextFromRichText(message.body),
				metadata: {
					channelId: message.channelId,
					memberId: message.memberId,
					conversationId: message.conversationId,
				},
			});
		}
	},
});

export const autoIndexNote = action({
	args: { noteId: v.id("notes") },
	handler: async (ctx, args) => {
		const note = await ctx.runQuery(internal.notes._getNoteById, {
			noteId: args.noteId,
		});
		if (note) {
			await ctx.runAction(api.ragchat.indexContent, {
				workspaceId: note.workspaceId,
				contentId: note._id,
				contentType: "note",
				text: `${note.title}: ${extractTextFromRichText(note.content)}`,
				metadata: {
					channelId: note.channelId,
					memberId: note.memberId,
				},
			});
		}
	},
});

export const getTaskForIndexing = query({
	args: { taskId: v.id("tasks") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.taskId);
	},
});

export const getCardForIndexing = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx, args) => {
		const card = await ctx.db.get(args.cardId);
		if (!card) return null;
		const list = await ctx.db.get(card.listId);
		if (!list) return null;
		const channel = await ctx.db.get(list.channelId);
		if (!channel) return null;
		return { card, list, channel };
	},
});

export const autoIndexTask = action({
	args: { taskId: v.id("tasks") },
	handler: async (ctx, args) => {
		const task = await ctx.runQuery(api.ragchat.getTaskForIndexing, {
			taskId: args.taskId,
		});
		if (task) {
			await ctx.runAction(api.ragchat.indexContent, {
				workspaceId: task.workspaceId,
				contentId: task._id,
				contentType: "task",
				text: task.title + (task.description ? `: ${task.description}` : ""),
				metadata: {
					userId: task.userId,
					status: task.status,
					completed: task.completed,
				},
			});
		}
	},
});

export const autoIndexCard = action({
	args: { cardId: v.id("cards") },
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.ragchat.getCardForIndexing, {
			cardId: args.cardId,
		});
		if (result) {
			const { card, list, channel } = result;
			await ctx.runAction(api.ragchat.indexContent, {
				workspaceId: channel.workspaceId,
				contentId: card._id,
				contentType: "card",
				text: card.title + (card.description ? `: ${card.description}` : ""),
				metadata: {
					listId: card.listId,
					channelId: list.channelId,
				},
			});
		}
	},
});

export const autoIndexCalendarEvent = action({
	args: { eventId: v.id("events") },
	handler: async (ctx, args) => {
		const event = await ctx.runQuery(api.calendar.getEventById, {
			eventId: args.eventId,
		});
		if (event) {
			const text = `${event.title} ${event.time ?? ""}`.trim();
			if (text.length >= 3) {
				await ctx.runAction(api.ragchat.indexContent, {
					workspaceId: event.workspaceId,
					contentId: event._id,
					contentType: "event",
					text,
					metadata: {
						date: event.date,
						memberId: event.memberId,
					},
				});
			}
		}
	},
});

export const bulkIndexWorkspace = action({
	args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
	handler: async (
		ctx,
		args
	): Promise<{
		success: true;
		indexed: {
			messages: number;
			notes: number;
			tasks: number;
			cards: number;
			events: number;
		};
	}> => {
		const limit = args.limit ?? 100;
		try {
			await rag.add(ctx, {
				namespace: args.workspaceId,
				key: "__workspace_init__",
				text: "Workspace initialized for RAG search",
				filterValues: [
					{ name: "workspaceId", value: args.workspaceId as string },
					{ name: "contentType", value: "message" },
					{ name: "channelId", value: NO_CHANNEL_FILTER_VALUE },
				],
			});
		} catch {
			// Namespace may already exist
		}
		const messages: Doc<"messages">[] = await ctx.runQuery(
			api.ragchat.getWorkspaceMessages,
			{
				workspaceId: args.workspaceId,
				limit,
			}
		);
		for (const message of messages) {
			try {
				await ctx.runAction(api.ragchat.indexContent, {
					workspaceId: message.workspaceId,
					contentId: message._id,
					contentType: "message",
					text: extractTextFromRichText(message.body),
					metadata: {
						channelId: message.channelId,
						memberId: message.memberId,
						conversationId: message.conversationId,
					},
				});
			} catch {
				// Skip failed items
			}
		}
		const notes: Doc<"notes">[] = await ctx.runQuery(
			api.ragchat.getWorkspaceNotes,
			{
				workspaceId: args.workspaceId,
				limit,
			}
		);
		for (const note of notes) {
			try {
				await ctx.runAction(api.ragchat.indexContent, {
					workspaceId: note.workspaceId,
					contentId: note._id,
					contentType: "note",
					text: `${note.title}: ${extractTextFromRichText(note.content)}`,
					metadata: {
						channelId: note.channelId,
						memberId: note.memberId,
					},
				});
			} catch {
				// Skip failed items
			}
		}
		const tasks: Doc<"tasks">[] = await ctx.runQuery(
			api.ragchat.getWorkspaceTasks,
			{
				workspaceId: args.workspaceId,
				limit,
			}
		);
		for (const task of tasks) {
			try {
				await ctx.runAction(api.ragchat.indexContent, {
					workspaceId: task.workspaceId,
					contentId: task._id,
					contentType: "task",
					text: task.title + (task.description ? `: ${task.description}` : ""),
					metadata: {
						userId: task.userId,
						status: task.status,
						completed: task.completed,
					},
				});
			} catch {
				// Skip failed items
			}
		}
		const cardsWithInfo: Array<{
			card: Doc<"cards">;
			list: Doc<"lists">;
			channel: Doc<"channels">;
		}> = await ctx.runQuery(api.ragchat.getWorkspaceCards, {
			workspaceId: args.workspaceId,
			limit,
		});
		for (const { card, list, channel } of cardsWithInfo) {
			try {
				await ctx.runAction(api.ragchat.indexContent, {
					workspaceId: channel.workspaceId,
					contentId: card._id,
					contentType: "card",
					text: card.title + (card.description ? `: ${card.description}` : ""),
					metadata: {
						listId: card.listId,
						channelId: list.channelId,
					},
				});
			} catch {
				// Skip failed items
			}
		}
		const events: Doc<"events">[] = await ctx.runQuery(
			api.calendar.getWorkspaceEvents,
			{
				workspaceId: args.workspaceId,
				limit,
			}
		);
		for (const event of events) {
			try {
				await ctx.runAction(api.ragchat.autoIndexCalendarEvent, {
					eventId: event._id,
				});
			} catch {
				// Skip failed items
			}
		}
		return {
			success: true,
			indexed: {
				messages: messages.length,
				notes: notes.length,
				tasks: tasks.length,
				cards: cardsWithInfo.length,
				events: events.length,
			},
		};
	},
});

export const triggerBulkIndexing = mutation({
	args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.first();
		if (!member) throw new Error("User is not a member of this workspace");
		await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit ?? 1000,
		});
		return { scheduled: true };
	},
});

export const triggerBulkIndexingInternal = internalMutation({
	args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit ?? 1000,
		});
		return { scheduled: true };
	},
});

export const autoInitializeWorkspace = mutation({
	args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit ?? 1000,
		});
		return { scheduled: true };
	},
});

export const semanticSearch = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.optional(v.id("users")),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = args.userId ?? (await getAuthUserId(ctx));
		if (!userId) throw new Error("Unauthorized");

		const member = await ctx.runQuery(api.members.current, {
			workspaceId: args.workspaceId,
		});
		if (!member) throw new Error("User is not a member of this workspace");

		const channels = await ctx.runQuery(api.channels.get, {
			workspaceId: args.workspaceId,
		});
		const channelIds = channels.map((c: { _id: string }) => c._id);

		const filters: Array<{
			name: "workspaceId" | "contentType" | "channelId";
			value: string;
		}> = [
			{ name: "workspaceId", value: args.workspaceId as string },
			{ name: "channelId", value: NO_CHANNEL_FILTER_VALUE },
		];
		for (const id of channelIds) {
			filters.push({ name: "channelId", value: id });
		}

		try {
			const { results, text, entries } = await rag.search(ctx, {
				namespace: args.workspaceId as string,
				query: args.query,
				filters,
				limit: args.limit ?? 10,
				vectorScoreThreshold: 0.5,
			});
			return { results, text, entries };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("No compatible namespace found")) {
				try {
					await ctx.runMutation(api.ragchat.autoInitializeWorkspace, {
						workspaceId: args.workspaceId,
						limit: 1000,
					});
				} catch {
					// Ignore
				}
				return { results: [], text: "", entries: [] };
			}
			throw error;
		}
	},
});
