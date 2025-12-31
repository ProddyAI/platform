// ...existing code...
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const searchMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find all channels in the workspace
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace_id", q => q.eq("workspaceId", args.workspaceId))
      .collect();
    const channelIds = channels.map(c => c._id);
    if (channelIds.length === 0) return [];
    // Search messages in those channels (no anyOf, so query each channelId)
    let results: any[] = [];
    for (const channelId of channelIds) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_channel_id", q => q.eq("channelId", channelId))
        .collect();
      results = results.concat(msgs);
    }
    // Simple text search (case-insensitive substring)
    const searchLower = args.search.toLowerCase();
    results = results.filter(m =>
      typeof m.body === "string" && m.body.toLowerCase().includes(searchLower)
    );
    if (args.limit) results = results.slice(0, args.limit);
    // Return message, channelId, and body
    return results.map(m => ({ _id: m._id, channelId: m.channelId, body: m.body }));
  },
});
