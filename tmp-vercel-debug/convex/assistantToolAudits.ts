import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { sanitizeAuditPayload } from "../src/lib/assistant-tool-audit";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

type ToolAuditOutcome = "success" | "error";

async function getCurrentMember(
	ctx: { db: any },
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
) {
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q: any) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();
}

const auditArgs = {
	workspaceId: v.id("workspaces"),
	memberId: v.optional(v.id("members")),
	userId: v.optional(v.id("users")),
	toolName: v.string(),
	toolkit: v.optional(v.string()),
	argumentsSnapshot: v.optional(v.any()),
	outcome: v.union(v.literal("success"), v.literal("error")),
	error: v.optional(v.string()),
	executionPath: v.string(),
	toolCallId: v.optional(v.string()),
	timestamp: v.optional(v.number()),
};

function normalizeOutcome(value: ToolAuditOutcome): ToolAuditOutcome {
	return value === "error" ? "error" : "success";
}

async function insertAuditEvent(
	ctx: { db: any },
	args: {
		workspaceId: Id<"workspaces">;
		memberId?: Id<"members">;
		userId?: Id<"users">;
		toolName: string;
		toolkit?: string;
		argumentsSnapshot?: unknown;
		outcome: ToolAuditOutcome;
		error?: string;
		executionPath: string;
		toolCallId?: string;
		timestamp?: number;
	}
) {
	const safeArguments = sanitizeAuditPayload(args.argumentsSnapshot);
	const safeError = sanitizeAuditPayload(args.error);

	await ctx.db.insert("assistantToolAuditEvents", {
		workspaceId: args.workspaceId,
		memberId: args.memberId,
		userId: args.userId,
		toolName: args.toolName,
		toolkit: args.toolkit,
		argumentsSnapshot: safeArguments,
		outcome: normalizeOutcome(args.outcome),
		error: typeof safeError === "string" ? safeError : undefined,
		executionPath: args.executionPath,
		toolCallId: args.toolCallId,
		timestamp: args.timestamp ?? Date.now(),
	});
}

export const logExternalToolAttemptInternal = internalMutation({
	args: auditArgs,
	handler: async (ctx, args) => {
		await insertAuditEvent(ctx, args);
	},
});

export const logExternalToolAttempt = mutation({
	args: auditArgs,
	handler: async (ctx, args) => {
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) {
			throw new Error("Unauthorized");
		}

		const member = await getCurrentMember(ctx, args.workspaceId, authUserId);
		if (!member) {
			throw new Error("Unauthorized");
		}

		await insertAuditEvent(ctx, {
			...args,
			userId: args.userId ?? authUserId,
			memberId: args.memberId ?? member._id,
		});
	},
});

export const listByWorkspace = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) {
			return [];
		}

		const member = await getCurrentMember(ctx, args.workspaceId, authUserId);
		if (!member) {
			return [];
		}

		return await ctx.db
			.query("assistantToolAuditEvents")
			.withIndex("by_workspace_id_timestamp", (q: any) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(args.limit ?? 50);
	},
});

export const listByWorkspaceAndMember = query({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) {
			return [];
		}

		const requester = await getCurrentMember(ctx, args.workspaceId, authUserId);
		if (!requester) {
			return [];
		}

		if (
			requester._id !== args.memberId &&
			requester.role !== "owner" &&
			requester.role !== "admin"
		) {
			return [];
		}

		return await ctx.db
			.query("assistantToolAuditEvents")
			.withIndex("by_workspace_id_member_id", (q: any) =>
				q.eq("workspaceId", args.workspaceId).eq("memberId", args.memberId)
			)
			.order("desc")
			.take(args.limit ?? 50);
	},
});
