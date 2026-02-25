/**
 * Monitoring: log assistant request outcomes for latency, success rate, and error categories.
 */

import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const logRequestInternal = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		conversationId: v.string(),
		outcome: v.union(v.literal("success"), v.literal("error")),
		durationMs: v.number(),
		executionPath: v.string(),
		errorCategory: v.optional(v.string()),
		timestamp: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("assistantRequestLogs", {
			workspaceId: args.workspaceId,
			userId: args.userId,
			conversationId: args.conversationId,
			outcome: args.outcome,
			durationMs: args.durationMs,
			executionPath: args.executionPath,
			errorCategory: args.errorCategory,
			timestamp: args.timestamp,
		});
	},
});

export type LogAssistantRequestParams = {
	workspaceId: Id<"workspaces">;
	userId: Id<"users">;
	conversationId: string;
	outcome: "success" | "error";
	durationMs: number;
	executionPath: string;
	errorCategory?: string;
};
