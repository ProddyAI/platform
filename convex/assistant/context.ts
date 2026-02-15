/**
 * Thread-based context for the assistant: recent tool usage and workspace/user.
 * Used to enrich the system prompt so the agent has continuity.
 */

import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";

export const getThreadContext = query({
	args: { threadId: v.string() },
	returns: v.union(
		v.null(),
		v.object({
			workspaceId: v.id("workspaces"),
			userId: v.id("users"),
			recentTools: v.array(
				v.object({
					toolName: v.string(),
					outcome: v.union(v.literal("success"), v.literal("error")),
				})
			),
		})
	),
	handler: async (ctx, args) => {
		const row = await ctx.db
			.query("assistantConversations")
			.withIndex("by_conversation_id", (q) =>
				q.eq("conversationId", args.threadId)
			)
			.unique();
		if (!row) return null;

		const recent = await ctx.db
			.query("assistantToolAuditEvents")
			.withIndex("by_workspace_id_timestamp", (q) =>
				q.eq("workspaceId", row.workspaceId)
			)
			.order("desc")
			.take(20);
		const forUser = recent.filter((e) => e.userId === row.userId);
		const recentTools = forUser.slice(0, 10).map((e) => ({
			toolName: e.toolName,
			outcome: e.outcome,
		}));

		return {
			workspaceId: row.workspaceId,
			userId: row.userId,
			recentTools,
		};
	},
});

/** Build a short system-prompt addition from thread context (recent tools). */
export function buildThreadContextPrompt(context: {
	recentTools: Array<{ toolName: string; outcome: string }>;
}): string {
	if (!context.recentTools.length) return "";
	const lines = context.recentTools.map(
		(t) => `- ${t.toolName}: ${t.outcome}`
	);
	return `\nRecent tools used in this conversation:\n${lines.join("\n")}`;
}
