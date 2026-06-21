import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

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

const STATUS_RANK: Record<Doc<"sprints">["status"], number> = {
	active: 0,
	planning: 1,
	completed: 2,
	cancelled: 3,
};

const DAY_MS = 1000 * 60 * 60 * 24;

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

// Load a sprint and assert the caller may access it.
async function requireSprintAccess(
	ctx: QueryCtx | MutationCtx,
	sprintId: Id<"sprints">
): Promise<Doc<"sprints">> {
	const sprint = await ctx.db.get(sprintId);
	if (!sprint) throw new Error("Sprint not found");
	await requireMember(ctx, sprint.workspaceId);
	return sprint;
}

const classifyIssue = (statusName?: string) => {
	if (isDoneStatusName(statusName)) return "done" as const;
	if (isInProgressStatusName(statusName)) return "inProgress" as const;
	return "notStarted" as const;
};

export const getByProject = query({
	args: {
		projectId: v.id("projects"),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		await requireMember(ctx, args.workspaceId);

		const sprints = await ctx.db
			.query("sprints")
			.withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
			.collect();

		// Surface active sprints first, then by most recent start date.
		return sprints.sort((a, b) => {
			const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
			if (rank !== 0) return rank;
			return b.startDate - a.startDate;
		});
	},
});

export const getById = query({
	args: { sprintId: v.id("sprints") },
	handler: async (ctx, args) => {
		return await requireSprintAccess(ctx, args.sprintId);
	},
});

export const getActiveSprint = query({
	args: {
		projectId: v.id("projects"),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		await requireMember(ctx, args.workspaceId);

		const sprints = await ctx.db
			.query("sprints")
			.withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
			.collect();

		return sprints.find((sprint) => sprint.status === "active") ?? null;
	},
});

export const getSprintIssues = query({
	args: { sprintId: v.id("sprints") },
	handler: async (ctx, args) => {
		await requireSprintAccess(ctx, args.sprintId);

		const sprintIssues = await ctx.db
			.query("sprintIssues")
			.withIndex("by_sprint_id_order", (q) => q.eq("sprintId", args.sprintId))
			.collect();

		const issues = await Promise.all(
			sprintIssues.map(async (link) => {
				const issue = await ctx.db.get(link.issueId);
				if (!issue) return null;
				const status = await ctx.db.get(issue.statusId);
				return {
					...issue,
					status,
					sprintOrder: link.order,
					sprintLinkId: link._id,
				};
			})
		);

		return issues
			.filter((issue): issue is NonNullable<typeof issue> => issue !== null)
			.sort((a, b) => a.sprintOrder - b.sprintOrder);
	},
});

export const getSprintStats = query({
	args: { sprintId: v.id("sprints") },
	handler: async (ctx, args) => {
		const sprint = await requireSprintAccess(ctx, args.sprintId);

		const sprintIssues = await ctx.db
			.query("sprintIssues")
			.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
			.collect();

		let total = 0;
		let completed = 0;
		let inProgress = 0;
		let notStarted = 0;

		await Promise.all(
			sprintIssues.map(async (link) => {
				const issue = await ctx.db.get(link.issueId);
				if (!issue) return;
				const status = await ctx.db.get(issue.statusId);
				total++;
				const bucket = classifyIssue(status?.name);
				if (bucket === "done") completed++;
				else if (bucket === "inProgress") inProgress++;
				else notStarted++;
			})
		);

		const now = Date.now();
		const daysTotal = Math.max(
			1,
			Math.ceil((sprint.endDate - sprint.startDate) / DAY_MS)
		);
		const daysElapsed = Math.min(
			daysTotal,
			Math.max(0, Math.ceil((now - sprint.startDate) / DAY_MS))
		);
		const daysRemaining = Math.max(
			0,
			Math.ceil((sprint.endDate - now) / DAY_MS)
		);

		return {
			total,
			completed,
			inProgress,
			notStarted,
			completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
			daysTotal,
			daysElapsed,
			daysRemaining,
		};
	},
});

// Issues in the sprint's project that are not yet part of the sprint.
export const getAddableIssues = query({
	args: { sprintId: v.id("sprints") },
	handler: async (ctx, args) => {
		const sprint = await requireSprintAccess(ctx, args.sprintId);

		const [projectIssues, sprintIssues] = await Promise.all([
			ctx.db
				.query("issues")
				.withIndex("by_project_id", (q) => q.eq("projectId", sprint.projectId))
				.collect(),
			ctx.db
				.query("sprintIssues")
				.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
				.collect(),
		]);

		const alreadyIn = new Set(sprintIssues.map((link) => link.issueId));

		const addable = projectIssues.filter(
			(issue) => !issue.parentIssueId && !alreadyIn.has(issue._id)
		);

		return await Promise.all(
			addable.map(async (issue) => {
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
		startDate: v.number(),
		endDate: v.number(),
		goal: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const member = await requireMember(ctx, args.workspaceId);

		const name = args.name.trim();
		if (!name) throw new Error("Sprint name is required");
		if (args.endDate <= args.startDate) {
			throw new Error("End date must be after the start date");
		}

		const now = Date.now();
		return await ctx.db.insert("sprints", {
			projectId: args.projectId,
			workspaceId: args.workspaceId,
			name,
			description: args.description?.trim() || undefined,
			startDate: args.startDate,
			endDate: args.endDate,
			goal: args.goal?.trim() || undefined,
			status: "planning",
			createdBy: member._id,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		sprintId: v.id("sprints"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		startDate: v.optional(v.number()),
		endDate: v.optional(v.number()),
		goal: v.optional(v.string()),
		status: v.optional(
			v.union(
				v.literal("planning"),
				v.literal("active"),
				v.literal("completed"),
				v.literal("cancelled")
			)
		),
	},
	handler: async (ctx, args) => {
		await requireSprintAccess(ctx, args.sprintId);
		const { sprintId, ...updates } = args;
		await ctx.db.patch(sprintId, { ...updates, updatedAt: Date.now() });
	},
});

export const remove = mutation({
	args: { sprintId: v.id("sprints") },
	handler: async (ctx, args) => {
		await requireSprintAccess(ctx, args.sprintId);

		const sprintIssues = await ctx.db
			.query("sprintIssues")
			.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
			.collect();

		await Promise.all(sprintIssues.map((link) => ctx.db.delete(link._id)));
		await ctx.db.delete(args.sprintId);
	},
});

// Add one or more issues to a sprint. Project / workspace are derived from the
// sprint (not trusted from the client) and each issue must belong to it.
export const addIssues = mutation({
	args: {
		sprintId: v.id("sprints"),
		issueIds: v.array(v.id("issues")),
	},
	handler: async (ctx, args) => {
		const sprint = await requireSprintAccess(ctx, args.sprintId);

		const existing = await ctx.db
			.query("sprintIssues")
			.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
			.collect();

		const alreadyIn = new Set(existing.map((link) => link.issueId));
		let order = existing.length;
		let added = 0;

		for (const issueId of args.issueIds) {
			if (alreadyIn.has(issueId)) continue;
			const issue = await ctx.db.get(issueId);
			if (!issue || issue.projectId !== sprint.projectId) continue;

			await ctx.db.insert("sprintIssues", {
				sprintId: args.sprintId,
				issueId,
				projectId: sprint.projectId,
				workspaceId: sprint.workspaceId,
				order,
				addedAt: Date.now(),
			});
			alreadyIn.add(issueId);
			order++;
			added++;
		}

		return { added };
	},
});

export const removeIssue = mutation({
	args: { sprintId: v.id("sprints"), issueId: v.id("issues") },
	handler: async (ctx, args) => {
		await requireSprintAccess(ctx, args.sprintId);

		const links = await ctx.db
			.query("sprintIssues")
			.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
			.collect();

		const target = links.find((link) => link.issueId === args.issueId);
		if (target) await ctx.db.delete(target._id);
	},
});

// Move every not-done issue from one sprint into another.
export const rolloverIncomplete = mutation({
	args: {
		fromSprintId: v.id("sprints"),
		toSprintId: v.id("sprints"),
	},
	handler: async (ctx, args) => {
		const fromSprint = await requireSprintAccess(ctx, args.fromSprintId);
		const toSprint = await requireSprintAccess(ctx, args.toSprintId);
		if (fromSprint.workspaceId !== toSprint.workspaceId) {
			throw new Error("Sprints belong to different workspaces");
		}

		const [fromLinks, toLinks] = await Promise.all([
			ctx.db
				.query("sprintIssues")
				.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.fromSprintId))
				.collect(),
			ctx.db
				.query("sprintIssues")
				.withIndex("by_sprint_id", (q) => q.eq("sprintId", args.toSprintId))
				.collect(),
		]);

		const targetIssueIds = new Set(toLinks.map((link) => link.issueId));
		let order = toLinks.length;
		let rolledOver = 0;

		for (const link of fromLinks) {
			if (targetIssueIds.has(link.issueId)) continue;
			const issue = await ctx.db.get(link.issueId);
			if (!issue) continue;
			const status = await ctx.db.get(issue.statusId);
			if (isDoneStatusName(status?.name)) continue;

			await ctx.db.insert("sprintIssues", {
				sprintId: args.toSprintId,
				issueId: link.issueId,
				projectId: toSprint.projectId,
				workspaceId: toSprint.workspaceId,
				order,
				addedAt: Date.now(),
			});
			targetIssueIds.add(link.issueId);
			order++;
			rolledOver++;
		}

		return { rolledOver };
	},
});
