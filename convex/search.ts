import { openai } from "@ai-sdk/openai";
import { getAuthUserId } from "@convex-dev/auth/server";
import { RAG } from "@convex-dev/rag";
import { v } from "convex/values";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";

// Define result types (maintaining compatibility with existing API)
type SearchResult = {
	_id: Id<any>;
	_creationTime: number;
	type: string;
	text: string;
	workspaceId: Id<"workspaces">;
	[key: string]: any;
};

type MessageResult = SearchResult & {
	type: "message";
	channelId?: Id<"channels">;
	memberId: Id<"members">;
};

type TaskResult = SearchResult & {
	type: "task";
	status: string;
	completed: boolean;
	userId: Id<"users">;
};

type NoteResult = SearchResult & {
	type: "note";
	channelId: Id<"channels">;
	memberId: Id<"members">;
};

type CardResult = SearchResult & {
	type: "card";
	listId: Id<"lists">;
	listName: string;
	channelId?: Id<"channels">;
	channelName?: string;
};

/**
 * Extracts plain text from rich text message body.
 *
 * Handles multiple formats:
 * - Quill Delta JSON format (ops array)
 * - HTML content (strips tags)
 * - Plain text strings
 *
 * @param {string} body - The message body in any supported format
 * @returns {string} Plain text content with formatting removed
 *
 * @example
 * extractTextFromRichText('{"ops":[{"insert":"Hello"}]}') // Returns: "Hello"
 * extractTextFromRichText('<p>Hello</p>') // Returns: "Hello"
 */
function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") {
		return String(body);
	}

	try {
		// Try to parse as JSON (Quill Delta format)
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.trim();
		}
	} catch (_e) {
		// Not JSON, use as is (might contain HTML)
		return body
			.replace(/<[^>]*>/g, "") // Remove HTML tags
			.trim();
	}

	return body.trim();
}

// Define filter types for workspace isolation and content type filtering
type FilterTypes = {
	workspaceId: string;
	contentType: string;
	channelId: string;
};

// Initialize RAG component with workspace and content type filters
// The generated Convex typings for `components.rag` currently omit the optional
// `order` argument on `chunks.list`, while `@convex-dev/rag` expects it. Cast to
// `any` to bypass the transient type mismatch without changing runtime behavior.
const rag = new RAG<FilterTypes>(components.rag as any, {
	filterNames: ["workspaceId", "contentType", "channelId"],
	textEmbeddingModel: openai.embedding("text-embedding-3-small") as any,
	embeddingDimension: 1536,
});

const NO_CHANNEL_FILTER_VALUE = "__none__";

// Index content for RAG search
export const indexContent = action({
	args: {
		workspaceId: v.id("workspaces"),
		contentId: v.string(),
		contentType: v.union(
			v.literal("message"),
			v.literal("task"),
			v.literal("note"),
			v.literal("card")
		),
		text: v.string(),
		metadata: v.any(),
	},
	handler: async (ctx, args) => {
		console.log(
			`Indexing ${args.contentType} ${args.contentId} for workspace ${args.workspaceId}`
		);
		console.log(`Text to index: "${args.text.substring(0, 100)}..."`);

		// Skip indexing if text is empty or too short
		if (!args.text || args.text.trim().length < 3) {
			console.log("Skipping indexing: text too short");
			return;
		}

		// Check if OpenAI API key is configured for embeddings
		if (!process.env.OPENAI_API_KEY) {
			console.error("OPENAI_API_KEY not configured, skipping content indexing");
			return;
		}

		try {
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

			console.log("Filter values:", filterValues);

			const result = await rag.add(ctx, {
				namespace: args.workspaceId,
				key: args.contentId,
				text: args.text,
				filterValues,
			});

			console.log("RAG add result:", result);
			console.log(`Successfully indexed ${args.contentType} ${args.contentId}`);
		} catch (error) {
			console.error(
				`Content indexing error for ${args.contentType} ${args.contentId}:`,
				error
			);
			console.error("Error details:", JSON.stringify(error, null, 2));
			// Re-throw the error so we can see what's happening
			throw error;
		}
	},
});

// Semantic search using RAG
export const semanticSearch = action({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		contentType: v.optional(
			v.union(
				v.literal("message"),
				v.literal("task"),
				v.literal("note"),
				v.literal("card")
			)
		),
		channelId: v.optional(v.id("channels")),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Check if OpenAI API key is configured for embeddings
		if (!process.env.OPENAI_API_KEY) {
			console.warn(
				"OPENAI_API_KEY not configured, falling back to empty results"
			);
			return [];
		}

		const limit = args.limit || 10;

		try {
			// Create filters for workspace isolation and content type filtering
			const filters: Array<
				| { name: "workspaceId"; value: string }
				| { name: "contentType"; value: string }
				| { name: "channelId"; value: string }
			> = [{ name: "workspaceId", value: args.workspaceId as string }];

			if (args.contentType) {
				filters.push({ name: "contentType", value: args.contentType });
			}

			if (args.channelId) {
				filters.push({ name: "channelId", value: args.channelId as string });
			}

			const { results } = await rag.search(ctx, {
				namespace: args.workspaceId,
				query: args.query,
				filters,
				limit,
				vectorScoreThreshold: 0.3, // Only return results with reasonable similarity
			});

			return results.map((result: any) => ({
				_id: result.entryId,
				text: result.content.map((c: any) => c.text).join(" "),
				score: result.score,
				metadata: result.filterValues,
			}));
		} catch (error) {
			console.error("RAG search error:", error);
			// Fall back to empty results if RAG fails
			return [];
		}
	},
});

// Search messages in a workspace (maintaining API compatibility)
export const searchMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<MessageResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		let messagesQuery = ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			);

		if (args.channelId) {
			messagesQuery = ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
				.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId));
		}

		const messages = await messagesQuery.take(limit * 3); // Take more to filter

		// Basic text filtering
		const filteredMessages = messages
			.filter((message) => {
				const text = extractTextFromRichText(message.body).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		return filteredMessages.map((message) => ({
			_id: message._id,
			_creationTime: message._creationTime,
			type: "message",
			text: extractTextFromRichText(message.body),
			channelId: message.channelId,
			memberId: message.memberId,
			workspaceId: message.workspaceId,
		}));
	},
});

// Search tasks in a workspace (maintaining API compatibility)
export const searchTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<TaskResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit * 3); // Take more to filter

		// Basic text filtering
		const filteredTasks = tasks
			.filter((task) => {
				const text = (
					task.title + (task.description ? `: ${task.description}` : "")
				).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		return filteredTasks.map((task) => ({
			_id: task._id,
			_creationTime: task._creationTime,
			type: "task",
			text: task.title + (task.description ? `: ${task.description}` : ""),
			status: task.status || "not_started",
			completed: task.completed,
			workspaceId: task.workspaceId,
			userId: task.userId,
		}));
	},
});

// Search notes in a workspace (maintaining API compatibility)
export const searchNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<NoteResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		let notesQuery = ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			);

		if (args.channelId) {
			notesQuery = ctx.db
				.query("notes")
				.withIndex("by_workspace_id_channel_id", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("channelId", args.channelId!)
				);
		}

		const notes = await notesQuery.take(limit * 3); // Take more to filter

		// Basic text filtering
		const filteredNotes = notes
			.filter((note) => {
				const text = (
					note.title +
					": " +
					extractTextFromRichText(note.content)
				).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		return filteredNotes.map((note) => ({
			_id: note._id,
			_creationTime: note._creationTime,
			type: "note",
			text: `${note.title}: ${extractTextFromRichText(note.content)}`,
			channelId: note.channelId,
			memberId: note.memberId,
			workspaceId: note.workspaceId,
		}));
	},
});

// Search cards in a workspace (maintaining API compatibility)
export const searchCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<CardResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		// First, get all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const channelIds = channels.map((channel) => channel._id);

		// Get all lists in these channels
		const lists = await Promise.all(
			channelIds.map((channelId) =>
				ctx.db
					.query("lists")
					.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
					.collect()
			)
		).then((results) => results.flat());

		const listIds = lists.map((list) => list._id);

		// Get cards from these lists
		const cards = await Promise.all(
			listIds.map((listId) =>
				ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", listId))
					.take(Math.ceil(limit / listIds.length))
			)
		).then((results) => results.flat().slice(0, limit * 3));

		// Basic text filtering
		const filteredCards = cards
			.filter((card) => {
				const text = (
					card.title + (card.description ? `: ${card.description}` : "")
				).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		// Process cards to add metadata
		return await Promise.all(
			filteredCards.map(async (card) => {
				const list = lists.find((l) => l._id === card.listId);
				const channel = list
					? channels.find((c) => c._id === list.channelId)
					: null;

				return {
					_id: card._id,
					_creationTime: card._creationTime,
					type: "card",
					text: card.title + (card.description ? `: ${card.description}` : ""),
					listId: card.listId,
					listName: list?.title || "Unknown List",
					channelId: channel?._id,
					channelName: channel?.name || "Unknown Channel",
					workspaceId: args.workspaceId,
				};
			})
		);
	},
});

// Comprehensive search across all content types (maintaining API compatibility)
export const searchAll = query({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<SearchResult[]> => {
		const totalLimit = args.limit || 10;
		const perTypeLimit = Math.ceil(totalLimit / 4); // Divide limit among 4 types

		// Run all searches in parallel
		const [messages, tasks, notes, cards] = await Promise.all([
			ctx.runQuery(api.search.searchMessages, {
				workspaceId: args.workspaceId,
				channelId: args.channelId,
				query: args.query,
				limit: perTypeLimit,
			}),
			ctx.runQuery(api.search.searchTasks, {
				workspaceId: args.workspaceId,
				query: args.query,
				limit: perTypeLimit,
			}),
			ctx.runQuery(api.search.searchNotes, {
				workspaceId: args.workspaceId,
				channelId: args.channelId,
				query: args.query,
				limit: perTypeLimit,
			}),
			ctx.runQuery(api.search.searchCards, {
				workspaceId: args.workspaceId,
				query: args.query,
				limit: perTypeLimit,
			}),
		]);

		// Combine and sort by creation time (newest first)
		const allResults = [...messages, ...tasks, ...notes, ...cards]
			.sort((a, b) => b._creationTime - a._creationTime)
			.slice(0, totalLimit);

		return allResults;
	},
});

// Auto-indexing functions for new content
export const autoIndexMessage = action({
	args: {
		messageId: v.id("messages"),
	},
	handler: async (ctx, args) => {
		const message = await ctx.runQuery(api.messages.getById, {
			id: args.messageId,
		});
		if (message) {
			await ctx.runAction(api.search.indexContent, {
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
	args: {
		noteId: v.id("notes"),
	},
	handler: async (ctx, args) => {
		const note = await ctx.runQuery(api.notes.getById, { noteId: args.noteId });
		if (note) {
			await ctx.runAction(api.search.indexContent, {
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

// Helper queries for auto-indexing
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

		return {
			card,
			list,
			channel,
		};
	},
});

// Auto-indexing actions using queries
export const autoIndexTask = action({
	args: {
		taskId: v.id("tasks"),
	},
	handler: async (ctx, args) => {
		const task = await ctx.runQuery(api.search.getTaskForIndexing, {
			taskId: args.taskId,
		});
		if (task) {
			await ctx.runAction(api.search.indexContent, {
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
	args: {
		cardId: v.id("cards"),
	},
	handler: async (ctx, args) => {
		const result = await ctx.runQuery(api.search.getCardForIndexing, {
			cardId: args.cardId,
		});
		if (result) {
			const { card, list, channel } = result;
			await ctx.runAction(api.search.indexContent, {
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

/**
 * Retrieves messages from a workspace in descending order (newest first).
 *
 * Used by AI search to fetch recent messages for analysis and by bulk indexing
 * operations to populate the search index.
 *
 * @param {Id<'workspaces'>} workspaceId - The workspace to fetch messages from
 * @param {number} [limit=100] - Maximum number of messages to return (default: 100)
 *
 * @returns {Promise<Array>} Array of message documents ordered by creation time (newest first)
 */
export const getWorkspaceMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
		return await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit);
	},
});

/**
 * Searches workspace messages by text content with case-insensitive matching.
 *
 * Filters messages based on query string and enriches results with channel information.
 * Used by both normal search UI and AI search to find relevant messages.
 *
 * @param {Id<'workspaces'>} workspaceId - The workspace to search within
 * @param {string} query - Text to search for in message bodies (case-insensitive)
 * @param {number} [limit=20] - Maximum number of results to return (default: 20)
 *
 * @returns {Promise<Array>} Array of search results with message text, channel info, and metadata
 */
export const searchWorkspaceMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 20;
		const searchQuery = args.query.toLowerCase().trim();

		if (!searchQuery) {
			return [];
		}

		// Verify user has access to this workspace
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.first();

		if (!member) {
			throw new Error("User is not a member of this workspace");
		}

		// Fetch messages from workspace (newest first)
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(200); // Fetch more to filter from

		// Filter and enrich results
		const results = [];
		for (const message of messages) {
			const messageText = extractTextFromRichText(message.body);

			// Case-insensitive text matching
			if (messageText.toLowerCase().includes(searchQuery)) {
				// Get channel info
				let channelName = "Unknown Channel";
				if (message.channelId) {
					const channel = await ctx.db.get(message.channelId);
					if (channel) {
						channelName = channel.name;
					}
				}

				results.push({
					_id: message._id,
					_creationTime: message._creationTime,
					text: messageText,
					channelId: message.channelId,
					channelName,
					memberId: message.memberId,
					workspaceId: message.workspaceId,
				});

				// Stop if we have enough results
				if (results.length >= limit) {
					break;
				}
			}
		}

		return results;
	},
});

export const getWorkspaceNotes = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
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
		const limit = args.limit || 100;
		return await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(limit);
	},
});

/**
 * Check if a RAG namespace exists for a workspace.
 * Returns true if the namespace exists and is ready.
 */
export const checkNamespaceExists = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (_ctx, _args) => {
		// This is a placeholder - we can't directly check the RAG component
		// Instead, we'll return false and let the action handle initialization
		// In practice, the first search will tell us if namespace exists
		return false; // Always return false to trigger check via search
	},
});

/**
 * Retrieves cards from a workspace for bulk indexing.
 *
 * Gets cards with their associated list and channel information needed for indexing.
 */
export const getWorkspaceCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;

		// Get all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const channelIds = channels.map((c) => c._id);
		const cardsWithInfo: Array<{
			card: any;
			list: any;
			channel: any;
		}> = [];

		// For each channel, get its lists and cards
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			for (const list of lists) {
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.take(Math.ceil(limit / channelIds.length));

				for (const card of cards) {
					cardsWithInfo.push({ card, list, channel });
					if (cardsWithInfo.length >= limit) break;
				}
				if (cardsWithInfo.length >= limit) break;
			}
			if (cardsWithInfo.length >= limit) break;
		}

		return cardsWithInfo;
	},
});

/**
 * Fuzzy/semantic search for workspace messages.
 *
 * Falls back to the RAG semantic search to surface related messages when exact
 * substring matching returns no results. Keeps the result shape aligned with
 * `searchWorkspaceMessages` so the UI can swap seamlessly.
 */
export const fuzzySearchMessages = action({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20;
		const searchQuery = args.query.trim();

		if (!searchQuery) {
			return [];
		}

		// Verify user access by running query that checks membership
		// The members.get query already handles auth + membership check
		const members = await ctx.runQuery(api.members.get, {
			workspaceId: args.workspaceId,
		});

		if (!members || members.length === 0) {
			throw new Error("User is not a member of this workspace");
		}

		// Semantic search via RAG component
		const ragResults = await ctx.runAction(api.search.semanticSearch, {
			workspaceId: args.workspaceId,
			query: args.query,
			contentType: "message",
			limit: limit * 2, // extra to allow dedupe/filtering
		});

		const seen = new Set<string>();
		const results: Array<{
			_id: Id<"messages">;
			_creationTime: number;
			text: string;
			channelId?: Id<"channels">;
			channelName: string;
			memberId: Id<"members">;
			workspaceId: Id<"workspaces">;
		}> = [];

		for (const rag of ragResults) {
			if (results.length >= limit) break;

			const message = await ctx.runQuery(api.messages.getById, {
				id: rag._id as Id<"messages">,
			});

			if (!message) continue;
			if (message.workspaceId !== args.workspaceId) continue;
			if (seen.has(message._id)) continue;
			seen.add(message._id);

			let channelName = "Direct Message";
			if (message.channelId) {
				const channel = await ctx.runQuery(api.channels.getById, {
					id: message.channelId,
				});
				if (channel) {
					channelName = channel.name;
				} else {
					channelName = "Unknown Channel";
				}
			}

			results.push({
				_id: message._id,
				_creationTime: message._creationTime,
				text: extractTextFromRichText(message.body),
				channelId: message.channelId,
				channelName,
				memberId: message.memberId,
				workspaceId: message.workspaceId,
			});
		}

		return results;
	},
});

// Bulk indexing function for existing content
export const bulkIndexWorkspace = action({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args
	): Promise<{
		success: boolean;
		indexed: {
			messages: number;
			notes: number;
			tasks: number;
			cards: number;
		};
	}> => {
		const limit = args.limit || 100;
		console.log(
			`Starting bulk indexing for workspace ${args.workspaceId} with limit ${limit}`
		);

		try {
			// First, ensure the RAG namespace exists by adding a dummy entry
			// This will create the namespace if it doesn't exist
			try {
				await rag.add(ctx, {
					namespace: args.workspaceId,
					key: "__workspace_init__",
					text: "Workspace initialized for RAG search",
					title: "System: Workspace Initialization",
					metadata: {},
					filterValues: [
						{ name: "workspaceId", value: args.workspaceId as string },
						{ name: "contentType", value: "message" },
						{ name: "channelId", value: NO_CHANNEL_FILTER_VALUE },
					],
				});
				console.log(
					`RAG namespace created/verified for workspace ${args.workspaceId}`
				);
			} catch (error) {
				console.error("Failed to initialize RAG namespace:", error);
				// Continue anyway, the add operations below will try to create it
			}

			// Index messages
			const messages: any[] = await ctx.runQuery(
				api.search.getWorkspaceMessages,
				{
					workspaceId: args.workspaceId,
					limit,
				}
			);

			console.log(`Found ${messages.length} messages to index`);

			for (const message of messages) {
				try {
					await ctx.runAction(api.search.indexContent, {
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
					console.log(`Indexed message: ${message._id}`);
				} catch (error) {
					console.error(`Failed to index message ${message._id}:`, error);
				}
			}

			// Index notes
			const notes: any[] = await ctx.runQuery(api.search.getWorkspaceNotes, {
				workspaceId: args.workspaceId,
				limit,
			});

			console.log(`Found ${notes.length} notes to index`);

			for (const note of notes) {
				try {
					await ctx.runAction(api.search.indexContent, {
						workspaceId: note.workspaceId,
						contentId: note._id,
						contentType: "note",
						text: `${note.title}: ${extractTextFromRichText(note.content)}`,
						metadata: {
							channelId: note.channelId,
							memberId: note.memberId,
						},
					});
					console.log(`Indexed note: ${note._id}`);
				} catch (error) {
					console.error(`Failed to index note ${note._id}:`, error);
				}
			}

			// Index tasks
			const tasks: any[] = await ctx.runQuery(api.search.getWorkspaceTasks, {
				workspaceId: args.workspaceId,
				limit,
			});

			console.log(`Found ${tasks.length} tasks to index`);

			for (const task of tasks) {
				try {
					await ctx.runAction(api.search.indexContent, {
						workspaceId: task.workspaceId,
						contentId: task._id,
						contentType: "task",
						text:
							task.title + (task.description ? `: ${task.description}` : ""),
						metadata: {
							userId: task.userId,
							status: task.status,
							completed: task.completed,
						},
					});
					console.log(`Indexed task: ${task._id}`);
				} catch (error) {
					console.error(`Failed to index task ${task._id}:`, error);
				}
			}

			// Index cards
			const cardsWithInfo: any[] = await ctx.runQuery(
				api.search.getWorkspaceCards,
				{
					workspaceId: args.workspaceId,
					limit,
				}
			);

			console.log(`Found ${cardsWithInfo.length} cards to index`);

			for (const cardInfo of cardsWithInfo) {
				try {
					const { card, list, channel } = cardInfo;
					await ctx.runAction(api.search.indexContent, {
						workspaceId: channel.workspaceId,
						contentId: card._id,
						contentType: "card",
						text:
							card.title + (card.description ? `: ${card.description}` : ""),
						metadata: {
							listId: card.listId,
							channelId: list.channelId,
						},
					});
					console.log(`Indexed card: ${card._id}`);
				} catch (error) {
					console.error(`Failed to index card ${cardInfo.card._id}:`, error);
				}
			}

			console.log("Bulk indexing completed successfully");
			return {
				success: true,
				indexed: {
					messages: messages.length,
					notes: notes.length,
					tasks: tasks.length,
					cards: cardsWithInfo.length,
				},
			};
		} catch (error) {
			console.error("Bulk indexing failed:", error);
			throw error;
		}
	},
});

// Main semantic search action for chatbot integration
export const searchAllSemantic = action({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<SearchResult[]> => {
		const totalLimit = args.limit || 10;

		// Try semantic search first
		const semanticResults = await ctx.runAction(api.search.semanticSearch, {
			workspaceId: args.workspaceId,
			query: args.query,
			channelId: args.channelId,
			limit: totalLimit,
		});

		// If we have semantic results, process them
		if (semanticResults.length > 0) {
			const processedResults: SearchResult[] = [];

			for (const result of semanticResults) {
				try {
					// For now, create a simplified result from the semantic search
					// The result._id is the RAG entry ID, but we can use the text and metadata
					const contentType =
						result.metadata?.find((m: any) => m.name === "contentType")
							?.value || "message";

					processedResults.push({
						_id: result._id as Id<"messages"> | Id<"notes"> | Id<"tasks">,
						_creationTime: Date.now(), // Placeholder
						type: contentType,
						text: result.text,
						score: result.score,
						workspaceId: args.workspaceId,
					});
				} catch (error) {
					// Skip invalid results
					console.error("Error processing semantic result:", error);
				}
			}

			return processedResults.slice(0, totalLimit);
		}

		// Fallback to basic search if semantic search fails or returns no results
		return await ctx.runQuery(api.search.searchAll, {
			workspaceId: args.workspaceId,
			channelId: args.channelId,
			query: args.query,
			limit: totalLimit,
		});
	},
});

/**
 * AI-powered message search with natural language understanding.
 *
 * Uses semantic RAG search to find relevant messages and generates an AI summary.
 * Similar to chatbot implementation but simplified for global search.
 *
 * @param {Id<'workspaces'>} workspaceId - The workspace to search within
 * @param {string} query - Natural language search query (e.g., "bug reports from last week")
 *
 * @returns {Promise<{answer: string, sources: Array}>} Object containing:
 *   - answer: AI-generated summary of the search results
 *   - sources: Array of up to 3 most relevant messages with id, text, and channelId
 *
 * @example
 * const result = await aiSearchMessages({
 *   workspaceId: "workspace123",
 *   query: "deployment issues"
 * });
 * // Returns: { answer: "Summary...", sources: [{id, text, channelId}, ...] }
 */
export const aiSearchMessages = action({
	args: {
		workspaceId: v.id("workspaces"),
		query: v.string(),
	},
	handler: async (
		ctx,
		args
	): Promise<{
		answer: string;
		sources: {
			id: Id<"messages">;
			text: string;
			channelId: Id<"channels">;
			channelName: string;
		}[];
	}> => {
		// Try semantic RAG search first (like chatbot does)
		let ragResults: Array<{ text: string; _id: string }> = [];
		try {
			ragResults = await ctx.runAction(api.search.semanticSearch, {
				workspaceId: args.workspaceId,
				query: args.query,
				contentType: "message",
				limit: 5,
			});
		} catch (error) {
			console.warn(
				"Semantic search failed, falling back to text search:",
				error
			);
		}

		// Fallback to text search if RAG returns nothing
		if (ragResults.length === 0) {
			const textSearchResults = await ctx.runQuery(
				api.search.searchWorkspaceMessages,
				{
					workspaceId: args.workspaceId,
					query: args.query,
					limit: 5,
				}
			);

			if (textSearchResults.length === 0) {
				return {
					answer: "No messages found matching your query.",
					sources: [],
				};
			}

			// Use text search results
			ragResults = textSearchResults.map((r) => ({
				text: r.text,
				_id: r._id,
			}));
		}

		// Prepare context for AI
		const context = ragResults
			.map((r, idx) => `[${idx + 1}] ${r.text}`)
			.join("\n\n");

		try {
			const { generateText } = await import("ai");
			const result = await generateText({
				model: openai("gpt-5-mini") as any,
				prompt: `You are a helpful work assistant. Answer the user's question using ONLY the messages below.
Provide a concise, direct answer. If the messages don't contain enough information, say so.
Do NOT output topic/keyword lists or message counts.

Question: ${args.query}

Relevant Messages:
${context}
`,
				temperature: 0.3,
			});

			// Get full message details for sources
			const sourceMessages = await Promise.all(
				ragResults.slice(0, 3).map(async (r) => {
					const message = await ctx.runQuery(api.messages.getById, {
						id: r._id as Id<"messages">,
					});
					if (!message) return null;

					let channelName = "Direct Message";
					if (message.channelId) {
						const channel = await ctx.runQuery(api.channels.getById, {
							id: message.channelId,
						});
						if (channel) {
							channelName = channel.name;
						}
					}

					return {
						id: message._id,
						text: r.text,
						channelId: message.channelId as Id<"channels">,
						channelName,
					};
				})
			);

			return {
				answer: result.text.trim(),
				sources: sourceMessages.filter(
					(s): s is NonNullable<typeof s> => s !== null
				),
			};
		} catch (error) {
			console.error("AI generation error:", error);
			// Return search results with a fallback answer
			return {
				answer: `I found ${ragResults.length} relevant message(s) about "${args.query}", but couldn't generate a summary. Please check the sources below.`,
				sources: [],
			};
		}
	},
});

/**
 * Triggers bulk indexing of workspace content into RAG system.
 *
 * This mutation schedules the bulkIndexWorkspace action to populate the RAG index
 * with existing workspace content (messages, notes, tasks, cards).
 *
 * Use this to:
 * - Initialize RAG for a new workspace
 * - Re-index content after RAG configuration changes
 * - Fix missing content in RAG index
 *
 * @param {Id<'workspaces'>} workspaceId - The workspace to index
 * @param {number} [limit] - Optional limit on items per type (default: 1000)
 *
 * @returns {Promise<{scheduled: boolean}>} Confirmation that indexing was scheduled
 */
export const triggerBulkIndexing = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Verify user has access to this workspace
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Check if user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.first();

		if (!member) {
			throw new Error("User is not a member of this workspace");
		}

		// Schedule the bulk indexing action
		await ctx.scheduler.runAfter(0, api.search.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit || 1000,
		});

		console.log(`Scheduled bulk indexing for workspace ${args.workspaceId}`);

		return { scheduled: true };
	},
});

/**
 * Internal version of triggerBulkIndexing that can be called without authentication.
 * Use this for admin tasks or initialization scripts.
 */
export const triggerBulkIndexingInternal = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Schedule the bulk indexing action
		await ctx.scheduler.runAfter(0, api.search.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit || 1000,
		});

		console.log(`Scheduled bulk indexing for workspace ${args.workspaceId}`);

		return { scheduled: true };
	},
});

/**
 * Auto-initialize RAG namespace for a workspace (called from chatbot).
 * This mutation can be called from actions to schedule indexing.
 */
export const autoInitializeWorkspace = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// No auth check - this is automatic system initialization
		console.log(`Auto-initializing RAG for workspace ${args.workspaceId}`);

		// Schedule the bulk indexing action
		await ctx.scheduler.runAfter(0, api.search.bulkIndexWorkspace, {
			workspaceId: args.workspaceId,
			limit: args.limit || 1000,
		});

		console.log(`Scheduled bulk indexing for workspace ${args.workspaceId}`);

		return { scheduled: true };
	},
});
