import { action, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';
import { Id } from './_generated/dataModel';
import { components } from './_generated/api';
import { RAG } from '@convex-dev/rag';
import { google } from '@ai-sdk/google';

// Define result types (maintaining compatibility with existing API)
type SearchResult = {
	_id: Id<any>;
	_creationTime: number;
	type: string;
	text: string;
	workspaceId: Id<'workspaces'>;
	[key: string]: any;
};

type MessageResult = SearchResult & {
	type: 'message';
	channelId?: Id<'channels'>;
	memberId: Id<'members'>;
};

type TaskResult = SearchResult & {
	type: 'task';
	status: string;
	completed: boolean;
	userId: Id<'users'>;
};

type NoteResult = SearchResult & {
	type: 'note';
	channelId: Id<'channels'>;
	memberId: Id<'members'>;
};

type CardResult = SearchResult & {
	type: 'card';
	listId: Id<'lists'>;
	listName: string;
	channelId?: Id<'channels'>;
	channelName?: string;
};

// Helper function to extract plain text from message body
function extractTextFromRichText(body: string): string {
	if (typeof body !== 'string') {
		return String(body);
	}

	try {
		// Try to parse as JSON (Quill Delta format)
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
				.join('')
				.trim();
		}
	} catch (e) {
		// Not JSON, use as is (might contain HTML)
		return body
			.replace(/<[^>]*>/g, '') // Remove HTML tags
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
	filterNames: ['workspaceId', 'contentType', 'channelId'],
	textEmbeddingModel: google.textEmbeddingModel('text-embedding-004'),
	embeddingDimension: 768, // Gemini text-embedding-004 uses 768 dimensions
});

const NO_CHANNEL_FILTER_VALUE = '__none__';

// Index content for RAG search
export const indexContent = action({
	args: {
		workspaceId: v.id('workspaces'),
		contentId: v.string(),
		contentType: v.union(
			v.literal('message'),
			v.literal('task'),
			v.literal('note'),
			v.literal('card')
		),
		text: v.string(),
		metadata: v.any(),
	},
	handler: async (ctx, args) => {
		console.log(`Indexing ${args.contentType} ${args.contentId} for workspace ${args.workspaceId}`);
		console.log(`Text to index: "${args.text.substring(0, 100)}..."`);

		// Skip indexing if text is empty or too short
		if (!args.text || args.text.trim().length < 3) {
			console.log('Skipping indexing: text too short');
			return;
		}

		// Check if Gemini API key is configured for embeddings
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			console.error('GOOGLE_GENERATIVE_AI_API_KEY not configured, skipping content indexing');
			return;
		}

		try {
			const channelIdFilterValue = (() => {
				const metadata = args.metadata as unknown;
				if (!metadata || typeof metadata !== 'object') {
					return NO_CHANNEL_FILTER_VALUE;
				}
				const maybeChannelId = (metadata as { channelId?: unknown }).channelId;
				if (typeof maybeChannelId === 'string' && maybeChannelId.length > 0) {
					return maybeChannelId;
				}
				return NO_CHANNEL_FILTER_VALUE;
			})();

			const filterValues: Array<{
				name: 'workspaceId' | 'contentType' | 'channelId';
				value: string;
			}> = [
				{ name: 'workspaceId', value: args.workspaceId as string },
				{ name: 'contentType', value: args.contentType },
				{ name: 'channelId', value: channelIdFilterValue },
			];

			console.log('Filter values:', filterValues);

			const result = await rag.add(ctx, {
				namespace: args.workspaceId,
				key: args.contentId,
				text: args.text,
				filterValues,
			});

			console.log('RAG add result:', result);
			console.log(`Successfully indexed ${args.contentType} ${args.contentId}`);
		} catch (error) {
			console.error(`Content indexing error for ${args.contentType} ${args.contentId}:`, error);
			console.error('Error details:', JSON.stringify(error, null, 2));
			// Re-throw the error so we can see what's happening
			throw error;
		}
	},
});

// Semantic search using RAG
export const semanticSearch = action({
	args: {
		workspaceId: v.id('workspaces'),
		query: v.string(),
		contentType: v.optional(
			v.union(
				v.literal('message'),
				v.literal('task'),
				v.literal('note'),
				v.literal('card')
			)
		),
		channelId: v.optional(v.id('channels')),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Check if Gemini API key is configured for embeddings
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			console.warn(
				'GOOGLE_GENERATIVE_AI_API_KEY not configured, falling back to empty results'
			);
			return [];
		}

		const limit = args.limit || 10;

		try {
			// Create filters for workspace isolation and content type filtering
			const filters: Array<
				| { name: 'workspaceId'; value: string }
				| { name: 'contentType'; value: string }
				| { name: 'channelId'; value: string }
			> = [{ name: 'workspaceId', value: args.workspaceId as string }];

			if (args.contentType) {
				filters.push({ name: 'contentType', value: args.contentType });
			}

			if (args.channelId) {
				filters.push({ name: 'channelId', value: args.channelId as string });
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
				text: result.content.map((c: any) => c.text).join(' '),
				score: result.score,
				metadata: result.filterValues,
			}));
		} catch (error) {
			console.error('RAG search error:', error);
			// Fall back to empty results if RAG fails
			return [];
		}
	},
});

// Search messages in a workspace (maintaining API compatibility)
export const searchMessages = query({
	args: {
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<MessageResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		let messagesQuery = ctx.db
			.query('messages')
			.withIndex('by_workspace_id', (q) =>
				q.eq('workspaceId', args.workspaceId)
			);

		if (args.channelId) {
			messagesQuery = ctx.db
				.query('messages')
				.withIndex('by_channel_id', (q) => q.eq('channelId', args.channelId))
				.filter((q) => q.eq(q.field('workspaceId'), args.workspaceId));
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
			type: 'message',
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
		workspaceId: v.id('workspaces'),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<TaskResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		const tasks = await ctx.db
			.query('tasks')
			.withIndex('by_workspace_id', (q) =>
				q.eq('workspaceId', args.workspaceId)
			)
			.take(limit * 3); // Take more to filter

		// Basic text filtering
		const filteredTasks = tasks
			.filter((task) => {
				const text = (
					task.title + (task.description ? `: ${task.description}` : '')
				).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		return filteredTasks.map((task) => ({
			_id: task._id,
			_creationTime: task._creationTime,
			type: 'task',
			text: task.title + (task.description ? `: ${task.description}` : ''),
			status: task.status || 'not_started',
			completed: task.completed,
			workspaceId: task.workspaceId,
			userId: task.userId,
		}));
	},
});

// Search notes in a workspace (maintaining API compatibility)
export const searchNotes = query({
	args: {
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<NoteResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		let notesQuery = ctx.db
			.query('notes')
			.withIndex('by_workspace_id', (q) =>
				q.eq('workspaceId', args.workspaceId)
			);

		if (args.channelId) {
			notesQuery = ctx.db
				.query('notes')
				.withIndex('by_workspace_id_channel_id', (q) =>
					q.eq('workspaceId', args.workspaceId).eq('channelId', args.channelId!)
				);
		}

		const notes = await notesQuery.take(limit * 3); // Take more to filter

		// Basic text filtering
		const filteredNotes = notes
			.filter((note) => {
				const text = (
					note.title +
					': ' +
					extractTextFromRichText(note.content)
				).toLowerCase();
				return text.includes(args.query.toLowerCase());
			})
			.slice(0, limit);

		return filteredNotes.map((note) => ({
			_id: note._id,
			_creationTime: note._creationTime,
			type: 'note',
			text: note.title + ': ' + extractTextFromRichText(note.content),
			channelId: note.channelId,
			memberId: note.memberId,
			workspaceId: note.workspaceId,
		}));
	},
});

// Search cards in a workspace (maintaining API compatibility)
export const searchCards = query({
	args: {
		workspaceId: v.id('workspaces'),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<CardResult[]> => {
		const limit = args.limit || 5;

		// Fallback to basic text search (RAG search will be called separately from actions)
		// First, get all channels in the workspace
		const channels = await ctx.db
			.query('channels')
			.withIndex('by_workspace_id', (q) =>
				q.eq('workspaceId', args.workspaceId)
			)
			.collect();

		const channelIds = channels.map((channel) => channel._id);

		// Get all lists in these channels
		const lists = await Promise.all(
			channelIds.map((channelId) =>
				ctx.db
					.query('lists')
					.withIndex('by_channel_id', (q) => q.eq('channelId', channelId))
					.collect()
			)
		).then((results) => results.flat());

		const listIds = lists.map((list) => list._id);

		// Get cards from these lists
		const cards = await Promise.all(
			listIds.map((listId) =>
				ctx.db
					.query('cards')
					.withIndex('by_list_id', (q) => q.eq('listId', listId))
					.take(Math.ceil(limit / listIds.length))
			)
		).then((results) => results.flat().slice(0, limit * 3));

		// Basic text filtering
		const filteredCards = cards
			.filter((card) => {
				const text = (
					card.title + (card.description ? `: ${card.description}` : '')
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
					type: 'card',
					text: card.title + (card.description ? `: ${card.description}` : ''),
					listId: card.listId,
					listName: list?.title || 'Unknown List',
					channelId: channel?._id,
					channelName: channel?.name || 'Unknown Channel',
					workspaceId: args.workspaceId,
				};
			})
		);
	},
});

// Comprehensive search across all content types (maintaining API compatibility)
export const searchAll = query({
	args: {
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
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
		messageId: v.id('messages'),
	},
	handler: async (ctx, args) => {
		const message = await ctx.runQuery(api.messages.getById, {
			id: args.messageId,
		});
		if (message) {
			await ctx.runAction(api.search.indexContent, {
				workspaceId: message.workspaceId,
				contentId: message._id,
				contentType: 'message',
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
		noteId: v.id('notes'),
	},
	handler: async (ctx, args) => {
		const note = await ctx.runQuery(api.notes.getById, { noteId: args.noteId });
		if (note) {
			await ctx.runAction(api.search.indexContent, {
				workspaceId: note.workspaceId,
				contentId: note._id,
				contentType: 'note',
				text: note.title + ': ' + extractTextFromRichText(note.content),
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
	args: { taskId: v.id('tasks') },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.taskId);
	},
});

export const getCardForIndexing = query({
	args: { cardId: v.id('cards') },
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
		taskId: v.id('tasks'),
	},
	handler: async (ctx, args) => {
		const task = await ctx.runQuery(api.search.getTaskForIndexing, {
			taskId: args.taskId,
		});
		if (task) {
			await ctx.runAction(api.search.indexContent, {
				workspaceId: task.workspaceId,
				contentId: task._id,
				contentType: 'task',
				text: task.title + (task.description ? `: ${task.description}` : ''),
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
		cardId: v.id('cards'),
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
				contentType: 'card',
				text: card.title + (card.description ? `: ${card.description}` : ''),
				metadata: {
					listId: card.listId,
					channelId: list.channelId,
				},
			});
		}
	},
});

// Helper queries for bulk indexing
export const getWorkspaceMessages = query({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
		return await ctx.db
			.query('messages')
			.withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
			.take(limit);
	},
});

export const getWorkspaceNotes = query({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
		return await ctx.db
			.query('notes')
			.withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
			.take(limit);
	},
});

export const getWorkspaceTasks = query({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
		return await ctx.db
			.query('tasks')
			.withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
			.take(limit);
	},
});

// Bulk indexing function for existing content
export const bulkIndexWorkspace = action({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<{
		success: boolean;
		indexed: {
			messages: number;
			notes: number;
			tasks: number;
		};
	}> => {
		const limit = args.limit || 100;
		console.log(`Starting bulk indexing for workspace ${args.workspaceId} with limit ${limit}`);

		try {
			// Index messages
			const messages: any[] = await ctx.runQuery(api.search.getWorkspaceMessages, {
				workspaceId: args.workspaceId,
				limit,
			});

			console.log(`Found ${messages.length} messages to index`);

			for (const message of messages) {
				try {
					await ctx.runAction(api.search.indexContent, {
						workspaceId: message.workspaceId,
						contentId: message._id,
						contentType: 'message',
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
						contentType: 'note',
						text: note.title + ': ' + extractTextFromRichText(note.content),
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
						contentType: 'task',
						text: task.title + (task.description ? `: ${task.description}` : ''),
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

			console.log('Bulk indexing completed successfully');
			return {
				success: true,
				indexed: {
					messages: messages.length,
					notes: notes.length,
					tasks: tasks.length,
				},
			};
		} catch (error) {
			console.error('Bulk indexing failed:', error);
			throw error;
		}
	},
});

// Main semantic search action for chatbot integration
export const searchAllSemantic = action({
	args: {
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
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
					const contentType = result.metadata?.find((m: any) => m.name === 'contentType')?.value || 'message';

					processedResults.push({
						_id: result._id as any, // Using RAG entry ID for now
						_creationTime: Date.now(), // Placeholder
						type: contentType,
						text: result.text,
						score: result.score,
						workspaceId: args.workspaceId,
					});
				} catch (error) {
					// Skip invalid results
					console.error('Error processing semantic result:', error);
					continue;
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
