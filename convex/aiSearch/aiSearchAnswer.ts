import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { EvidenceItem } from "./formatEvidence";
import { formatEvidence } from "./formatEvidence";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

/**
 * Main AI Search action that:
 * 1. Takes a natural language query
 * 2. Uses existing search functions to retrieve data
 * 3. Re-hydrates real entities from the database
 * 4. Enforces workspace membership and DM access correctly
 * 5. Summarizes results using Gemini Flash
 * 6. Returns a safe answer (no hallucination if no results)
 */
export const aiSearchAnswer = action({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    channelId: v.optional(v.id("channels")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Authenticate user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // Verify workspace membership
    await ctx.runQuery(api.aiSearch.permissions.assertWorkspaceMember, {
      userId,
      workspaceId: args.workspaceId,
    });

    const limit = args.limit ?? 10;

    // Run semantic search (with fallback handled internally)
    const searchResults = await ctx.runAction(api.search.searchAllSemantic, {
      workspaceId: args.workspaceId,
      channelId: args.channelId,
      query: args.query,
      limit: limit * 2,
    });

    if (searchResults.length === 0) {
      return {
        answer:
          "I couldn't find any relevant information for your query. Try rephrasing your question or using different keywords.",
        sources: [],
      };
    }

    const evidenceItems: EvidenceItem[] = [];

    for (const result of searchResults) {
      // STEP 5: defensive guard against invalid IDs
      if (!result._id || typeof result._id !== "string") {
        continue;
      }

      try {
        let evidence: EvidenceItem | null = null;

        switch (result.type) {
          case "message": {
            const hydratedMessage = await ctx.runQuery(
              api.aiSearch.formatEvidence.hydrateMessage,
              {
                messageId: result._id as Id<"messages">,
                workspaceId: args.workspaceId,
                userId,
              }
            );

            if (!hydratedMessage) continue;

            // Enforce DM access if needed
            if (hydratedMessage.metadata?.conversationId) {
              const hasAccess = await ctx.runQuery(
                api.aiSearch.permissions.canAccessConversation,
                {
                  userId,
                  workspaceId: args.workspaceId,
                  conversationId:
                    hydratedMessage.metadata.conversationId,
                }
              );

              if (!hasAccess) continue;
            }

            evidence = hydratedMessage;
            break;
          }

          case "task": {
            evidence = await ctx.runQuery(
              api.aiSearch.formatEvidence.hydrateTask,
              {
                taskId: result._id as Id<"tasks">,
                workspaceId: args.workspaceId,
                userId,
              }
            );
            break;
          }

          case "note": {
            evidence = await ctx.runQuery(
              api.aiSearch.formatEvidence.hydrateNote,
              {
                noteId: result._id as Id<"notes">,
                workspaceId: args.workspaceId,
                userId,
              }
            );
            break;
          }

          case "card": {
            evidence = await ctx.runQuery(
              api.aiSearch.formatEvidence.hydrateCard,
              {
                cardId: result._id as Id<"cards">,
                workspaceId: args.workspaceId,
                userId,
              }
            );
            break;
          }
        }

        if (evidence) {
          evidenceItems.push(evidence);
          if (evidenceItems.length >= limit) break;
        }
      } catch (error) {
        console.error(
          `Error hydrating ${result.type} ${result._id}:`,
          error
        );
      }
    }

    if (evidenceItems.length === 0) {
      return {
        answer:
          "I couldn't find any relevant information that you have access to for your query.",
        sources: [],
      };
    }

    const evidenceText = formatEvidence(evidenceItems);

    try {
      const answer = await generateAnswer(args.query, evidenceText);

      return {
        answer,
        sources: evidenceItems.map((item) => ({
          type: item.type,
          id: item.id,
          text:
            item.text.slice(0, 100) +
            (item.text.length > 100 ? "..." : ""),
        })),
      };
    } catch (error) {
      console.error("Gemini generation failed:", error);

      return {
        answer: `I found ${evidenceItems.length} relevant result(s):\n\n${evidenceText.slice(
          0,
          500
        )}${evidenceText.length > 500 ? "..." : ""}`,
        sources: evidenceItems.map((item) => ({
          type: item.type,
          id: item.id,
          text:
            item.text.slice(0, 100) +
            (item.text.length > 100 ? "..." : ""),
        })),
      };
    }
  },
});

/**
 * Generates a concise answer using Gemini 2.5 Flash
 * based strictly on provided evidence.
 */
async function generateAnswer(
  query: string,
  evidence: string
): Promise<string> {
  const { text } = await generateText({
    model: google("models/gemini-2.5-flash"),
    prompt: `
Answer the user's question using ONLY the evidence below.
If the evidence is insufficient, say you couldn't find enough information.

Question:
${query}

Evidence:
${evidence}
`,
    temperature: 0.3,
    maxTokens: 300,
  });

  return text.trim();
}
