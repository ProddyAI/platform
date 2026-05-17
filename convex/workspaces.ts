import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

import {
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { createDefaultCategoriesForWorkspace } from "./tasks";

const generateCode = () => {
	const code = Array.from(
		{ length: 6 },
		() => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]
	).join("");

	return code;
};

const BILLABLE_MEMBER_ROLES = new Set(["owner", "admin", "member"]);

const getWorkspaceSeatTier = (workspace: {
	plan?: string;
}): "pro" | "enterprise" | undefined => {
	if (workspace.plan === "pro" || workspace.plan === "enterprise") {
		return workspace.plan;
	}
	return undefined;
};

const getPaidSeatLimit = (workspace: {
	plan?: string;
	proSeats?: number;
	enterpriseSeats?: number;
}) => {
	if (workspace.plan === "enterprise") return workspace.enterpriseSeats ?? 0;
	if (workspace.plan === "pro") return workspace.proSeats ?? 0;
	return 0;
};

type ReadableCtx = Pick<QueryCtx | MutationCtx, "db">;
type WritableCtx = Pick<MutationCtx, "db">;

const getActiveBillableMemberCount = async (
	ctx: ReadableCtx,
	workspaceId: Id<"workspaces">
) => {
	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	return members.filter((member) => BILLABLE_MEMBER_ROLES.has(member.role))
		.length;
};

const getPendingBillableInviteCount = async (
	ctx: ReadableCtx,
	workspaceId: Id<"workspaces">
) => {
	const pendingInvites = await ctx.db
		.query("workspaceInvites")
		.withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	const now = Date.now();
	return pendingInvites.filter(
		(invite) =>
			!invite.used &&
			invite.expiresAt > now &&
			(invite.role === "admin" || invite.role === "member")
	).length;
};

const resetWorkspaceMemberSeatTiers = async (
	ctx: WritableCtx,
	workspaceId: Id<"workspaces">
) => {
	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	for (const member of members) {
		await ctx.db.patch(member._id, { seatTier: undefined });
	}
};

export const join = mutation({
	args: {
		joinCode: v.string(),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const workspace = await ctx.db.get(args.workspaceId);

		if (!workspace) throw new Error("Workspace not found.");

		if (workspace.joinCode !== args.joinCode.toLowerCase())
			throw new Error("Invalid join code.");

		const existingMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (existingMember) throw new Error("Already a member of this workspace.");

		const workspaceSeatTier = getWorkspaceSeatTier(workspace);
		if (workspaceSeatTier) {
			const activeBillable = await getActiveBillableMemberCount(
				ctx,
				workspace._id
			);
			const pendingBillable = await getPendingBillableInviteCount(
				ctx,
				workspace._id
			);
			const occupiedSeats = activeBillable + pendingBillable;
			const totalSeatsPurchased = getPaidSeatLimit(workspace);

			if (occupiedSeats >= totalSeatsPurchased) {
				throw new Error(
					`Seat limit reached for ${workspaceSeatTier}. Ask a workspace owner or admin to free a seat or add seats before joining.`
				);
			}
		}

		await ctx.db.insert("members", {
			userId,
			workspaceId: workspace._id,
			role: "member",
			seatTier: workspaceSeatTier,
		});

		const workspaceMembers = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspace._id))
			.collect();
		const recipientUserIds = workspaceMembers
			.map((m) => m.userId)
			.filter((memberUserId) => memberUserId !== userId);

		if (recipientUserIds.length > 0) {
			await ctx.scheduler.runAfter(
				0,
				internal.notifications.sendPushNotification,
				{
					userIds: recipientUserIds,
					title: "New workspace member",
					message: "Someone joined your workspace",
					notificationType: "workspaceJoin",
					data: {
						workspaceId: workspace._id,
						userId,
						type: "workspace_join",
					},
				}
			);
		}

		return workspace._id;
	},
});

export const newJoinCode = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member || (member.role !== "admin" && member.role !== "owner"))
			throw new Error("Unauthorized.");

		const joinCode = generateCode();

		await ctx.db.patch(args.workspaceId, {
			joinCode,
		});

		return args.workspaceId;
	},
});

export const create = mutation({
	args: {
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		if (args.name.length < 3 || args.name.length > 20)
			throw new Error("Invalid workspace name.");

		const joinCode = generateCode();

		const workspaceId = await ctx.db.insert("workspaces", {
			name: args.name,
			userId,
			joinCode,
		});

		await ctx.db.insert("members", {
			userId,
			workspaceId,
			role: "owner",
		});

		await ctx.db.insert("channels", {
			name: "general",
			workspaceId,
		});

		// Create default task categories for the workspace
		await createDefaultCategoriesForWorkspace(ctx, workspaceId, userId);

		return workspaceId;
	},
});

export const get = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return [];

		const members = await ctx.db
			.query("members")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.collect();

		const workspaceIds = members.map((member) => member.workspaceId);

		const workspaces = [];

		for (const workspaceId of workspaceIds) {
			const workspace = await ctx.db.get(workspaceId);

			if (workspace) {
				workspaces.push(workspace);
			}
		}

		return workspaces;
	},
});

export const getInfoById = query({
	args: { id: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.id).eq("userId", userId)
			)
			.unique();

		const workspace = await ctx.db.get(args.id);

		if (!workspace) return null;

		return {
			name: workspace?.name,
			isMember: Boolean(member),
			role: member?.role,
		};
	},
});

export const getById = query({
	args: { id: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.id).eq("userId", userId)
			)
			.unique();

		if (!member) return null;

		return await ctx.db.get(args.id);
	},
});

export const update = mutation({
	args: {
		id: v.id("workspaces"),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.id).eq("userId", userId)
			)
			.unique();

		if (!member || (member.role !== "admin" && member.role !== "owner"))
			throw new Error("Unauthorized.");

		if (args.name.length < 3 || args.name.length > 20)
			throw new Error("Invalid workspace name.");

		await ctx.db.patch(args.id, {
			name: args.name,
		});

		return args.id;
	},
});

export const remove = mutation({
	args: {
		id: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.id).eq("userId", userId)
			)
			.unique();

		// Only owners can delete workspaces
		if (!member || member.role !== "owner") throw new Error("Unauthorized.");

		const [members, channels, conversations, messages, reactions] =
			await Promise.all([
				ctx.db
					.query("members")
					.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.id))
					.collect(),
				ctx.db
					.query("channels")
					.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.id))
					.collect(),
				ctx.db
					.query("conversations")
					.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.id))
					.collect(),
				ctx.db
					.query("messages")
					.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.id))
					.collect(),
				ctx.db
					.query("reactions")
					.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.id))
					.collect(),
			]);

		for (const member of members) await ctx.db.delete(member._id);
		for (const channel of channels) await ctx.db.delete(channel._id);
		for (const conversation of conversations)
			await ctx.db.delete(conversation._id);
		for (const message of messages) await ctx.db.delete(message._id);
		for (const reaction of reactions) await ctx.db.delete(reaction._id);

		await ctx.db.delete(args.id);

		return args.id;
	},
});
// Internal query: get a workspace by ID (no auth check)
export const getWorkspaceByIdInternal = internalQuery({
	args: { id: v.id("workspaces") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const resetBillingStatus = mutation({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");
		if (workspace.userId !== userId) throw new Error("Only owner can reset");
		await ctx.db.patch(args.workspaceId, {
			plan: "free",
			subscriptionStatus: "none",
			dodoSubscriptionId: undefined,
			dodoCustomerId: undefined,
			proSeats: 0,
			enterpriseSeats: 0,
			totalPaidSeats: 0,
			cancellationAtPeriodEnd: false,
			nextBillingDate: undefined,
			currentPeriodEnd: undefined,
			scheduledCancellationDate: undefined,
		});
		await resetWorkspaceMemberSeatTiers(ctx, args.workspaceId);
		return { success: true };
	},
});

export const resetMyBilling = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");
		const workspaces = await ctx.db
			.query("workspaces")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.collect();
		for (const workspace of workspaces) {
			await ctx.db.patch(workspace._id, {
				plan: "free",
				subscriptionStatus: "none",
				dodoSubscriptionId: undefined,
				dodoCustomerId: undefined,
				proSeats: 0,
				enterpriseSeats: 0,
				totalPaidSeats: 0,
				cancellationAtPeriodEnd: false,
				nextBillingDate: undefined,
				currentPeriodEnd: undefined,
				scheduledCancellationDate: undefined,
			});
			await resetWorkspaceMemberSeatTiers(ctx, workspace._id);
		}
		return { count: workspaces.length };
	},
});
