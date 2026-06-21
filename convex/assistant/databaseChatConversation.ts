import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export async function getDatabaseChatConversation(
	ctx: QueryCtx | MutationCtx | ActionCtx,
	conversationId: string | null | undefined
) {
	if (!conversationId) {
		return null;
	}

	try {
		return await ctx.runQuery(components.databaseChat.conversations.get, {
			conversationId,
		});
	} catch (error) {
		console.warn(
			"[Assistant] Stored database-chat conversation ID is invalid:",
			conversationId,
			error
		);
		return null;
	}
}
