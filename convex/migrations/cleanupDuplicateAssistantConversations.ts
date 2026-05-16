import { internalMutation } from "../_generated/server";

/**
 * One-time migration to clean up duplicate assistantConversations entries.
 * Keeps the most recent conversation for each workspaceId + userId combination
 * and deletes older duplicates.
 * 
 * Run this manually via: npx convex run migrations/cleanupDuplicateAssistantConversations:cleanup
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allConversations = await ctx.db
      .query("assistantConversations")
      .collect();

    // Group by workspaceId + userId
    const grouped = new Map<string, typeof allConversations>();
    
    for (const conv of allConversations) {
      const key = `${conv.workspaceId}:${conv.userId}`;
      const existing = grouped.get(key) || [];
      existing.push(conv);
      grouped.set(key, existing);
    }

    let duplicatesFound = 0;
    let duplicatesDeleted = 0;

    // For each group with duplicates, keep the most recent one
    for (const [key, conversations] of grouped.entries()) {
      if (conversations.length > 1) {
        duplicatesFound += conversations.length - 1;
        
        // Sort by lastMessageAt descending (most recent first)
        conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        
        // Keep the first (most recent), delete the rest
        const toKeep = conversations[0];
        const toDelete = conversations.slice(1);
        
        console.log(`Found ${conversations.length} duplicates for ${key}, keeping conversation ${toKeep._id}`);
        
        for (const conv of toDelete) {
          await ctx.db.delete(conv._id);
          duplicatesDeleted++;
          console.log(`  Deleted duplicate: ${conv._id}`);
        }
      }
    }

    return {
      totalConversations: allConversations.length,
      duplicatesFound,
      duplicatesDeleted,
      uniqueConversationsRemaining: grouped.size,
    };
  },
});

