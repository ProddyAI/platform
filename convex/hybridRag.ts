/**
 * hybridRag.ts — Unified Context Layer & Hybrid Ranking Pipeline
 *
 * Architecture overview:
 *
 *   ragchat.semanticSearch (vector, top rawLimit)
 *       ↓
 *   fetchTaskMetadataBatch   (DB: full task docs by ID)
 *   fetchCardMetadataBatch   (DB: full card docs by ID)
 *   fetchBlockerCardIds      (DB: cards.blockedBy — find cards that block others)
 *   fetchBlockerIssueIds     (DB: issueBlocking — find blocking issues)
 *       ↓
 *   computeHybridScore       (pure: cosine × urgency × recency multipliers)
 *       ↓
 *   sort ↓, take K
 *       ↓
 *   sanitizeContextWindow    (pure: dedup + injection strip + token budget)
 *       ↓
 *   LLM-ready context string → proddyAgent
 *
 * Key design choices:
 *  - No vector DB changes: operates entirely as a post-processing step.
 *  - Blocker boost targets the BLOCKING card (root-cause bottleneck), not victims.
 *  - Top-K is configurable per call (default 10) for complex project overviews.
 *  - Runs alongside aiSearch.ts; does not replace the calendar/schedule path yet.
 */

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalQuery } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// Types — aligned with @convex-dev/rag SearchEntry shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised RAG entry — derived from the SDK's SearchResult + SearchEntry pair.
 * `key` is the contentId we stored when indexing (i.e. the Convex document _id).
 * `score` is the cosine similarity [0, 1] from the vector index.
 */
type RawRagEntry = {
	key: string;    // contentId (Convex document _id string)
	score: number;  // cosine similarity [0, 1]
	text: string;   // full text snippet from the entry
};

/** A RAG result enriched with live DB metadata and a hybrid score */
type EnrichedEntry = {
	key: string;
	rawScore: number;
	hybridScore: number; // final weighted score, capped at 1.0
	text: string;
	contentType: "task" | "message" | "note" | "card" | "event" | "unknown";
	metadata: {
		title?: string;
		status?: string;
		dueDate?: number;
		priority?: string;
		completed?: boolean;
		isBlocker?: boolean;
		isOverdue?: boolean;
		creationTime?: number;
	};
};

// ─────────────────────────────────────────────────────────────────────────────
// Scoring weights — tune these to change retrieval behaviour
// ─────────────────────────────────────────────────────────────────────────────

const WEIGHTS = {
	HIGH_PRIORITY: 1.3,
	OVERDUE: 1.4,
	IN_PROGRESS: 1.2,
	BLOCKER: 1.35, // card/issue actively blocking others
	RECENT_7D: 1.1, // created within last 7 days
	COMPLETED: 0.6,
	ON_HOLD: 0.85,
	CANCELLED: 0.6,
} as const;

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Internal Queries (DB access — ctx.db cannot be used inside actions)
// ─────────────────────────────────────────────────────────────────────────────

/** Batch-fetch full task documents by their Convex IDs. */
export const fetchTaskMetadataBatch = internalQuery({
	args: {
		taskIds: v.array(v.id("tasks")),
	},
	handler: async (ctx, args) => {
		const results: Array<{ id: Id<"tasks">; doc: Doc<"tasks"> | null }> = [];
		for (const id of args.taskIds) {
			const doc = await ctx.db.get(id);
			results.push({ id, doc });
		}
		return results;
	},
});

/** Batch-fetch full card documents by their Convex IDs. */
export const fetchCardMetadataBatch = internalQuery({
	args: {
		cardIds: v.array(v.id("cards")),
	},
	handler: async (ctx, args) => {
		const results: Array<{ id: Id<"cards">; doc: Doc<"cards"> | null }> = [];
		for (const id of args.cardIds) {
			const doc = await ctx.db.get(id);
			results.push({ id, doc });
		}
		return results;
	},
});

/**
 * Find which candidate card IDs are blocking at least one other card.
 *
 * A card is a **blocker** when its _id appears inside another card's `blockedBy`
 * array. We scan all cards in the workspace that have a non-empty `blockedBy`,
 * then intersect with the candidate set.
 *
 * The candidate set is small (≤ rawLimit, typically 20), so this is safe.
 */
export const fetchBlockerCardIds = internalQuery({
	args: {
		// We receive string IDs because actions cannot pass typed Id<> to queries
		// across the serialisation boundary without a v.id() validator here.
		candidateCardIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<string[]> => {
		if (args.candidateCardIds.length === 0) return [];

		// Collect all card IDs that appear in *other* cards' blockedBy arrays.
		// We paginate with take(500) to stay within Convex transaction limits.
		const cardsWithBlockers = await ctx.db
			.query("cards")
			.take(500);

		const blockerSet = new Set<string>();
		for (const card of cardsWithBlockers) {
			if (card.blockedBy && card.blockedBy.length > 0) {
				for (const blockerId of card.blockedBy) {
					blockerSet.add(blockerId as string);
				}
			}
		}

		return args.candidateCardIds.filter((id) => blockerSet.has(id));
	},
});

/**
 * Find which candidate issue IDs are acting as blocking issues (root causes).
 * Uses the `issueBlocking` table: a row means blockingIssueId → blockedIssueId.
 */
export const fetchBlockerIssueIds = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		candidateIssueIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<string[]> => {
		if (args.candidateIssueIds.length === 0) return [];

		const blockerIds: string[] = [];
		for (const issueIdStr of args.candidateIssueIds) {
			const issueId = issueIdStr as Id<"issues">;
			const row = await ctx.db
				.query("issueBlocking")
				.withIndex("by_blocking_issue_id", (q) =>
					q.eq("blockingIssueId", issueId)
				)
				.first();
			if (row) {
				blockerIds.push(issueIdStr);
			}
		}
		return blockerIds;
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// Pure Scoring Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies weighted multipliers to the raw cosine similarity score.
 * Multipliers are multiplicative (not additive) to preserve relative ordering.
 * Result is capped at 1.0.
 */
function computeHybridScore(
	rawScore: number,
	meta: {
		status?: string | null;
		dueDate?: number | null;
		priority?: string | null;
		completed?: boolean;
		isBlocker?: boolean;
		creationTime?: number;
	},
	now: number
): number {
	let score = rawScore;

	// Blocker signal — surface root-cause bottlenecks
	if (meta.isBlocker) {
		score *= WEIGHTS.BLOCKER;
	}

	// Urgency: overdue and not yet complete
	const isOverdue =
		meta.dueDate != null && meta.dueDate < now && meta.completed !== true;
	if (isOverdue) {
		score *= WEIGHTS.OVERDUE;
	}

	// Priority
	if (meta.priority === "high" || meta.priority === "urgent") {
		score *= WEIGHTS.HIGH_PRIORITY;
	}

	// Workflow status
	if (meta.status === "in_progress") {
		score *= WEIGHTS.IN_PROGRESS;
	} else if (meta.status === "on_hold") {
		score *= WEIGHTS.ON_HOLD;
	} else if (meta.status === "completed") {
		score *= WEIGHTS.COMPLETED;
	} else if (meta.status === "cancelled") {
		score *= WEIGHTS.CANCELLED;
	}

	// Recency bonus — content from the past 7 days is fresher
	if (meta.creationTime != null && now - meta.creationTime < MS_7_DAYS) {
		score *= WEIGHTS.RECENT_7D;
	}

	return Math.min(score, 1.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Sanitizer
// ─────────────────────────────────────────────────────────────────────────────

/** Common adversarial prompt-injection patterns */
const INJECTION_PATTERNS: RegExp[] = [
	/ignore (all )?previous instructions?/i,
	/\bSYSTEM:/,
	/\[SYS\]:/,
	/<\|im_start\|>/,
	/<\|im_end\|>/,
	/\n---\n/,
	/forget (everything|all)/i,
	/pretend (you are|to be)/i,
	/override (your|the) (instructions?|system)/i,
	/you are now\b/i,
	/act as\b.{0,60}\bAI\b/i,
];

/** Naive unigram token set for Jaccard near-duplicate detection */
function tokenSet(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, " ")
			.split(/\s+/)
			.filter((t) => t.length > 2)
	);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	let intersection = 0;
	for (const token of a) {
		if (b.has(token)) intersection++;
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * sanitizeContextWindow
 *
 * Converts a ranked list of enriched entries into a clean, LLM-ready Markdown
 * context string. Applies prompt injection filtering, near-duplicate collapse,
 * per-snippet truncation, and a total token-budget cap.
 */
function sanitizeContextWindow(
	entries: EnrichedEntry[],
	opts: {
		maxSnippetChars?: number;
		maxTotalChars?: number;
	} = {}
): string {
	const maxSnippet = opts.maxSnippetChars ?? 300;
	const maxTotal = opts.maxTotalChars ?? 24_000; // ≈6k tokens at 4 chars/token

	// 1. Prompt injection filter
	const clean = entries.filter((e) => {
		const flagged = INJECTION_PATTERNS.some((re) => re.test(e.text));
		if (flagged) {
			console.warn(
				`[hybridRag:sanitize] Stripped injection payload in key=${e.key}`
			);
		}
		return !flagged;
	});

	// 2. Near-duplicate collapse (Jaccard > 0.80 → keep higher-scored entry)
	const deduped: EnrichedEntry[] = [];
	const seenSets: Set<string>[] = [];

	for (const entry of clean) {
		const ts = tokenSet(entry.text);
		const isDup = seenSets.some((prev) => jaccardSimilarity(prev, ts) > 0.8);
		if (!isDup) {
			deduped.push(entry);
			seenSets.push(ts);
		}
	}

	// 3. Per-snippet truncation + total budget
	const groups: Record<string, EnrichedEntry[]> = {};
	let budget = maxTotal;

	for (const entry of deduped) {
		if (budget <= 0) break;

		const snippet =
			entry.text.length > maxSnippet
				? `${entry.text.slice(0, maxSnippet).trimEnd()}…`
				: entry.text;

		const cost = snippet.length + 100; // ~100 chars overhead for metadata line
		if (cost > budget) break;
		budget -= cost;

		const ct = entry.contentType;
		if (!groups[ct]) groups[ct] = [];
		groups[ct].push({ ...entry, text: snippet });
	}

	// 4. Render grouped, structured Markdown
	const ORDER: EnrichedEntry["contentType"][] = [
		"task",
		"card",
		"note",
		"message",
		"event",
		"unknown",
	];

	const LABELS: Record<string, string> = {
		task: "## Tasks",
		card: "## Board Cards",
		note: "## Notes",
		message: "## Messages",
		event: "## Calendar Events",
		unknown: "## Other",
	};

	const sections: string[] = [];

	for (const type of ORDER) {
		const items = groups[type];
		if (!items || items.length === 0) continue;

		const rows = items.map((e) => {
			const m = e.metadata;
			const flags: string[] = [];
			if (m.isBlocker) flags.push("🔴 BLOCKER");
			if (m.isOverdue) flags.push("⚠️ OVERDUE");
			if (m.status) flags.push(`status:${m.status}`);
			if (m.priority) flags.push(`priority:${m.priority}`);
			if (m.dueDate) {
				flags.push(`due:${new Date(m.dueDate).toISOString().slice(0, 10)}`);
			}
			const flagStr = flags.length ? ` [${flags.join(" | ")}]` : "";
			const title = m.title ? `**${m.title}**${flagStr}\n  ` : "";
			const rel = `(relevance: ${(e.hybridScore * 100).toFixed(0)}%)`;
			return `- ${title}${e.text} ${rel}`;
		});

		sections.push(`${LABELS[type] ?? `## ${type}`}\n${rows.join("\n")}`);
	}

	return sections.length > 0
		? sections.join("\n\n")
		: "(No relevant workspace context found.)";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Orchestrator Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * hybridSearch
 *
 * Entry point for the Unified Context Layer. Call from chatbot.ts or any action
 * to get a ranked, sanitized, token-efficient context string.
 *
 * Example (in chatbot.ts):
 *
 *   const { contextString, stats } = await ctx.runAction(api.hybridRag.hybridSearch, {
 *     workspaceId,
 *     userId,
 *     query: userMessage,
 *     topK: 15,          // optional; 10 for standard queries, 20-30 for project overviews
 *   });
 *   // Inject contextString directly into the system prompt before proddyAgent.
 */
export const hybridSearch = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.optional(v.id("users")),
		query: v.string(),
		/** How many re-ranked results to return (default 10). */
		topK: v.optional(v.number()),
		/** How many raw vector hits to retrieve before re-ranking (default max(topK*2, 20)). */
		rawLimit: v.optional(v.number()),
		/** Max characters per snippet in the output context (default 300). */
		maxSnippetChars: v.optional(v.number()),
		/** Total character budget for the whole context window (default 24000 ≈ 6k tokens). */
		maxTotalChars: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args
	): Promise<{
		contextString: string;
		entries: EnrichedEntry[];
		stats: {
			rawCount: number;
			enrichedCount: number;
			returnedCount: number;
			topK: number;
		};
	}> => {
		const topK = args.topK ?? 10;
		const rawLimit = args.rawLimit ?? Math.max(topK * 2, 20);
		const now = Date.now();

		// ── 1. Vector search ─────────────────────────────────────────────────
		let ragResult: {
			results: Array<{
				entryId: string;
				score: number;
				content: Array<{ text: string; metadata?: Record<string, unknown> }>;
			}>;
			text: string;
			entries: Array<{ key?: string; text?: string; entryId: string }>;
		};

		try {
			ragResult = (await ctx.runAction(api.ragchat.semanticSearch, {
				workspaceId: args.workspaceId,
				userId: args.userId,
				query: args.query,
				limit: rawLimit,
			})) as typeof ragResult;
		} catch (err) {
			console.error("[hybridRag] semanticSearch failed:", err);
			return {
				contextString: "(Hybrid search unavailable — vector index not ready.)",
				entries: [],
				stats: { rawCount: 0, enrichedCount: 0, returnedCount: 0, topK },
			};
		}

		// Normalise to RawRagEntry[] — prefer `entries` (has key + text) over `results`
		const rawEntries: RawRagEntry[] = [];

		if (ragResult.entries && ragResult.entries.length > 0) {
			// `entries` from rag.search: { key?, text, entryId, ... }
			// We pair them with scores from `results` via entryId
			const scoreMap = new Map<string, number>();
			for (const r of ragResult.results ?? []) {
				scoreMap.set(r.entryId, r.score);
			}
			for (const e of ragResult.entries) {
				const key = e.key ?? e.entryId;
				const text = e.text ?? "";
				const score = scoreMap.get(e.entryId) ?? 0.5;
				if (text.trim()) {
					rawEntries.push({ key, score, text });
				}
			}
		} else if (ragResult.results && ragResult.results.length > 0) {
			// Fallback: use results directly (content[0].text as snippet)
			for (const r of ragResult.results) {
				const text = r.content?.[0]?.text ?? "";
				if (text.trim()) {
					rawEntries.push({ key: r.entryId, score: r.score, text });
				}
			}
		}

		if (rawEntries.length === 0) {
			return {
				contextString: "(No relevant workspace content found.)",
				entries: [],
				stats: { rawCount: 0, enrichedCount: 0, returnedCount: 0, topK },
			};
		}

		// ── 2. Batch-fetch DB metadata for all candidate keys ─────────────────
		// Keys are Convex document _id strings; we try all types and see which fetch succeeds.
		const candidateIds = rawEntries.map((e) => e.key);

		const [taskBatch, cardBatch, blockerCardIds, blockerIssueIds] =
			await Promise.all([
				ctx.runQuery(internal.hybridRag.fetchTaskMetadataBatch, {
					taskIds: candidateIds as Id<"tasks">[],
				}) as Promise<Array<{ id: Id<"tasks">; doc: Doc<"tasks"> | null }>>,

				ctx.runQuery(internal.hybridRag.fetchCardMetadataBatch, {
					cardIds: candidateIds as Id<"cards">[],
				}) as Promise<Array<{ id: Id<"cards">; doc: Doc<"cards"> | null }>>,

				ctx.runQuery(internal.hybridRag.fetchBlockerCardIds, {
					candidateCardIds: candidateIds,
				}) as Promise<string[]>,

				ctx.runQuery(internal.hybridRag.fetchBlockerIssueIds, {
					workspaceId: args.workspaceId,
					candidateIssueIds: candidateIds,
				}) as Promise<string[]>,
			]);

		// Build lookup maps
		const taskMap = new Map<string, Doc<"tasks">>();
		for (const { id, doc } of taskBatch) {
			if (doc) taskMap.set(id as string, doc);
		}

		const cardMap = new Map<string, Doc<"cards">>();
		for (const { id, doc } of cardBatch) {
			if (doc) cardMap.set(id as string, doc);
		}

		const blockerCardSet = new Set(blockerCardIds);
		const blockerIssueSet = new Set(blockerIssueIds);

		// ── 3. Enrich & compute hybrid scores ─────────────────────────────────
		const enriched: EnrichedEntry[] = rawEntries.map((entry) => {
			const key = entry.key;
			let contentType: EnrichedEntry["contentType"] = "unknown";
			let meta: EnrichedEntry["metadata"] = {};

			if (taskMap.has(key)) {
				const task = taskMap.get(key)!;
				const isOverdue =
					task.dueDate != null && task.dueDate < now && !task.completed;
				contentType = "task";
				meta = {
					title: task.title,
					status: task.status ?? undefined,
					dueDate: task.dueDate,
					priority: task.priority,
					completed: task.completed,
					isOverdue,
					// Tasks have no explicit blocking table; use high-priority in-progress
					// as a proxy for an implicit blocker signal
					isBlocker: task.priority === "high" && task.status === "in_progress",
					creationTime: task._creationTime,
				};
			} else if (cardMap.has(key)) {
				const card = cardMap.get(key)!;
				const isOverdue =
					card.dueDate != null && card.dueDate < now && !card.isCompleted;
				contentType = "card";
				meta = {
					title: card.title,
					dueDate: card.dueDate,
					priority: card.priority,
					isOverdue,
					isBlocker: blockerCardSet.has(key), // true if other cards cite this as a blocker
					creationTime: card._creationTime,
				};
			} else if (blockerIssueSet.has(key)) {
				contentType = "unknown";
				meta = { isBlocker: true };
			}
			// Messages, notes, events: no metadata enrichment → raw score stands

			const hybridScore = computeHybridScore(
				entry.score,
				{
					status: meta.status ?? null,
					dueDate: meta.dueDate ?? null,
					priority: meta.priority ?? null,
					completed: meta.completed,
					isBlocker: meta.isBlocker,
					creationTime: meta.creationTime,
				},
				now
			);

			return {
				key,
				rawScore: entry.score,
				hybridScore,
				text: entry.text,
				contentType,
				metadata: {
					...meta,
					isOverdue: meta.isOverdue ?? false,
				},
			};
		});

		// ── 4. Sort by hybrid score, take top K ───────────────────────────────
		const sorted = enriched
			.filter((e) => e.text.trim().length > 0)
			.sort((a, b) => b.hybridScore - a.hybridScore)
			.slice(0, topK);

		// ── 5. Sanitize and format context string ─────────────────────────────
		const contextString = sanitizeContextWindow(sorted, {
			maxSnippetChars: args.maxSnippetChars,
			maxTotalChars: args.maxTotalChars,
		});

		return {
			contextString,
			entries: sorted,
			stats: {
				rawCount: rawEntries.length,
				enrichedCount: enriched.length,
				returnedCount: sorted.length,
				topK,
			},
		};
	},
});
