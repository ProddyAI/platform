import { action, mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';
import { getAuthUserId } from '@convex-dev/auth/server';
import { api } from './_generated/api';

// Define types for chat messages and responses
type Source = {
	id: string;
	type: string;
	text: string;
};

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	sources?: Source[];
	actions?: NavigationAction[];
};

type ChatHistory = {
	messages: ChatMessage[];
};

type NavigationAction = {
	label: string;
	type: string;
	url: string;
	noteId?: string;
	channelId?: string;
};

type GenerateResponseResult = {
	response: string;
	sources?: Array<{
		id: Id<any>;
		type: string;
		text: string;
	}>;
	actions?: NavigationAction[];
	error?: string;
};

let cachedGeminiModel: string | null = null;
let cachedGeminiApiVersion: string | null = null;

function normalizeChannelName(name: string) {
	return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeChannelQuery(raw: string) {
	let s = raw.trim().toLowerCase();
	if (s.startsWith('#')) s = s.slice(1);
	// If user says "social channel" treat it as "social".
	s = s.replace(/\bchannel\b/g, '').trim();
	// Normalize separators
	s = s.replace(/[\s_]+/g, '-');
	// Remove punctuation that often sneaks in
	s = s.replace(/[^a-z0-9-]/g, '');
	// Collapse multiple dashes
	s = s.replace(/-+/g, '-');
	// Trim dashes
	s = s.replace(/^-+|-+$/g, '');
	return s;
}

function extractChannelFromQueryText(query: string): string | null {
	const q = query.trim();
	// #channel-name
	const hash = q.match(/#([a-zA-Z0-9][a-zA-Z0-9_-]{1,30})/);
	if (hash?.[1]) return hash[1];
	// in "channel name" / in channel name
	const inMatch = q.match(/\bin\s+["']?([a-zA-Z0-9][a-zA-Z0-9 _-]{1,30})["']?/i);
	if (inMatch?.[1]) return inMatch[1];
	// in the <name> channel
	const inChannel = q.match(/\bin\s+the\s+([a-zA-Z0-9][a-zA-Z0-9 _-]{1,30})\s+channel\b/i);
	if (inChannel?.[1]) return inChannel[1];
	return null;
}

function scoreChannelMatch(channelSlug: string, querySlug: string) {
	if (!channelSlug || !querySlug) return -1;
	if (channelSlug === querySlug) return 1000;
	if (channelSlug === `${querySlug}-channel`) return 900;
	if (`${channelSlug}-channel` === querySlug) return 900;

	const channelNoSuffix = channelSlug.replace(/-channel$/g, '');
	const queryNoSuffix = querySlug.replace(/-channel$/g, '');
	if (channelNoSuffix === queryNoSuffix) return 850;

	if (channelSlug.includes(querySlug)) return 600 - Math.abs(channelSlug.length - querySlug.length);
	if (querySlug.includes(channelSlug)) return 550 - Math.abs(channelSlug.length - querySlug.length);
	if (channelNoSuffix.includes(queryNoSuffix)) return 500 - Math.abs(channelNoSuffix.length - queryNoSuffix.length);
	return 0;
}

async function generateLLMResponse(
	prompt: string,
	systemPrompt?: string
): Promise<string> {
	const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new Error(
			'GOOGLE_GENERATIVE_AI_API_KEY is required for Gemini 1.5 Flash'
		);
	}

	const preferredModel =
		process.env.GOOGLE_GENERATIVE_AI_MODEL ||
		process.env.GEMINI_MODEL ||
		'gemini-1.5-flash';

	// The Generative Language API frequently exposes models under v1beta.
	// If you need to override, set GOOGLE_GENERATIVE_AI_API_VERSION to "v1beta" or "v1".
	const apiVersion =
		process.env.GOOGLE_GENERATIVE_AI_API_VERSION ||
		cachedGeminiApiVersion ||
		'v1beta';

	const finalPrompt = systemPrompt
		? `System:\n${systemPrompt}\n\nUser:\n${prompt}`
		: prompt;

	function normalizeModelName(modelName: string): string {
		return modelName.startsWith('models/') ? modelName.slice('models/'.length) : modelName;
	}

	async function listModels(version: string): Promise<any[]> {
		const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
		const res = await fetch(url);
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Gemini ListModels failed: ${res.status} ${text}`);
		}
		const data: any = await res.json();
		return Array.isArray(data?.models) ? data.models : [];
	}

	function pickBestModel(models: any[]): string | null {
		const supportsGenerateContent = models.filter((m) =>
			Array.isArray(m?.supportedGenerationMethods)
				? m.supportedGenerationMethods.includes('generateContent')
				: false
		);

		const names = supportsGenerateContent
			.map((m) => String(m?.name || ''))
			.filter(Boolean);

		const normalized = names.map(normalizeModelName);

		const exactFlash = normalized.find((n) => n.includes('gemini-1.5-flash'));
		if (exactFlash) return exactFlash;

		const anyFlash = normalized.find((n) => n.includes('flash'));
		if (anyFlash) return anyFlash;

		const anyGemini = normalized.find((n) => n.includes('gemini'));
		if (anyGemini) return anyGemini;

		return normalized[0] ?? null;
	}

	async function tryModel(version: string, model: string): Promise<any> {
		const url = `https://generativelanguage.googleapis.com/${version}/models/${encodeURIComponent(
			model
		)}:generateContent?key=${apiKey}`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [
					{
						role: 'user',
						parts: [{ text: finalPrompt }],
					},
				],
				generationConfig: {
					temperature: 0.2,
					maxOutputTokens: 1024,
				},
			}),
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Gemini request failed: ${res.status} ${text}`);
		}

		return await res.json();
	}

	const modelCandidates = [
		normalizeModelName(cachedGeminiModel || ''),
		normalizeModelName(preferredModel),
		// Common fallbacks across releases.
		'gemini-1.5-flash-latest',
		'gemini-1.5-flash-002',
		'gemini-1.5-flash-001',
	].filter(Boolean);

	let data: any = null;
	let lastError: unknown = null;
	for (const model of modelCandidates) {
		try {
			data = await tryModel(apiVersion, model);
			lastError = null;
			break;
		} catch (err) {
			lastError = err;
			const msg = err instanceof Error ? err.message : '';
			// If the model is missing/unsupported, resolve an available one via ListModels and retry.
			if (msg.includes('Call ListModels') || msg.includes('NOT_FOUND') || msg.includes('not found')) {
				try {
					const models = await listModels(apiVersion);
					const best = pickBestModel(models);
					if (best) {
						cachedGeminiModel = best;
						cachedGeminiApiVersion = apiVersion;
						data = await tryModel(apiVersion, best);
						lastError = null;
						break;
					}
				} catch {
					// Ignore ListModels failures and continue trying fallbacks.
				}
			}
			continue;
		}
	}

	if (!data) {
		throw lastError instanceof Error
			? lastError
			: new Error('Gemini request failed');
	}

	const text =
		data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ??
		'';
	return String(text).trim();
}

type AssistantIntent = {
	mode: 'channel' | 'overview' | 'tasks' | 'qa';
	channel: string | null;
};

async function extractIntent(query: string): Promise<AssistantIntent> {
	const intentPrompt = `
You are a router for a workspace assistant.

User query:
"${query}"

Decide what the user wants:
- mode = "channel" if they ask what happened in a specific channel (explicit channel mention)
- mode = "overview" if they ask "what happened" / "summarize" without a channel (overall recap)
- mode = "tasks" if they ask about tasks / to-dos / what tasks they have
- mode = "qa" otherwise (answer normally)

Extract channel name if present (without #), else null.

Return ONLY JSON:
{"mode":"channel"|"overview"|"tasks"|"qa","channel":string|null}
`;

	const raw = await generateLLMResponse(intentPrompt, '');
	try {
		const cleaned = raw.replace(/```json|```/g, '').trim();
		const parsed = JSON.parse(cleaned);
		const mode = String(parsed.mode || 'qa') as AssistantIntent['mode'];
		const channel = parsed.channel ? String(parsed.channel) : null;
		if (mode === 'channel' || mode === 'overview' || mode === 'tasks' || mode === 'qa') {
			return { mode, channel };
		}
		return { mode: 'qa', channel };
	} catch {
		// Cheap fallback if JSON parsing fails
		const lower = query.toLowerCase();
		if (lower.includes('task') || lower.includes('todo') || lower.includes('to-do')) {
			return { mode: 'tasks', channel: null };
		}
		if (lower.includes('what happened') || lower.includes('summarize') || lower.includes('summary')) {
			return { mode: 'overview', channel: null };
		}
		return { mode: 'qa', channel: null };
	}
}

export const askAssistant = action({
	args: {
		query: v.string(),
		userId: v.optional(v.id('users')),
		workspaceId: v.optional(v.id('workspaces')),
	},

	handler: async (
		ctx,
		args
	): Promise<{ answer: string; sources: string[] }> => {
		if (!args.workspaceId) {
			return {
				answer: 'Workspace context is required.',
				sources: [],
			};
		}

		const intent = await extractIntent(args.query);
		const requestedChannelName = intent.channel;

		// ---------------------------------------------------------------------
		// 2. RESOLVE CHANNEL ID (if name found)
		// ---------------------------------------------------------------------
		let channelId: Id<'channels'> | null = null;
		let resolvedChannelName: string | null = null;

		if (intent.mode === 'channel') {
			const fallbackFromText = extractChannelFromQueryText(args.query);
			const raw = requestedChannelName || fallbackFromText;

			if (raw) {
				let channels: any[] = [];
				try {
					channels = await ctx.runQuery(api.channels.get, {
						workspaceId: args.workspaceId!,
					});
				} catch {
					channels = [];
				}

				if (!channels.length) {
					return {
						answer:
							"I can't access channels for this workspace. Make sure you're signed in and a member of the workspace.",
						sources: [],
					};
				}

				const querySlug = normalizeChannelQuery(raw);
				let best: { channel: any; score: number } | null = null;
				for (const ch of channels) {
					const chSlug = normalizeChannelName(String(ch.name || ''));
					const score = scoreChannelMatch(chSlug, querySlug);
					if (!best || score > best.score) {
						best = { channel: ch, score };
					}
				}

				if (!best || best.score < 500) {
					const sample = channels
						.slice(0, 8)
						.map((c) => `#${String(c.name)}`)
						.join(', ');
					return {
						answer: `I couldn't find a channel matching "${raw}". Try using #channel-name. Available channels include: ${sample}`,
						sources: [],
					};
				}

				channelId = best.channel._id as Id<'channels'>;
				resolvedChannelName = String(best.channel.name);
			}
		}

		// ---------------------------------------------------------------------
		// 3. CHANNEL SUMMARY (if requested)
		// ---------------------------------------------------------------------
		if (channelId) {
			let results: any;
			try {
				results = await ctx.runQuery(api.messages.get, {
					channelId,
					paginationOpts: { numItems: 200, cursor: null },
				});
			} catch {
				return {
					answer:
						"I couldn't read messages in that channel. Make sure you're signed in and have access to it.",
					sources: resolvedChannelName ? [`#${resolvedChannelName}`] : [],
				};
			}
			const messages: Array<{ _creationTime: number; body: string }> =
				results.page.map((m: any) => ({
					_creationTime: m._creationTime,
					body: m.body,
				}));

			if (!messages.length) {
				return {
					answer: `No messages found in #${resolvedChannelName}.`,
					sources: [],
				};
			}

			const messageContext = [...messages]
				.reverse()
				.map(
					(m) =>
						`[${new Date(m._creationTime).toISOString()}] ${m.body}`
				)
				.join('\n');

			const chatPrompt = `
You are an AI assistant summarizing a developer chat channel.

INSTRUCTIONS:
- Provide a clear, structured summary of the conversation.
- Use Markdown headers (###) to organize sections.
- Use bullet points for lists, but simple paragraphs are allowed if better for flow.
- Highlight key decisions, blockers, and progress.
- Be concise but complete.

FORMAT:

### Summary
[Executive summary of the conversation]

### Key Discussions
- [Topic]: [Details]

### Decisions made
- [Decision]

### Open Issues
- [Issue]

USER QUESTION:
${args.query}

CHAT HISTORY:
${messageContext}
`;

			const answer = await generateLLMResponse(chatPrompt, '');
			return {
				answer,
				sources: [`#${resolvedChannelName}`],
			};
		}

		// ---------------------------------------------------------------------
		// 3b. TASKS (per user)
		// ---------------------------------------------------------------------
		if (intent.mode === 'tasks') {
			const authUserId = await getAuthUserId(ctx);
			const effectiveUserId = (args.userId ?? authUserId) as Id<'users'> | null;
			if (!effectiveUserId) {
				return {
					answer: 'Sign in to view your tasks.',
					sources: [],
				};
			}

			// Use the existing query which already filters to the current auth user.
			// Note: api.tasks.getTasks ignores userId args and uses auth; we keep args.userId
			// only as a fallback for messaging, but actual access is auth-controlled.
			const tasks: any[] = await ctx.runQuery(api.tasks.getTasks, {
				workspaceId: args.workspaceId!,
			});

			if (!tasks.length) {
				return {
					answer: "You don't have any tasks in this workspace.",
					sources: ['Tasks'],
				};
			}

			// Keep context short; send the most recent tasks.
			const taskLines = tasks
				.slice(0, 40)
				.map((t) => {
					const status = t.status ?? (t.completed ? 'completed' : 'not_started');
					const due = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null;
					return `- ${t.title}${t.description ? ` — ${t.description}` : ''} (status: ${status}${due ? `, due: ${due}` : ''})`;
				})
				.join('\n');

			const taskPrompt = `
You are an AI assistant helping a user manage their tasks.

INSTRUCTIONS:
- Summarize the user's tasks clearly.
- Group by status if helpful.
- Highlight urgent/overdue items if due dates exist.
- Keep it concise.

USER QUESTION:
${args.query}

TASKS:
${taskLines}
`;

			const answer = await generateLLMResponse(taskPrompt, '');
			return { answer, sources: ['Tasks'] };
		}

		// ---------------------------------------------------------------------
		// 3c. OVERVIEW SUMMARY ("what happened" across all channels)
		// ---------------------------------------------------------------------
		if (intent.mode === 'overview') {
			const allChannels = await ctx.runQuery(api.channels.get, {
				workspaceId: args.workspaceId!,
			});

			const messagesByChannel = new Map<string, string[]>();
			for (const ch of allChannels) {
				const res = await ctx.runQuery(api.messages.get, {
					channelId: ch._id as Id<'channels'>,
					paginationOpts: { numItems: 60, cursor: null },
				});
				const items: Array<{ _creationTime: number; body: string }> = res.page.map(
					(m: any) => ({ _creationTime: m._creationTime, body: m.body })
				);
				const chName = (ch.name as string) || 'unknown';
				if (!messagesByChannel.has(chName)) messagesByChannel.set(chName, []);
				for (const m of items.reverse()) {
					messagesByChannel
						.get(chName)!
						.push(`[${new Date(m._creationTime).toISOString()}] ${m.body}`);
				}
			}

			let chatContext = '';
			for (const [chName, msgs] of messagesByChannel.entries()) {
				if (!msgs.length) continue;
				chatContext += `\n#${chName}:\n${msgs.join('\n')}\n`;
			}

			if (!chatContext.trim()) {
				return { answer: 'No recent channel activity found.', sources: [] };
			}

			const overviewPrompt = `
You are an AI assistant summarizing a workspace's recent activity.

INSTRUCTIONS:
- Provide an overall summary of what happened.
- Then break down key points by channel (use headings like "### #channel").
- Highlight decisions, blockers, progress.
- Keep it concise.

USER QUESTION:
${args.query}

RECENT CHANNEL ACTIVITY:
${chatContext}
`;

			const answer = await generateLLMResponse(overviewPrompt, '');
			const sources = Array.from(messagesByChannel.keys()).map((c) => `#${c}`);
			return { answer, sources };
		}

		// ---------------------------------------------------------------------
		// 4. FALLBACK → MIXED SEARCH (RAG + Recent Messages)
		// ---------------------------------------------------------------------
		const ragResults: Array<{ text: string }> = await ctx.runAction(
			api.search.semanticSearch,
			{
				workspaceId: args.workspaceId!,
				query: args.query,
				limit: 5,
			}
		);

		const ragContext = ragResults
			.map((c: any, i: number) => `[Doc ${i + 1}] ${c?.text ?? ''}`)
			.join('\n\n');

		const allChannels = await ctx.runQuery(api.channels.get, {
			workspaceId: args.workspaceId!,
		});

		const messagesByChannel = new Map<string, string[]>();
		for (const ch of allChannels) {
			const res = await ctx.runQuery(api.messages.get, {
				channelId: ch._id as Id<'channels'>,
				paginationOpts: { numItems: 50, cursor: null },
			});

			const items: Array<{ _creationTime: number; body: string }> = res.page.map(
				(m: any) => ({ _creationTime: m._creationTime, body: m.body })
			);
			const chName = (ch.name as string) || 'unknown';
			if (!messagesByChannel.has(chName)) messagesByChannel.set(chName, []);
			for (const m of items.reverse()) {
				messagesByChannel
					.get(chName)!
					.push(`[${new Date(m._creationTime).toISOString()}] ${m.body}`);
			}
		}

		let chatContext = '';
		if (messagesByChannel.size > 0) {
			chatContext = 'RECENT CHANNEL ACTIVITY:\n';
			for (const [chName, msgs] of messagesByChannel.entries()) {
				chatContext += `\n#${chName}:\n${msgs.join('\n')}\n`;
			}
		}

		const combinedContext = `
${ragContext ? 'KNOWLEDGE BASE:\n' + ragContext : ''}

${chatContext}
`.trim();

		if (!combinedContext) {
			return {
				answer:
					"I don't have enough information (no documents or recent messages found).",
				sources: [],
			};
		}

		const mixedPrompt = `
You are a senior AI assistant for full-stack and AI engineers.

INSTRUCTIONS:
- Answer the question using the provided context (Knowledge Base + Recent Channel Activity).
- If the user asks for a summary or "what happened", group your answer by channel (e.g., "In #general...", "In #random...").
- If the user asks a specific question, answer directly.
- Use Markdown formatting (headers, bold, lists).
- If the answer is not in the context, say so clearly.

FORMAT:

### Answer/Summary
[Direct answer or Channel-wise summary]

### Key Details
- [Points]

QUESTION:
${args.query}

CONTEXT:
${combinedContext}
`;

		const answer = await generateLLMResponse(mixedPrompt, '');
		const uniqueChannels = Array.from(messagesByChannel.keys()).map(
			(c) => `#${c}`
		);
		const sources = [
			...(ragResults.length ? ['Knowledge Base'] : []),
			...uniqueChannels,
		];
		return { answer, sources };
	},
});

// Get the current member for a workspace
async function getCurrentMember(ctx: QueryCtx, workspaceId: Id<'workspaces'>) {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error('Unauthorized');

	const member = await ctx.db
		.query('members')
		.withIndex('by_workspace_id_user_id', (q) =>
			q.eq('workspaceId', workspaceId).eq('userId', userId)
		)
		.unique();

	if (!member) throw new Error('Not a member of this workspace');
	return member;
}

// Get chat history for the current user in a workspace
export const getChatHistory = query({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args): Promise<ChatHistory> => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const chatHistory = await ctx.db
			.query('chatHistory')
			.withIndex('by_workspace_id_member_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('memberId', member._id)
			)
			.first();

		if (!chatHistory) {
			// Return empty history if none exists
			return {
				messages: [],
			};
		}

		return {
			messages: chatHistory.messages,
		};
	},
});

// Add a message to chat history
export const addMessage = mutation({
	args: {
		workspaceId: v.id('workspaces'),
		content: v.string(),
		role: v.union(v.literal('user'), v.literal('assistant')),
		sources: v.optional(
			v.array(
				v.object({
					id: v.string(),
					type: v.string(),
					text: v.string(),
				})
			)
		),
		actions: v.optional(
			v.array(
				v.object({
					label: v.string(),
					type: v.string(),
					url: v.string(),
					noteId: v.optional(v.string()),
					channelId: v.optional(v.string()),
				})
			)
		),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const chatHistory = await ctx.db
			.query('chatHistory')
			.withIndex('by_workspace_id_member_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('memberId', member._id)
			)
			.first();

		const timestamp = Date.now();
		const newMessage: ChatMessage = {
			role: args.role,
			content: args.content,
			timestamp,
			sources: args.sources,
			actions: args.actions,
		};

		if (chatHistory) {
			// Update existing chat history
			return await ctx.db.patch(chatHistory._id, {
				messages: [...chatHistory.messages, newMessage],
				updatedAt: timestamp,
			});
		} else {
			// Create new chat history
			return await ctx.db.insert('chatHistory', {
				workspaceId: args.workspaceId,
				memberId: member._id,
				messages: [newMessage],
				updatedAt: timestamp,
			});
		}
	},
});

// Clear chat history
export const clearChatHistory = mutation({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const chatHistory = await ctx.db
			.query('chatHistory')
			.withIndex('by_workspace_id_member_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('memberId', member._id)
			)
			.first();

		if (chatHistory) {
			// Reset to just the welcome message
			const timestamp = Date.now();
			return await ctx.db.patch(chatHistory._id, {
				messages: [
					{
						role: 'assistant',
						content:
							"Hello! I'm your workspace assistant. How can I help you today?",
						timestamp,
					},
				],
				updatedAt: timestamp,
			});
		}

		// If no history exists, do nothing
		return null;
	},
});

// DEPRECATED: This function is no longer used.
// All chat functionality has been moved to the main assistant router.
// This is kept for backward compatibility but should not be called.
export const generateResponse = action({
	args: {
		workspaceId: v.id('workspaces'),
		message: v.string(),
	},
	handler: async (_ctx, _args): Promise<GenerateResponseResult> => {
		// This function is deprecated - all logic moved to /api/assistant router
		return {
			response:
				'This function is deprecated. Please use the main assistant router.',
			sources: [],
			actions: [],
		};
	},
});
