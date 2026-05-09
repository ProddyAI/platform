import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	formatPendingTaskDraftConfirmation,
	mergePendingTaskDraftUpdate,
} from "./assistant/taskDrafts";
import { canAssignTaskToMember } from "./assistant/taskAssignment";

const TASK_PRIORITY_VALIDATOR = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high")
);

const getMember = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
) => {
	return await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();
};

const wasMemberInvitedByCurrentMember = async (
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	currentMemberId: Id<"members">,
	targetUserId: Id<"users">
) => {
	const targetUser = await ctx.db.get(targetUserId);
	const email = targetUser?.email?.trim().toLowerCase();
	if (!email) return false;

	const invites = await ctx.db
		.query("workspaceInvites")
		.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	return invites.some(
		(invite) =>
			invite.invitedBy === currentMemberId &&
			invite.used &&
			invite.email.trim().toLowerCase() === email
	);
};

export const getByWorkspaceAndUser = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
	},
});

export const getByConversationId = query({
	args: {
		conversationId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_conversation_id", (q) =>
				q.eq("conversationId", args.conversationId)
			)
			.unique();
	},
});

export const upsertConversation = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		conversationId: v.string(),
		lastMessageAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				conversationId: args.conversationId,
				lastMessageAt: args.lastMessageAt,
			});
			return existing._id;
		}

		return await ctx.db.insert("assistantConversations", {
			workspaceId: args.workspaceId,
			userId: args.userId,
			conversationId: args.conversationId,
			lastMessageAt: args.lastMessageAt,
		});
	},
});

export const savePendingTaskDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		assigneeMemberId: v.optional(v.id("members")),
		dueDate: v.optional(v.number()),
		priority: v.optional(TASK_PRIORITY_VALIDATOR),
	},
	handler: async (ctx, args) => {
		const member = await getMember(ctx, args.workspaceId, args.userId);
		if (!member) {
			throw new Error("Not a member of this workspace");
		}

		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		if (!existing) {
			throw new Error("Assistant conversation not found");
		}

		let assigneeMemberId: Id<"members"> | undefined;
		let assigneeUserId: Id<"users"> | undefined;
		let assigneeName: string | undefined;

		if (args.assigneeMemberId) {
			const assigneeMember = await ctx.db.get(args.assigneeMemberId);
			if (!assigneeMember || assigneeMember.workspaceId !== args.workspaceId) {
				throw new Error(
					"Tasks can only be assigned to accepted workspace members."
				);
			}

			const targetWasInvitedByCurrentMember = await wasMemberInvitedByCurrentMember(
				ctx,
				args.workspaceId,
				member._id,
				assigneeMember.userId
			);
			const canAssign = canAssignTaskToMember({
				currentMemberId: member._id,
				currentRole: member.role,
				targetMemberId: assigneeMember._id,
				targetWasInvitedByCurrentMember,
			});

			if (!canAssign) {
				if (
					assigneeMember.role === "owner" &&
					member.role !== "owner" &&
					member.role !== "admin"
				) {
					throw new Error(
						"Members cannot assign tasks directly to the workspace owner."
					);
				}

				throw new Error(
					"Only owners, admins, or the original inviter can assign tasks to this member."
				);
			}

			const assigneeUser = await ctx.db.get(assigneeMember.userId);
			assigneeMemberId = assigneeMember._id;
			assigneeUserId = assigneeMember.userId;
			assigneeName =
				assigneeUser?.name?.trim() ||
				assigneeUser?.email?.trim() ||
				"Assigned member";
		}

		const draft = mergePendingTaskDraftUpdate(
			existing.pendingTaskDraft,
			{
				title: args.title,
				description: args.description,
				assigneeMemberId,
				assigneeUserId,
				assigneeName,
				dueDate: args.dueDate,
				priority: args.priority,
			},
			Date.now()
		);

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: draft,
			lastMessageAt: Date.now(),
		});

		return {
			draft,
			confirmationMessage: formatPendingTaskDraftConfirmation(draft),
		};
	},
});

export const clearPendingTaskDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.boolean(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		if (!existing) {
			return false;
		}

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: undefined,
			lastMessageAt: Date.now(),
		});
		return true;
	},
});

export const createTaskFromPendingDraft = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.object({
		taskId: v.id("tasks"),
		title: v.string(),
		assigneeName: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const member = await getMember(ctx, args.workspaceId, args.userId);
		if (!member) {
			throw new Error("Not a member of this workspace");
		}

		const existing = await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
		const draft = existing?.pendingTaskDraft;
		if (!existing || !draft) {
			throw new Error("No pending task draft to create");
		}

		let assigneeUserId = args.userId;
		if (draft.assigneeMemberId) {
			const assigneeMember = await ctx.db.get(draft.assigneeMemberId);
			if (!assigneeMember || assigneeMember.workspaceId !== args.workspaceId) {
				throw new Error(
					"The selected assignee is no longer an active member of this workspace."
				);
			}
			assigneeUserId = assigneeMember.userId;
		} else if (draft.assigneeUserId) {
			assigneeUserId = draft.assigneeUserId;
		}

		const now = Date.now();
		const taskId = await ctx.db.insert("tasks", {
			title: draft.title,
			description: draft.description,
			completed: false,
			status: "not_started",
			dueDate: draft.dueDate,
			priority: draft.priority,
			tags: [],
			createdAt: now,
			updatedAt: now,
			userId: assigneeUserId,
			workspaceId: args.workspaceId,
		});

		await ctx.db.patch(existing._id, {
			pendingTaskDraft: undefined,
			lastMessageAt: now,
		});

		await ctx.scheduler.runAfter(0, internal.usageTracking.recordTaskCreated, {
			userId: assigneeUserId,
			workspaceId: args.workspaceId,
		});
		await ctx.scheduler.runAfter(0, api.ragchat.autoIndexTask, {
			taskId,
		});

		return {
			taskId,
			title: draft.title,
			assigneeName: draft.assigneeName,
		};
	},
});

export const getMyConversation = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		return await ctx.db
			.query("assistantConversations")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();
	},
});
