import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
