import { query } from "../_generated/server";
import { v } from "convex/values";

export const getWorkspaceMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    return await ctx.db
      .query("messages")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .order("desc")
      .take(limit);
  },
});
