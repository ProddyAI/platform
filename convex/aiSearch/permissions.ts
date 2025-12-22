import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";

/**
 * Ensures the user is a member of the workspace.
 * Returns the memberId if valid, otherwise throws.
 */
export const assertWorkspaceMember = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx: QueryCtx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_workspace_id_user_id", q =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!member) {
      throw new Error("Access denied: user is not a member of this workspace");
    }

    return member._id;
  },
});

/**
 * Checks whether a user can access a DM conversation.
 * User must be one of the two members in the conversation.
 */
export const canAccessConversation = query({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx: QueryCtx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_workspace_id_user_id", q =>
        q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
      )
      .first();

    if (!member) return false;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return false;

    return (
      conversation.memberOneId === member._id ||
      conversation.memberTwoId === member._id
    );
  },
});
