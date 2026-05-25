"use node";

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

type AnalyzeInputIssue = {
	issueId: Id<"issues">;
	title: string;
	description?: string;
	statusName?: string;
};

export type DependencySuggestion = {
	blockerId: Id<"issues">;
	blockedId: Id<"issues">;
	reasoning: string;
	resolutionSteps: string[];
};

const DONE_STATUS_KEYWORDS = new Set([
	"done",
	"completed",
	"complete",
	"closed",
	"resolved",
]);

const normalize = (s: string) =>
	s
		.toLowerCase()
		.replace(/[`"'()[\]{}]/g, " ")
		.replace(/[^a-z0-9#\s-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const STOPWORDS = new Set([
	"with",
	"from",
	"this",
	"that",
	"then",
	"than",
	"into",
	"onto",
	"your",
	"have",
	"need",
	"needs",
	"must",
	"should",
	"will",
	"make",
	"made",
	"when",
	"what",
	"where",
	"which",
	"while",
	"after",
	"before",
	"task",
	"issue",
	"card",
	"board",
	"project",
	"work",
	"feat",
	"feature",
	"implement",
	"update",
	"fix",
	"create",
	"build",
]);

const tokenize = (s: string) =>
	normalize(s)
		.split(" ")
		.filter((t) => t.length >= 4 && !STOPWORDS.has(t));

const isDone = (statusName?: string) => {
	if (!statusName) return false;
	return DONE_STATUS_KEYWORDS.has(statusName.trim().toLowerCase());
};

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Match normalized titles as whole phrases, not arbitrary substrings. */
const containsNormalizedTitleAtWordBoundary = (
	haystack: string,
	normTitle: string,
	minLength: number
): boolean => {
	if (normTitle.length < minLength) return false;
	const pattern = `(^|\\s)${escapeRegExp(normTitle)}(\\s|$)`;
	return new RegExp(pattern).test(haystack);
};

/** Split dependency phrase captures on conjunctions and punctuation. */
const segmentDependencyCapture = (raw: string): string[] =>
	normalize(raw)
		.split(/\s+(?:and|or|then)\s+|[,;|]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

const mapSegmentsToIssueIds = (
	segments: string[],
	titleToId: Map<string, Id<"issues">>,
	minTitleLength: number
): Id<"issues">[] => {
	const matched: Id<"issues">[] = [];
	for (const segment of segments) {
		for (const [normTitle, id] of titleToId.entries()) {
			if (
				containsNormalizedTitleAtWordBoundary(
					segment,
					normTitle,
					minTitleLength
				)
			) {
				matched.push(id);
			}
		}
	}
	return matched;
};

const extractExplicitMentions = (
	text: string,
	titleToId: Map<string, Id<"issues">>
) => {
	const out = new Set<Id<"issues">>();
	const t = normalize(text);

	// Pattern 1: "blocked by [...] <title>" / "depends on <title>" / "after <title>"
	const patterns = [
		/blocked by\s*[:-]?\s*([^,;|\n.]+)/g,
		/depends on\s*[:-]?\s*([^,;|\n.]+)/g,
		/\bafter\s+([^,;|\n.]+)/g,
		/requires\s*[:-]?\s*([^,;|\n.]+)/g,
	];
	for (const re of patterns) {
		for (const match of t.matchAll(re)) {
			const raw = (match[1] ?? "").trim();
			if (!raw) continue;
			const segments = segmentDependencyCapture(raw);
			for (const id of mapSegmentsToIssueIds(segments, titleToId, 10)) {
				out.add(id);
			}
		}
	}

	// Pattern 2: direct mention of another issue title (longer titles only)
	for (const [normTitle, id] of titleToId.entries()) {
		if (containsNormalizedTitleAtWordBoundary(t, normTitle, 14)) {
			out.add(id);
		}
	}

	return out;
};

const jaccard = (a: Set<string>, b: Set<string>) => {
	if (a.size === 0 || b.size === 0) return 0;
	let inter = 0;
	for (const t of a) if (b.has(t)) inter++;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
};

const buildResolutionSteps = (blockedTitle: string, blockerTitle: string) => {
	return [
		`Clarify the contract: what "${blockedTitle}" needs from "${blockerTitle}".`,
		`Break "${blockerTitle}" into the smallest shippable checklist and assign an owner.`,
		`Complete "${blockerTitle}" (or deliver the missing artifact) and confirm it's usable.`,
		`Unblock "${blockedTitle}": update requirements, then resume implementation and verify end-to-end.`,
	];
};

export const analyzeIssueDependencies = action({
	args: {
		issues: v.array(
			v.object({
				issueId: v.id("issues"),
				title: v.string(),
				description: v.optional(v.string()),
				statusName: v.optional(v.string()),
			})
		),
	},
	handler: async (_ctx, args): Promise<DependencySuggestion[]> => {
		const issues: AnalyzeInputIssue[] = args.issues;

		// Build quick lookup for explicit title mentions.
		const titleToId = new Map<string, Id<"issues">>();
		for (const i of issues) {
			titleToId.set(normalize(i.title), i.issueId);
		}

		const tokensById = new Map<Id<"issues">, Set<string>>();
		for (const i of issues) {
			const blob = [i.title, i.description ?? ""].join("\n");
			tokensById.set(i.issueId, new Set(tokenize(blob)));
		}

		const suggestions: DependencySuggestion[] = [];

		for (const blocked of issues) {
			if (isDone(blocked.statusName)) continue;

			const blockedText = [blocked.title, blocked.description ?? ""].join("\n");
			const explicit = extractExplicitMentions(blockedText, titleToId);

			// 1) Explicit mentions win.
			for (const blockerId of explicit) {
				if (blockerId === blocked.issueId) continue;
				const blocker = issues.find((i) => i.issueId === blockerId);
				if (!blocker || isDone(blocker.statusName)) continue;

				suggestions.push({
					blockerId,
					blockedId: blocked.issueId,
					reasoning: `Detected explicit dependency reference in "${blocked.title}".`,
					resolutionSteps: buildResolutionSteps(blocked.title, blocker.title),
				});
			}

			// 2) Heuristic similarity: if blocked issue contains "after/depends/requires"
			// and shares significant tokens with another issue, suggest a dependency.
			const blockedNorm = normalize(blockedText);
			const hasDependencyLanguage =
				blockedNorm.includes("blocked by") ||
				blockedNorm.includes("depends on") ||
				blockedNorm.includes("requires") ||
				blockedNorm.includes("after ") ||
				blockedNorm.includes("before ");

			if (!hasDependencyLanguage) continue;

			const blockedTokens = tokensById.get(blocked.issueId) ?? new Set();
			for (const maybeBlocker of issues) {
				if (maybeBlocker.issueId === blocked.issueId) continue;
				if (isDone(maybeBlocker.statusName)) continue;
				if (explicit.has(maybeBlocker.issueId)) continue;

				const blockerTokens = tokensById.get(maybeBlocker.issueId) ?? new Set();
				const score = jaccard(blockedTokens, blockerTokens);
				if (score < 0.35) continue;

				suggestions.push({
					blockerId: maybeBlocker.issueId,
					blockedId: blocked.issueId,
					reasoning: `Similar scope detected and dependency language present (similarity ${(
						score * 100
					).toFixed(0)}%).`,
					resolutionSteps: buildResolutionSteps(
						blocked.title,
						maybeBlocker.title
					),
				});
			}
		}

		// Deduplicate by (blocker, blocked)
		const seen = new Set<string>();
		return suggestions.filter((s) => {
			const key = `${s.blockerId}::${s.blockedId}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	},
});
