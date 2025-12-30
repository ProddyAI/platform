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

	function cleanModelText(raw: unknown): string {
		let text = String(raw ?? '').trim();
		if (!text) return '';

		// Gemini sometimes wraps the whole response in quotes (especially when the prompt contains quotes).
		// Strip only obvious outer quotes to avoid altering legitimate quoted content.
		if (
			(text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
			(text.startsWith("'") && text.endsWith("'") && text.length >= 2)
		) {
			text = text.slice(1, -1).trim();
		}
		// Also handle a single accidental leading quote.
		if (text.startsWith('"High Priority') || text.startsWith("'High Priority")) {
			text = text.slice(1).trim();
		}
		return text;
	}

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

	async function tryModel(version: string, model: string, textPrompt: string): Promise<any> {
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
						parts: [{ text: textPrompt }],
					},
				],
				generationConfig: {
					temperature: 0.2,
					// Allow slightly longer outputs; some summaries (e.g., multi-channel) can hit the ceiling.
					maxOutputTokens: 2048,
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
	let usedModel: string | null = null;
	for (const model of modelCandidates) {
		try {
			data = await tryModel(apiVersion, model, finalPrompt);
			usedModel = model;
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
						data = await tryModel(apiVersion, best, finalPrompt);
						usedModel = best;
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

	const candidate = data?.candidates?.[0];
	const firstText = candidate?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
	const finishReasonRaw = String(candidate?.finishReason ?? '').toUpperCase();

	// If Gemini hit output token limits, attempt one continuation pass.
	if (finishReasonRaw.includes('MAX') && usedModel) {
		try {
			const continuationPrompt = `${finalPrompt}\n\n---\nThe previous response was cut off. Continue from where you left off.

Rules:
- Output ONLY the continuation text (no repeated headings if already written).
- Do not repeat any lines already present.
- Never quote or paste any workspace message verbatim.

Previous response so far:\n${firstText}`;
			const more = await tryModel(apiVersion, usedModel, continuationPrompt);
			const moreText =
				more?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
			return cleanModelText(`${firstText}\n${moreText}`);
		} catch {
			// Fall through to returning the best-effort partial text.
		}
	}

	return cleanModelText(firstText);
}

type AssistantIntent = {
	mode:
		| 'channel'
		| 'overview'
		| 'team_status'
		| 'tasks'
		| 'agenda_today'
		| 'agenda_tomorrow'
		| 'tasks_today'
		| 'tasks_tomorrow'
		| 'calendar_next_week'
		| 'calendar_today'
		| 'calendar_tomorrow'
		| 'calendar'
		| 'boards'
		| 'qa';
	channel: string | null;
};

function toPlainText(input: unknown): string {
	const text = String(input ?? '').trim();
	if (!text) return '';
	// Try to unwrap common editor JSON payloads.
	if (text.startsWith('{') || text.startsWith('[')) {
		try {
			const parsed: any = JSON.parse(text);
			// Quill Delta-like: { ops: [{ insert: "..." }] }
			if (parsed?.ops && Array.isArray(parsed.ops)) {
				return parsed.ops
					.map((op: any) => (typeof op?.insert === 'string' ? op.insert : ''))
					.join('')
					.replace(/\s+/g, ' ')
					.trim();
			}
		} catch {
			// ignore
		}
	}
	return text.replace(/\s+/g, ' ').trim();
}

function truncateOneLine(text: string, maxLen: number) {
	const t = toPlainText(text);
	if (t.length <= maxLen) return t;
	return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

const MESSAGE_TOPIC_STOP_WORDS = new Set([
	// Common
	'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'is', 'are', 'am', 'was', 'were',
	'and', 'or', 'as', 'at', 'by', 'with', 'from', 'into', 'over', 'under',
	'i', 'we', 'you', 'me', 'my', 'your', 'our', 'their', 'it', 'this', 'that', 'these', 'those',
	'what', 'whats', "what's", 'why', 'how', 'when', 'where', 'who',
	'please', 'pls', 'thanks', 'thank', 'ok', 'okay', 'yeah', 'yep',
	// Time
	'today', 'tomorrow', 'tmr', 'tmrw', 'tomo', 'yesterday',
	// Noise
	'http', 'https', 'www', 'com',
]);

function extractTopicKeywords(text: unknown, limit: number = 5): string[] {
	const plain = toPlainText(text);
	if (!plain) return [];
	const tokens = plain
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/g)
		.map((w) => w.trim())
		.filter(Boolean)
		.filter((w) => w.length >= 3)
		.filter((w) => !MESSAGE_TOPIC_STOP_WORDS.has(w));

	if (!tokens.length) return [];
	const counts = new Map<string, number>();
	for (const w of tokens) counts.set(w, (counts.get(w) ?? 0) + 1);
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([w]) => w)
		.slice(0, Math.max(0, limit));
}

function hasUrgencySignal(text: unknown): boolean {
	const t = toPlainText(text).toLowerCase();
	if (!t) return false;
	return /\b(urgent|asap|blocker|blocked|breaking|broken|prod|production|down|deadline|fix|bug|incident)\b/i.test(t);
}

function heuristicSummarizeMessagesToPriorityGroups(opts: {
	messages: Array<{ body: unknown; channel?: string; author?: string }>;
	includeChannels?: boolean;
}): string {
	const groups = emptyPriorityGroup();
	if (!opts.messages.length) return renderPriorityGroups(groups);

	// Aggregate per-channel (or single bucket if no channel).
	type Bucket = { channel: string; count: number; urgent: boolean; authors: Set<string>; keywords: Map<string, number> };
	const buckets = new Map<string, Bucket>();
	for (const m of opts.messages) {
		const channel = String(m.channel ?? 'channel');
		const key = opts.includeChannels ? channel : 'all';
		const b = buckets.get(key) ?? {
			channel: key,
			count: 0,
			urgent: false,
			authors: new Set<string>(),
			keywords: new Map<string, number>(),
		};
		b.count += 1;
		b.urgent = b.urgent || hasUrgencySignal(m.body);
		if (m.author) b.authors.add(String(m.author).trim());
		for (const kw of extractTopicKeywords(m.body, 6)) {
			b.keywords.set(kw, (b.keywords.get(kw) ?? 0) + 1);
		}
		buckets.set(key, b);
	}

	const summaries = Array.from(buckets.values())
		.map((b) => {
			const topKeywords = Array.from(b.keywords.entries())
				.sort((a, c) => c[1] - a[1])
				.map(([w]) => w)
				.slice(0, 5);
			const topics = topKeywords.length ? `topics: ${topKeywords.join(', ')}` : 'topics: (general)';
			const authors = b.authors.size
				? ` — ${Array.from(b.authors)
					.slice(0, 4)
					.map((a) => (a.startsWith('@') ? a : `@${a}`))
					.join(', ')}${b.authors.size > 4 ? '…' : ''}`
				: '';
			const channelPart = opts.includeChannels ? `#${b.channel} — ` : '';
			return { urgent: b.urgent, line: `${channelPart}${topics} (${b.count} msg${b.count === 1 ? '' : 's'})${authors}` };
		})
		.sort((a, b) => Number(b.urgent) - Number(a.urgent));

	for (const s of summaries) {
		if (s.urgent) groups.high.push(s.line);
		else groups.medium.push(s.line);
	}

	// Keep low as empty unless we have a lot of noise.
	return renderPriorityGroups(groups);
}

function plural(n: number, one: string, many?: string) {
	return n === 1 ? one : many ?? `${one}s`;
}

function clockEmojiForTime(time?: string): string {
	if (!time) return '🗓️';
	const t = time.trim().toLowerCase();
	// Match: 10am, 10:30am, 10:30 am, 22:15
	const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
	if (!m) return '🗓️';
	let hour = Number(m[1]);
	const ampm = m[3];
	if (ampm === 'pm' && hour < 12) hour += 12;
	if (ampm === 'am' && hour === 12) hour = 0;
	// Normalize to 1..12 for clock faces.
	let h12 = hour % 12;
	if (h12 === 0) h12 = 12;
	const clocks: Record<number, string> = {
		1: '🕐',
		2: '🕑',
		3: '🕒',
		4: '🕓',
		5: '🕔',
		6: '🕕',
		7: '🕖',
		8: '🕗',
		9: '🕘',
		10: '🕙',
		11: '🕚',
		12: '🕛',
	};
	return clocks[h12] ?? '🗓️';
}

function renderTrafficLightPrioritySections(opts: {
	header: string;
	highLabel?: string;
	mediumLabel?: string;
	lowLabel?: string;
	groups: PriorityGroup;
}): string {
	const highTitle = opts.highLabel ?? 'High Priority';
	const medTitle = opts.mediumLabel ?? 'Medium Priority';
	const lowTitle = opts.lowLabel ?? 'Low Priority';

	const section = (title: string, icon: string, items: string[]) => {
		if (!items.length) return `${icon} ${title}:\nNo items`;
		return `${icon} ${title}:\n${items.map((i) => `• ${i}`).join('\n')}`;
	};

	return [
		opts.header,
		section(highTitle, '🔴', opts.groups.high),
		section(medTitle, '🟡', opts.groups.medium),
		section(lowTitle, '🟢', opts.groups.low),
	].join('\n\n');
}

function sortEventsByTimeThenTitle(events: Array<{ date: number; time?: string; title: string }>) {
	const parseMinutes = (time?: string): number => {
		if (!time) return Number.MAX_SAFE_INTEGER;
		const t = time.trim().toLowerCase();
		const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
		if (!m) return Number.MAX_SAFE_INTEGER;
		let hour = Number(m[1]);
		const min = Number(m[2] ?? '0');
		const ampm = m[3];
		if (ampm === 'pm' && hour < 12) hour += 12;
		if (ampm === 'am' && hour === 12) hour = 0;
		return hour * 60 + min;
	};

	return [...events].sort((a, b) => {
		if (a.date !== b.date) return a.date - b.date;
		const am = parseMinutes(a.time);
		const bm = parseMinutes(b.time);
		if (am !== bm) return am - bm;
		return a.title.localeCompare(b.title);
	});
}

function renderCalendarSection(opts: { title: string; events: Array<{ title: string; time?: string }> }) {
	const lines: string[] = [];
	lines.push(opts.title);
	if (!opts.events.length) {
		lines.push('No events');
		return lines.join('\n');
	}
	for (const ev of opts.events) {
		const timePart = ev.time ? `${ev.time} - ` : '';
		lines.push(`${clockEmojiForTime(ev.time)} ${timePart}${ev.title}`);
	}
	return lines.join('\n');
}

function renderAgendaDigest(opts: {
	now: Date;
	label: string;
	events: Array<{ title: string; date: number; time?: string }>;
	tasks: Array<{ title: string; dueDate?: number; priority?: 'low' | 'medium' | 'high' }>
	cards: Array<{ title: string; dueDate?: number; priority?: any; channelName?: string }>
	mentionsCount: number;
	mentionsSummary?: string;
}): string {
	const hour = opts.now.getHours();
	const greeting = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';
	const lines: string[] = [];
	lines.push(`${greeting} Here's ${opts.label} ahead:`);

	const eventsSorted = sortEventsByTimeThenTitle(opts.events);
	const meetingCount = eventsSorted.length;
	if (!meetingCount) {
		lines.push(`📅 No meetings scheduled`);
	} else {
		const first = eventsSorted[0];
		const time = first.time ? ` at ${first.time}` : '';
		const highlight = `${first.title}${time}`;
		lines.push(`📅 ${meetingCount} ${plural(meetingCount, 'meeting')} — ${highlight}${meetingCount > 1 ? ' (+more)' : ''}`);
	}

	const taskCount = opts.tasks.length;
	if (!taskCount) lines.push(`✅ No tasks due`);
	else {
		// Highlight one high-ish task if possible.
		const sorted = [...opts.tasks].sort((a, b) => {
			const ap = a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0;
			const bp = b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0;
			if (ap !== bp) return bp - ap;
			return Number(a.dueDate ?? Number.MAX_SAFE_INTEGER) - Number(b.dueDate ?? Number.MAX_SAFE_INTEGER);
		});
		lines.push(`✅ ${taskCount} ${plural(taskCount, 'task')} — ${sorted[0]?.title}${taskCount > 1 ? ' (+more)' : ''}`);
	}

	const cardDueCount = opts.cards.filter((c) => Boolean(c.dueDate)).length;
	if (!cardDueCount) lines.push(`📌 No assigned cards due`);
	else lines.push(`📌 ${cardDueCount} assigned ${plural(cardDueCount, 'card')} with due dates`);

	if (opts.mentionsCount) {
		lines.push(`🔔 ${opts.mentionsCount} ${plural(opts.mentionsCount, 'mention')} (summarized)`);
		if (opts.mentionsSummary && opts.mentionsSummary.trim()) {
			lines.push(opts.mentionsSummary.trim());
		}
	}
	else lines.push(`🔔 No new mentions`);

	return lines.join('\n');
}

function normalizeWhitespaceForPrompt(text: unknown, maxLen: number): string {
	return truncateOneLine(toPlainText(text), maxLen).replace(/\s+/g, ' ').trim();
}

function tokenizeForFuzzyMatch(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/g)
		.map((t) => t.trim())
		.filter(Boolean)
		.slice(0, 64);
}

function isLevenshteinWithin(a: string, b: string, maxEdits: number): boolean {
	if (a === b) return true;
	if (maxEdits <= 0) return false;
	const aLen = a.length;
	const bLen = b.length;
	if (Math.abs(aLen - bLen) > maxEdits) return false;
	if (!aLen || !bLen) return Math.max(aLen, bLen) <= maxEdits;

	// DP with early exit; optimized for small maxEdits.
	let prev = new Array(bLen + 1);
	let curr = new Array(bLen + 1);
	for (let j = 0; j <= bLen; j++) prev[j] = j;

	for (let i = 1; i <= aLen; i++) {
		curr[0] = i;
		let rowMin = curr[0];
		const aChar = a.charCodeAt(i - 1);
		for (let j = 1; j <= bLen; j++) {
			const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin > maxEdits) return false;
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}

	return prev[bLen] <= maxEdits;
}

function hasApproximateToken(text: string, target: string, maxEdits: number): boolean {
	const tokens = tokenizeForFuzzyMatch(text);
	for (const tok of tokens) {
		// Skip tiny tokens to avoid false positives.
		if (tok.length < Math.max(3, target.length - maxEdits)) continue;
		if (isLevenshteinWithin(tok, target, maxEdits)) return true;
	}
	return false;
}

function formatRecentMessagesForLLM(
	messages: Array<{ _creationTime: number; body: string }>,
	opts: { maxMessages: number; maxCharsPerMessage: number }
): string {
	const sorted = [...messages].sort((a, b) => a._creationTime - b._creationTime);
	const selected = sorted.slice(Math.max(0, sorted.length - opts.maxMessages));
	return selected
		.map((m) => truncateOneLine(String(m.body ?? ''), opts.maxCharsPerMessage))
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => `- ${s}`)
		.join('\n');
}

function isLikelyTomorrowReferenceFallback(text: unknown, tomorrowKey: string): boolean {
	const t = toPlainText(text).toLowerCase();
	if (!t) return false;
	if (tomorrowKey && t.includes(tomorrowKey)) return true;
	// Small heuristic only for fallback when Gemini isn't available.
	if (/\b(tmr|tmrw|tomo|tomorow|tommorow|tommorrow|tommrow)\b/i.test(t)) return true;
	if (hasApproximateToken(t, 'tomorrow', 2)) return true;
	if (/\bnext\s+day\b/i.test(t)) return true;
	if (/\bin\s+1\s+day\b/i.test(t)) return true;
	return false;
}

function extractIntent(query: string): AssistantIntent {
	const q = query.trim().toLowerCase();
	const qNoPunct = q.replace(/[^a-z0-9\s#@'-]/g, ' ');

	let channelFromText = extractChannelFromQueryText(query);
	if (channelFromText) {
		const norm = channelFromText.trim().toLowerCase();
		// Treat "all" as workspace overview, not a channel.
		if (norm === 'all' || norm === 'all-channels' || norm === 'everything' || norm === 'everyone' || norm === 'workspace') {
			channelFromText = null;
		}
	}

	const wantsTasks = q.includes('task') || q.includes('tasks') || q.includes('todo') || q.includes('to-do');
	const wantsCalendar =
		q.includes('calendar') ||
		q.includes('event') ||
		q.includes('events') ||
		q.includes('meeting') ||
		q.includes('agenda') ||
		q.includes('session');
	const wantsMeetingsList = /\b(meetings?|meeting|standup|1\s*:\s*1|one\s*-?\s*on\s*-?\s*one)\b/i.test(qNoPunct);
	const wantsBoards = q.includes('board') || q.includes('boards') || q.includes('kanban') || q.includes('card') || q.includes('cards');

	// Privacy guard: if user asks for someone else's tasks (e.g. "@Anwita's tasks"), do not attempt lookup.
	const seemsLikeOtherPerson = /@\w+/.test(qNoPunct) || /\b(\w+)'s\s+tasks\b/.test(qNoPunct);
	if (wantsTasks && seemsLikeOtherPerson) {
		// Still route to tasks, but the action handler will respond with a privacy-safe message.
		return { mode: 'tasks', channel: null };
	}
	const wantsChannel = Boolean(channelFromText) && (q.includes('summar') || q.includes('what happened') || q.includes('recap'));
	if (wantsChannel) {
		return { mode: 'channel', channel: channelFromText };
	}

	const wantsNextWeek = q.includes('next week');
	const wantsTomorrow =
		/\b(tomorrow|tomorow|tommorow|tommorrow|tommrow|tmr|tmrw|tomo)\b/i.test(qNoPunct) ||
		hasApproximateToken(qNoPunct, 'tomorrow', 2);
	const wantsWhatsFor = /\b(what\s*'?s\s+for|whats\s+for|for\s+tomorrow)\b/i.test(qNoPunct);
	const wantsToday =
		q.includes('today') ||
		q.includes("what's for today") ||
		q.includes("whats for today") ||
		q.includes('how\'s my day') ||
		q.includes('hows my day') ||
		q.includes('my day') ||
		q.includes('day looking') ||
		q.includes('today\'s agenda') ||
		q.includes('todays agenda') ||
		hasApproximateToken(qNoPunct, 'today', 1);

	const wantsTeamStatus =
		/\b(status|updates?|what\s*'?s\s+new|progress)\b/i.test(qNoPunct) &&
		/\b(team|everyone|all|workspace)\b/i.test(qNoPunct);
	if (wantsTeamStatus) {
		return { mode: 'team_status', channel: null };
	}

	const wantsOverview =
		(q.includes('what happened') || q.includes('summarize') || q.includes('summary') || q.includes('recap') || wantsTeamStatus) &&
		!channelFromText;

	// If the user asks for a summary "for today/tomorrow", treat it as a personal agenda request,
	// not a channel/workspace recap.
	if (wantsOverview && wantsToday) {
		return { mode: 'agenda_today', channel: null };
	}
	if (wantsOverview && wantsTomorrow) {
		return { mode: 'agenda_tomorrow', channel: null };
	}

	if (wantsOverview) {
		return { mode: 'overview', channel: null };
	}

	// Prioritize the new personal-assistant intents.
	if (wantsCalendar && wantsNextWeek) {
		return { mode: 'calendar_next_week', channel: null };
	}
	if (wantsMeetingsList && wantsToday) {
		return { mode: 'calendar_today', channel: null };
	}
	if (wantsCalendar && wantsTomorrow) {
		return { mode: 'calendar_tomorrow', channel: null };
	}
	if (wantsTasks && wantsToday) {
		return { mode: 'tasks_today', channel: null };
	}
	if (wantsTasks && wantsTomorrow) {
		return { mode: 'tasks_tomorrow', channel: null };
	}
	if (wantsToday && (wantsCalendar || wantsTasks || q.includes('agenda') || q.includes('day'))) {
		return { mode: 'agenda_today', channel: null };
	}
	if (
		wantsTomorrow &&
		(wantsCalendar || wantsTasks || q.includes('agenda') || q.includes('day') || q.includes('what about') || wantsWhatsFor)
	) {
		return { mode: 'agenda_tomorrow', channel: null };
	}
	if (wantsCalendar) {
		return { mode: 'calendar', channel: null };
	}
	if (wantsBoards) {
		return { mode: 'boards', channel: null };
	}
	if (wantsTasks) {
		return { mode: 'tasks', channel: null };
	}

	return { mode: 'qa', channel: null };
}

function extractSearchTerms(query: string): string[] {
	const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
	const raw = q.split(/\s+/g).map((w) => w.trim()).filter(Boolean);
	const stop = new Set([
		'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'is', 'are', 'am', 'was', 'were',
		'my', 'your', 'our', 'their', 'what', 'whats', "what's", 'about', 'please', 'do',
		'i', 'we', 'you', 'me', 'it', 'this', 'that', 'with', 'and', 'or', 'as', 'now',
		'today', 'tomorrow', 'tmr', 'tmrw', 'tomo',
	]);
	return Array.from(new Set(raw.filter((w) => w.length >= 3 && !stop.has(w)))).slice(0, 8);
}

type PriorityGroup = {
	high: string[];
	medium: string[];
	low: string[];
};

function emptyPriorityGroup(): PriorityGroup {
	return { high: [], medium: [], low: [] };
}

function renderPriorityGroups(groups: PriorityGroup): string {
	const section = (title: string, items: string[]) => {
		if (!items.length) return `${title}:\n\nNo items`;
		return `${title}:\n\n${items.map((i) => `- ${i}`).join('\n')}`;
	};
	return [
		section('High Priority', groups.high),
		section('Medium Priority', groups.medium),
		section('Low Priority', groups.low),
	].join('\n\n');
}

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

function getNextWeekRange(now: Date) {
	// Week starts Monday.
	const d = new Date(now);
	const day = d.getDay(); // 0 (Sun) .. 6 (Sat)
	const daysSinceMonday = (day + 6) % 7;
	const thisMonday = new Date(d);
	thisMonday.setDate(d.getDate() - daysSinceMonday);
	thisMonday.setHours(0, 0, 0, 0);
	const nextMonday = new Date(thisMonday);
	nextMonday.setDate(thisMonday.getDate() + 7);
	const nextWeekEnd = new Date(nextMonday);
	nextWeekEnd.setDate(nextMonday.getDate() + 7);
	nextWeekEnd.setMilliseconds(-1); // end of previous ms
	return { from: nextMonday.getTime(), to: nextWeekEnd.getTime() };
}

function shortDate(ms: number) {
	const d = new Date(ms);
	return d.toISOString().slice(0, 10);
}

function bucketByDueDate(opts: { dueDate?: number; explicitPriority?: 'low' | 'medium' | 'high' | 'highest' | 'lowest' }) {
	// If an explicit priority exists, respect it.
	if (opts.explicitPriority) {
		if (opts.explicitPriority === 'high' || opts.explicitPriority === 'highest') return 'high' as const;
		if (opts.explicitPriority === 'medium') return 'medium' as const;
		return 'low' as const;
	}

	const now = Date.now();
	const due = opts.dueDate;
	if (!due) return 'low' as const;
	if (due < now) return 'high' as const;
	const inMs = due - now;
	if (inMs <= 24 * 60 * 60 * 1000) return 'high' as const;
	if (inMs <= 3 * 24 * 60 * 60 * 1000) return 'medium' as const;
	return 'low' as const;
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
	): Promise<{ answer: string; sources: string[]; actions?: NavigationAction[] }> => {
		if (!args.workspaceId) {
			return {
				answer: 'Workspace context is required.',
				sources: [],
			};
		}

		const calendarActionForWorkspace = (workspaceId: Id<'workspaces'>): NavigationAction => ({
			label: 'View calendar',
			type: 'calendar',
			url: `/workspace/${workspaceId}/calendar`,
		});

		// Intent-first routing (no LLM call).
		const intent = extractIntent(args.query);
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
					// Cost-safe: fetch a small slice; we further cap/truncate before sending to the model.
					paginationOpts: { numItems: 40, cursor: null },
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

			// Token safety: only send a short, recent slice to the model.
			const messageContext = formatRecentMessagesForLLM(messages, {
				maxMessages: 10,
				maxCharsPerMessage: 200,
			});

			const chatPrompt = `Summarize only the recent messages provided.

Rules:
- Never quote or paste any message verbatim.
- Do not include any continuous 5+ words copied from a message.
- Paraphrase and keep it concise.

Output format EXACTLY:
High Priority:\n- ...\n
Medium Priority:\n- ...\n
Low Priority:\n- ...

			If a section has no items, write:\nNo items
			Do NOT write "If you are <name>" or any conditional identity statements.

User question: ${args.query}

Messages (most recent last):\n${messageContext}`;

			try {
				const answer = await generateLLMResponse(chatPrompt, '');
				return {
					answer,
					sources: [`#${resolvedChannelName}`],
				};
			} catch {
				// Gemini not available: return a safe, non-verbatim heuristic summary.
				const answer = heuristicSummarizeMessagesToPriorityGroups({
					messages: messages.map((m) => ({ body: m.body })),
					includeChannels: false,
				});
				return {
					answer,
					sources: [`#${resolvedChannelName}`],
				};
			}
		}

		// ---------------------------------------------------------------------
		// 3b. PERSONAL ASSISTANT (today / next week / tasks / calendar / boards)
		// ---------------------------------------------------------------------
		{
			const authUserId = await getAuthUserId(ctx);
			if (!authUserId) {
				return { answer: 'Sign in to use the assistant.', sources: [] };
			}
			// STRICT: ignore any passed userId; always scope to auth user.
			const workspaceId = args.workspaceId as Id<'workspaces'>;

			if (intent.mode === 'team_status') {
				// Ensure membership.
				await ctx.runQuery(api.members.current, { workspaceId });

				const [members, presenceState, channels] = await Promise.all([
					ctx.runQuery(api.members.get, { workspaceId }),
					ctx.runQuery(api.presence.listWorkspacePresence, { workspaceId }) as Promise<any[]>,
					ctx.runQuery(api.channels.get, { workspaceId }) as Promise<any[]>,
				]);

				const onlineUserIds = new Set(
					(presenceState || [])
						.filter((p: any) => Boolean(p?.online))
						.map((p: any) => String(p?.userId))
				);

				const totalMembers = Array.isArray(members) ? members.length : 0;
				const onlineMembers = (members || []).filter((m: any) => onlineUserIds.has(String(m?.userId)));
				const offlineMembers = (members || []).filter((m: any) => !onlineUserIds.has(String(m?.userId)));

				const formatMember = (m: any) => `@${String(m?.user?.name ?? 'Unknown').trim()}`;

				const lines: string[] = [];
				lines.push('Team Status Overview:');
				lines.push(`👥 Online: ${onlineMembers.length}/${totalMembers} team members`);
				if (onlineMembers.length) {
					lines.push(
						`🟢 Online: ${onlineMembers
							.slice(0, 12)
							.map(formatMember)
							.join(', ')}${onlineMembers.length > 12 ? '…' : ''}`
					);
				}

				type TeamUpdate = { author: string; channel: string; body: string };
				const updates: TeamUpdate[] = [];
				// Who said what: sample a small set of channels, take the most recent message in each.
				for (const ch of (channels || []).slice(0, 6)) {
					const recent = await ctx.runQuery(api.messages.getRecentChannelMessages, {
						channelId: ch._id as Id<'channels'>,
						limit: 6,
					});
					const last = Array.isArray(recent) ? recent[recent.length - 1] : null;
					if (!last?.body) continue;
					const author = String(last.authorName || 'Someone').trim();
					const body = truncateOneLine(String(last.body), 140);
					const channelName = String(ch?.name || 'unknown');
					updates.push({ author, channel: channelName, body });
				}
				if (updates.length) {
					lines.push('');
					lines.push('Recent updates (summary):');
					const context = updates
						.slice(0, 6)
						.map((u) => `@${u.author} in #${u.channel}: ${u.body}`)
						.join('\n');

					try {
						const prompt = `Summarize these recent team updates.

Rules:
- Do NOT paste the messages verbatim.
- Keep it to 1-3 short bullet points.
- If you mention a person, format as @Name.

Updates:\n${context}`;
						const summary = await generateLLMResponse(prompt, '');
						lines.push(summary);
					} catch {
						// If Gemini isn't available, avoid showing raw messages; show a non-verbatim fallback.
						const fallback = updates
							.slice(0, 6)
							.map((u) => `• @${u.author} posted in #${u.channel}`)
							.join('\n');
						lines.push(fallback);
					}
				}

				if (offlineMembers.length) {
					lines.push('');
					lines.push(
						`⚫ Offline: ${offlineMembers
							.slice(0, 15)
							.map(formatMember)
							.join(', ')}${offlineMembers.length > 15 ? '…' : ''}`
					);
				}

				return {
					answer: lines.join('\n'),
					sources: ['Presence', 'Messages'],
				};
			}

			if (
				intent.mode === 'agenda_today' ||
				intent.mode === 'agenda_tomorrow' ||
				intent.mode === 'tasks_today' ||
				intent.mode === 'tasks_tomorrow' ||
				intent.mode === 'calendar_next_week' ||
				intent.mode === 'calendar_today' ||
				intent.mode === 'calendar_tomorrow' ||
				intent.mode === 'calendar' ||
				intent.mode === 'boards' ||
				intent.mode === 'tasks'
			) {
				const now = new Date();
				const todayFrom = startOfDayMs(now);
				const todayTo = endOfDayMs(now);
				const tomorrow = new Date(now);
				tomorrow.setDate(now.getDate() + 1);
				const tomorrowFrom = startOfDayMs(tomorrow);
				const tomorrowTo = endOfDayMs(tomorrow);

				const getAssignedCardsForUser = async () => {
					const currentMember = await ctx.runQuery(api.members.current, { workspaceId });
					if (!currentMember) {
						return [] as any[];
					}
					return await ctx.runQuery(api.board.getAssignedCards, {
						workspaceId,
						memberId: currentMember._id,
					});
				};

				// Privacy: prevent requests for other users' tasks.
				if (intent.mode === 'tasks') {
					const q = args.query.trim().toLowerCase();
					const qNoPunct = q.replace(/[^a-z0-9\s#@'-]/g, ' ');
					const seemsLikeOtherPerson = /@\w+/.test(qNoPunct) || /\b(\w+)'s\s+tasks\b/.test(qNoPunct);
					if (seemsLikeOtherPerson) {
						return {
							answer:
								"I can only show tasks assigned to you (the signed-in user). If you want, ask \"What are my tasks for today?\" or \"Show my tasks\".",
							sources: [],
						};
					}
				}

				if (intent.mode === 'calendar_next_week') {
					const range = getNextWeekRange(now);
					const events = await ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
						workspaceId,
						from: range.from,
						to: range.to,
					});

					const sorted = sortEventsByTimeThenTitle(events);
					const byDay = new Map<string, Array<{ title: string; time?: string }>>();
					for (const ev of sorted) {
						const dayKey = shortDate(ev.date);
						const list = byDay.get(dayKey) ?? [];
						list.push({ title: ev.title, time: ev.time });
						byDay.set(dayKey, list);
					}
					const lines: string[] = [];
					lines.push("Next Week's Calendar:");
					if (!sorted.length) {
						lines.push('No events');
					} else {
						for (const [day, items] of Array.from(byDay.entries())) {
							lines.push('');
							lines.push(`📅 ${day}`);
							for (const ev of items) {
								const timePart = ev.time ? `${ev.time} - ` : '';
								lines.push(`${clockEmojiForTime(ev.time)} ${timePart}${ev.title}`);
							}
						}
					}

					return {
						answer: lines.join('\n'),
						sources: ['Calendar'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'calendar_today') {
					const events = await ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
						workspaceId,
						from: todayFrom,
						to: todayTo,
					});
					return {
						answer: renderCalendarSection({
							title: "Today's Meetings:",
							events: sortEventsByTimeThenTitle(events).map((e) => ({ title: e.title, time: e.time })),
						}),
						sources: ['Calendar'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'calendar_tomorrow') {
					const events = await ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
						workspaceId,
						from: tomorrowFrom,
						to: tomorrowTo,
					});

					return {
						answer: renderCalendarSection({
							title: "Tomorrow's Calendar:",
							events: sortEventsByTimeThenTitle(events).map((e) => ({ title: e.title, time: e.time })),
						}),
						sources: ['Calendar'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'calendar') {
					// Match the example style: show Today + Tomorrow.
					const [todayEvents, tomorrowEvents] = await Promise.all([
						ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
							workspaceId,
							from: todayFrom,
							to: todayTo,
						}),
						ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
							workspaceId,
							from: tomorrowFrom,
							to: tomorrowTo,
						}),
					]);

					const lines: string[] = [];
					lines.push(
						renderCalendarSection({
							title: "Today's Calendar:",
							events: sortEventsByTimeThenTitle(todayEvents).map((e) => ({ title: e.title, time: e.time })),
						})
					);
					lines.push('');
					lines.push(
						renderCalendarSection({
							title: "Tomorrow's Calendar:",
							events: sortEventsByTimeThenTitle(tomorrowEvents).map((e) => ({ title: e.title, time: e.time })),
						})
					);

					return {
						answer: lines.join('\n'),
						sources: ['Calendar'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'boards') {
					// Boards are represented by cards assigned to the user (cards.assignees).
					const assignedCards = await getAssignedCardsForUser();
					const groups = emptyPriorityGroup();
					for (const c of assignedCards.slice(0, 80)) {
						const bucket = bucketByDueDate({
							dueDate: c.dueDate,
							explicitPriority: c.priority,
						});
						const duePart = c.dueDate ? ` (due ${shortDate(c.dueDate)})` : '';
						const boardPart = c.channelName ? ` (#${c.channelName})` : '';
						groups[bucket].push(`${c.title}${boardPart}${duePart}`);
					}
					return {
						answer: renderTrafficLightPrioritySections({
							header: 'Your Board Cards:',
							groups,
						}),
						sources: ['Boards'],
					};
				}

				if (intent.mode === 'tasks_today') {
					const tasks = await ctx.runQuery(api.chatbot.getMyTasksInRange, {
						workspaceId,
						from: todayFrom,
						to: todayTo,
						onlyIncomplete: true,
					});

					const groups = emptyPriorityGroup();
					for (const t of tasks) {
						const bucket = bucketByDueDate({ dueDate: t.dueDate, explicitPriority: t.priority ?? undefined });
						groups[bucket].push(`${t.title}${t.dueDate ? ` (${shortDate(t.dueDate)})` : ''}`);
					}
					return {
						answer: renderTrafficLightPrioritySections({
							header: "Today's Tasks:",
							groups,
						}),
						sources: ['Tasks'],
					};
				}

				if (intent.mode === 'tasks_tomorrow') {
					const tasks = await ctx.runQuery(api.chatbot.getMyTasksInRange, {
						workspaceId,
						from: tomorrowFrom,
						to: tomorrowTo,
						onlyIncomplete: true,
					});

					const groups = emptyPriorityGroup();
					for (const t of tasks) {
						const bucket = bucketByDueDate({ dueDate: t.dueDate, explicitPriority: t.priority ?? undefined });
						groups[bucket].push(`${t.title}${t.dueDate ? ` (${shortDate(t.dueDate)})` : ''}`);
					}
					return {
						answer: renderTrafficLightPrioritySections({
							header: "Tomorrow's Tasks:",
							groups,
						}),
						sources: ['Tasks'],
					};
				}

				if (intent.mode === 'tasks') {
					// Show upcoming/incomplete tasks (cost-safe, no model).
					const tasks = await ctx.runQuery(api.chatbot.getMyUpcomingTasks, {
						workspaceId,
						limit: 25,
					});
					const groups = emptyPriorityGroup();
					for (const t of tasks) {
						const bucket = bucketByDueDate({ dueDate: t.dueDate, explicitPriority: t.priority ?? undefined });
						const duePart = t.dueDate ? ` (due ${shortDate(t.dueDate)})` : '';
						groups[bucket].push(`${t.title}${duePart}`);
					}
					return {
						answer: renderTrafficLightPrioritySections({
							header: 'Your Tasks:',
							groups,
						}),
						sources: ['Tasks'],
					};
				}

				if (intent.mode === 'agenda_today') {
					const [events, tasks, assignedCards, mentioned] = await Promise.all([
						ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
							workspaceId,
							from: todayFrom,
							to: todayTo,
						}),
						ctx.runQuery(api.chatbot.getMyTasksInRange, {
							workspaceId,
							from: todayFrom,
							to: todayTo,
							onlyIncomplete: true,
						}),
						getAssignedCardsForUser(),
						ctx.runQuery(api.messages.getMentionedMessages, {
							workspaceId,
							limit: 80,
						}) as Promise<any[]>,
					]);

					// Match example style: a compact day-ahead digest (still user-scoped).
					const createdTodayMentionsCount = (mentioned || []).filter((m) => {
						const created = Number((m as any)?._creationTime ?? 0);
						return Boolean(created) && created >= todayFrom && created <= todayTo;
					}).length;

					return {
						answer: renderAgendaDigest({
							now,
							label: 'your day',
							events,
							tasks,
							cards: assignedCards,
							mentionsCount: createdTodayMentionsCount,
						}),
						sources: ['Calendar', 'Tasks', 'Boards'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'agenda_tomorrow') {
					const [events, tasks, assignedCards, mentioned] = await Promise.all([
						ctx.runQuery(api.chatbot.getMyCalendarEventsInRange, {
							workspaceId,
							from: tomorrowFrom,
							to: tomorrowTo,
						}),
						ctx.runQuery(api.chatbot.getMyTasksInRange, {
							workspaceId,
							from: tomorrowFrom,
							to: tomorrowTo,
							onlyIncomplete: true,
						}),
						getAssignedCardsForUser(),
						ctx.runQuery(api.messages.getMentionedMessages, {
							workspaceId,
							limit: 120,
						}) as Promise<any[]>,
					]);

					const tomorrowKey = shortDate(tomorrowFrom);
					const mentionCandidates = (mentioned || [])
						.filter((m) => {
							const created = Number((m as any)?._creationTime ?? 0);
							return Boolean(created) && created >= todayFrom;
						})
						.slice(0, 40)
						.map((m) => {
							const who = String((m as any)?.user?.name ?? 'Someone').trim();
							const ctxName = String((m as any)?.context?.name ?? 'Mention');
							const created = Number((m as any)?._creationTime ?? 0);
							const body = String((m as any)?.body ?? '');
							return { who, ctxName, created, body };
						});

					let tomorrowMentionsCount = 0;
					let mentionsSummary: string | undefined;
					if (mentionCandidates.length) {
						try {
							const mentionContext = mentionCandidates
								.map((m, i) => {
									const when = m.created ? new Date(m.created).toISOString() : '';
									const body = normalizeWhitespaceForPrompt(m.body, 260);
									return `(${i + 1}) [${when}] @${m.who} in ${m.ctxName}: ${body}`;
								})
								.join('\n');

							const prompt = `You are helping with a personal agenda for tomorrow.

Task:
- From the MENTIONS below, identify which items are relevant to TOMORROW (or the next day), even if the message has small spelling mistakes or informal phrasing.
- Then summarize those relevant items.

Strict rules:
- Never quote or paste any message verbatim.
- Do not include any continuous 5+ words copied from any message.
- Do not include raw message text or long fragments.
- Keep bullets short and action-oriented.
- If you mention a person, format as @Name.

Output format EXACTLY:
Count: <number>
• <summary>
• <summary>
• <summary>

If there are no relevant mentions, output EXACTLY:
Count: 0
No items

Mentions:\n${mentionContext}`;

							const llm = await generateLLMResponse(prompt, '');
							const lines = String(llm ?? '')
								.split(/\r?\n/)
								.map((l) => l.trim())
								.filter(Boolean);
							const countLine = lines.find((l) => /^count\s*:\s*\d+/i.test(l));
							const countMatch = countLine?.match(/(\d+)/);
							tomorrowMentionsCount = countMatch ? Number(countMatch[1]) : 0;
							const bullets = lines
								.filter((l) => l.startsWith('•') || l.startsWith('-'))
								.map((l) => (l.startsWith('-') ? `• ${l.slice(1).trim()}` : l))
								.slice(0, 3);
							if (bullets.length) mentionsSummary = bullets.join('\n');
							if (!tomorrowMentionsCount && bullets.length) tomorrowMentionsCount = bullets.length;
						} catch {
							// Gemini isn't available: keep a small, safe heuristic fallback.
							const matches = mentionCandidates.filter((m) => isLikelyTomorrowReferenceFallback(m.body, tomorrowKey));
							tomorrowMentionsCount = matches.length;
							if (matches.length) {
								mentionsSummary = matches
									.slice(0, 3)
									.map((m) => {
										const keywords = extractTopicKeywords(m.body, 4);
										const topicPart = keywords.length ? ` — topics: ${keywords.join(', ')}` : '';
										return `• @${m.who} in ${m.ctxName}${topicPart}`;
									})
									.join('\n');
							}
						}
					}

					return {
						answer: renderAgendaDigest({
							now,
							label: 'tomorrow',
							events,
							tasks,
							cards: assignedCards,
							mentionsCount: tomorrowMentionsCount,
							mentionsSummary,
						}),
						sources: ['Calendar', 'Tasks', 'Boards'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}
			}
		}

		// ---------------------------------------------------------------------
		// 3c. OVERVIEW SUMMARY ("what happened" across all channels)
		// ---------------------------------------------------------------------
		if (intent.mode === 'overview') {
			const allChannels = await ctx.runQuery(api.channels.get, {
				workspaceId: args.workspaceId!,
			});

			const messagesByChannel = new Map<string, string[]>();
			// Cost-safe: only sample a small number of channels to avoid N+1.
			for (const ch of allChannels.slice(0, 6)) {
				const res = await ctx.runQuery(api.messages.get, {
					channelId: ch._id as Id<'channels'>,
					paginationOpts: { numItems: 20, cursor: null },
				});
				const items: Array<{ _creationTime: number; body: string }> = res.page.map(
					(m: any) => ({ _creationTime: m._creationTime, body: m.body })
				);
				const chName = (ch.name as string) || 'unknown';
				if (!messagesByChannel.has(chName)) messagesByChannel.set(chName, []);

				const context = formatRecentMessagesForLLM(items, {
					maxMessages: 4,
					maxCharsPerMessage: 180,
				});
				if (context.trim()) messagesByChannel.get(chName)!.push(context);
			}

			let chatContext = '';
			for (const [chName, msgs] of Array.from(messagesByChannel.entries())) {
				if (!msgs.length) continue;
				chatContext += `\n#${chName}:\n${msgs.join('\n')}\n`;
			}

			if (!chatContext.trim()) {
				return { answer: 'No recent channel activity found.', sources: [] };
			}

			const overviewPrompt = `Summarize only the recent messages provided.

Rules:
- Never quote or paste any message verbatim.
- Do not include any continuous 5+ words copied from a message.
- Paraphrase and keep it concise.

Output format EXACTLY:
High Priority:\n- ...\n
Medium Priority:\n- ...\n
Low Priority:\n- ...

			If a section has no items, write:\nNo items
			Do NOT write "If you are <name>" or any conditional identity statements.

User question: ${args.query}

Recent messages:\n${chatContext}`;

			try {
				const answer = await generateLLMResponse(overviewPrompt, '');
				const sources = Array.from(messagesByChannel.keys()).map((c) => `#${c}`);
				return { answer, sources };
			} catch {
				// Gemini not available: return a safe, non-verbatim heuristic summary by channel.
				const flattened: Array<{ body: unknown; channel?: string }> = [];
				for (const [chName, msgs] of Array.from(messagesByChannel.entries())) {
					for (const raw of msgs) {
						// raw is "[timestamp] body"; keep it internal for keyword extraction.
						flattened.push({ body: raw, channel: chName });
					}
				}
				const answer = heuristicSummarizeMessagesToPriorityGroups({ messages: flattened, includeChannels: true });
				const sources = Array.from(messagesByChannel.keys()).map((c) => `#${c}`);
				return { answer, sources };
			}
		}

		// ---------------------------------------------------------------------
		// 4. FALLBACK → MIXED SEARCH (RAG + Recent Messages)
		// ---------------------------------------------------------------------
		// Cost-first: do a cheap keyword scan of recent messages before semantic search/LLM.
		{
			const terms = extractSearchTerms(args.query);
			if (terms.length) {
				let channels: any[] = [];
				try {
					channels = await ctx.runQuery(api.channels.get, { workspaceId: args.workspaceId! });
				} catch {
					channels = [];
				}

				const hits: Array<{ score: number; channel: string; author: string; body: string }> = [];
				for (const ch of channels.slice(0, 6)) {
					const recent = await ctx.runQuery(api.messages.getRecentChannelMessages, {
						channelId: ch._id as Id<'channels'>,
						limit: 25,
					});
					for (const m of Array.isArray(recent) ? recent : []) {
						const body = truncateOneLine(String((m as any)?.body ?? ''), 220);
						if (!body) continue;
						const hay = body.toLowerCase();
						let score = 0;
						for (const t of terms) {
							if (hay.includes(t)) score += 1;
						}
						if (!score) continue;
						const author = String((m as any)?.authorName ?? 'Someone').trim();
						const channelName = String(ch?.name || 'unknown');
						hits.push({ score, channel: channelName, author, body });
					}
				}

				if (hits.length) {
					hits.sort((a, b) => b.score - a.score);
					const top = hits.slice(0, 8);
					const messageContext = top
						.map((h) => `@${h.author} in #${h.channel}: ${h.body}`)
						.join('\n');

					// Prefer Gemini to summarize/answer (small context). If Gemini isn't configured, fall back to a heuristic summary.
					try {
						const prompt = `Answer the user's question using ONLY the following recent messages.

Be concise. Summarize; do NOT paste the messages verbatim.
Never quote. Do not include any continuous 5+ words copied from a message.
If you need to name people, use @Name.

Question: ${args.query}

Recent messages:\n${messageContext}`;
						const answer = await generateLLMResponse(prompt, '');
						return { answer, sources: ['Messages'] };
					} catch {
						const keywords = Array.from(
							new Set(top.flatMap((h) => extractTopicKeywords(h.body, 4)))
						).slice(0, 8);
						const channelsUsed = Array.from(new Set(top.map((h) => `#${h.channel}`))).slice(0, 6);
						const authorsUsed = Array.from(new Set(top.map((h) => `@${h.author}`))).slice(0, 6);
						const lines: string[] = [];
						lines.push("I found relevant recent activity, but AI summarization isn't available right now.");
						if (channelsUsed.length) lines.push(`Channels: ${channelsUsed.join(', ')}`);
						if (authorsUsed.length) lines.push(`People: ${authorsUsed.join(', ')}`);
						if (keywords.length) lines.push(`Topics: ${keywords.join(', ')}`);
						return { answer: lines.join('\n'), sources: ['Messages'] };
					}
				}
			}
		}

		const ragResults: Array<{ text: string }> = await ctx.runAction(
			api.search.semanticSearch,
			{
				workspaceId: args.workspaceId!,
				query: args.query,
				limit: 3,
			}
		);

		const ragContext = ragResults
			.map((c: any, i: number) => `[Doc ${i + 1}] ${c?.text ?? ''}`)
			.join('\n\n');

		// Cost-safe: do not include large channel histories in general QA.
		const combinedContext = `${ragContext ? 'KNOWLEDGE BASE:\n' + ragContext : ''}`.trim();

		if (!combinedContext) {
			return {
				answer:
					"I don't have enough information (no documents or recent messages found).",
				sources: [],
			};
		}

		const mixedPrompt = `Answer using ONLY the provided context.

Rules:
- Never quote or paste any context verbatim.
- Do not include any continuous 5+ words copied from the context.
- Paraphrase and keep it concise.

If listing items, use this EXACT format:
High Priority:\n- ...\n
Medium Priority:\n- ...\n
Low Priority:\n- ...

			If a section has no items, write:\nNo items

Question: ${args.query}

Context:\n${combinedContext}`;

		try {
			const answer = await generateLLMResponse(mixedPrompt, '');
			const sources = [...(ragResults.length ? ['Knowledge Base'] : [])];
			return { answer, sources };
		} catch {
			// If Gemini isn't configured, do not expose raw document text.
			return {
				answer:
					"I found some relevant workspace context, but AI summarization isn't available right now. Try again after configuring Gemini.",
				sources: [...(ragResults.length ? ['Knowledge Base'] : [])],
			};
		}
	},
});

// -----------------------------
// User-scoped assistant queries
// -----------------------------

export const getMyTasksInRange = query({
	args: {
		workspaceId: v.id('workspaces'),
		from: v.number(),
		to: v.number(),
		onlyIncomplete: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		// Ensure membership (privacy).
		await getCurrentMember(ctx, args.workspaceId);

		const tasks = await ctx.db
			.query('tasks')
			.withIndex('by_workspace_id_user_id', (q) => q.eq('workspaceId', args.workspaceId).eq('userId', userId))
			.filter((q) =>
				q.and(
					q.neq(q.field('dueDate'), undefined),
					q.gte(q.field('dueDate'), args.from),
					q.lte(q.field('dueDate'), args.to)
				)
			)
			.collect();

		const filtered = args.onlyIncomplete
			? tasks.filter((t) => !t.completed && t.status !== 'completed')
			: tasks;

		// Return only minimal fields.
		return filtered
			.map((t) => ({
				_id: t._id,
				title: t.title,
				dueDate: t.dueDate,
				priority: t.priority,
				status: t.status,
				completed: t.completed,
			}))
			.sort((a, b) => (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER))
			.slice(0, 40);
	},
});

export const getMyUpcomingTasks = query({
	args: {
		workspaceId: v.id('workspaces'),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		await getCurrentMember(ctx, args.workspaceId);

		const tasks = await ctx.db
			.query('tasks')
			.withIndex('by_workspace_id_user_id', (q) => q.eq('workspaceId', args.workspaceId).eq('userId', userId))
			.filter((q) => q.neq(q.field('status'), 'completed'))
			.collect();

		return tasks
			.filter((t) => !t.completed && t.status !== 'completed')
			.map((t) => ({
				_id: t._id,
				title: t.title,
				dueDate: t.dueDate,
				priority: t.priority,
				status: t.status,
			}))
			.sort((a, b) => (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER))
			.slice(0, args.limit ?? 25);
	},
});

export const getMyCalendarEventsInRange = query({
	args: {
		workspaceId: v.id('workspaces'),
		from: v.number(),
		to: v.number(),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		// Strict: only the current member's events.
		const events = await ctx.db
			.query('events')
			.withIndex('by_member_id', (q) => q.eq('memberId', member._id))
			.filter((q) =>
				q.and(
					q.eq(q.field('workspaceId'), args.workspaceId),
					q.gte(q.field('date'), args.from),
					q.lte(q.field('date'), args.to)
				)
			)
			.collect();

		return events
			.map((e) => ({
				_id: e._id,
				title: e.title,
				date: e.date,
				time: e.time,
			}))
			.sort((a, b) => a.date - b.date)
			.slice(0, 40);
	},
});

export const getMyAssignedCardsInRange = query({
	args: {
		workspaceId: v.id('workspaces'),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const mentions = await ctx.db
			.query('mentions')
			.withIndex('by_workspace_id_mentioned_member_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('mentionedMemberId', member._id)
			)
			.filter((q) => q.neq(q.field('cardId'), undefined))
			.order('desc')
			.take(200);

		const uniqueCardMentions: Array<{ cardId: Id<'cards'>; channelId?: Id<'channels'>; cardTitle?: string }> = [];
		const seen = new Set<string>();
		for (const m of mentions) {
			if (!m.cardId) continue;
			const key = String(m.cardId);
			if (seen.has(key)) continue;
			seen.add(key);
			uniqueCardMentions.push({
				cardId: m.cardId as Id<'cards'>,
				channelId: m.channelId as Id<'channels'> | undefined,
				cardTitle: m.cardTitle,
			});
			if (uniqueCardMentions.length >= (args.limit ?? 20)) break;
		}

		const cards = await Promise.all(
			uniqueCardMentions.map(async (m) => {
				const card = await ctx.db.get(m.cardId);
				return { mention: m, card };
			})
		);

		const channelIds = Array.from(
			new Set(cards.map((c) => c.mention.channelId).filter(Boolean).map((id) => String(id)))
		);
		const channels = await Promise.all(channelIds.map(async (id) => ctx.db.get(id as Id<'channels'>)));
		const channelMap = new Map(channels.filter(Boolean).map((c) => [String(c!._id), c!]));

		const inRange = cards
			.map(({ mention, card }) => {
				if (!card?.dueDate) return null;
				if (card.dueDate < args.from || card.dueDate > args.to) return null;
				const channelName = mention.channelId ? channelMap.get(String(mention.channelId))?.name : undefined;
				return {
					_id: card._id,
					title: card.title ?? mention.cardTitle ?? 'Untitled card',
					dueDate: card.dueDate,
					priority: card.priority,
					boardName: channelName ? `#${channelName}` : 'Board',
				};
			})
			.filter(Boolean) as Array<{ _id: Id<'cards'>; title: string; dueDate: number; priority?: any; boardName: string }>;

		return inRange.sort((a, b) => a.dueDate - b.dueDate).slice(0, args.limit ?? 20);
	},
});

export const getMyBoardsSummary = query({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const mentions = await ctx.db
			.query('mentions')
			.withIndex('by_workspace_id_mentioned_member_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('mentionedMemberId', member._id)
			)
			.filter((q) => q.neq(q.field('cardId'), undefined))
			.order('desc')
			.take(300);

		const byChannel = new Map<string, { channelId: Id<'channels'>; count: number; hasOverdueOrToday: boolean; hasUpcoming: boolean }>();
		const now = new Date();
		const todayStart = startOfDayMs(now);
		const todayEnd = endOfDayMs(now);
		const upcomingEnd = todayEnd + 7 * 24 * 60 * 60 * 1000;

		for (const m of mentions) {
			if (!m.channelId) continue;
			const key = String(m.channelId);
			const entry = byChannel.get(key) ?? {
				channelId: m.channelId as Id<'channels'>,
				count: 0,
				hasOverdueOrToday: false,
				hasUpcoming: false,
			};
			entry.count += 1;
			byChannel.set(key, entry);
		}

		// Fetch channel docs (no N+1: only unique channels).
		const channelDocs = await Promise.all(
			Array.from(byChannel.values()).map(async (b) => ctx.db.get(b.channelId))
		);
		const channelNameById = new Map(channelDocs.filter(Boolean).map((c) => [String(c!._id), c!.name]));

		// Light signal for urgency: sample a small set of recent mentioned cards to detect due dates.
		const sampleMentions = mentions.filter((m) => Boolean(m.cardId)).slice(0, 25);
		const sampleCards = await Promise.all(sampleMentions.map(async (m) => ({ m, c: await ctx.db.get(m.cardId as Id<'cards'>) })));
		for (const { m, c } of sampleCards) {
			if (!m.channelId || !c?.dueDate) continue;
			const entry = byChannel.get(String(m.channelId));
			if (!entry) continue;
			if (c.dueDate <= todayEnd) entry.hasOverdueOrToday = true;
			else if (c.dueDate <= upcomingEnd) entry.hasUpcoming = true;
		}

		return Array.from(byChannel.entries())
			.map(([id, b]) => ({
				id,
				name: `#${channelNameById.get(id) ?? 'unknown'}`,
				assignedCards: b.count,
				hasOverdueOrToday: b.hasOverdueOrToday,
				hasUpcoming: b.hasUpcoming,
			}))
			.sort((a, b) => b.assignedCards - a.assignedCards)
			.slice(0, 30);
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
