import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, type MutationCtx, query, mutation } from "./_generated/server";

// ─── Helper ──────────────────────────────────────────────────────────────────

const getMember = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
) => {
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type StressLevel = "low" | "medium" | "high";

export type StressMetrics = {
	totalPending: number;
	overdueCount: number;
	pendingSoon: number;
	highPriorityPercent: number;
	completionRate7d: number;
	baseScore: number;
	finalScore: number;
	stressLevel: StressLevel;
	multiplierApplied: boolean;
};

// ─── Core Formula ─────────────────────────────────────────────────────────────

function calculateStress(metrics: {
	overdueCount: number;
	pendingSoon: number;
	totalPending: number;
	highPriorityPercent: number;
}): { baseScore: number; finalScore: number; stressLevel: StressLevel; multiplierApplied: boolean } {
	const { overdueCount, pendingSoon, totalPending, highPriorityPercent } = metrics;

	// Step 1 – base formula
	const baseScore = overdueCount * 10 + pendingSoon * 5 + totalPending * 2;

	// Step 2 – high-priority multiplier
	const multiplierApplied = highPriorityPercent > 50;
	const finalScore = multiplierApplied ? Math.round(baseScore * 1.5) : baseScore;

	// Step 3 – classify
	let stressLevel: StressLevel = "low";
	if (finalScore > 100) stressLevel = "high";
	else if (finalScore > 50) stressLevel = "medium";

	return { baseScore, finalScore, stressLevel, multiplierApplied };
}

// ─── Query: Stress Metrics ────────────────────────────────────────────────────

export const getStressMetrics = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args): Promise<StressMetrics | null> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member) return null;

		const now = Date.now();
		const in24h = now + 24 * 60 * 60 * 1000;
		const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.collect();

		const pendingTasks = allTasks.filter(
			(t) => !t.completed && t.status !== "cancelled"
		);

		const totalPending = pendingTasks.length;
		const overdueCount = pendingTasks.filter(
			(t) => t.dueDate && t.dueDate < now
		).length;
		const pendingSoon = pendingTasks.filter(
			(t) => t.dueDate && t.dueDate >= now && t.dueDate <= in24h
		).length;

		const highPriorityTasks = pendingTasks.filter((t) => t.priority === "high");
		const highPriorityPercent =
			totalPending > 0
				? Math.round((highPriorityTasks.length / totalPending) * 100)
				: 0;

		// Cohort metric: % of tasks created in the last 7d that are now complete.
		// This is not a velocity metric; it measures completeness of the recent cohort.
		const recentTasks = allTasks.filter(
			(t) => t._creationTime >= sevenDaysAgo
		);
		const completedRecently = recentTasks.filter((t) => t.completed).length;
		const completionRate7d =
			recentTasks.length > 0
				? Math.round((completedRecently / recentTasks.length) * 100)
				: 100;

		const { baseScore, finalScore, stressLevel, multiplierApplied } =
			calculateStress({ overdueCount, pendingSoon, totalPending, highPriorityPercent });

		return {
			totalPending,
			overdueCount,
			pendingSoon,
			highPriorityPercent,
			completionRate7d,
			baseScore,
			finalScore,
			stressLevel,
			multiplierApplied,
		};
	},
});

// ─── Query: Daily Focus Tasks ─────────────────────────────────────────────────

export const getDailyFocusTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member) return [];

		const now = Date.now();
		const limit = args.limit ?? 5;

		const allTasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.collect();

		const pendingTasks = allTasks.filter(
			(t) => !t.completed && t.status !== "cancelled"
		);

		const priorityWeight: Record<string, number> = {
			high: 0,
			medium: 1,
			low: 2,
			"": 3,
		};

		const sorted = [...pendingTasks].sort((a, b) => {
			const pa = priorityWeight[a.priority ?? ""] ?? 3;
			const pb = priorityWeight[b.priority ?? ""] ?? 3;
			if (pa !== pb) return pa - pb;
			if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
			if (a.dueDate) return -1;
			if (b.dueDate) return 1;
			return a._creationTime - b._creationTime;
		});

		return sorted.slice(0, limit).map((t) => ({
			...t,
			isOverdue: t.dueDate ? t.dueDate < now : false,
		}));
	},
});

// ─── Mutation: Reschedule Task ────────────────────────────────────────────────

export const rescheduleTask = mutation({
	args: {
		taskId: v.id("tasks"),
		daysToAdd: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const task = await ctx.db.get(args.taskId);
		if (!task) throw new Error("Task not found");
		if (task.userId !== userId) throw new Error("Not authorized");

		const daysToAdd = args.daysToAdd ?? 1;
		const now = Date.now();
		const baseDate = task.dueDate && task.dueDate > now ? task.dueDate : now;
		const newDueDate = baseDate + daysToAdd * 24 * 60 * 60 * 1000;

		await ctx.db.patch(args.taskId, {
			dueDate: newDueDate,
			updatedAt: now,
		});

		return { taskId: args.taskId, newDueDate };
	},
});
