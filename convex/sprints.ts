import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByProject = query({
    args: {
        projectId: v.id("projects"),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const sprints = await ctx.db
            .query("sprints")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();
        return sprints.sort((a, b) => b.createdAt - a.createdAt);
    },
});

export const getById = query({
    args: { sprintId: v.id("sprints") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        return await ctx.db.get(args.sprintId);
    },
});

export const getActiveSprint = query({
    args: {
        projectId: v.id("projects"),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const sprints = await ctx.db
            .query("sprints")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();
        return sprints.find((s) => s.status === "active") ?? null;
    },
});

export const getSprintIssues = query({
    args: { sprintId: v.id("sprints") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];
        const sprintIssues = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
            .collect();
        const issues = await Promise.all(
            sprintIssues.map(async (si) => {
                const issue = await ctx.db.get(si.issueId);
                if (!issue) return null;
                const status = await ctx.db.get(issue.statusId);
                return { ...issue, status, sprintOrder: si.order, sprintIssueId: si._id };
            })
        );
        return issues
            .filter(Boolean)
            .sort((a, b) => (a!.sprintOrder ?? 0) - (b!.sprintOrder ?? 0));
    },
});

export const getSprintStats = query({
    args: { sprintId: v.id("sprints") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const sprintIssues = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
            .collect();
        let total = 0;
        let completed = 0;
        let inProgress = 0;
        let notStarted = 0;
        await Promise.all(
            sprintIssues.map(async (si) => {
                const issue = await ctx.db.get(si.issueId);
                if (!issue) return;
                const status = await ctx.db.get(issue.statusId);
                total++;
                const name = status?.name?.toLowerCase() ?? "";
                if (name.includes("done") || name.includes("completed") || name.includes("closed")) {
                    completed++;
                } else if (name.includes("progress") || name.includes("review")) {
                    inProgress++;
                } else {
                    notStarted++;
                }
            })
        );
        const sprint = await ctx.db.get(args.sprintId);
        const now = Date.now();
        const daysTotal = sprint
            ? Math.ceil((sprint.endDate - sprint.startDate) / (1000 * 60 * 60 * 24))
            : 0;
        const daysElapsed = sprint
            ? Math.max(0, Math.ceil((Math.min(now, sprint.endDate) - sprint.startDate) / (1000 * 60 * 60 * 24)))
            : 0;
        const daysRemaining = sprint
            ? Math.max(0, Math.ceil((sprint.endDate - now) / (1000 * 60 * 60 * 24)))
            : 0;
        return { total, completed, inProgress, notStarted, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0, daysTotal, daysElapsed, daysRemaining };
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
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const member = await ctx.db
            .query("members")
            .withIndex("by_workspace_id_user_id", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("userId", userId)
            )
            .unique();
        if (!member) throw new Error("Not a member of this workspace");
        const now = Date.now();
        return await ctx.db.insert("sprints", {
            projectId: args.projectId,
            workspaceId: args.workspaceId,
            name: args.name,
            description: args.description,
            startDate: args.startDate,
            endDate: args.endDate,
            goal: args.goal,
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
        status: v.optional(v.union(
            v.literal("planning"),
            v.literal("active"),
            v.literal("completed"),
            v.literal("cancelled")
        )),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const { sprintId, ...updates } = args;
        await ctx.db.patch(sprintId, { ...updates, updatedAt: Date.now() });
    },
});

export const remove = mutation({
    args: { sprintId: v.id("sprints") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const sprintIssues = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
            .collect();
        await Promise.all(sprintIssues.map((si) => ctx.db.delete(si._id)));
        await ctx.db.delete(args.sprintId);
    },
});

export const addIssue = mutation({
    args: {
        sprintId: v.id("sprints"),
        issueId: v.id("issues"),
        projectId: v.id("projects"),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const existing = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
            .collect();
        if (existing.find((si) => si.issueId === args.issueId)) return;
        await ctx.db.insert("sprintIssues", {
            sprintId: args.sprintId,
            issueId: args.issueId,
            projectId: args.projectId,
            workspaceId: args.workspaceId,
            order: existing.length,
            addedAt: Date.now(),
        });
    },
});

export const removeIssue = mutation({
    args: { sprintId: v.id("sprints"), issueId: v.id("issues") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const si = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.sprintId))
            .collect();
        const toDelete = si.find((s) => s.issueId === args.issueId);
        if (toDelete) await ctx.db.delete(toDelete._id);
    },
});

export const rolloverIncomplete = mutation({
    args: { fromSprintId: v.id("sprints"), toSprintId: v.id("sprints") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const sprintIssues = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.fromSprintId))
            .collect();
        const toSprint = await ctx.db.get(args.toSprintId);
        if (!toSprint) throw new Error("Target sprint not found");
        const targetIssues = await ctx.db
            .query("sprintIssues")
            .withIndex("by_sprint_id", (q) => q.eq("sprintId", args.toSprintId))
            .collect();
        let orderStart = targetIssues.length;
        const incomplete = await Promise.all(
            sprintIssues.map(async (si) => {
                const issue = await ctx.db.get(si.issueId);
                if (!issue) return null;
                const status = await ctx.db.get(issue.statusId);
                const name = status?.name?.toLowerCase() ?? "";
                const isDone = name.includes("done") || name.includes("completed") || name.includes("closed");
                return isDone ? null : si;
            })
        );
        const toRollover = incomplete.filter(Boolean) as typeof sprintIssues;
        let rolledOver = 0;
        await Promise.all(
            toRollover.map(async (si, idx) => {
                const alreadyIn = targetIssues.find((t) => t.issueId === si.issueId);
                if (alreadyIn) return;
                await ctx.db.insert("sprintIssues", {
                    sprintId: args.toSprintId,
                    issueId: si.issueId,
                    projectId: toSprint.projectId,
                    workspaceId: toSprint.workspaceId,
                    order: orderStart + idx,
                    addedAt: Date.now(),
                });
                rolledOver++;
            })
        );
        return { rolledOver };
    },
});
