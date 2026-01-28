// Main RAG chat handler for chatbot.ts
export const handleRagChat = action({
  args: {
    message: v.string(),
    userId: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    // Placeholder: Implement RAG chat logic or route to OpenAI, etc.
    // For now, just echo the message for testing.
    return {
      response: `Echo: ${args.message}`,
      sources: [],
      actions: [],
    };
  },
});
// --- Workspace content queries (moved from search.ts) ---
export const getWorkspaceMessages = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("messages")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(limit);
  },
});

export const getWorkspaceNotes = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("notes")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(limit);
  },
});

export const getWorkspaceTasks = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("tasks")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .take(limit);
  },
});

export const getWorkspaceCards = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    // Get all channels in the workspace
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_workspace_id", (q) =>
        q.eq("workspaceId", args.workspaceId)
      )
      .collect();
    const channelIds = channels.map((c) => c._id);
    const cardsWithInfo: Array<{ card: any; list: any; channel: any }> = [];
    for (const channel of channels) {
      const lists = await ctx.db
        .query("lists")
        .withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
        .collect();
      for (const list of lists) {
        const cards = await ctx.db
          .query("cards")
          .withIndex("by_list_id", (q) => q.eq("listId", list._id))
          .take(Math.ceil(limit / channelIds.length));
        for (const card of cards) {
          cardsWithInfo.push({ card, list, channel });
          if (cardsWithInfo.length >= limit) break;
        }
        if (cardsWithInfo.length >= limit) break;
      }
      if (cardsWithInfo.length >= limit) break;
    }
    return cardsWithInfo;
  },
});
import { openai } from "@ai-sdk/openai";
import { RAG } from "@convex-dev/rag";
import { components, api } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

type FilterTypes = {
  workspaceId: string;
  contentType: string;
  channelId: string;
};

const rag = new RAG<FilterTypes>(components.rag as any, {
  filterNames: ["workspaceId", "contentType", "channelId"],
  textEmbeddingModel: openai.embedding("text-embedding-3-small") as any,
  embeddingDimension: 1536,
});

const NO_CHANNEL_FILTER_VALUE = "__none__";

function extractTextFromRichText(body: string): string {
  if (typeof body !== "string") {
    return String(body);
  }
  try {
    const parsedBody = JSON.parse(body);
    if (parsedBody.ops) {
      return parsedBody.ops
        .map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
        .join("")
        .trim();
    }
  } catch (_e) {
    return body.replace(/<[^>]*>/g, "").trim();
  }
  return body.trim();
}

export const indexContent = action({
  args: {
    workspaceId: v.id("workspaces"),
    contentId: v.string(),
    contentType: v.union(
      v.literal("message"),
      v.literal("task"),
      v.literal("note"),
      v.literal("card")
    ),
    text: v.string(),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    if (!args.text || args.text.trim().length < 3) return;
    if (!process.env.OPENAI_API_KEY) return;
    const channelIdFilterValue = (() => {
      const metadata = args.metadata as unknown;
      if (!metadata || typeof metadata !== "object") {
        return NO_CHANNEL_FILTER_VALUE;
      }
      const maybeChannelId = (metadata as { channelId?: unknown }).channelId;
      if (typeof maybeChannelId === "string" && maybeChannelId.length > 0) {
        return maybeChannelId;
      }
      return NO_CHANNEL_FILTER_VALUE;
    })();
    const filterValues: Array<{
      name: "workspaceId" | "contentType" | "channelId";
      value: string;
    }> = [
      { name: "workspaceId", value: args.workspaceId as string },
      { name: "contentType", value: args.contentType },
      { name: "channelId", value: channelIdFilterValue },
    ];
    await rag.add(ctx, {
      namespace: args.workspaceId,
      key: args.contentId,
      text: args.text,
      filterValues,
    });
  },
});

export const autoIndexMessage = action({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(api.messages.getById, { id: args.messageId });
    if (message) {
      await ctx.runAction(api.ragchat.indexContent, {
        workspaceId: message.workspaceId,
        contentId: message._id,
        contentType: "message",
        text: extractTextFromRichText(message.body),
        metadata: {
          channelId: message.channelId,
          memberId: message.memberId,
          conversationId: message.conversationId,
        },
      });
    }
  },
});

export const autoIndexNote = action({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const note = await ctx.runQuery(api.notes.getById, { noteId: args.noteId });
    if (note) {
      await ctx.runAction(api.ragchat.indexContent, {
        workspaceId: note.workspaceId,
        contentId: note._id,
        contentType: "note",
        text: `${note.title}: ${extractTextFromRichText(note.content)}`,
        metadata: {
          channelId: note.channelId,
          memberId: note.memberId,
        },
      });
    }
  },
});

export const getTaskForIndexing = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getCardForIndexing = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) return null;
    const list = await ctx.db.get(card.listId);
    if (!list) return null;
    const channel = await ctx.db.get(list.channelId);
    if (!channel) return null;
    return { card, list, channel };
  },
});

export const autoIndexTask = action({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.runQuery(api.ragchat.getTaskForIndexing, { taskId: args.taskId });
    if (task) {
      await ctx.runAction(api.ragchat.indexContent, {
        workspaceId: task.workspaceId,
        contentId: task._id,
        contentType: "task",
        text: task.title + (task.description ? `: ${task.description}` : ""),
        metadata: {
          userId: task.userId,
          status: task.status,
          completed: task.completed,
        },
      });
    }
  },
});

export const autoIndexCard = action({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const result = await ctx.runQuery(api.ragchat.getCardForIndexing, { cardId: args.cardId });
    if (result) {
      const { card, list, channel } = result;
      await ctx.runAction(api.ragchat.indexContent, {
        workspaceId: channel.workspaceId,
        contentId: card._id,
        contentType: "card",
        text: card.title + (card.description ? `: ${card.description}` : ""),
        metadata: {
          listId: card.listId,
          channelId: list.channelId,
        },
      });
    }
  },
});

export const bulkIndexWorkspace = action({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    try {
      try {
        await rag.add(ctx, {
          namespace: args.workspaceId,
          key: "__workspace_init__",
          text: "Workspace initialized for RAG search",
          title: "System: Workspace Initialization",
          metadata: {},
          filterValues: [
            { name: "workspaceId", value: args.workspaceId as string },
            { name: "contentType", value: "message" },
            { name: "channelId", value: NO_CHANNEL_FILTER_VALUE },
          ],
        });
      } catch (error) {}
      const messages: any[] = await ctx.runQuery(api.ragchat.getWorkspaceMessages, { workspaceId: args.workspaceId, limit });
      for (const message of messages) {
        try {
          await ctx.runAction(api.ragchat.indexContent, {
            workspaceId: message.workspaceId,
            contentId: message._id,
            contentType: "message",
            text: extractTextFromRichText(message.body),
            metadata: {
              channelId: message.channelId,
              memberId: message.memberId,
              conversationId: message.conversationId,
            },
          });
        } catch (error) {}
      }
      const notes: any[] = await ctx.runQuery(api.ragchat.getWorkspaceNotes, { workspaceId: args.workspaceId, limit });
      for (const note of notes) {
        try {
          await ctx.runAction(api.ragchat.indexContent, {
            workspaceId: note.workspaceId,
            contentId: note._id,
            contentType: "note",
            text: `${note.title}: ${extractTextFromRichText(note.content)}`,
            metadata: {
              channelId: note.channelId,
              memberId: note.memberId,
            },
          });
        } catch (error) {}
      }
      const tasks: any[] = await ctx.runQuery(api.ragchat.getWorkspaceTasks, { workspaceId: args.workspaceId, limit });
      for (const task of tasks) {
        try {
          await ctx.runAction(api.ragchat.indexContent, {
            workspaceId: task.workspaceId,
            contentId: task._id,
            contentType: "task",
            text: task.title + (task.description ? `: ${task.description}` : ""),
            metadata: {
              userId: task.userId,
              status: task.status,
              completed: task.completed,
            },
          });
        } catch (error) {}
      }
      const cardsWithInfo: any[] = await ctx.runQuery(api.ragchat.getWorkspaceCards, { workspaceId: args.workspaceId, limit });
      for (const cardInfo of cardsWithInfo) {
        try {
          const { card, list, channel } = cardInfo;
          await ctx.runAction(api.ragchat.indexContent, {
            workspaceId: channel.workspaceId,
            contentId: card._id,
            contentType: "card",
            text: card.title + (card.description ? `: ${card.description}` : ""),
            metadata: {
              listId: card.listId,
              channelId: list.channelId,
            },
          });
        } catch (error) {}
      }
      return { success: true, indexed: { messages: messages.length, notes: notes.length, tasks: tasks.length, cards: cardsWithInfo.length } };
    } catch (error) { throw error; }
  },
});

export const triggerBulkIndexing = mutation({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const member = await ctx.db
      .query("members")
      .withIndex("by_workspace_id_user_id", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", userId)
      )
      .first();
    if (!member) throw new Error("User is not a member of this workspace");
    await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
      workspaceId: args.workspaceId,
      limit: args.limit || 1000,
    });
    return { scheduled: true };
  },
});

export const triggerBulkIndexingInternal = internalMutation({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
      workspaceId: args.workspaceId,
      limit: args.limit || 1000,
    });
    return { scheduled: true };
  },
});

export const autoInitializeWorkspace = mutation({
  args: { workspaceId: v.id("workspaces"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, api.ragchat.bulkIndexWorkspace, {
      workspaceId: args.workspaceId,
      limit: args.limit || 1000,
    });
    return { scheduled: true };
  },
});
