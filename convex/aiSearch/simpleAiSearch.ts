import { action } from "../_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

type MessageDoc = {
  _id: Id<"messages">;
  body: string;
};

function extractText(body: any): string {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (parsed && Array.isArray(parsed.ops)) {
        return parsed.ops.map((op: any) => typeof op.insert === "string" ? op.insert : "").join("").trim();
      }
      return body;
    } catch {
      return body;
    }
  }
  if (body && Array.isArray(body.ops)) {
    return body.ops.map((op: any) => typeof op.insert === "string" ? op.insert : "").join("").trim();
  }
  return "";
}

export const simpleAiSearch = action({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
  },

  handler: async (
    ctx,
    args
  ): Promise<{
    answer: string;
    sources: { id: Id<"messages">; text: string }[];
  }> => {
    const messages: MessageDoc[] = await ctx.runQuery(
      api.search.getWorkspaceMessages, 
      {
        workspaceId: args.workspaceId,
        limit: 50, // Fetch more to filter from
      }
    );

    if (messages.length === 0) {
      return {
        answer: "No messages found in this workspace.",
        sources: [],
      };
    }

    // Filter messages that contain query keywords
    const queryWords = args.query.toLowerCase().split(/\s+/);
    const relevantMessages = messages
      .map((m: any) => ({
        ...m,
        text: m.plainText ? m.plainText : extractText(m.body)
      }))
      .filter(m => {
        const messageText = m.text.toLowerCase();
        // Message must contain at least one query word
        return queryWords.some(word => messageText.includes(word));
      })
      .slice(0, 5); // Limit to top 5 relevant messages

    if (relevantMessages.length === 0) {
      return {
        answer: "No messages found matching your query.",
        sources: [],
      };
    }

    const context = relevantMessages.map(m => m.text).join("\n\n");

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      maxTokens: 1000,
      prompt: `
Answer the user's question using ONLY the messages below.
Provide a concise, direct answer based on the relevant information.
If the messages don't contain enough information, say so.

Question: ${args.query}

Relevant Messages:
${context}
`,
      temperature: 0.3,
    });

    return {
      answer: result.text.trim(),
      sources: relevantMessages.slice(0, 3).map(m => ({
        id: m._id,
        text: m.text,
      })),
    };
  },
});
