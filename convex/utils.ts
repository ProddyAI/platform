import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";


export const getMember = async (
	ctx: QueryCtx,
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

export const populateUser = async (ctx: QueryCtx, userId: Id<"users">) => {
	return await ctx.db.get(userId);
};

export const populateMember = async (
	ctx: QueryCtx,
	memberId: Id<"members">
) => {
	const member = await ctx.db.get(memberId);
	if (!member) return null;

	const user = await populateUser(ctx, member.userId);
	if (!user) return null;

	return {
		...member,
		user,
	};
};

export const getChannel = async (ctx: QueryCtx, channelId: Id<"channels">) => {
	return await ctx.db.get(channelId);
};

export const getConversation = async (
	ctx: QueryCtx,
	conversationId: Id<"conversations">
) => {
	return await ctx.db.get(conversationId);
};

export const getMessage = async (ctx: QueryCtx, messageId: Id<"messages">) => {
	return await ctx.db.get(messageId);
};

export const getUserEmailFromMemberId = async (
	ctx: QueryCtx,
	memberId: Id<"members">
) => {
	try {
		const member = await ctx.db.get(memberId);
		if (!member) return null;

		const user = await ctx.db.get(member.userId);
		if (!user) return null;

		return user.email;
	} catch (error) {
		return null;
	}
};

export const getUserNameFromMemberId = async (
	ctx: QueryCtx,
	memberId: Id<"members">
) => {
	try {
		const member = await ctx.db.get(memberId);
		if (!member) return null;

		const user = await ctx.db.get(member.userId);
		if (!user) return null;

		return user.name;
	} catch (error) {
		return null;
	}
};
