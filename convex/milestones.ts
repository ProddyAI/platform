import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const DEFAULT_COLOR = "#6366f1";

// Status-name classification, kept consistent with convex/board.ts.
const DONE_STATUS_KEYWORDS = [
	"done",
	"completed",
	"complete",
	"closed",
	"resolved",
];
const IN_PROGRESS_STATUS_KEYWORDS = ["progress", "review", "doing", "started"];

const isDoneStatusName = (name?: string) => {
	const normalized = (name ?? "").trim().toLowerCase();
	return DONE_STATUS_KEYWORDS.some((keyword) => normalized === keyword);
};

const isInProgressStatusName = (name?: string) => {
	const normalized = (name ?? "").trim().toLowerCase();
	return IN_PROGRESS_STATUS_KEYWORDS.some((keyword) =>
		normalized.includes(keyword)
	);
};

// Authn + authz: resolve the caller to a member of the workspace, or throw.
async function requireMember(
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Unauthorized");

	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Not a member of this workspace");
	return member;
}

async function requireMilestoneAccess(
	ctx: QueryCtx | MutationCtx,
	milestoneId: Id<"milestones">
): Promise<Doc<"milestones">> {
	const milestone = await ctx.db.get(milestoneId);
	if (!milestone) throw new Error("Milestone not found");
	await requireMember(ctx, milestone.workspaceId);
	return milestone;
}

export const getByProject = query({
	args: {
		projectId: v.id("projects"),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		await requireMember(ctx, args.workspaceId);

		const milestones = await ctx.db
			.query("milestones")
			.withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
			.collect();

		// Dated milestones first (chronological), then undated by manual order.
		return milestones.sort((a, b) => {
			if (a.targetDate && b.targetDate) return a.targetDate - b.targetDate;
			if (a.targetDate) return -1;
			if (b.targetDate) return 1;
			return a.order - b.order;
		});
	},
});

export const getById = query({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		return await requireMilestoneAccess(ctx, args.milestoneId);
	},
});

export const getMilestoneIssues = query({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		await requireMilestoneAccess(ctx, args.milestoneId);

		const links = await ctx.db
			.query("milestoneIssues")
			.withIndex("by_milestone_id", (q) =>
				q.eq("milestoneId", args.milestoneId)
			)
			.collect();

		const issues = await Promise.all(
			links.map(async (link) => {
				const issue = await ctx.db.get(link.issueId);
				if (!issue) return null;
				const status = await ctx.db.get(issue.statusId);
				return { ...issue, status };
			})
		);

		return issues.filter(
			(issue): issue is NonNullable<typeof issue> => issue !== null
		);
	},
});

export const getMilestoneStats = query({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		await requireMilestoneAccess(ctx, args.milestoneId);

		const links = await ctx.db
			.query("milestoneIssues")
			.withIndex("by_milestone_id", (q) =>
				q.eq("milestoneId", args.milestoneId)
			)
			.collect();

		let total = 0;
		let completed = 0;
		let inProgress = 0;

		await Promise.all(
			links.map(async (link) => {
				const issue = await ctx.db.get(link.issueId);
				if (!issue) return;
				const status = await ctx.db.get(issue.statusId);
				total++;
				if (isDoneStatusName(status?.name)) completed++;
				else if (isInProgressStatusName(status?.name)) inProgress++;
			})
		);

		return {
			total,
			completed,
			inProgress,
			notStarted: total - completed - inProgress,
			completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
		};
	},
});

// Issues in the milestone's project that are not yet linked to it.
export const getLinkableIssues = query({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		const milestone = await requireMilestoneAccess(ctx, args.milestoneId);

		const [projectIssues, links] = await Promise.all([
			ctx.db
				.query("issues")
				.withIndex("by_project_id", (q) =>
					q.eq("projectId", milestone.projectId)
				)
				.collect(),
			ctx.db
				.query("milestoneIssues")
				.withIndex("by_milestone_id", (q) =>
					q.eq("milestoneId", args.milestoneId)
				)
				.collect(),
		]);

		const alreadyLinked = new Set(links.map((link) => link.issueId));

		const linkable = projectIssues.filter(
			(issue) => !issue.parentIssueId && !alreadyLinked.has(issue._id)
		);

		return await Promise.all(
			linkable.map(async (issue) => {
				const status = await ctx.db.get(issue.statusId);
				return { ...issue, status };
			})
		);
	},
});

export const create = mutation({
	args: {
		projectId: v.id("projects"),
		workspaceId: v.id("workspaces"),
		name: v.string(),
		description: v.optional(v.string()),
		targetDate: v.optional(v.number()),
		color: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const member = await requireMember(ctx, args.workspaceId);

		const name = args.name.trim();
		if (!name) throw new Error("Milestone name is required");

		const existing = await ctx.db
			.query("milestones")
			.withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
			.collect();

		const now = Date.now();
		return await ctx.db.insert("milestones", {
			projectId: args.projectId,
			workspaceId: args.workspaceId,
			name,
			description: args.description?.trim() || undefined,
			targetDate: args.targetDate,
			color: args.color ?? DEFAULT_COLOR,
			status: "planned",
			order: existing.length,
			createdBy: member._id,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		milestoneId: v.id("milestones"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		targetDate: v.optional(v.number()),
		color: v.optional(v.string()),
		status: v.optional(
			v.union(
				v.literal("planned"),
				v.literal("in_progress"),
				v.literal("completed"),
				v.literal("archived")
			)
		),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		await requireMilestoneAccess(ctx, args.milestoneId);
		const { milestoneId, ...updates } = args;
		await ctx.db.patch(milestoneId, { ...updates, updatedAt: Date.now() });
	},
});

export const remove = mutation({
	args: { milestoneId: v.id("milestones") },
	handler: async (ctx, args) => {
		await requireMilestoneAccess(ctx, args.milestoneId);

		const links = await ctx.db
			.query("milestoneIssues")
			.withIndex("by_milestone_id", (q) =>
				q.eq("milestoneId", args.milestoneId)
			)
			.collect();

		await Promise.all(links.map((link) => ctx.db.delete(link._id)));
		await ctx.db.delete(args.milestoneId);
	},
});

export const linkIssues = mutation({
	args: {
		milestoneId: v.id("milestones"),
		issueIds: v.array(v.id("issues")),
	},
	handler: async (ctx, args) => {
		const milestone = await requireMilestoneAccess(ctx, args.milestoneId);

		const existing = await ctx.db
			.query("milestoneIssues")
			.withIndex("by_milestone_id", (q) =>
				q.eq("milestoneId", args.milestoneId)
			)
			.collect();

		const alreadyLinked = new Set(existing.map((link) => link.issueId));
		let linked = 0;

		for (const issueId of args.issueIds) {
			if (alreadyLinked.has(issueId)) continue;
			const issue = await ctx.db.get(issueId);
			if (!issue || issue.projectId !== milestone.projectId) continue;

			await ctx.db.insert("milestoneIssues", {
				milestoneId: args.milestoneId,
				issueId,
				projectId: milestone.projectId,
				workspaceId: milestone.workspaceId,
				linkedAt: Date.now(),
			});
			alreadyLinked.add(issueId);
			linked++;
		}

		return { linked };
	},
});

export const unlinkIssue = mutation({
	args: { milestoneId: v.id("milestones"), issueId: v.id("issues") },
	handler: async (ctx, args) => {
		await requireMilestoneAccess(ctx, args.milestoneId);

		const links = await ctx.db
			.query("milestoneIssues")
			.withIndex("by_milestone_id", (q) =>
				q.eq("milestoneId", args.milestoneId)
			)
			.collect();

		const target = links.find((link) => link.issueId === args.issueId);
		if (target) await ctx.db.delete(target._id);
	},
});
