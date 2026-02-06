import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery, mutation, query } from "./_generated/server";

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
				const url = await ctx.storage.getUrl(sender.image as any);
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

		return await ctx.db.insert("workspaceInvites", {
			workspaceId: args.workspaceId,
			email: args.email,
			hash: args.hash,
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
		if (!user || !user.email) {
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

		await ctx.db.patch(args.inviteId, { used: true });

		const existingMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", invite.workspaceId).eq("userId", userId)
			)
			.unique();

		if (existingMember) {
			return { success: true, message: "User already a member" };
		}

		await ctx.db.insert("members", {
			workspaceId: invite.workspaceId,
			userId: userId,
			role: "member",
		});

		return { success: true };
	},
});
