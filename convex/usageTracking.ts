import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { getPlanConfig, isUnlimited } from "./plans";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return "YYYY-MM" for the current UTC month. */
function getCurrentMonth(): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

type FeatureType =
	| "aiRequest"
	| "aiDiagram"
	| "aiSummary"
	| "message"
	| "task"
	| "channel"
	| "board"
	| "note";

/** Maps a feature type to the DB column name on `usageStats`. */
const FEATURE_FIELD_MAP: Record<FeatureType, string> = {
	aiRequest: "aiRequestCount",
	aiDiagram: "aiDiagramCount",
	aiSummary: "aiSummaryCount",
	message: "messageCount",
	task: "taskCount",
	channel: "channelCount",
	board: "boardCount",
	note: "noteCount",
};

/** Maps a feature type to the plan-limits key on `PlanLimits`. */
const FEATURE_LIMIT_MAP: Record<FeatureType, string> = {
	aiRequest: "aiRequestsPerMonth",
	aiDiagram: "aiDiagramGenerationsPerMonth",
	aiSummary: "aiSummaryRequestsPerMonth",
	message: "messagesPerMonth",
	task: "tasksPerMonth",
	channel: "channelsPerMonth",
	board: "boardsPerMonth",
	note: "notesPerMonth",
};

// ---------------------------------------------------------------------------
// Core upsert-and-increment  (internal – called by other mutations/actions)
// ---------------------------------------------------------------------------

export const incrementUsage = internalMutation({
	args: {
		userId: v.id("users"),
		workspaceId: v.id("workspaces"),
		featureType: v.string(),
	},
	handler: async (ctx, args) => {
		const month = getCurrentMonth();
		const fieldName = FEATURE_FIELD_MAP[args.featureType as FeatureType];
		if (!fieldName) {
			console.warn(`[UsageTracking] Unknown feature type: ${args.featureType}`);
			return;
		}

		const existing = await ctx.db
			.query("usageStats")
			.withIndex("by_user_workspace_month", (q) =>
				q
					.eq("userId", args.userId)
					.eq("workspaceId", args.workspaceId)
					.eq("month", month)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				[fieldName]: ((existing as any)[fieldName] ?? 0) + 1,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("usageStats", {
				userId: args.userId,
				workspaceId: args.workspaceId,
				month,
				aiRequestCount: 0,
				aiDiagramCount: 0,
				aiSummaryCount: 0,
				messageCount: 0,
				taskCount: 0,
				channelCount: 0,
				boardCount: 0,
				noteCount: 0,
				[fieldName]: 1,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Convenience wrappers (internal)
// ---------------------------------------------------------------------------

export const recordAIRequest = internalMutation({
	args: {
		userId: v.id("users"),
		workspaceId: v.id("workspaces"),
		featureType: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const month = getCurrentMonth();
		const featureType = (args.featureType ?? "aiRequest") as FeatureType;
		const fieldName = FEATURE_FIELD_MAP[featureType];
		if (!fieldName) return;

		const existing = await ctx.db
			.query("usageStats")
			.withIndex("by_user_workspace_month", (q) =>
				q
					.eq("userId", args.userId)
					.eq("workspaceId", args.workspaceId)
					.eq("month", month)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				[fieldName]: ((existing as any)[fieldName] ?? 0) + 1,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("usageStats", {
				userId: args.userId,
				workspaceId: args.workspaceId,
				month,
				aiRequestCount: 0,
				aiDiagramCount: 0,
				aiSummaryCount: 0,
				messageCount: 0,
				taskCount: 0,
				channelCount: 0,
				boardCount: 0,
				noteCount: 0,
				[fieldName]: 1,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	},
});

export const recordMessageCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.usageTracking.incrementUsage, {
			...args,
			featureType: "message",
		});
	},
});

export const recordTaskCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.usageTracking.incrementUsage, {
			...args,
			featureType: "task",
		});
	},
});

export const recordEventCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	// Deprecated: calendar events are no longer tracked. Kept as no-op
	// so any in-flight scheduled calls don't crash.
	handler: async (_ctx, _args) => {},
});

export const recordChannelCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.usageTracking.incrementUsage, {
			...args,
			featureType: "channel",
		});
	},
});

export const recordBoardCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.usageTracking.incrementUsage, {
			...args,
			featureType: "board",
		});
	},
});

export const recordNoteCreated = internalMutation({
	args: { userId: v.id("users"), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		await ctx.runMutation(internal.usageTracking.incrementUsage, {
			...args,
			featureType: "note",
		});
	},
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Aggregate usage for an entire workspace (across all users) for a month. */
export const getWorkspaceMonthlyUsageInternal = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		month: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const month = args.month ?? getCurrentMonth();

		const rows = await ctx.db
			.query("usageStats")
			.withIndex("by_workspace_month", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("month", month)
			)
			.collect();

		const totals = {
			aiRequestCount: 0,
			aiDiagramCount: 0,
			aiSummaryCount: 0,
			messageCount: 0,
			taskCount: 0,
			channelCount: 0,
			boardCount: 0,
			noteCount: 0,
		};

		for (const row of rows) {
			totals.aiRequestCount += row.aiRequestCount ?? 0;
			totals.aiDiagramCount += row.aiDiagramCount ?? 0;
			totals.aiSummaryCount += row.aiSummaryCount ?? 0;
			totals.messageCount += row.messageCount ?? 0;
			totals.taskCount += row.taskCount ?? 0;
			totals.channelCount += row.channelCount ?? 0;
			totals.boardCount += row.boardCount ?? 0;
			totals.noteCount += row.noteCount ?? 0;
		}

		return { month, ...totals };
	},
});

/** Check whether a workspace is within its AI usage limit. */
export const checkAIUsageLimit = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		featureType: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return { allowed: false, used: 0, limit: 0 };

		const plan = getPlanConfig(workspace.plan);
		const featureType = (args.featureType ?? "aiRequest") as FeatureType;
		const limitKey = FEATURE_LIMIT_MAP[featureType];
		const limit = (plan.limits as any)[limitKey] as number;

		if (isUnlimited(limit)) return { allowed: true, used: 0, limit: -1 };

		const month = getCurrentMonth();
		const rows = await ctx.db
			.query("usageStats")
			.withIndex("by_workspace_month", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("month", month)
			)
			.collect();

		const fieldName = FEATURE_FIELD_MAP[featureType];
		let used = 0;
		for (const row of rows) {
			used += (row as any)[fieldName] ?? 0;
		}

		return { allowed: used < limit, used, limit };
	},
});

// ---------------------------------------------------------------------------
// Public query – used by the Usage Dashboard UI
// ---------------------------------------------------------------------------

export const getWorkspaceUsage = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify membership
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.first();
		if (!member) throw new Error("Not a member of this workspace");

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		const plan = getPlanConfig(workspace.plan);
		const month = getCurrentMonth();

		const rows = await ctx.db
			.query("usageStats")
			.withIndex("by_workspace_month", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("month", month)
			)
			.collect();

		const totals = {
			aiRequestCount: 0,
			aiDiagramCount: 0,
			aiSummaryCount: 0,
			messageCount: 0,
			taskCount: 0,
			channelCount: 0,
			boardCount: 0,
			noteCount: 0,
		};

		for (const row of rows) {
			totals.aiRequestCount += row.aiRequestCount ?? 0;
			totals.aiDiagramCount += (row.aiDiagramCount ?? 0) + ((row as any).diagramsGenerated ?? 0);
			totals.aiSummaryCount += row.aiSummaryCount ?? 0;
			totals.messageCount += (row.messageCount ?? 0) + ((row as any).messagesCreated ?? 0);
			totals.taskCount += (row.taskCount ?? 0) + ((row as any).tasksCreated ?? 0);
			totals.channelCount += (row.channelCount ?? 0) + ((row as any).channelsCreated ?? 0);
			totals.boardCount += (row.boardCount ?? 0) + ((row as any).boardsCreated ?? 0);
			totals.noteCount += (row.noteCount ?? 0) + ((row as any).notesCreated ?? 0);
		}

		return {
			month,
			plan: {
				name: plan.name,
				label: plan.label,
			},
			ai: {
				requests: { used: totals.aiRequestCount, limit: plan.limits.aiRequestsPerMonth },
				diagrams: { used: totals.aiDiagramCount, limit: plan.limits.aiDiagramGenerationsPerMonth },
				summaries: { used: totals.aiSummaryCount, limit: plan.limits.aiSummaryRequestsPerMonth },
			},
			collaboration: {
				messages: { used: totals.messageCount, limit: plan.limits.messagesPerMonth },
				tasks: { used: totals.taskCount, limit: plan.limits.tasksPerMonth },
				channels: { used: totals.channelCount, limit: plan.limits.channelsPerMonth },
				boards: { used: totals.boardCount, limit: plan.limits.boardsPerMonth },
				notes: { used: totals.noteCount, limit: plan.limits.notesPerMonth },
			},
		};
	},
});

// ---------------------------------------------------------------------------
// Public query – for Next.js API routes to check limits before calling AI
// ---------------------------------------------------------------------------

export const checkAIUsageLimitPublic = query({
	args: {
		workspaceId: v.id("workspaces"),
		featureType: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return { allowed: false, used: 0, limit: 0 };

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return { allowed: false, used: 0, limit: 0 };

		const plan = getPlanConfig(workspace.plan);
		const featureType = (args.featureType ?? "aiRequest") as FeatureType;
		const limitKey = FEATURE_LIMIT_MAP[featureType];
		const limit = (plan.limits as any)[limitKey] as number;

		if (isUnlimited(limit)) return { allowed: true, used: 0, limit: -1 };

		const month = getCurrentMonth();
		const rows = await ctx.db
			.query("usageStats")
			.withIndex("by_workspace_month", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("month", month)
			)
			.collect();

		const fieldName = FEATURE_FIELD_MAP[featureType];
		let used = 0;
		for (const row of rows) {
			used += (row as any)[fieldName] ?? 0;
		}

		return { allowed: used < limit, used, limit };
	},
});

// ---------------------------------------------------------------------------
// Public mutation – for Next.js API routes to record usage after AI calls
// ---------------------------------------------------------------------------

export const recordAIRequestPublic = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		featureType: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return;

		const month = getCurrentMonth();
		const featureType = (args.featureType ?? "aiRequest") as FeatureType;
		const fieldName = FEATURE_FIELD_MAP[featureType];
		if (!fieldName) return;

		const existing = await ctx.db
			.query("usageStats")
			.withIndex("by_user_workspace_month", (q) =>
				q
					.eq("userId", userId)
					.eq("workspaceId", args.workspaceId)
					.eq("month", month)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				[fieldName]: ((existing as any)[fieldName] ?? 0) + 1,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.insert("usageStats", {
				userId,
				workspaceId: args.workspaceId,
				month,
				aiRequestCount: 0,
				aiDiagramCount: 0,
				aiSummaryCount: 0,
				messageCount: 0,
				taskCount: 0,
				channelCount: 0,
				boardCount: 0,
				noteCount: 0,
				[fieldName]: 1,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	},
});
