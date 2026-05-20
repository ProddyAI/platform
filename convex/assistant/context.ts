import { v } from "convex/values";
import { query } from "../_generated/server";

export type PreflightContextIntent =
	| "channel_summary"
	| "task_lookup"
	| "note_lookup"
	| "workspace_catchup"
	| "calendar_lookup"
	| "task_create"
	| "external_action"
	| "hybrid"
	| "general";

export type PreflightContextConfidence = "low" | "medium" | "high";

export type PreflightContextPlan = {
	intent: PreflightContextIntent;
	confidence: PreflightContextConfidence;
	channelQuery?: string;
	taskQuery?: string;
	noteQuery?: string;
	resolvedTopic?: string;
	needsMemberResolution: boolean;
	recommendedToolOrder: string[];
	summaryLines: string[];
};

const CHANNEL_REFERENCE_PATTERN = /#([a-z0-9][a-z0-9-_]*)/i;
const TASK_CREATE_PATTERN =
	/\b(create|add|make)\b[\s\S]{0,30}\b(task|todo|to-do)\b|\b(task|todo|to-do)\b[\s\S]{0,20}\bfor\b/i;
const NOTE_LOOKUP_PATTERN = /\b(note|notes)\b/i;
const TASK_LOOKUP_PATTERN = /\b(task|tasks|todo|blocker|blocked|priority)\b/i;
const CATCHUP_PATTERN =
	/\b(what happened|in general|catch up|catch-up|summary|summarize|update me)\b/i;
const CALENDAR_PATTERN =
	/\b(calendar|schedule|meeting|meetings|today|tomorrow|next week)\b/i;
const STARRED_GITHUB_REPO_REQUEST_PATTERN =
	/\b(starred|stars?)\b[\s\S]{0,20}\b(repo|repos|repository|repositories)\b/i;
const GITHUB_REPO_REQUEST_PATTERN =
	/\b((github|gothub|git\s*hub)\s+)?(repo|repos|repository|repositories)\b/i;
const EXTERNAL_PATTERN =
	/\b(github|gothub|git\s*hub|gmail|slack|notion|clickup|linear|repo|repos|repository|repositories)\b/i;
const TOPIC_PREFIX_PATTERN =
	/^(?:find|search|show|summarize|summary of|what happened in|what is happening in|what happened with|what about|about)\s+/i;
const TOPIC_SUFFIX_PATTERN =
	/\b(?:notes?|tasks?|channels?|messages?|please|for me|today|tomorrow)\b/gi;
const CHANNEL_SUMMARY_EXPLICIT_PATTERN =
	/\b(summarize|summary|what('?s| is) (in|happening in)|show channel|channel (context|activity|messages?|summary))\b/i;

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function extractChannelQuery(message: string) {
	const match = message.match(CHANNEL_REFERENCE_PATTERN);
	return match?.[1]?.trim().toLowerCase() ?? null;
}

function sanitizeTopic(raw: string) {
	const withoutPrefix = raw.replace(TOPIC_PREFIX_PATTERN, "");
	const withoutSuffix = withoutPrefix.replace(TOPIC_SUFFIX_PATTERN, "");
	return normalizeWhitespace(withoutSuffix)
		.replace(/^[\s:,-]+|[\s?.!,]+$/g, "")
		.trim();
}

function extractTopicAfterKeyword(message: string, keyword: RegExp) {
	const match = message.match(keyword);
	if (!match || typeof match.index !== "number") return null;
	const tail = message.slice(match.index + match[0].length);
	const topic = sanitizeTopic(tail);
	return topic || null;
}

function planTaskCreate(
	message: string,
	lower: string
): PreflightContextPlan | null {
	if (!TASK_CREATE_PATTERN.test(lower)) return null;
	const needsMemberResolution = /\bfor\s+[A-Za-z]+|\bassign\b/i.test(message);
	return {
		intent: "task_create",
		confidence: "medium",
		needsMemberResolution,
		recommendedToolOrder: needsMemberResolution
			? ["getWorkspaceMembers"]
			: ["draftTaskForConfirmation"],
		summaryLines: [
			"Treat this as an action-oriented task request.",
			needsMemberResolution
				? "Resolve the assignee against accepted workspace members before drafting."
				: "Draft the task after confirming the relevant workspace context.",
		],
	};
}

function planNoteLookup(
	message: string,
	lower: string
): PreflightContextPlan | null {
	if (!NOTE_LOOKUP_PATTERN.test(lower)) return null;
	const noteQuery =
		extractTopicAfterKeyword(message, /\b(?:notes?\s+about|notes?\s+on)\b/i) ??
		extractTopicAfterKeyword(message, /\b(?:find|search|show)\s+notes?\b/i);
	return {
		intent: "note_lookup",
		confidence: noteQuery ? "high" : "medium",
		noteQuery: noteQuery ?? undefined,
		resolvedTopic: noteQuery ?? undefined,
		needsMemberResolution: false,
		recommendedToolOrder: noteQuery ? ["searchNotes"] : ["getRecentNotes"],
		summaryLines: noteQuery
			? [
					`Direct note topic detected: ${noteQuery}`,
					"Search notes directly before semantic fallback.",
				]
			: ["User asked for notes without a clear topic."],
	};
}

function planTaskLookup(
	message: string,
	lower: string
): PreflightContextPlan | null {
	if (!TASK_LOOKUP_PATTERN.test(lower)) return null;
	const taskQuery =
		extractTopicAfterKeyword(message, /\b(?:tasks?\s+about|tasks?\s+on)\b/i) ??
		extractTopicAfterKeyword(message, /\b(?:blocked|blockers?)\b/i);
	return {
		intent: "task_lookup",
		confidence: taskQuery ? "high" : "medium",
		taskQuery: taskQuery ?? undefined,
		resolvedTopic: taskQuery ?? undefined,
		needsMemberResolution: false,
		recommendedToolOrder: taskQuery ? ["searchTasks"] : ["getMyAllTasks"],
		summaryLines: taskQuery
			? [
					`Direct task topic detected: ${taskQuery}`,
					"Use task search before broader workspace retrieval.",
				]
			: ["Task intent detected without a specific topic."],
	};
}

function planWorkspaceCatchup(
	lower: string,
	channelQuery: string | null
): PreflightContextPlan | null {
	if (!CATCHUP_PATTERN.test(lower)) return null;
	if (channelQuery && !/\bin general\b/i.test(lower)) return null;
	return {
		intent: "workspace_catchup",
		confidence: "high",
		needsMemberResolution: false,
		recommendedToolOrder: ["getWorkspaceGeneralSummary"],
		summaryLines: [
			"Broad catch-up request detected.",
			"Start with the compact workspace summary instead of semantic search.",
		],
	};
}

function planCalendarLookup(lower: string): PreflightContextPlan | null {
	if (!CALENDAR_PATTERN.test(lower)) return null;
	return {
		intent: "calendar_lookup",
		confidence: "medium",
		needsMemberResolution: false,
		recommendedToolOrder: lower.includes("tomorrow")
			? ["getMyCalendarTomorrow"]
			: lower.includes("next week")
				? ["getMyCalendarNextWeek"]
				: ["getMyCalendarToday"],
		summaryLines: ["Calendar or schedule request detected."],
	};
}

function planExternalAction(
	_message: string,
	lower: string
): PreflightContextPlan | null {
	if (STARRED_GITHUB_REPO_REQUEST_PATTERN.test(lower)) {
		return {
			intent: "external_action",
			confidence: "high",
			resolvedTopic: "github starred repositories",
			needsMemberResolution: false,
			recommendedToolOrder: ["runGithubTool"],
			summaryLines: [
				"Treat starred repository listing as an authenticated GitHub request.",
				"List repositories starred by the authenticated user, not owned repositories or public search results.",
			],
		};
	}
	if (GITHUB_REPO_REQUEST_PATTERN.test(lower)) {
		return {
			intent: "external_action",
			confidence: "high",
			resolvedTopic: "github repositories",
			needsMemberResolution: false,
			recommendedToolOrder: ["runGithubTool"],
			summaryLines: [
				"Treat repository listing as an authenticated GitHub request.",
				"List repositories for the authenticated user, not starred repositories or public search results.",
			],
		};
	}
	if (EXTERNAL_PATTERN.test(lower)) {
		return {
			intent: "external_action",
			confidence: "medium",
			needsMemberResolution: false,
			recommendedToolOrder: [],
			summaryLines: [
				"External integration request detected.",
				"Use workspace context first only when the request also references internal topics.",
			],
		};
	}
	return null;
}

const ACTION_VERB_PATTERN =
	/\b(create|add|make|find|search|assign|note|task|todo|to-do|schedule|book)\b/i;

function planChannelSummary(
	lower: string,
	channelQuery: string | null
): PreflightContextPlan | null {
	if (
		!channelQuery ||
		(!CHANNEL_SUMMARY_EXPLICIT_PATTERN.test(lower) &&
			ACTION_VERB_PATTERN.test(lower))
	) {
		return null;
	}
	return {
		intent: "channel_summary",
		confidence: CHANNEL_SUMMARY_EXPLICIT_PATTERN.test(lower)
			? "high"
			: "medium",
		channelQuery,
		resolvedTopic: channelQuery,
		needsMemberResolution: false,
		recommendedToolOrder: ["searchChannels", "getChannelSummary"],
		summaryLines: [
			`Matched explicit channel reference: #${channelQuery}`,
			"Prefer direct channel retrieval before semantic fallback.",
		],
	};
}

function generalPreflightPlan(): PreflightContextPlan {
	return {
		intent: "general",
		confidence: "low",
		needsMemberResolution: false,
		recommendedToolOrder: [],
		summaryLines: ["No strong direct context signal detected."],
	};
}

export function buildPreflightContextPlan(input: {
	message: string;
}): PreflightContextPlan {
	const message = normalizeWhitespace(input.message);
	const lower = message.toLowerCase();
	const channelQuery = extractChannelQuery(message);

	const planners: Array<() => PreflightContextPlan | null> = [
		() => planTaskCreate(message, lower),
		() => planNoteLookup(message, lower),
		() => planTaskLookup(message, lower),
		() => planWorkspaceCatchup(lower, channelQuery),
		() => planCalendarLookup(lower),
		() => planExternalAction(message, lower),
		() => planChannelSummary(lower, channelQuery),
	];

	for (const plan of planners) {
		const result = plan();
		if (result) return result;
	}

	return generalPreflightPlan();
}

export function buildPreflightContextPrompt(
	context: Pick<
		PreflightContextPlan,
		| "intent"
		| "confidence"
		| "resolvedTopic"
		| "recommendedToolOrder"
		| "summaryLines"
	>
) {
	const lines = [
		"Preflight context:",
		`Intent: ${context.intent}`,
		`Confidence: ${context.confidence}`,
		context.resolvedTopic ? `Resolved topic: ${context.resolvedTopic}` : "",
		context.recommendedToolOrder.length
			? `Recommended tools: ${context.recommendedToolOrder.join(" -> ")}`
			: "",
		...context.summaryLines.map((line) => `- ${line}`),
	].filter(Boolean);

	return lines.join("\n");
}

export const getThreadContext = query({
	args: { threadId: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			workspaceId: v.id("workspaces"),
			userId: v.id("users"),
			recentTools: v.array(
				v.object({
					toolName: v.string(),
					outcome: v.union(v.literal("success"), v.literal("error")),
				})
			),
		})
	),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("assistantConversations")
			.withIndex("by_conversation_id", (q) =>
				q.eq("conversationId", args.threadId)
			)
			.unique();
		if (!row) return null;

		const recent = await ctx.db
			.query("assistantToolAuditEvents")
			.withIndex("by_workspace_id_timestamp", (q) =>
				q.eq("workspaceId", row.workspaceId)
			)
			.order("desc")
			.take(20);
		const forUser = recent.filter((e) => e.userId === row.userId);
		const recentTools = forUser.slice(0, 10).map((e) => ({
			toolName: e.toolName,
			outcome: e.outcome,
		}));

		return {
			workspaceId: row.workspaceId,
			userId: row.userId,
			recentTools,
		};
	},
});

export function buildThreadContextPrompt(context: {
	recentTools: Array<{ toolName: string; outcome: string }>;
}): string {
	if (!context.recentTools.length) return "";
	const lines = context.recentTools.map((t) => `- ${t.toolName}: ${t.outcome}`);
	return `\nRecent tools used in this conversation:\n${lines.join("\n")}`;
}
