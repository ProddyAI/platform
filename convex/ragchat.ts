import { openai } from "@ai-sdk/openai";
import { getAuthUserId } from "@convex-dev/auth/server";
import { RAG } from "@convex-dev/rag";
import { generateText } from "ai";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { extractTextFromRichText } from "./richText";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Deterministic string hash for cache key (no Node crypto). */
function hashQuery(query: string): string {
	const s = query.trim().toLowerCase();
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (h << 5) - h + s.charCodeAt(i);
		h |= 0;
	}
	return String(h);
}

type FilterTypes = {
	workspaceId: string;
	contentType: string;
	channelId: string;
};
const rag = new RAG<FilterTypes>(components.rag as any, {
	filterNames: ["workspaceId", "contentType", "channelId"],
	textEmbeddingModel: openai.embedding("text-embedding-3-large") as any,
	embeddingDimension: 3072,
});

const NO_CHANNEL_FILTER_VALUE = "__none__";

export const getSearchCache = query({
	args: { workspaceId: v.id("workspaces"), queryHash: v.string() },
	returns: v.union(v.null(), v.any()),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("assistantSearchCache")
			.withIndex("by_workspace_query", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("queryHash", args.queryHash)
			)
			.unique();
		if (!row || row.expiresAt <= Date.now()) return null;
		return row.result;
	},
});

export const setSearchCache = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		queryHash: v.string(),
		result: v.any(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantSearchCache")
			.withIndex("by_workspace_query", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("queryHash", args.queryHash)
			)
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				result: args.result,
				expiresAt: args.expiresAt,
			});
		} else {
			await ctx.db.insert("assistantSearchCache", {
				workspaceId: args.workspaceId,
				queryHash: args.queryHash,
				result: args.result,
				expiresAt: args.expiresAt,
			});
		}
	},
});

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
		return {
			scheduled: true,
			message: "Re-indexing workspace content. This may take a few minutes.",
		};
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
	handler: async (
		ctx,
		args
	): Promise<{ results: unknown[]; text: string; entries: unknown[] }> => {
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

		const requestedLimit = args.limit ?? 10;
		const queryHash = hashQuery(`${args.query}|${requestedLimit}`);
		const cached: unknown = await ctx.runQuery(api.ragchat.getSearchCache, {
			workspaceId: args.workspaceId,
			queryHash,
		});
		if (cached != null) {
			return cached as { results: unknown[]; text: string; entries: unknown[] };
		}

		try {
			// Stage 1: broad vector search (more candidates, lower threshold)
			const { results, text, entries } = await rag.search(ctx, {
				namespace: args.workspaceId as string,
				query: args.query,
				filters,
				limit: Math.min(50, requestedLimit * 5),
				vectorScoreThreshold: 0.3,
			});

			if (results.length <= requestedLimit) {
				const out = { results, text, entries };
				await ctx.runMutation(api.ragchat.setSearchCache, {
					workspaceId: args.workspaceId,
					queryHash,
					result: out,
					expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
				});
				return out;
			}

			// Stage 2: rerank with LLM (top K by relevance to query)
			const topK = requestedLimit;
			const passageList = results
				.map((r, i) => `[${i}] ${r.content?.[0]?.text ?? ""}`)
				.join("\n\n");
			const { text: rankOutput } = await generateText({
				model: openai("gpt-4o-mini"),
				system:
					"You output only a JSON array of integers: the zero-based indices of passages in order of relevance to the query, most relevant first. Output exactly one array, e.g. [3,0,1].",
				prompt: `Query: ${args.query}\n\nPassages:\n${passageList}\n\nReturn the top ${topK} most relevant passage indices as a JSON array.`,
			});
			let indices: number[] = [];
			try {
				const parsed = JSON.parse(
					rankOutput.replace(/^[^[]*\[/, "[").replace(/\][^]*$/, "]")
				);
				if (Array.isArray(parsed)) {
					indices = parsed.filter(
						(n) => typeof n === "number" && n >= 0 && n < results.length
					);
				}
			} catch {
				// Fallback: use original order
				indices = results.map((_, i) => i).slice(0, topK);
			}

			// Stage 3: diversify by contentType (max 3 per type)
			const contentTypeCount: Record<string, number> = {};
			const maxPerType = 3;
			const rerankedResults: typeof results = [];
			const rerankedEntries: typeof entries = [];
			for (const i of indices) {
				if (rerankedResults.length >= requestedLimit) break;
				const entry = entries[i];
				const filterValues = entry?.filterValues;
				const contentType =
					(Array.isArray(filterValues)
						? (
								filterValues.find((f) => f.name === "contentType") as
									| { value?: string }
									| undefined
							)?.value
						: undefined) ?? "message";
				if ((contentTypeCount[contentType] ?? 0) >= maxPerType) continue;
				contentTypeCount[contentType] =
					(contentTypeCount[contentType] ?? 0) + 1;
				rerankedResults.push(results[i]);
				if (entry) rerankedEntries.push(entry);
			}
			const combinedText = rerankedResults
				.map((r) => r.content?.[0]?.text ?? "")
				.join("\n\n");
			const out = {
				results: rerankedResults,
				text: combinedText,
				entries: rerankedEntries,
			};
			await ctx.runMutation(api.ragchat.setSearchCache, {
				workspaceId: args.workspaceId,
				queryHash,
				result: out,
				expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
			});
			return out;
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
