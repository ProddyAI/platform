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
        limit: 20,
      }
    );

    if (messages.length === 0) {
      return {
        answer: "No messages found in this workspace.",
        sources: [],
      };
    }


    const context = messages
      .map((m: any) => m.plainText ? m.plainText : extractText(m.body))
      .join("\n");

    const result = await generateText({
      model: google("models/gemini-2.5-flash"),
      prompt: `
Answer the user's question using ONLY the messages below.
please try to summarize whatever is in the message which contains the keyword the user typed
If the messages are insufficient, say so clearly.

Question:
${args.query}

Messages:
${context}
`,
      temperature: 0.3,
      maxTokens: 300,
    });

    return {
      answer: result.text.trim(),
      sources: messages.slice(0, 5).map((m: any) => ({
        id: m._id,
        text: m.plainText ? m.plainText : extractText(m.body),
      })),
    };
  },
});
