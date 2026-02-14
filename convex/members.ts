import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
	internalQuery,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

export const _getMemberById = internalQuery({
	args: {
		id: v.id("members"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const _getByWorkspaceAndUser = internalQuery({
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

const populateUser = (ctx: QueryCtx, id: Id<"users">) => {
	return ctx.db.get(id);
};

// Helper query to get a member by ID with user info
export const getMemberById = query({
	args: {
		memberId: v.id("members"),
	},
	handler: async (ctx, args) => {
		const member = await ctx.db.get(args.memberId);
		if (!member) return null;

		const user = await populateUser(ctx, member.userId);
		if (!user) return null;

		return {
			...member,
			user,
		};
	},
});

export const getById = query({
	args: {
		id: v.id("members"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const member = await ctx.db.get(args.id);

		if (!member) return null;

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", member.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!currentMember) return null;

		const user = await populateUser(ctx, member.userId);

		if (!user) return null;

		return {
			...member,
			user,
		};
	},
});

export const get = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return [];

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) return [];

		const data = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const members = [];

		for (const member of data) {
			const user = await populateUser(ctx, member.userId);

			if (user) {
				members.push({
					...member,
					user,
				});
			}
		}

		return members;
	},
});

export const current = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) return null;

		return member;
	},
});

export const update = mutation({
	args: {
		id: v.id("members"),
		role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db.get(args.id);

		if (!member) throw new Error("Member not found.");

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", member.workspaceId).eq("userId", userId)
			)
			.unique();

		// Check permissions based on role hierarchy
		if (!currentMember) throw new Error("Unauthorized.");

		// Only owners can promote to owner
		if (args.role === "owner" && currentMember.role !== "owner") {
			throw new Error("Only owners can promote members to owner role.");
		}

		// Only owners and admins can promote to admin
		if (
			args.role === "admin" &&
			currentMember.role !== "owner" &&
			currentMember.role !== "admin"
		) {
			throw new Error(
				"Only owners and admins can promote members to admin role."
			);
		}

		// Owners cannot be demoted by non-owners
		if (member.role === "owner" && currentMember.role !== "owner") {
			throw new Error("Owners cannot be demoted by non-owners.");
		}

		await ctx.db.patch(args.id, {
			role: args.role,
		});

		return args.id;
	},
});

export const remove = mutation({
	args: {
		id: v.id("members"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db.get(args.id);

		if (!member) throw new Error("Member not found.");

		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", member.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!currentMember) throw new Error("Unauthorized.");

		// Only owners can remove owners and admins
		if (
			(member.role === "owner" || member.role === "admin") &&
			currentMember.role !== "owner"
		) {
			throw new Error("Only owners can remove owners and admins.");
		}

		// Owners cannot be removed
		if (member.role === "owner") throw new Error("Owners cannot be removed.");

		// Admins can only remove members
		if (currentMember.role === "admin" && member.role !== "member") {
			throw new Error("Admins can only remove members.");
		}

		// Cannot remove self if admin or owner
		if (
			currentMember._id === args.id &&
			(currentMember.role === "admin" || currentMember.role === "owner")
		) {
			throw new Error("Cannot remove self if admin or owner.");
		}

		const [messages, reactions, conversations] = await Promise.all([
			ctx.db
				.query("messages")
				.withIndex("by_member_id", (q) => q.eq("memberId", member._id))
				.collect(),
			ctx.db
				.query("reactions")
				.withIndex("by_member_id", (q) => q.eq("memberId", member._id))
				.collect(),
			ctx.db
				.query("conversations")
				.filter((q) =>
					q.or(
						q.eq(q.field("memberOneId"), member._id),
						q.eq(q.field("memberTwoId"), member._id)
					)
				)
				.collect(),
		]);

		for (const message of messages) await ctx.db.delete(message._id);

		for (const reaction of reactions) await ctx.db.delete(reaction._id);

		for (const conversation of conversations)
			await ctx.db.delete(conversation._id);

		await ctx.db.delete(args.id);

		return args.id;
	},
});
