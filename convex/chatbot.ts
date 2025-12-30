import { action, mutation, query, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { type TableNames, Id } from './_generated/dataModel';
import { getAuthUserId } from '@convex-dev/auth/server';
import { api } from './_generated/api';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

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
		id: Id<TableNames>;
		type: string;
		text: string;
	}>;
	actions?: NavigationAction[];
	error?: string;
};

type LLMMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

const DEFAULT_SYSTEM_PROMPT =
	[
		'You are Proddy, a personal work assistant for a team workspace.',
		'You help with: calendar/meetings, tasks, incidents, team status, and project execution.',
		'Respond in plain text with short headings and bullet points.',
		'Recent chat messages are ONLY for conversational continuity; they are not a data source.',
		'Do NOT output topic/keyword summaries of chat messages. Never write "topics" or any message counts.',
		'If you do not know the answer, respond with "I do not have that information."',
	].join(' ');

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
	opts: {
		prompt: string;
		systemPrompt?: string;
		recentMessages?: ReadonlyArray<ChatMessage>;
	}
): Promise<string> {
	const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required');
	}

	const modelId =
		process.env.GOOGLE_GENERATIVE_AI_MODEL ||
		process.env.GEMINI_MODEL ||
		'gemini-2.5-flash';

	const system = (opts.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT).trim();
	const userPrompt = String(opts.prompt ?? '').trim();
	if (!userPrompt) return '';

	const previous = (opts.recentMessages ?? [])
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.slice(-3)
		.map<LLMMessage>((m) => ({
			role: m.role,
			content: truncateOneLine(String(m.content ?? '').trim(), 700),
		}));

	const messages: LLMMessage[] = [
		{ role: 'system', content: system },
		...previous,
		{ role: 'user', content: userPrompt },
	];

	const { text } = await generateText({
		model: google(modelId),
		messages,
		temperature: 0.2,
		maxTokens: 1024,
	});

	return text.trim();
}

type AssistantIntent = {
	mode:
		| 'channel'
		| 'channels_overview'
		| 'overview'
		| 'team_status'
		| 'incidents'
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
			const parsed: unknown = JSON.parse(text);
			const isRecord = (v: unknown): v is Record<string, unknown> =>
				typeof v === 'object' && v !== null;

			// Quill Delta-like: { ops: [{ insert: "..." }] }
			if (isRecord(parsed) && Array.isArray(parsed.ops)) {
				const inserts = parsed.ops
					.map((op: unknown) => {
						if (!isRecord(op)) return '';
						return typeof op.insert === 'string' ? op.insert : '';
					})
					.join('');
				return inserts.replace(/\s+/g, ' ').trim();
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
	// The UI does not render Slack-style emoji shortcodes (e.g. :clock10:),
	// so always return a single Unicode emoji.
	return time ? '🕒' : '📅';
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
	windowLabel: string;
	events: Array<{ title: string; date: number; time?: string }>;
	tasks: Array<{ title: string; dueDate?: number; priority?: Priority }>
	cards: Array<{ title: string; dueDate?: number; priority?: Priority; channelName?: string }>
	mentionsCount: number;
	mentionsSummary?: string;
}): string {
	const hour = opts.now.getHours();
	const greeting = hour < 12 ? 'Good morning!' : hour < 17 ? 'Good afternoon!' : 'Good evening!';
	const lines: string[] = [];
	lines.push(`${greeting} Here's ${opts.label} ahead:`);

	const section = (title: string, bodyLines: string[]) => {
		lines.push('');
		lines.push(title);
		if (!bodyLines.length) {
			lines.push('No items');
			return;
		}
		for (const l of bodyLines) lines.push(`• ${l}`);
	};

	// Meetings
	const eventsSorted = sortEventsByTimeThenTitle(opts.events);
	section(
		`📅 Meetings (${opts.windowLabel})`,
		eventsSorted.map((e) => {
			const timePart = e.time ? `${e.time} - ` : '';
			return `${clockEmojiForTime(e.time)} ${timePart}${e.title}`;
		})
	);

	// Tasks
	const dueTasks = opts.tasks
		.filter((t) => typeof t.dueDate === 'number')
		.sort((a, b) => {
			const ap = a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0;
			const bp = b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0;
			if (ap !== bp) return bp - ap;
			return Number(a.dueDate ?? Number.MAX_SAFE_INTEGER) - Number(b.dueDate ?? Number.MAX_SAFE_INTEGER);
		});
	const undatedTasks = opts.tasks.filter((t) => typeof t.dueDate !== 'number');
	section(
		`📋 Tasks due ${opts.windowLabel}`,
		dueTasks.map((t) => `${t.title}${t.dueDate ? ` (${shortDate(t.dueDate)})` : ''}`)
	);
	section(
		'📋 Tasks assigned without due date',
		undatedTasks.map((t) => `${t.title} — no due date`)
	);

	// Cards
	const dueCards = opts.cards
		.filter((c) => typeof c.dueDate === 'number')
		.sort((a, b) => {
			const ap = a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0;
			const bp = b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0;
			if (ap !== bp) return bp - ap;
			return Number(a.dueDate ?? Number.MAX_SAFE_INTEGER) - Number(b.dueDate ?? Number.MAX_SAFE_INTEGER);
		});
	const undatedCards = opts.cards.filter((c) => typeof c.dueDate !== 'number');
	section(
		`🗂️ Cards due ${opts.windowLabel}`,
		dueCards.map((c) => {
			const channelPart = c.channelName ? ` (#${c.channelName})` : '';
			const duePart = c.dueDate ? ` (due ${shortDate(c.dueDate)})` : '';
			return `${c.title}${channelPart}${duePart}`;
		})
	);
	section(
		'🗂️ Cards assigned without due date',
		undatedCards.map((c) => {
			const channelPart = c.channelName ? ` (#${c.channelName})` : '';
			return `${c.title}${channelPart} — no due date`;
		})
	);
	if (opts.mentionsCount && opts.mentionsSummary && opts.mentionsSummary.trim()) {
		lines.push('');
		lines.push('🔔 Mentions');
		lines.push(opts.mentionsSummary.trim());
	}

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

	const wantsSummaryKeyword = /\b(summarize|summary|recap|what\s+happened)\b/i.test(qNoPunct);
	const wantsAllChannels = /\b(all|all\s+channels|all-channels|everything|everyone|workspace)\b/i.test(qNoPunct);
	const mentionsChannelsWord = /\bchannels?\b/i.test(qNoPunct);

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
	const wantsIncidents = /\b(incident|incidents|p0|p1|sev\s*1|sev\s*2|sev1|sev2|outage|on\s*-?call|oncall)\b/i.test(
		qNoPunct
	);

	// Privacy guard: if user asks for someone else's tasks (e.g. "@Anwita's tasks"), do not attempt lookup.
	const seemsLikeOtherPerson = /@\w+/.test(qNoPunct) || /\b(\w+)'s\s+tasks\b/.test(qNoPunct);
	if (wantsTasks && seemsLikeOtherPerson) {
		// Still route to tasks, but the action handler will respond with a privacy-safe message.
		return { mode: 'tasks', channel: null };
	}
	const wantsChannel = Boolean(channelFromText) && wantsSummaryKeyword;
	if (wantsChannel) {
		return { mode: 'channel', channel: channelFromText };
	}

	// "summarize all" / "what happened in all channels" -> workspace overview.
	// If the user explicitly says "channels", produce a channels-only recap.
	if (wantsSummaryKeyword && mentionsChannelsWord && !channelFromText) {
		return { mode: 'channels_overview', channel: null };
	}
	// Otherwise, generic "summarize all" / "workspace" is treated as a personal daily brief / workspace overview.
	if (wantsSummaryKeyword && wantsAllChannels && !channelFromText) {
		return { mode: 'overview', channel: null };
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

	if (wantsIncidents) {
		return { mode: 'incidents', channel: null };
	}

	// "day" / "overview" should produce a personal daily brief, not a message-topic recap.
	const wantsDailyBrief =
		qNoPunct.trim() === 'day' ||
		qNoPunct.trim() === 'overview' ||
		/\b(daily\s+(brief|summary)|day\s+(brief|summary|overview)|my\s+day)\b/i.test(qNoPunct) ||
		/\boverview\b/i.test(qNoPunct);
	if (wantsDailyBrief) {
		return { mode: 'agenda_today', channel: null };
	}

	const wantsOverview = wantsSummaryKeyword && !channelFromText;

	// If the user asks for a summary "for today/tomorrow", treat it as a personal agenda request,
	// not a channel/workspace recap.
	if (wantsOverview && wantsToday) {
		return { mode: 'agenda_today', channel: null };
	}
	if (wantsOverview && wantsTomorrow) {
		return { mode: 'agenda_tomorrow', channel: null };
	}

	if (wantsOverview) {
		// Treat generic "recap" requests as a daily assistant brief.
		return { mode: 'agenda_today', channel: null };
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

type Priority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

function isDefined<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function normalizePriority(input: unknown): Priority | undefined {
	if (typeof input !== 'string') return undefined;
	const p = input.trim().toLowerCase();
	if (p === 'lowest') return 'lowest';
	if (p === 'low') return 'low';
	if (p === 'medium') return 'medium';
	if (p === 'high') return 'high';
	if (p === 'highest') return 'highest';
	return undefined;
}

function bucketByDueDate(opts: { dueDate?: number; explicitPriority?: Priority }) {
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
		const workspaceId = args.workspaceId;
		if (!workspaceId) {
			return {
				answer: 'Workspace context is required.',
				sources: [],
			};
		}

		const recentChatMessages = await (async (): Promise<ChatMessage[]> => {
			try {
				const history = await ctx.runQuery(api.chatbot.getChatHistory, { workspaceId });
				return history.messages.slice(-3);
			} catch {
				return [];
			}
		})();

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
				type WorkspaceChannel = { _id: Id<'channels'>; name: string };
				let channels: WorkspaceChannel[] = [];
				try {
					channels = await ctx.runQuery(api.channels.get, {
						workspaceId,
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
				let best: { channel: WorkspaceChannel; score: number } | null = null;
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

				channelId = best.channel._id;
				resolvedChannelName = String(best.channel.name);
			}
		}

		// ---------------------------------------------------------------------
		// 3. CHANNEL SUMMARY (if requested)
		// ---------------------------------------------------------------------
		if (channelId) {
			let results: { page: Array<{ _creationTime: number; body: string }> };
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
			const messages: Array<{ _creationTime: number; body: string }> = results.page.map((m) => ({
				_creationTime: m._creationTime,
				body: String(m.body),
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

			const chatPrompt = `You are Proddy, a personal work assistant.

Task:
- The user asked to summarize a channel. Use ONLY the provided recent messages as input.
- Produce a work recap grounded in those messages: concrete updates, decisions, owners, deadlines, incidents, and next actions.

Strict rules:
- Do NOT quote any message or copy 5+ consecutive words.
- Do NOT output topic/keyword lists and do NOT mention message counts.
- Do NOT use vague filler like "ongoing coordination" or "open threads likely exist".
- Do NOT use emoji shortcodes like :clipboard: or :clock10: (they will be displayed literally).

Output format (plain text):
Channel Summary — #<channel>
- <bullet point>
- <bullet point>

Rules for bullets:
- Only include information supported by the messages.
- Keep it concise: 5-12 bullets max.
- If something is unknown, omit it.

User request: ${args.query}

Recent messages (most recent last):
${messageContext}`;

			try {
				const answer = await generateLLMResponse({
					prompt: chatPrompt,
					systemPrompt: '',
					recentMessages: recentChatMessages,
				});
				return {
					answer,
					sources: [],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : '';
				const detail = errorMessage.includes('GOOGLE_GENERATIVE_AI_API_KEY is required')
					? 'AI is not configured for this environment.'
					: 'AI summarization is temporarily unavailable.';

				return {
					answer: `${detail} I can't summarize #${resolvedChannelName} right now - please try again later.`,
					sources: resolvedChannelName ? [`#${resolvedChannelName}`] : [],
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
					ctx.runQuery(api.presence.listWorkspacePresence, { workspaceId }),
					ctx.runQuery(api.channels.get, { workspaceId }),
				]);

				const onlineUserIds = new Set(
					(presenceState || [])
						.filter((p) => Boolean(p?.online))
						.map((p) => String(p?.userId))
				);

				const totalMembers = Array.isArray(members) ? members.length : 0;
				const onlineMembers = (members || []).filter((m) => onlineUserIds.has(String(m?.userId)));
				const offlineMembers = (members || []).filter((m) => !onlineUserIds.has(String(m?.userId)));

				const formatMember = (m: { user?: { name?: string } }) =>
					`@${String(m?.user?.name ?? 'Unknown').trim()}`;

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
						const summary = await generateLLMResponse({
							prompt,
							systemPrompt: '',
							recentMessages: recentChatMessages,
						});
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
				intent.mode === 'incidents' ||
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
						return [];
					}
					const cards = await ctx.runQuery(api.board.getAssignedCards, {
						workspaceId,
						memberId: currentMember._id,
					});
					return cards.map((c) => ({
						title: String(c.title ?? ''),
						dueDate: typeof c.dueDate === 'number' ? c.dueDate : undefined,
						priority: normalizePriority(c.priority),
						channelName: typeof c.channelName === 'string' ? c.channelName : undefined,
					}));
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

				if (intent.mode === 'incidents') {
					// Ensure membership.
					await ctx.runQuery(api.members.current, { workspaceId });

					let channels: Array<{ _id: Id<'channels'>; name: string }> = [];
					try {
						channels = await ctx.runQuery(api.channels.get, { workspaceId });
					} catch {
						channels = [];
					}

					const candidates = (channels || [])
						.map((c) => String(c?.name ?? '').trim())
						.filter(Boolean)
						.filter((name) => /\b(incident|incidents|oncall|ops|status|alerts)\b/i.test(name))
						.slice(0, 6)
						.map((name) => `#${name}`);

					const lines: string[] = [];
					lines.push('Incident Status');
					
					if (candidates.length) {
						lines.push(`- Check incident channels: ${candidates.join(', ')}`);
					} else {
						lines.push('- Check your incident/oncall/status channels for the latest updates');
					}
					lines.push('- Identify owner, impact, current mitigation, and next update time');

					return {
						answer: lines.join('\n'),
						sources: candidates.length ? ['Channels'] : [],
					};
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
					const [events, tasksDueToday, upcomingTasks, assignedCards, mentioned] = await Promise.all([
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
						ctx.runQuery(api.chatbot.getMyUpcomingTasks, {
							workspaceId,
							limit: 25,
						}),
						getAssignedCardsForUser(),
						ctx.runQuery(api.messages.getMentionedMessages, {
							workspaceId,
							limit: 80,
						}),
					]);

					const undatedTasks = (upcomingTasks || [])
						.filter((t) => typeof t?.dueDate !== 'number')
						.slice(0, 10)
						.map((t) => ({
							title: String(t?.title ?? ''),
							dueDate: undefined,
							priority: t?.priority ?? undefined,
						}));
					const tasks = [...(tasksDueToday || []), ...undatedTasks].filter((t) => String(t?.title ?? '').trim());

					const cardsDueToday = (assignedCards || []).filter((c) => typeof c?.dueDate === 'number' && c.dueDate >= todayFrom && c.dueDate <= todayTo);
					const cardsUndated = (assignedCards || []).filter((c) => typeof c?.dueDate !== 'number').slice(0, 10);
					const cards = [...cardsDueToday, ...cardsUndated].filter((c) => String(c?.title ?? '').trim());

					// Match example style: a compact day-ahead digest (still user-scoped).
					const todaysMentions = (mentioned || []).filter((m) => {
						const created = typeof m?._creationTime === 'number' ? m._creationTime : 0;
						return created >= todayFrom && created <= todayTo;
					});
					const createdTodayMentionsCount = todaysMentions.length;
					const mentionsSummary = todaysMentions
						.slice(0, 6)
						.map((m) => {
							const who = String(m?.user?.name ?? 'Someone').trim();
							const ctxName = String(m?.context?.name ?? 'Mention').trim();
							return `- @${who} in ${ctxName}`;
						})
						.join('\n');

					return {
						answer: renderAgendaDigest({
							now,
							label: 'your day',
							windowLabel: 'today',
							events,
							tasks,
							cards,
							mentionsCount: createdTodayMentionsCount,
							mentionsSummary: mentionsSummary || undefined,
						}),
						sources: ['Calendar', 'Tasks', 'Boards'],
						actions: [calendarActionForWorkspace(workspaceId)],
					};
				}

				if (intent.mode === 'agenda_tomorrow') {
					const [events, tasksDueTomorrow, upcomingTasks, assignedCards, mentioned] = await Promise.all([
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
						ctx.runQuery(api.chatbot.getMyUpcomingTasks, {
							workspaceId,
							limit: 25,
						}),
						getAssignedCardsForUser(),
						ctx.runQuery(api.messages.getMentionedMessages, {
							workspaceId,
							limit: 120,
						}),
					]);

					const undatedTasks = (upcomingTasks || [])
						.filter((t) => typeof t?.dueDate !== 'number')
						.slice(0, 10)
						.map((t) => ({
							title: String(t?.title ?? ''),
							dueDate: undefined,
							priority: t?.priority ?? undefined,
						}));
					const tasks = [...(tasksDueTomorrow || []), ...undatedTasks].filter((t) => String(t?.title ?? '').trim());

					const cardsDueTomorrow = (assignedCards || []).filter((c) => typeof c?.dueDate === 'number' && c.dueDate >= tomorrowFrom && c.dueDate <= tomorrowTo);
					const cardsUndated = (assignedCards || []).filter((c) => typeof c?.dueDate !== 'number').slice(0, 10);
					const cards = [...cardsDueTomorrow, ...cardsUndated].filter((c) => String(c?.title ?? '').trim());

					const tomorrowKey = shortDate(tomorrowFrom);
					const mentionCandidates = (mentioned || [])
						.filter((m) => {
							const created = typeof m?._creationTime === 'number' ? m._creationTime : 0;
							return created >= todayFrom;
						})
						.slice(0, 40)
						.map((m) => {
							const who = String(m?.user?.name ?? 'Someone').trim();
							const ctxName = String(m?.context?.name ?? 'Mention');
							const created = typeof m?._creationTime === 'number' ? m._creationTime : 0;
							const body = String(m?.body ?? '');
							return { who, ctxName, created, body };
						});

					const matches = mentionCandidates.filter((m) =>
						isLikelyTomorrowReferenceFallback(m.body, tomorrowKey)
					);
					let tomorrowMentionsCount = matches.length;
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

Output format:
- <summary>
- <summary>
- <summary>

If there are no relevant mentions, output EXACTLY:
No items

Mentions:\n${mentionContext}`;

							mentionsSummary = await generateLLMResponse({
								prompt,
								systemPrompt: '',
								recentMessages: recentChatMessages,
							});
						} catch {
								// Gemini isn't available: avoid topic/keyword heuristics; use a safe structured fallback.
								if (matches.length) {
									mentionsSummary = matches
										.slice(0, 6)
										.map((m) => `- @${m.who} in ${m.ctxName}`)
										.join('\n');
								}
						}
					}

					return {
						answer: renderAgendaDigest({
							now,
							label: 'tomorrow',
							windowLabel: 'tomorrow',
							events,
							tasks,
							cards,
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
		if (intent.mode === 'channels_overview') {
			const authUserId = await getAuthUserId(ctx);
			if (!authUserId) {
				return { answer: 'Sign in to use the assistant.', sources: [] };
			}
			const workspaceId = args.workspaceId as Id<'workspaces'>;
			await ctx.runQuery(api.members.current, { workspaceId });

			const now = new Date();
			const todayFrom = startOfDayMs(now);
			const todayTo = endOfDayMs(now);

			const recent = await ctx.runQuery(api.messages.getRecentWorkspaceChannelMessages, {
				workspaceId,
				from: todayFrom,
				to: todayTo,
				limit: 350,
				perChannelLimit: 4,
			});

			if (!recent?.length) {
				return {
					answer: 'No channel updates found today.',
					sources: ['Messages'],
				};
			}

			type Rec = { channelName: string; authorName: string; body: string; creationTime: number };
			const byChannel = new Map<string, Rec[]>();
			for (const r of recent as unknown as Rec[]) {
				const name = String(r?.channelName ?? '').trim();
				if (!name) continue;
				const list = byChannel.get(name) ?? [];
				list.push({
					channelName: name,
					authorName: String(r?.authorName ?? '').trim(),
					body: String(r?.body ?? ''),
					creationTime: typeof r?.creationTime === 'number' ? r.creationTime : 0,
				});
				byChannel.set(name, list);
			}

			const activeChannels = Array.from(byChannel.entries())
				.map(([channelName, msgs]) => ({
					channelName,
					count: msgs.length,
					last: Math.max(...msgs.map((m) => m.creationTime || 0)),
				}))
				.sort((a, b) => (b.last - a.last) || (b.count - a.count))
				.slice(0, 12);

			const channelBlocks = activeChannels
				.map(({ channelName }) => {
					const msgs = (byChannel.get(channelName) ?? [])
						.sort((a, b) => a.creationTime - b.creationTime)
						.slice(-4);
					const snippets = msgs
						.map((m) => {
							const who = m.authorName ? `@${m.authorName}: ` : '';
							return `- ${who}${truncateOneLine(m.body, 200)}`;
						})
						.join('\n');
					return `#${channelName}\n${snippets}`;
				})
				.join('\n\n');

			const prompt = `You are Proddy, a personal work assistant.

Task:
- The user asked: "summarize all channels".
- Produce a short recap per channel, using ONLY the provided snippets.

Strict rules:
- Do NOT quote any snippet or copy 5+ consecutive words.
- Do NOT output topic/keyword lists and do NOT mention message counts.
- Do NOT invent details.
- Keep it short.

Output format (plain text):
#<channel>
- <1 short bullet>
- <optional 2nd bullet>

Only include channels provided.

Channel snippets (today):
${channelBlocks}`;

			try {
				const answer = await generateLLMResponse({
					prompt,
					systemPrompt: '',
					recentMessages: recentChatMessages,
				});
				return {
					answer,
					sources: ['Messages'],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : '';
				const detail = errorMessage.includes('GOOGLE_GENERATIVE_AI_API_KEY is required')
					? 'AI is not configured for channel summaries.'
					: 'AI channel summary is temporarily unavailable.';

				const fallback = activeChannels
					.map(({ channelName }) => `#${channelName}\n- Recent activity posted (summary unavailable)`)
					.join('\n\n');

				return {
					answer: `${detail}\n\n${fallback}`,
					sources: ['Messages'],
				};
			}
		}

		if (intent.mode === 'overview') {
			// Workspace "summarize all": today's agenda + a short recap across recent channel messages.
			const authUserId = await getAuthUserId(ctx);
			if (!authUserId) {
				return { answer: 'Sign in to use the assistant.', sources: [] };
			}
			const now = new Date();
			const todayFrom = startOfDayMs(now);
			const todayTo = endOfDayMs(now);
			const workspaceId = args.workspaceId as Id<'workspaces'>;
			await ctx.runQuery(api.members.current, { workspaceId });

			const currentMember = await ctx.runQuery(api.members.current, { workspaceId });
			const memberId = currentMember?._id;

			const [events, tasksDueToday, upcomingTasks, assignedCards, mentioned] = await Promise.all([
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
				ctx.runQuery(api.chatbot.getMyUpcomingTasks, {
					workspaceId,
					limit: 25,
				}),
				memberId
					? ctx.runQuery(api.board.getAssignedCards, {
						workspaceId,
						memberId,
					})
					: Promise.resolve([]),
				ctx.runQuery(api.messages.getMentionedMessages, {
					workspaceId,
					limit: 40,
				}),
			]);

			const undatedTasks = (upcomingTasks || [])
				.filter((t) => typeof t?.dueDate !== 'number')
				.slice(0, 10)
				.map((t) => ({
					title: String(t?.title ?? ''),
					dueDate: undefined,
					priority: t?.priority ?? undefined,
				}));
			const tasks = [...(tasksDueToday || []), ...undatedTasks].filter((t) => String(t?.title ?? '').trim());

			type AssignedCardShape = {
				title?: unknown;
				dueDate?: unknown;
				priority?: unknown;
				channelName?: unknown;
			};
			const mappedCards = (assignedCards || []).map((c: AssignedCardShape) => ({
				title: String(c?.title ?? ''),
				dueDate: typeof c?.dueDate === 'number' ? (c.dueDate as number) : undefined,
				priority: normalizePriority(c?.priority),
				channelName: typeof c?.channelName === 'string' ? (c.channelName as string) : undefined,
			}));
			const cardsDueToday = mappedCards.filter((c) => typeof c?.dueDate === 'number' && c.dueDate! >= todayFrom && c.dueDate! <= todayTo);
			const cardsUndated = mappedCards.filter((c) => typeof c?.dueDate !== 'number').slice(0, 10);
			const cards = [...cardsDueToday, ...cardsUndated].filter((c) => String(c?.title ?? '').trim());

			const todaysMentions = (mentioned || []).filter((m) => {
				const created = typeof m?._creationTime === 'number' ? m._creationTime : 0;
				return created >= todayFrom && created <= todayTo;
			});
			const mentionsSummary = todaysMentions
				.slice(0, 6)
				.map((m) => {
					const who = String(m?.user?.name ?? 'Someone').trim();
					const ctxName = String(m?.context?.name ?? 'Mention').trim();
					return `- @${who} in ${ctxName}`;
				})
				.join('\n');

			let channelRecap: string | null = null;
			try {
				const recent = await ctx.runQuery(api.messages.getRecentWorkspaceChannelMessages, {
					workspaceId,
					from: todayFrom,
					to: todayTo,
					limit: 250,
					perChannelLimit: 3,
				});

				const lines = (recent || [])
					.map((m) => {
						const channelName = String(m?.channelName ?? 'unknown').trim();
						const who = String(m?.authorName ?? '').trim();
						const body = truncateOneLine(String(m?.body ?? ''), 180);
						const prefix = `#${channelName}${who ? ` @${who}` : ''}: `;
						return `${prefix}${body}`.trim();
					})
					.filter(Boolean)
					.slice(-30);

				if (lines.length) {
					const prompt = `You are Proddy, a personal work assistant.

Task:
- Summarize what happened across the workspace today using ONLY the provided recent channel snippets.

Strict rules:
- Do NOT quote any snippet or copy 5+ consecutive words.
- Do NOT output topic/keyword lists and do NOT mention message counts.
- Do NOT invent details. If it isn't supported by the snippets, omit it.
- Output plain bullet points only (no priority buckets).

Output format:
Workspace Updates (Today)
- <bullet>
- <bullet>

Keep it concise: 5-12 bullets max.

Recent channel snippets:
${lines.map((l) => `- ${l}`).join('\n')}`;

					channelRecap = await generateLLMResponse({
						prompt,
						systemPrompt: '',
						recentMessages: recentChatMessages,
					});
				}
			} catch (e) {
				// Keep the agenda response even if the model fails.
				const errorMessage = e instanceof Error ? e.message : '';
				channelRecap = errorMessage.includes('GOOGLE_GENERATIVE_AI_API_KEY is required')
					? 'AI is not configured for workspace summaries.'
					: 'AI workspace summary is temporarily unavailable.';
			}

			const agenda = renderAgendaDigest({
				now,
				label: 'today',
				windowLabel: 'today',
				events,
				tasks,
				cards,
				mentionsCount: todaysMentions.length,
				mentionsSummary: mentionsSummary || undefined,
			});

			const answer = [
				agenda.trim(),
				channelRecap ? `\n\n${channelRecap.trim()}` : '',
			]
				.join('')
				.trim();

			return {
				answer,
				sources: ['Calendar', 'Tasks', 'Boards', 'Messages'],
			};
		}

		// ---------------------------------------------------------------------
		// 4. FALLBACK → KNOWLEDGE BASE (RAG)
		// ---------------------------------------------------------------------
		// Note: We intentionally avoid mining/summarizing raw chat messages here.

		const ragResults: Array<{ text: string }> = await ctx.runAction(
			api.search.semanticSearch,
			{
				workspaceId: args.workspaceId!,
				query: args.query,
				limit: 3,
			}
		);

		const ragContext = ragResults
			.map((c, i) => `[Doc ${i + 1}] ${c.text ?? ''}`)
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

		const mixedPrompt = `Answer as a personal work assistant using ONLY the provided context.

Rules:
- Never quote or paste any context verbatim.
- Do not include any continuous 5+ words copied from the context.
- Do NOT output topic/keyword lists or message counts.
- Prefer short headings and bullet points.

Question: ${args.query}

Context:\n${combinedContext}`;

		try {
			const answer = await generateLLMResponse({
				prompt: mixedPrompt,
				systemPrompt: '',
				recentMessages: recentChatMessages,
			});
			const sources = [...(ragResults.length ? ['Knowledge Base'] : [])];
			return { answer, sources };
		} catch {
			// Best-effort assistant response without quoting docs.
			const lines: string[] = [];

			lines.push('• [Unable to generate detailed answer at this time]');
			return {
				answer: lines.join('\n'),
				sources: [],
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
					title: String(card.title ?? mention.cardTitle ?? 'Untitled card'),
					dueDate: card.dueDate,
					priority: normalizePriority(card.priority),
					boardName: channelName ? `#${channelName}` : 'Board',
				};
			})
			.filter(isDefined);

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
