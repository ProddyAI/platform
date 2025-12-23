import { query } from "../_generated/server";
import { v } from "convex/values";

export const devSearchMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_workspace_id", q =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(5);
  },
});