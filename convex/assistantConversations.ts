import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { formatPendingTaskDraftConfirmation } from "./assistant/taskDrafts";

const TASK_PRIORITY_VALIDATOR = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high")
);

const pendingTaskDraftValidator = v.object({
	title: v.string(),
	description: v.optional(v.string()),
	dueDate: v.optional(v.number()),
	priority: v.optional(TASK_PRIORITY_VALIDATOR),
	updatedAt: v.number(),
});

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

export const getByWorkspaceAndUser = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
	},
});

export const getByConversationId = query({
	args: {
		conversationId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_conversation_id", (q) =>
				q.eq("conversationId", args.conversationId)
			)
			.unique();
	},
});

export const upsertConversation = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		conversationId: v.string(),
		lastMessageAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				conversationId: args.conversationId,
				lastMessageAt: args.lastMessageAt,
			});
			return existing._id;
		}

		return await ctx.db.insert("assistantConversations", {
			workspaceId: args.workspaceId,
			userId: args.userId,
			conversationId: args.conversationId,
			lastMessageAt: args.lastMessageAt,
		});
	},
});

export const savePendingTaskDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		title: v.string(),
		description: v.optional(v.string()),
		dueDate: v.optional(v.number()),
		priority: v.optional(TASK_PRIORITY_VALIDATOR),
	},
	returns: v.object({
		draft: pendingTaskDraftValidator,
		confirmationMessage: v.string(),
	}),
	handler: async (ctx, args) => {
		const member = await getMember(ctx, args.workspaceId, args.userId);
		if (!member) {
			throw new Error("Not a member of this workspace");
		}

		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		if (!existing) {
			throw new Error("Assistant conversation not found");
		}

		const draft = {
			title: args.title.trim(),
			description: args.description?.trim() || undefined,
			dueDate: args.dueDate,
			priority: args.priority,
			updatedAt: Date.now(),
		};

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: draft,
			lastMessageAt: Date.now(),
		});

		return {
			draft,
			confirmationMessage: formatPendingTaskDraftConfirmation(draft),
		};
	},
});

export const clearPendingTaskDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		if (!existing) {
			return false;
		}

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: undefined,
			lastMessageAt: Date.now(),
		});
		return true;
	},
});

export const createTaskFromPendingDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		taskId: v.id("tasks"),
		title: v.string(),
	}),
	handler: async (ctx, args) => {
		const member = await getMember(ctx, args.workspaceId, args.userId);
		if (!member) {
			throw new Error("Not a member of this workspace");
		}

		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		const draft = existing?.pendingTaskDraft;
		if (!existing || !draft) {
			throw new Error("No pending task draft to create");
		}

		const now = Date.now();
		const taskId = await ctx.db.insert("tasks", {
			title: draft.title,
			description: draft.description,
			completed: false,
			status: "not_started",
			dueDate: draft.dueDate,
			priority: draft.priority,
			tags: [],
			createdAt: now,
			updatedAt: now,
			userId: args.userId,
			workspaceId: args.workspaceId,
		});

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: undefined,
			lastMessageAt: now,
		});

		await ctx.scheduler.runAfter(0, internal.usageTracking.recordTaskCreated, {
			userId: args.userId,
			workspaceId: args.workspaceId,
		});
		await ctx.scheduler.runAfter(0, api.ragchat.autoIndexTask, {
			taskId,
		});

		return {
			taskId,
			title: draft.title,
		};
	},
});

export const getMyConversation = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();
	},
});
