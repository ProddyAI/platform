import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/**
 * One-time migration to clean up duplicate assistantConversations entries.
 * Keeps the most recent conversation for each workspaceId + userId combination
 * and deletes older duplicates.
 *
 * Processes in bounded batches to stay within Convex transaction limits.
 *
 * Run via: npx convex run migrations/cleanupDuplicateAssistantConversations:cleanup
 */

const BATCH_SIZE = 100;

export const cleanup = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    totalProcessed: v.optional(v.number()),
    totalDeleted: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cursor = args.cursor ?? null;
    const totalProcessed = args.totalProcessed ?? 0;
    const totalDeleted = args.totalDeleted ?? 0;

    // Fetch one bounded page of conversations
    const page = await ctx.db
      .query("assistantConversations")
      .paginate({ cursor, numItems: BATCH_SIZE });

    // Group this page by workspaceId + userId
    const grouped = new Map<string, typeof page.page>();

    for (const conv of page.page) {
      const key = `${conv.workspaceId}:${conv.userId}`;
      const existing = grouped.get(key) ?? [];
      existing.push(conv);
      grouped.set(key, existing);
    }

    // Within this batch, delete all but the most recent per key
    let batchDeleted = 0;
    for (const conversations of grouped.values()) {
      if (conversations.length > 1) {
        conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        const toDelete = conversations.slice(1);
        for (const conv of toDelete) {
          await ctx.db.delete(conv._id);
          batchDeleted++;
          console.log(`  Deleted duplicate: ${conv._id}`);
        }
      }
    }

    const newTotalProcessed = totalProcessed + page.page.length;
    const newTotalDeleted = totalDeleted + batchDeleted;

    console.log(
      `[cleanupDuplicates] batch done — processed ${page.page.length}, deleted ${batchDeleted}. ` +
      `Running totals: processed=${newTotalProcessed}, deleted=${newTotalDeleted}, isDone=${page.isDone}`
    );

    if (!page.isDone) {
      // Schedule the next batch as a separate transaction
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.cleanupDuplicateAssistantConversations.cleanup,
        {
          cursor: page.continueCursor,
          totalProcessed: newTotalProcessed,
          totalDeleted: newTotalDeleted,
        }
      );
    }

    return {
      isDone: page.isDone,
      totalProcessed: newTotalProcessed,
      totalDeleted: newTotalDeleted,
    };
  },
});
