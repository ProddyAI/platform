import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

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
			(invite.role === "owner" ||
				invite.role === "admin" ||
				invite.role === "member")
	).length;
};

export const getInviteDetails = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!currentMember) {
			throw new Error("Unauthorized. User is not a member of this workspace.");
		}

		if (currentMember.role !== "admin" && currentMember.role !== "owner") {
			throw new Error("Unauthorized. Only admins and owners can send invites.");
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const sender = await ctx.db.get(userId);
		if (!sender) {
			throw new Error("User not found");
		}

		let senderImageUrl: string | undefined;
		if (sender.image) {
			if (sender.image.startsWith("http")) {
				senderImageUrl = sender.image;
			} else {
				const url = await ctx.storage.getUrl(sender.image as Id<"_storage">);
				senderImageUrl = url ?? undefined;
			}
		}

		return {
			workspaceName: workspace.name,
			senderName: sender.name,
			senderEmail: sender.email,
			senderImage: senderImageUrl,
		};
	},
});

export const getSeatUsage = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();
		if (!currentMember) {
			return null;
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return null;

		const paidMembers = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) =>
				q.or(
					q.eq(q.field("role"), "owner"),
					q.eq(q.field("role"), "admin"),
					q.eq(q.field("role"), "member")
				)
			)
			.collect();

		const pendingPaidInvites = await ctx.db
			.query("workspaceInvites")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.filter((q) =>
				q.and(
					q.eq(q.field("used"), false),
					q.gt(q.field("expiresAt"), Date.now()),
					q.or(
						q.eq(q.field("role"), "owner"),
						q.eq(q.field("role"), "admin"),
						q.eq(q.field("role"), "member")
					)
				)
			)
			.collect();

		return {
			proSeats: workspace.proSeats ?? 0,
			enterpriseSeats: workspace.enterpriseSeats ?? 0,
			occupiedSeats: paidMembers.length,
			pendingInvites: pendingPaidInvites.length,
			plan: workspace.plan ?? "free",
		};
	},
});

export const getWorkspaceJoinCode = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!currentMember) {
			throw new Error("Unauthorized. User is not a member of this workspace.");
		}

		if (currentMember.role !== "admin" && currentMember.role !== "owner") {
			throw new Error(
				"Unauthorized. Only admins and owners can access the join code."
			);
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}
		return workspace.joinCode;
	},
});

export const insertInvite = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
		hash: v.string(),
		expiresAt: v.number(),
		role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
		comment: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!currentMember) {
			throw new Error("Unauthorized. User is not a member of this workspace.");
		}

		if (currentMember.role !== "admin" && currentMember.role !== "owner") {
			throw new Error(
				"Unauthorized. Only admins and owners can send workspace invites."
			);
		}
		if (args.role === "owner" && currentMember.role !== "owner") {
			throw new Error("Unauthorized. Only owners can invite another owner.");
		}

		// Enforce paid seat limits. Removed members free up one occupied seat;
		// purchased seat quantity is only changed explicitly from billing.
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		const workspaceSeatTier = getWorkspaceSeatTier(workspace);
		if (workspaceSeatTier) {
			const totalSeatsPurchased = getPaidSeatLimit(workspace);
			const totalOccupied =
				(await getActiveBillableMemberCount(ctx, args.workspaceId)) +
				(await getPendingBillableInviteCount(ctx, args.workspaceId));

			if (totalOccupied >= totalSeatsPurchased) {
				throw new Error(
					`Seat limit reached for ${workspaceSeatTier}. You have ${totalSeatsPurchased} seats and all are occupied or invited. Remove a member, wait for an invite to expire, or add seats before inviting another user.`
				);
			}
		}

		const invitePlan = workspaceSeatTier;

		return await ctx.db.insert("workspaceInvites", {
			workspaceId: args.workspaceId,
			email: args.email,
			hash: args.hash,
			role: args.role,
			invitePlan,
			comment: args.comment,
			used: false,
			expiresAt: args.expiresAt,
			createdAt: Date.now(),
			invitedBy: currentMember._id,
		});
	},
});

export const getInviteByHash = query({
	args: {
		hash: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("workspaceInvites")
			.withIndex("by_hash", (q) => q.eq("hash", args.hash))
			.first();
	},
});

export const getWorkspaceJoinCodeForInviteVerification = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}
		return workspace.joinCode;
	},
});

// Helper internal queries for authorization checks
export const getMemberRole = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", args.userId)
			)
			.unique();
	},
});

export const getUserById = internalQuery({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.userId);
	},
});

export const getPendingInviteForUser = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db
			.query("workspaceInvites")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.filter((q) =>
				q.and(
					q.eq(q.field("email"), args.email),
					q.eq(q.field("used"), false),
					q.gt(q.field("expiresAt"), now)
				)
			)
			.first();
	},
});

// Server-side action for invite verification flow
// This is called from the Next.js API route after server-side authentication
export const getJoinCodeForVerification = action({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args): Promise<string | undefined> => {
		// Step 1: Verify user is authenticated (same as getWorkspaceJoinCode)
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		// Step 2: Check if user is a workspace member with admin/owner role
		const currentMember = await ctx.runQuery(
			internal.workspaceInvites.getMemberRole,
			{ workspaceId: args.workspaceId, userId }
		);

		if (
			currentMember &&
			(currentMember.role === "admin" || currentMember.role === "owner")
		) {
			// User is an admin/owner member - allow access to join code
			return await ctx.runQuery(
				internal.workspaceInvites.getWorkspaceJoinCodeForInviteVerification,
				{ workspaceId: args.workspaceId }
			);
		}

		// Step 3: If not a member, check if user has a valid pending invite
		const user = await ctx.runQuery(internal.workspaceInvites.getUserById, {
			userId,
		});
		if (!user?.email) {
			throw new Error("Unauthorized. User email not found.");
		}

		const pendingInvite = await ctx.runQuery(
			internal.workspaceInvites.getPendingInviteForUser,
			{ workspaceId: args.workspaceId, email: user.email.toLowerCase() }
		);

		if (!pendingInvite) {
			// User is neither a member with appropriate role, nor has a pending invite
			throw new Error(
				"Unauthorized. User does not have permission to access this workspace's join code."
			);
		}

		// User has a valid pending invite - allow access to join code for verification
		return await ctx.runQuery(
			internal.workspaceInvites.getWorkspaceJoinCodeForInviteVerification,
			{ workspaceId: args.workspaceId }
		);
	},
});

export const consumeInvite = mutation({
	args: {
		inviteId: v.id("workspaceInvites"),
	},
	handler: async (ctx, args) => {
		// Get userId from authenticated context instead of trusting client-supplied argument
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const invite = await ctx.db.get(args.inviteId);
		if (!invite) {
			throw new Error("Invite not found");
		}
		if (invite.used) {
			throw new Error("Invite already used");
		}
		if (invite.expiresAt < Date.now()) {
			throw new Error("Invite expired");
		}

		const existingMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", invite.workspaceId).eq("userId", userId)
			)
			.unique();

		if (existingMember) {
			await ctx.db.patch(args.inviteId, { used: true });
			return { success: true, message: "User already a member" };
		}

		const workspace = await ctx.db.get(invite.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const workspaceSeatTier = getWorkspaceSeatTier(workspace);
		const inviteRole = invite.role === "viewer" ? "member" : invite.role;
		if (
			workspaceSeatTier &&
			(inviteRole === "owner" ||
				inviteRole === "admin" ||
				inviteRole === "member")
		) {
			const totalSeatsPurchased = getPaidSeatLimit(workspace);
			const occupiedSeats = await getActiveBillableMemberCount(
				ctx,
				invite.workspaceId
			);

			if (occupiedSeats >= totalSeatsPurchased) {
				throw new Error(
					`Seat limit reached for ${workspaceSeatTier}. Ask a workspace owner or admin to free a seat or add seats before joining.`
				);
			}
		}

		await ctx.db.patch(args.inviteId, { used: true });

		await ctx.db.insert("members", {
			workspaceId: invite.workspaceId,
			userId,
			role: inviteRole ?? "member",
			seatTier:
				inviteRole === "owner" ||
				inviteRole === "admin" ||
				inviteRole === "member" ||
				inviteRole === undefined
					? workspaceSeatTier
					: undefined,
		});

		const workspaceMembers = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", invite.workspaceId)
			)
			.collect();
		const recipientUserIds = workspaceMembers
			.map((m) => m.userId)
			.filter((memberUserId) => memberUserId !== userId);

		if (recipientUserIds.length > 0) {
			await ctx.scheduler.runAfter(
				2000,
				internal.notifications.sendPushNotification,
				{
					userIds: recipientUserIds,
					title: "New workspace member",
					message: "Someone joined your workspace",
					notificationType: "workspaceJoin",
					data: {
						workspaceId: invite.workspaceId,
						userId,
						type: "workspace_join",
					},
				}
			);
		}

		return { success: true };
	},
});
