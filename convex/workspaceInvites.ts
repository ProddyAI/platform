import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const getWorkspaceJoinCodeForInviteVerification = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		// Require authentication (but not membership) for invite verification
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized. User must be authenticated.");
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}
		return workspace.joinCode;
	},
});

export const consumeInvite = mutation({
	args: {
		inviteId: v.id("workspaceInvites"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
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
				q.eq("workspaceId", invite.workspaceId).eq("userId", args.userId)
			)
			.unique();

		if (existingMember) {
			return { success: true, message: "User already a member" };
		}

		await ctx.db.insert("members", {
			workspaceId: invite.workspaceId,
			userId: args.userId,
			role: "member",
		});

		return { success: true };
	},
});
