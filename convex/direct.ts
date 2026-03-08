import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

// Helper query to check if a direct message has been read by a specific member
export const _isDirectMessageRead = query({
	args: {
		messageId: v.id("messages"),
		memberId: v.id("members"),
	},
	handler: async (ctx, args) => {
		const existingRead = await ctx.db
			.query("directReads")
			.withIndex("by_message_id_member_id", (q) =>
				q.eq("messageId", args.messageId).eq("memberId", args.memberId)
			)
			.unique();

		return Boolean(existingRead);
	},
});

// Helper function to get a member by workspace and user ID
const getMember = async (
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

// Helper function to populate user data for a member
const populateUser = async (ctx: QueryCtx, userId: Id<"users">) => {
	return await ctx.db.get(userId);
};

// Helper function to populate member data
const populateMember = async (ctx: QueryCtx, memberId: Id<"members">) => {
	const member = await ctx.db.get(memberId);
	if (!member) return null;

	const user = await populateUser(ctx, member.userId);
	if (!user) return null;

	return {
		...member,
		user,
	};
};

// Helper function to get unread direct messages
const getUnreadDirectMessages = async (
	ctx: QueryCtx,
	workspaceId: Id<"workspaces">
) => {
	try {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return [];
		}

		// Get the current member
		const currentMember = await getMember(
			ctx,
			workspaceId,
			userId as Id<"users">
		);
		if (!currentMember) {
			return [];
		}

		// Find all conversations where the current member is involved
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.filter((q) =>
				q.or(
					q.eq(q.field("memberOneId"), currentMember._id),
					q.eq(q.field("memberTwoId"), currentMember._id)
				)
			)
			.collect();

		// Get the most recent direct messages from each conversation
		const directMessages = [];

		for (const conversation of conversations) {
			// Find the other member in the conversation
			const otherMemberId =
				conversation.memberOneId === currentMember._id
					? conversation.memberTwoId
					: conversation.memberOneId;

			// Get the other member's details
			const otherMember = await populateMember(ctx, otherMemberId);
			if (!otherMember) continue;

			// Get the most recent message in this conversation that was sent by the other member
			const recentMessages = await ctx.db
				.query("messages")
				.withIndex("by_conversation_id", (q) =>
					q.eq("conversationId", conversation._id)
				)
				.filter((q) => q.eq(q.field("memberId"), otherMemberId))
				.order("desc")
				.take(5);

			// Skip if no messages from the other member
			if (recentMessages.length === 0) continue;

			// Process each message
			for (const message of recentMessages) {
				// Check if this message has already been read
				const isRead = await ctx.db
					.query("directReads")
					.withIndex("by_message_id_member_id", (q) =>
						q.eq("messageId", message._id).eq("memberId", currentMember._id)
					)
					.unique();

				// Skip if the message is read
				if (isRead) continue;

				// Extract message text
				let messageText = "";
				try {
					// Try to parse as JSON (Quill Delta format)
					const parsedBody = JSON.parse(message.body);
					if (parsedBody.ops) {
						messageText = parsedBody.ops
							.map((op: any) =>
								typeof op.insert === "string" ? op.insert : ""
							)
							.join("")
							.trim();
					}
				} catch (_e) {
					// Not JSON, use as is (might contain HTML)
					messageText = message.body
						.replace(/<[^>]*>/g, "") // Remove HTML tags
						.trim();
				}

				// Create the processed direct message object
				directMessages.push({
					id: message._id,
					messageId: message._id,
					text: messageText,
					timestamp: message._creationTime,
					read: false,
					author: {
						id: otherMember._id,
						name: otherMember.user.name || "",
						image: otherMember.user.image,
					},
					source: {
						type: "direct" as "channel" | "direct" | "thread" | "card",
						id: conversation._id,
						name: otherMember.user.name || "Direct Message",
					},
				});
			}
		}

		// Sort by timestamp (newest first)
		directMessages.sort((a, b) => b.timestamp - a.timestamp);

		return directMessages;
	} catch (error) {
		console.error("Error in getUnreadDirectMessages:", error);
		return [];
	}
};

// Get direct messages received by the current user
export const getDirectMessagesForCurrentUser = query({
	args: {
		workspaceId: v.id("workspaces"),
		includeRead: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				return [];
			}

			// Get the current member
			const currentMember = await getMember(
				ctx,
				args.workspaceId,
				userId as Id<"users">
			);
			if (!currentMember) {
				return [];
			}

			// Find all conversations where the current member is involved
			const conversations = await ctx.db
				.query("conversations")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.filter((q) =>
					q.or(
						q.eq(q.field("memberOneId"), currentMember._id),
						q.eq(q.field("memberTwoId"), currentMember._id)
					)
				)
				.collect();

			// Get the most recent direct messages from each conversation
			const directMessages = [];

			for (const conversation of conversations) {
				// Find the other member in the conversation
				const otherMemberId =
					conversation.memberOneId === currentMember._id
						? conversation.memberTwoId
						: conversation.memberOneId;

				// Get the other member's details
				const otherMember = await populateMember(ctx, otherMemberId);
				if (!otherMember) continue;

				// Get the most recent message in this conversation that was sent by the other member
				const recentMessages = await ctx.db
					.query("messages")
					.withIndex("by_conversation_id", (q) =>
						q.eq("conversationId", conversation._id)
					)
					.filter((q) => q.eq(q.field("memberId"), otherMemberId))
					.order("desc")
					.take(5);

				// Skip if no messages from the other member
				if (recentMessages.length === 0) continue;

				// Process each message
				for (const message of recentMessages) {
					// Check if this message has already been read
					const isRead = await ctx.db
						.query("directReads")
						.withIndex("by_message_id_member_id", (q) =>
							q.eq("messageId", message._id).eq("memberId", currentMember._id)
						)
						.unique();

					// Skip if we're only looking for unread messages and this one is read
					if (args.includeRead === false && isRead) continue;

					// Extract message text
					let messageText = "";
					try {
						// Try to parse as JSON (Quill Delta format)
						const parsedBody = JSON.parse(message.body);
						if (parsedBody.ops) {
							messageText = parsedBody.ops
								.map((op: any) =>
									typeof op.insert === "string" ? op.insert : ""
								)
								.join("")
								.trim();
						}
					} catch (_e) {
						// Not JSON, use as is (might contain HTML)
						messageText = message.body
							.replace(/<[^>]*>/g, "") // Remove HTML tags
							.trim();
					}

					// Create the processed direct message object
					directMessages.push({
						id: message._id,
						messageId: message._id,
						text: messageText,
						timestamp: message._creationTime,
						read: Boolean(isRead), // Convert to boolean (null/undefined becomes false)
						author: {
							id: otherMember._id,
							name: otherMember.user.name || "",
							image: otherMember.user.image,
						},
						source: {
							type: "direct" as "channel" | "direct" | "thread" | "card",
							id: conversation._id,
							name: otherMember.user.name || "Direct Message",
						},
					});
				}
			}

			// Sort by timestamp (newest first)
			directMessages.sort((a, b) => b.timestamp - a.timestamp);

			return directMessages;
		} catch (error) {
			console.error("Error in getDirectMessagesForCurrentUser:", error);
			return [];
		}
	},
});

// Mark a direct message as read
export const markDirectMessageAsRead = mutation({
	args: {
		messageId: v.id("messages"),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				throw new Error("Unauthorized");
			}

			// Get the message
			const message = await ctx.db.get(args.messageId);
			if (!message) {
				throw new Error("Message not found");
			}

			// Get the current member
			const currentMember = await getMember(
				ctx,
				message.workspaceId,
				userId as Id<"users">
			);
			if (!currentMember) {
				throw new Error("Member not found");
			}

			// Check if this message is already marked as read
			const existingRead = await ctx.db
				.query("directReads")
				.withIndex("by_message_id_member_id", (q) =>
					q.eq("messageId", args.messageId).eq("memberId", currentMember._id)
				)
				.unique();

			// If already marked as read, do nothing
			if (existingRead) {
				return { success: true };
			}

			// Mark the message as read
			await ctx.db.insert("directReads", {
				messageId: args.messageId,
				memberId: currentMember._id,
				timestamp: Date.now(),
			});

			return { success: true };
		} catch (error) {
			console.error("Error in markDirectMessageAsRead:", error);
			throw error;
		}
	},
});

// Mark all direct messages as read
export const markAllDirectMessagesAsRead = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				throw new Error("Unauthorized");
			}

			// Get the current member
			const currentMember = await getMember(
				ctx,
				args.workspaceId,
				userId as Id<"users">
			);
			if (!currentMember) {
				throw new Error("Member not found");
			}

			// Find all conversations where the current member is involved
			const conversations = await ctx.db
				.query("conversations")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.filter((q) =>
					q.or(
						q.eq(q.field("memberOneId"), currentMember._id),
						q.eq(q.field("memberTwoId"), currentMember._id)
					)
				)
				.collect();

			// For each conversation, mark all messages from the other member as read
			for (const conversation of conversations) {
				// Find the other member in the conversation
				const otherMemberId =
					conversation.memberOneId === currentMember._id
						? conversation.memberTwoId
						: conversation.memberOneId;

				// Get all unread messages from the other member
				const unreadMessages = await ctx.db
					.query("messages")
					.withIndex("by_conversation_id", (q) =>
						q.eq("conversationId", conversation._id)
					)
					.filter((q) => q.eq(q.field("memberId"), otherMemberId))
					.collect();

				// Mark each message as read
				for (const message of unreadMessages) {
					// Check if already read
					const existingRead = await ctx.db
						.query("directReads")
						.withIndex("by_message_id_member_id", (q) =>
							q.eq("messageId", message._id).eq("memberId", currentMember._id)
						)
						.unique();

					// If not already read, mark it as read
					if (!existingRead) {
						await ctx.db.insert("directReads", {
							messageId: message._id,
							memberId: currentMember._id,
							timestamp: Date.now(),
						});
					}
				}
			}

			return { success: true };
		} catch (error) {
			console.error("Error in markAllDirectMessagesAsRead:", error);
			throw error;
		}
	},
});

// Get unread direct message count
export const getUnreadDirectMessageCount = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				return { total: 0 };
			}

			// Get the current member
			const currentMember = await getMember(
				ctx,
				args.workspaceId,
				userId as Id<"users">
			);
			if (!currentMember) {
				return { total: 0 };
			}

			// Get all direct messages by calling the same logic directly
			// We can't call the handler directly, so we'll duplicate the logic
			const directMessages = await getUnreadDirectMessages(
				ctx,
				args.workspaceId
			);

			return {
				total: directMessages.length,
				direct: directMessages.length,
			};
		} catch (error) {
			console.error("Error in getUnreadDirectMessageCount:", error);
			return { total: 0 };
		}
	},
});
