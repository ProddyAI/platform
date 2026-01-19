import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the joinCode for a workspace
 */
export const getWorkspaceJoinCode = query({
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

/**
 * Insert a new email-based workspace invite
 */
export const insertInvite = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
		hash: v.string(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("workspaceInvites", {
			workspaceId: args.workspaceId,
			email: args.email,
			hash: args.hash,
			used: false,
			expiresAt: args.expiresAt,
		});
	},
});

/**
 * Fetch an invite by its hash
 */
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

/**
 * Consume an invite and add user to workspace
 */
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

		// Mark invite as used
		await ctx.db.patch(args.inviteId, { used: true });

		// Add user to workspace (member role)
		await ctx.db.insert("members", {
			workspaceId: invite.workspaceId,
			userId: args.userId,
			role: "member",
		});

		return { success: true };
	},
});