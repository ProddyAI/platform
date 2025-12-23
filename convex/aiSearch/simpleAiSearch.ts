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

function extractText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed.ops) {
      return parsed.ops
        .map((op: { insert?: unknown }) =>
          typeof op.insert === "string" ? op.insert : ""
        )
        .join("")
        .trim();
    }
  } catch {}
  return body;
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
      api.search.getWorkspaceMessages, // ✅ CORRECT NAMESPACE
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
      .map((m: MessageDoc) => extractText(m.body))
      .join("\n");

    const result = await generateText({
      model: google("models/gemini-2.5-flash"),
      prompt: `
Answer the user's question using ONLY the messages below.
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
      sources: messages.slice(0, 5).map((m: MessageDoc) => ({
        id: m._id,
        text: extractText(m.body),
      })),
    };
  },
});
