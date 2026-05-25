import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByProject = query({
    args: { projectId: v.id("projects"), workspaceId: v.id("workspaces") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const milestones = await ctx.db
            .query("milestones")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();
        return milestones.sort((a, b) => a.order - b.order);
    },
});

export const getByWorkspace = query({
    args: { workspaceId: v.id("workspaces") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const milestones = await ctx.db
            .query("milestones")
            .withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
            .collect();
        const enriched = await Promise.all(
            milestones.map(async (m) => {
                const project = await ctx.db.get(m.projectId);
                return { ...m, project };
            })
        );
        return enriched.sort((a, b) => {
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
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        return await ctx.db.get(args.milestoneId);
    },
});

export const getMilestoneIssues = query({
    args: { milestoneId: v.id("milestones") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return [];
        const milestoneIssues = await ctx.db
            .query("milestoneIssues")
            .withIndex("by_milestone_id", (q) => q.eq("milestoneId", args.milestoneId))
            .collect();
        const issues = await Promise.all(
            milestoneIssues.map(async (mi) => {
                const issue = await ctx.db.get(mi.issueId);
                if (!issue) return null;
                const status = await ctx.db.get(issue.statusId);
                return { ...issue, status };
            })
        );
        return issues.filter(Boolean);
    },
});

export const getMilestoneStats = query({
    args: { milestoneId: v.id("milestones") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) return null;
        const milestoneIssues = await ctx.db
            .query("milestoneIssues")
            .withIndex("by_milestone_id", (q) => q.eq("milestoneId", args.milestoneId))
            .collect();
        let total = 0; let completed = 0; let inProgress = 0;
        await Promise.all(
            milestoneIssues.map(async (mi) => {
                const issue = await ctx.db.get(mi.issueId);
                if (!issue) return;
                const status = await ctx.db.get(issue.statusId);
                total++;
                const name = status?.name?.toLowerCase() ?? "";
                if (name.includes("done") || name.includes("completed") || name.includes("closed")) { completed++; }
                else if (name.includes("progress") || name.includes("review")) { inProgress++; }
            })
        );
        return { total, completed, inProgress, notStarted: total - completed - inProgress, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
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
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const member = await ctx.db
            .query("members")
            .withIndex("by_workspace_id_user_id", (q) =>
                q.eq("workspaceId", args.workspaceId).eq("userId", userId)
            )
            .unique();
        if (!member) throw new Error("Not a member");
        const existing = await ctx.db
            .query("milestones")
            .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
            .collect();
        const now = Date.now();
        return await ctx.db.insert("milestones", {
            projectId: args.projectId,
            workspaceId: args.workspaceId,
            name: args.name,
            description: args.description,
            targetDate: args.targetDate,
            color: args.color ?? "#6366f1",
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
        status: v.optional(v.union(
            v.literal("planned"),
            v.literal("in_progress"),
            v.literal("completed"),
            v.literal("archived")
        )),
        order: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const { milestoneId, ...updates } = args;
        await ctx.db.patch(milestoneId, { ...updates, updatedAt: Date.now() });
    },
});

export const remove = mutation({
    args: { milestoneId: v.id("milestones") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const milestoneIssues = await ctx.db
            .query("milestoneIssues")
            .withIndex("by_milestone_id", (q) => q.eq("milestoneId", args.milestoneId))
            .collect();
        await Promise.all(milestoneIssues.map((mi) => ctx.db.delete(mi._id)));
        await ctx.db.delete(args.milestoneId);
    },
});

export const addIssue = mutation({
    args: {
        milestoneId: v.id("milestones"),
        issueId: v.id("issues"),
        projectId: v.id("projects"),
        workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const existing = await ctx.db
            .query("milestoneIssues")
            .withIndex("by_milestone_id", (q) => q.eq("milestoneId", args.milestoneId))
            .collect();
        if (existing.find((mi) => mi.issueId === args.issueId)) return;
        await ctx.db.insert("milestoneIssues", {
            milestoneId: args.milestoneId,
            issueId: args.issueId,
            projectId: args.projectId,
            workspaceId: args.workspaceId,
            linkedAt: Date.now(),
        });
    },
});

export const removeIssue = mutation({
    args: { milestoneId: v.id("milestones"), issueId: v.id("issues") },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error("Unauthorized");
        const mi = await ctx.db
            .query("milestoneIssues")
            .withIndex("by_milestone_id", (q) => q.eq("milestoneId", args.milestoneId))
            .collect();
        const toDelete = mi.find((m) => m.issueId === args.issueId);
        if (toDelete) await ctx.db.delete(toDelete._id);
    },
});
