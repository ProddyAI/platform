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
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace_id", q => q.eq("workspaceId", args.workspaceId))
      .collect();
    const channelIds = channels.map(c => c._id);
    if (channelIds.length === 0) return [];
    let results: any[] = [];
    for (const channelId of channelIds) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_channel_id", q => q.eq("channelId", channelId))
        .collect();
      results = results.concat(msgs);
    }
    function extractText(body: any): string {
      if (typeof body === "string") {
        try {
          const parsed = JSON.parse(body);
          if (parsed && Array.isArray(parsed.ops)) {
            return parsed.ops.map((op: any) => typeof op.insert === "string" ? op.insert : "").join("");
          }
          return body;
        } catch {
          return body;
        }
      }
      if (body && Array.isArray(body.ops)) {
        return body.ops.map((op: any) => typeof op.insert === "string" ? op.insert : "").join("");
      }
      return "";
    }
    const searchLower = args.search.toLowerCase();
    results = results.filter(m => {
      const text = extractText(m.body);
      return text.toLowerCase().includes(searchLower);
    });
    if (args.limit) results = results.slice(0, args.limit);
    return results.map(m => ({ _id: m._id, channelId: m.channelId, text: extractText(m.body) }));
  },
});
