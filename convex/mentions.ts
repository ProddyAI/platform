import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

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

// Helper function to get channel data
const getChannel = async (ctx: QueryCtx, channelId: Id<"channels">) => {
	return await ctx.db.get(channelId);
};

// Helper function to get conversation data
const getConversation = async (
	ctx: QueryCtx,
	conversationId: Id<"conversations">
) => {
	return await ctx.db.get(conversationId);
};

// Helper function to get message data
const getMessage = async (ctx: QueryCtx, messageId: Id<"messages">) => {
	return await ctx.db.get(messageId);
};

// Get all mentions for the current user in a workspace
export const getMentionsForCurrentUser = query({
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

			// Query mentions for the current member
			let mentionsQuery = ctx.db
				.query("mentions")
				.withIndex("by_workspace_id_mentioned_member_id", (q) =>
					q
						.eq("workspaceId", args.workspaceId)
						.eq("mentionedMemberId", currentMember._id)
				);

			// Filter by read status if specified
			if (args.includeRead === false) {
				mentionsQuery = ctx.db
					.query("mentions")
					.withIndex("by_workspace_id_mentioned_member_id_read", (q) =>
						q
							.eq("workspaceId", args.workspaceId)
							.eq("mentionedMemberId", currentMember._id)
							.eq("read", false)
					);
			}

			// Get mentions and sort by creation time (newest first)
			const mentions = await mentionsQuery.order("desc").collect();

			// Process mentions to include all necessary data
			const processedMentions = [];

			for (const mention of mentions) {
				// Get the member who created the mention
				const mentioner = await populateMember(ctx, mention.mentionerMemberId);
				if (!mentioner) {
					continue;
				}

				// Determine the source type and get source data
				let sourceType = "channel";
				let sourceName = "";
				let sourceId = "";
				let messageText = "";

				// Handle card assignment mentions
				if (mention.cardId) {
					sourceType = "card";
					const card = await ctx.db.get(mention.cardId);

					if (card) {
						// Get the list to find the channel
						const list = await ctx.db.get(card.listId);
						if (list && mention.channelId) {
							const channel = await getChannel(ctx, mention.channelId);
							if (channel) {
								sourceName = `${channel.name} - Board`;
								sourceId = mention.channelId;
								messageText = `You were assigned to card "${mention.cardTitle || card.title}"`;
							}
						} else {
							sourceName = "Board";
							sourceId = mention.channelId || "";
							messageText = `You were assigned to card "${mention.cardTitle || card.title}"`;
						}
					} else {
						// Card was deleted but we still have the title
						sourceName = "Board";
						sourceId = mention.channelId || "";
						messageText = `You were assigned to card "${mention.cardTitle || "Unknown"}" (deleted)`;
					}
				}
				// Handle message mentions
				else if (mention.messageId) {
					const message = await getMessage(ctx, mention.messageId);
					if (!message) continue;

					if (mention.channelId) {
						sourceType = "channel";
						const channel = await getChannel(ctx, mention.channelId);
						if (channel) {
							sourceName = channel.name;
							sourceId = channel._id;
						}
					} else if (mention.conversationId) {
						sourceType = "direct";
						const conversation = await getConversation(
							ctx,
							mention.conversationId
						);
						if (conversation) {
							// For direct messages, use the other member's name
							const otherMemberId =
								conversation.memberOneId === currentMember._id
									? conversation.memberTwoId
									: conversation.memberOneId;

							const otherMember = await populateMember(ctx, otherMemberId);
							if (otherMember?.user.name) {
								sourceName = otherMember.user.name;
								sourceId = otherMemberId;
							}
						}
					} else if (mention.parentMessageId) {
						sourceType = "thread";
						const parentMessage = await getMessage(
							ctx,
							mention.parentMessageId
						);
						if (parentMessage) {
							sourceId = parentMessage._id;
							sourceName = "Thread";
						}
					}

					// Extract a preview of the message text
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
				}

				// Create the processed mention object
				const processedMention = {
					id: mention._id,
					messageId: mention.messageId,
					cardId: mention.cardId,
					text: messageText,
					timestamp: mention.createdAt,
					read: mention.read,
					author: {
						id: mentioner._id,
						name: mentioner.user.name || "",
						image: mentioner.user.image,
					},
					source: {
						type: sourceType as "channel" | "direct" | "thread" | "card",
						id: sourceId,
						name: sourceName,
					},
				};

				// Add the processed mention to the result
				processedMentions.push(processedMention);
			}
			return processedMentions;
		} catch (error) {
			console.error("Error in getMentionsForCurrentUser:", error);
			return [];
		}
	},
});

// Mark a mention as read or unread
export const markMentionAsRead = mutation({
	args: {
		mentionId: v.id("mentions"),
		status: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const mention = await ctx.db.get(args.mentionId);
		if (!mention) {
			throw new Error("Mention not found");
		}

		// Get the current member
		const currentMember = await getMember(
			ctx,
			mention.workspaceId,
			userId as Id<"users">
		);
		if (!currentMember) {
			throw new Error("Member not found");
		}

		// Verify that the mention belongs to the current user
		if (mention.mentionedMemberId !== currentMember._id) {
			throw new Error("Unauthorized to change read status of this mention");
		}

		// If status is provided, use it; otherwise, mark as read
		const newStatus = args.status !== undefined ? args.status : true;

		// Update the mention
		await ctx.db.patch(args.mentionId, {
			read: newStatus,
		});

		return { success: true, read: newStatus };
	},
});

// Mark all mentions as read for the current user in a workspace
export const markAllMentionsAsRead = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
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

		// Get all unread mentions for the current user
		const unreadMentions = await ctx.db
			.query("mentions")
			.withIndex("by_workspace_id_mentioned_member_id_read", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("mentionedMemberId", currentMember._id)
					.eq("read", false)
			)
			.collect();

		// Update all mentions to be read
		for (const mention of unreadMentions) {
			await ctx.db.patch(mention._id, {
				read: true,
			});
		}

		return { success: true, count: unreadMentions.length };
	},
});

// Get processed mentions
export const getProcessedMentions = query({
	args: {
		workspaceId: v.id("workspaces"),
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

			// Get all mentions for the current member
			const mentions = await ctx.db
				.query("mentions")
				.withIndex("by_workspace_id_mentioned_member_id", (q) =>
					q
						.eq("workspaceId", args.workspaceId)
						.eq("mentionedMemberId", currentMember._id)
				)
				.collect();

			// Process the mentions
			const processedMentions = [];
			for (const mention of mentions) {
				// Get the member who created the mention
				const mentioner = await populateMember(ctx, mention.mentionerMemberId);
				if (!mentioner) continue;

				// Determine the source type and get source data
				let sourceType = "channel";
				let sourceName = "";
				let sourceId = "";
				let messageText = "";

				// Handle card assignment mentions
				if (mention.cardId) {
					sourceType = "card";
					const card = await ctx.db.get(mention.cardId);

					if (card) {
						// Get the list to find the channel
						const list = await ctx.db.get(card.listId);
						if (list && mention.channelId) {
							const channel = await getChannel(ctx, mention.channelId);
							if (channel) {
								sourceName = `${channel.name} - Board`;
								sourceId = mention.channelId;
								messageText = `You were assigned to card "${mention.cardTitle || card.title}"`;
							}
						} else {
							sourceName = "Board";
							sourceId = mention.channelId || "";
							messageText = `You were assigned to card "${mention.cardTitle || card.title}"`;
						}
					} else {
						// Card was deleted but we still have the title
						sourceName = "Board";
						sourceId = mention.channelId || "";
						messageText = `You were assigned to card "${mention.cardTitle || "Unknown"}" (deleted)`;
					}
				}
				// Handle message mentions
				else if (mention.messageId) {
					const message = await getMessage(ctx, mention.messageId);
					if (!message) {
						messageText = "Message not found";
					} else {
						if (mention.channelId) {
							sourceType = "channel";
							const channel = await getChannel(ctx, mention.channelId);
							if (channel) {
								sourceName = channel.name;
								sourceId = channel._id;
							}
						} else if (mention.conversationId) {
							sourceType = "direct";
							const conversation = await getConversation(
								ctx,
								mention.conversationId
							);
							if (conversation) {
								// For direct messages, use the other member's name
								const otherMemberId =
									conversation.memberOneId === currentMember._id
										? conversation.memberTwoId
										: conversation.memberOneId;

								const otherMember = await populateMember(ctx, otherMemberId);
								if (otherMember?.user.name) {
									sourceName = otherMember.user.name;
									sourceId = otherMemberId;
								}
							}
						} else if (mention.parentMessageId) {
							sourceType = "thread";
							const parentMessage = await getMessage(
								ctx,
								mention.parentMessageId
							);
							if (parentMessage) {
								sourceId = parentMessage._id;
								sourceName = "Thread";
							}
						}

						// Extract a preview of the message text
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
					}
				} else {
					// If no message or card, use a default text
					messageText = "You were mentioned";
				}

				// Create a processed mention with actual content
				const processedMention = {
					id: mention._id,
					messageId: mention.messageId,
					cardId: mention.cardId,
					text: messageText,
					timestamp: mention.createdAt,
					read: mention.read,
					author: {
						id: mentioner._id,
						userId: mentioner.userId,
						name: mentioner.user.name || "",
						image: mentioner.user.image,
					},
					source: {
						type: sourceType as "channel" | "direct" | "thread" | "card",
						id: sourceId || mention.channelId || "",
						name: sourceName || "Channel",
					},
				};

				processedMentions.push(processedMention);
			}

			return processedMentions;
		} catch (_error) {
			return [];
		}
	},
});

// Get all mentions in the workspace
export const getAllMentions = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				return [];
			}

			// Get all mentions for the workspace
			const mentions = await ctx.db
				.query("mentions")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect();

			return mentions;
		} catch (_error) {
			return [];
		}
	},
});

// NOTE: Email functions have been moved to convex/email.ts

// Helper query to get a mention by ID (for internal use)
export const _getMentionById = query({
	args: {
		mentionId: v.id("mentions"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.mentionId);
	},
});
