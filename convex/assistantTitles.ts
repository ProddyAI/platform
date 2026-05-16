import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { generateConversationTitle, isFillerMessage } from "./assistant/titleGeneration";

const DEFAULT_TITLES = new Set(["New Chat", "Assistant Chat"]);

function isDefaultTitle(title: string | undefined): boolean {
	return !title || DEFAULT_TITLES.has(title);
}

export const generateTitle = action({
	args: {
		conversationId: v.string(),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) return { success: false, error: "API key not configured" };

		// Authenticate server-side — never trust a client-supplied userId
		const userId = await getAuthUserId(ctx);
		if (!userId) return { success: false, error: "Not authenticated" };

		try {
			const conversation = await ctx.runQuery(
				api.assistantConversations.getByConversationId,
				{ conversationId: args.conversationId }
			);

			if (!conversation) {
				return { success: false, error: "Conversation not found" };
			}

			// Ownership check: authenticated user must own this conversation
			if (conversation.userId !== userId) {
				return { success: false, error: "Not authorized" };
			}

			// Workspace check: conversation must belong to the requested workspace
			if (conversation.workspaceId !== args.workspaceId) {
				return { success: false, error: "Workspace mismatch" };
			}

			if (
				conversation.title &&
				!isDefaultTitle(conversation.title) &&
				conversation.titleSource !== "ai_generated"
			) {
				return { success: false, error: "Conversation has a manual title" };
			}

			const messages = await ctx.runQuery(components.databaseChat.messages.list, {
				conversationId: args.conversationId,
			});

			if (!messages || messages.length === 0) {
				return { success: false, error: "No messages found" };
			}

			const title = await generateConversationTitle(
				messages.map((m) => ({ role: m.role, content: m.content })),
				apiKey
			);

			if (isDefaultTitle(title)) {
				return { success: false, error: "Not enough context to generate title" };
			}

			await ctx.runMutation(internal.assistantConversations.updateConversationTitleInternal, {
				conversationId: args.conversationId,
				title,
				titleSource: "ai_generated",
				userId,
			});

			return { success: true, title };
		} catch (error) {
			console.error("[generateTitle] Failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

export const autoGenerateTitleIfNeeded = internalAction({
	args: {
		conversationId: v.string(),
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) return;

		try {
			const conversation = await ctx.runQuery(
				api.assistantConversations.getByConversationId,
				{ conversationId: args.conversationId }
			);

			// Skip manually renamed conversations
			if (
				conversation?.title &&
				!isDefaultTitle(conversation.title) &&
				conversation.titleSource !== "ai_generated"
			) {
				return;
			}

			// Skip if a good AI title already exists
			if (
				conversation?.titleSource === "ai_generated" &&
				!isDefaultTitle(conversation?.title)
			) {
				return;
			}

			const messages = await ctx.runQuery(components.databaseChat.messages.list, {
				conversationId: args.conversationId,
			});

			if (!messages || messages.length < 2) return;
			if (!messages.some((m) => m.role === "assistant")) return;

			// After 6 messages, only proceed if still on a default title
			if (messages.length > 6 && !isDefaultTitle(conversation?.title)) return;

			// Skip filler-only conversations
			const userMessages = messages.filter((m) => m.role === "user");
			if (!userMessages.some((m) => !isFillerMessage(m.content ?? ""))) return;

			const title = await generateConversationTitle(
				messages.map((m) => ({ role: m.role, content: m.content ?? "" })),
				apiKey
			);

			if (!title || isDefaultTitle(title)) return;

			await ctx.runMutation(internal.assistantConversations.updateConversationTitleInternal, {
				conversationId: args.conversationId,
				title,
				titleSource: "ai_generated",
				userId: args.userId,
			});
		} catch (error) {
			console.error("[autoGenerateTitleIfNeeded] Failed:", error);
		}
	},
});
