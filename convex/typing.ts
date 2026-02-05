import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Set typing status for a user in a channel
 */
export const setTyping = mutation({
	args: {
		channelId: v.optional(v.id("channels")),
		conversationId: v.optional(v.id("conversations")),
		isTyping: v.boolean(),
	},
	handler: async (ctx, { channelId, conversationId, isTyping }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		// We'll use the history table to track typing status temporarily
		// This is ephemeral data that expires quickly
		const roomId = channelId
			? `channel-${channelId}`
			: `conversation-${conversationId}`;

		if (isTyping) {
			// Find existing typing record or create new one
			const existing = await ctx.db
				.query("history")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.filter((q) => q.eq(q.field("status"), `typing-${roomId}`))
				.first();

			if (existing) {
				// Update existing record
				await ctx.db.patch(existing._id, {
					lastSeen: Date.now(),
				});
			} else {
				// Fetch workspaceId from channel or conversation
				const workspaceId = channelId
					? (
							await ctx.db
								.query("channels")
								.filter((q) => q.eq(q.field("_id"), channelId))
								.first()
						)?.workspaceId
					: (
							await ctx.db
								.query("conversations")
								.filter((q) => q.eq(q.field("_id"), conversationId))
								.first()
						)?.workspaceId;

				if (!workspaceId) {
					throw new Error("Channel or conversation not found");
				}

				// Create new typing record
				await ctx.db.insert("history", {
					userId,
					workspaceId,
					channelId,
					status: `typing-${roomId}`,
					lastSeen: Date.now(),
				});
			}
		} else {
			// Remove typing record
			const existing = await ctx.db
				.query("history")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.filter((q) => q.eq(q.field("status"), `typing-${roomId}`))
				.first();

			if (existing) {
				await ctx.db.delete(existing._id);
			}
		}

		return { success: true };
	},
});

/**
 * Get list of users currently typing in a channel/conversation
 */
export const getTypingUsers = query({
	args: {
		channelId: v.optional(v.id("channels")),
		conversationId: v.optional(v.id("conversations")),
	},
	handler: async (ctx, { channelId, conversationId }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return [];
		}

		// Authorization check: verify user is a member
		let workspaceId;
		if (channelId) {
			const channel = await ctx.db.get(channelId);
			if (!channel) return [];
			workspaceId = channel.workspaceId;
		} else if (conversationId) {
			const conversation = await ctx.db.get(conversationId);
			if (!conversation) return [];
			workspaceId = conversation.workspaceId;
		} else {
			return [];
		}

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) {
			return [];
		}

		const roomId = channelId
			? `channel-${channelId}`
			: `conversation-${conversationId}`;

		// Get all typing records for this room using the index
		const typingRecords = await ctx.db
			.query("history")
			.withIndex("by_status", (q) => q.eq("status", `typing-${roomId}`))
			.collect();

		const now = Date.now();
		const typingUsers: Array<{
			userId: string;
			userName: string;
			userImage?: string;
		}> = [];

		for (const record of typingRecords) {
			// Only show users who have typed within the last 3 seconds
			if (now - record.lastSeen < 3000 && record.userId !== userId) {
				const user = await ctx.db.get(record.userId);
				if (user) {
					typingUsers.push({
						userId: record.userId,
						userName: user.name || "Anonymous",
						userImage: user.image,
					});
				}
			}
		}

		return typingUsers;
	},
});
