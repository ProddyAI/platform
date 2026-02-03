import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

const populateThread = async (ctx: QueryCtx, messageId: Id<"messages">) => {
	const messages = await ctx.db
		.query("messages")
		.withIndex("by_parent_message_id", (q) =>
			q.eq("parentMessageId", messageId)
		)
		.collect();

	if (messages.length === 0) {
		return {
			count: 0,
			image: undefined,
			timestamp: 0,
			name: "",
		};
	}

	const lastMessage = messages[messages.length - 1];
	const lastMessageMember = await populateMember(ctx, lastMessage.memberId);

	if (!lastMessageMember) {
		return {
			count: 0,
			image: undefined,
			timestamp: 0,
			name: "",
		};
	}

	const lastMessageUser = await populateUser(ctx, lastMessageMember.userId);

	return {
		count: messages.length,
		image: lastMessageUser?.image,
		timestamp: lastMessage._creationTime,
		name: lastMessageUser?.name,
	};
};

const populateReactions = (ctx: QueryCtx, messageId: Id<"messages">) => {
	return ctx.db
		.query("reactions")
		.withIndex("by_message_id", (q) => q.eq("messageId", messageId))
		.collect();
};

const populateUser = (ctx: QueryCtx, userId: Id<"users">) => {
	return ctx.db.get(userId);
};

const populateMember = (ctx: QueryCtx, memberId: Id<"members">) => {
	return ctx.db.get(memberId);
};

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

export const get = query({
	args: {
		channelId: v.optional(v.id("channels")),
		conversationId: v.optional(v.id("conversations")),
		parentMessageId: v.optional(v.id("messages")),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		let _conversationId = args.conversationId;

		// replying in a thread in 1-1 conversation
		if (!args.conversationId && !args.channelId && args.parentMessageId) {
			const parentMessage = await ctx.db.get(args.parentMessageId);

			if (!parentMessage) throw new Error("Parent message not found.");

			_conversationId = parentMessage.conversationId;
		}

		const results = await ctx.db
			.query("messages")
			.withIndex("by_channel_id_parent_message_id_conversation_id", (q) =>
				q
					.eq("channelId", args.channelId)
					.eq("parentMessageId", args.parentMessageId)
					.eq("conversationId", _conversationId)
			)
			.order("desc")
			.paginate(args.paginationOpts);

		return {
			...results,
			page: (
				await Promise.all(
					results.page.map(async (message) => {
						const member = await populateMember(ctx, message.memberId);
						const user = member
							? await populateUser(ctx, member?.userId)
							: null;

						if (!member || !user) return null;

						const reactions = await populateReactions(ctx, message._id);
						const thread = await populateThread(ctx, message._id);
						const image = message.image
							? await ctx.storage.getUrl(message.image)
							: undefined;

						const reactionsWithCounts = reactions.map((reaction) => ({
							...reaction,
							count: reactions.filter((r) => r.value === reaction.value).length,
						}));

						const dedupedReactions = reactionsWithCounts.reduce(
							(acc, reaction) => {
								const existingReaction = acc.find(
									(r) => r.value === reaction.value
								);

								if (existingReaction) {
									existingReaction.memberIds = Array.from(
										new Set([...existingReaction.memberIds, reaction.memberId])
									);
								} else {
									acc.push({ ...reaction, memberIds: [reaction.memberId] });
								}

								return acc;
							},
							[] as (Doc<"reactions"> & {
								count: number;
								memberIds: Id<"members">[];
							})[]
						);

						const reactionsWithoutMemberIdProperty = dedupedReactions.map(
							({ memberId, ...rest }) => rest
						);

						return {
							...message,
							image,
							member,
							user,
							reactions: reactionsWithoutMemberIdProperty,
							threadCount: thread.count,
							threadImage: thread.image,
							threadName: thread.name,
							threadTimestamp: thread.timestamp,
						};
					})
				)
			).filter(
				(message): message is NonNullable<typeof message> => message !== null
			),
		};
	},
});

// Helper query to get a message by ID (for internal use)
export const _getMessageById = query({
	args: {
		messageId: v.id("messages"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.messageId);
	},
});

export const getById = query({
	args: {
		id: v.id("messages"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const message = await ctx.db.get(args.id);

		if (!message) return null;

		const currentMember = await getMember(
			ctx,
			message.workspaceId,
			userId as Id<"users">
		);

		if (!currentMember) return null;

		const member = await populateMember(ctx, message.memberId);

		if (!member) return null;

		const user = await populateUser(ctx, member.userId);

		if (!user) return null;

		const reactions = await populateReactions(ctx, message._id);

		const reactionsWithCounts = reactions.map((reaction) => ({
			...reaction,
			count: reactions.filter((r) => r.value === reaction.value).length,
		}));

		const dedupedReactions = reactionsWithCounts.reduce(
			(acc, reaction) => {
				const existingReaction = acc.find((r) => r.value === reaction.value);

				if (existingReaction) {
					existingReaction.memberIds = Array.from(
						new Set([...existingReaction.memberIds, reaction.memberId])
					);
				} else {
					acc.push({ ...reaction, memberIds: [reaction.memberId] });
				}

				return acc;
			},
			[] as (Doc<"reactions"> & {
				count: number;
				memberIds: Id<"members">[];
			})[]
		);

		const reactionsWithoutMemberIdProperty = dedupedReactions.map(
			({ memberId, ...rest }) => rest
		);

		return {
			...message,
			image: message.image
				? await ctx.storage.getUrl(message.image)
				: undefined,
			user,
			member,
			reactions: reactionsWithoutMemberIdProperty,
		};
	},
});

export const create = mutation({
	args: {
		body: v.string(),
		image: v.optional(v.id("_storage")),
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		conversationId: v.optional(v.id("conversations")),
		parentMessageId: v.optional(v.id("messages")),
		tags: v.optional(v.array(v.string())),
		calendarEvent: v.optional(
			v.object({
				date: v.number(),
				time: v.optional(v.string()),
			})
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await getMember(
			ctx,
			args.workspaceId,
			userId as Id<"users">
		);

		if (!member) throw new Error("Unauthorized.");

		let _conversationId = args.conversationId;

		// replying in a thread in 1-1 conversation
		if (!args.conversationId && !args.channelId && args.parentMessageId) {
			const parentMessage = await ctx.db.get(args.parentMessageId);

			if (!parentMessage) throw new Error("Parent message not found.");

			_conversationId = parentMessage.conversationId;
		}

		// Verify channel exists if channelId is provided
		if (args.channelId) {
			const channel = await ctx.db.get(args.channelId);
			if (!channel) {
				throw new Error("Channel not found.");
			}
		}

		const messageId = await ctx.db.insert("messages", {
			memberId: member._id,
			body: args.body,
			image: args.image,
			channelId: args.channelId,
			workspaceId: args.workspaceId,
			conversationId: _conversationId,
			parentMessageId: args.parentMessageId,
			calendarEvent: args.calendarEvent,
			tags: args.tags,
		});

		// If this is a reply to a thread, send an email notification
		if (args.parentMessageId) {
			await ctx.scheduler.runAfter(0, api.email.sendThreadReplyEmail, {
				messageId,
				parentMessageId: args.parentMessageId,
			});
		}

		// If this is a direct message, send an email notification
		if (args.conversationId) {
			await ctx.scheduler.runAfter(0, api.email.sendDirectMessageEmail, {
				messageId,
			});
		}

		// Process mentions in the message (skip for direct messages)
		// If this is a direct message (has conversationId), skip mention processing
		if (args.conversationId) {
			return messageId;
		}

		try {
			// Get all members in the workspace to check for mentions
			const workspaceMembers = await ctx.db
				.query("members")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect();

			// Create a map of member ID to member for quick lookup
			const memberMap = new Map(workspaceMembers.map((m) => [m._id, m]));

			// Get all users associated with these members
			const userIds = workspaceMembers.map((m) => m.userId);
			const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));

			// Create a map of user ID to user for quick lookup
			const userMap = new Map(users.filter(Boolean).map((u) => [u?._id, u]));

			// Create a map of member ID to user name for mention detection
			const memberIdToName = new Map();
			workspaceMembers.forEach((m) => {
				const user = userMap.get(m.userId);
				if (user?.name) {
					memberIdToName.set(m._id, user.name);
				}
			});

			// Check for mentions in the message body
			const mentionedMemberIds = new Set<Id<"members">>();

			// Check for data-member-id attributes in HTML
			const memberIdRegex = /data-member-id="([^"]+)"/g;
			let match;
			while ((match = memberIdRegex.exec(args.body)) !== null) {
				const memberId = match[1] as Id<"members">;
				if (memberMap.has(memberId)) {
					mentionedMemberIds.add(memberId);
				}
			}

			// Check for @username mentions in text or Quill Delta format
			try {
				// Try to parse as JSON (Quill Delta format)
				const parsedBody = JSON.parse(args.body);
				if (parsedBody.ops) {
					for (const op of parsedBody.ops) {
						if (op.insert && typeof op.insert === "string") {
							// Check for data-member-id in HTML
							const memberIdRegex = /data-member-id="([^"]+)"/g;
							let match;
							while ((match = memberIdRegex.exec(op.insert)) !== null) {
								const memberId = match[1] as Id<"members">;
								if (memberMap.has(memberId)) {
									mentionedMemberIds.add(memberId);
								}
							}

							// Check for @username mentions
							// Use Array.from to convert Map entries to an array for compatibility
							Array.from(memberIdToName.entries()).forEach(
								([memberId, name]) => {
									if (op.insert.includes(`@${name}`)) {
										mentionedMemberIds.add(memberId);
									}
								}
							);
						}
					}
				}
			} catch (_e) {
				// Not JSON, check for @username mentions in plain text
				// Use Array.from to convert Map entries to an array for compatibility
				Array.from(memberIdToName.entries()).forEach(([memberId, name]) => {
					if (args.body.includes(`@${name}`)) {
						mentionedMemberIds.add(memberId);
					}
				});
			}

			// Create mention records for each mentioned member
			for (const mentionedMemberId of Array.from(mentionedMemberIds)) {
				// Create the mention record
				const mentionId = await ctx.db.insert("mentions", {
					messageId,
					mentionedMemberId,
					mentionerMemberId: member._id,
					workspaceId: args.workspaceId,
					channelId: args.channelId,
					conversationId: _conversationId,
					parentMessageId: args.parentMessageId,
					read: false,
					createdAt: Date.now(),
				});

				// Schedule an email notification for the mention
				await ctx.scheduler.runAfter(0, api.email.sendMentionEmail, {
					mentionId,
				});
			}
		} catch (_error) {
			// Don't throw the error, as we still want to return the message ID
			// even if mention processing fails
		}

		// Schedule RAG indexing for the new message
		await ctx.scheduler.runAfter(0, api.search.autoIndexMessage, {
			messageId,
		});

		return messageId;
	},
});

export const update = mutation({
	args: {
		id: v.id("messages"),
		body: v.string(),
		tags: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const message = await ctx.db.get(args.id);

		if (!message) throw new Error("Message not found.");

		const member = await getMember(
			ctx,
			message.workspaceId,
			userId as Id<"users">
		);

		if (!member || member._id !== message.memberId)
			throw new Error("Unauthorized.");

		const updateData: any = {
			body: args.body,
			updatedAt: Date.now(),
		};

		if (args.tags !== undefined) {
			updateData.tags = args.tags;
		}

		await ctx.db.patch(args.id, updateData);

		// Schedule RAG re-indexing for the updated message
		await ctx.scheduler.runAfter(0, api.search.autoIndexMessage, {
			messageId: args.id,
		});

		return args.id;
	},
});

export const remove = mutation({
	args: {
		id: v.id("messages"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const message = await ctx.db.get(args.id);

		if (!message) throw new Error("Message not found.");

		const member = await getMember(
			ctx,
			message.workspaceId,
			userId as Id<"users">
		);

		if (!member || member._id !== message.memberId)
			throw new Error("Unauthorized.");

		await ctx.db.delete(args.id);

		return args.id;
	},
});

export const getUserMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		const userId = identity.subject;
		const baseUserId = userId.split("|")[0];

		// Get the current member using the base user ID
		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("userId", baseUserId as Id<"users">)
			)
			.unique();

		// If no member found, return empty array
		if (!currentMember) {
			return [];
		}

		// Get all messages for the current member in this workspace
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("memberId"), currentMember._id))
			.order("desc")
			.collect();

		// Get all channels and conversations in one go
		const [channels, conversations] = await Promise.all([
			ctx.db
				.query("channels")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect(),
			ctx.db
				.query("conversations")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect(),
		]);

		// Create lookup maps for faster access
		const channelMap = new Map(
			channels.map((channel) => [channel._id, channel])
		);
		const conversationMap = new Map(
			conversations.map((conversation) => [conversation._id, conversation])
		);

		// Get all members and users in one go
		const memberIds = new Set<Id<"members">>();
		messages.forEach((message) => memberIds.add(message.memberId));
		conversations.forEach((conversation) => {
			memberIds.add(conversation.memberOneId);
			memberIds.add(conversation.memberTwoId);
		});

		const members = await Promise.all(
			Array.from(memberIds).map((id) => ctx.db.get(id))
		);
		const memberMap = new Map(
			members.filter(Boolean).map((member) => [member?._id, member])
		);

		const userIds = new Set<Id<"users">>();
		members.forEach((member) => {
			if (member?.userId) userIds.add(member.userId);
		});

		const users = await Promise.all(
			Array.from(userIds).map((id) => ctx.db.get(id))
		);
		const userMap = new Map(
			users.filter(Boolean).map((user) => [user?._id, user])
		);

		// Get channel and conversation information for each message
		const messagesWithContext = messages.map((message) => {
			let context: {
				name: string;
				type: "channel" | "conversation" | "unknown";
				id: Id<"channels"> | Id<"conversations">;
				memberId?: Id<"members">;
			} = {
				name: "Unknown",
				type: "unknown",
				id:
					message.channelId ||
					message.conversationId ||
					("" as Id<"channels"> | Id<"conversations">),
			};

			if (message.channelId) {
				const channel = channelMap.get(message.channelId);
				if (channel) {
					context = {
						name: channel.name,
						type: "channel",
						id: channel._id,
					};
				}
			} else if (message.conversationId) {
				const conversation = conversationMap.get(message.conversationId);
				if (conversation) {
					const currentMember = memberMap.get(message.memberId);
					if (currentMember) {
						const otherMemberId =
							conversation.memberOneId === currentMember._id
								? conversation.memberTwoId
								: conversation.memberOneId;
						const otherMember = memberMap.get(otherMemberId);
						if (otherMember) {
							const otherUser = userMap.get(otherMember.userId);
							if (otherUser) {
								context = {
									name: `Direct Message with ${otherUser.name}`,
									type: "conversation",
									id: conversation._id,
									memberId: otherMember._id,
								};
							}
						}
					}
				}
			}

			return {
				...message,
				context,
			};
		});

		return messagesWithContext;
	},
});

export const getAllWorkspaceMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		try {
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				throw new Error("Not authenticated");
			}

			// Get all messages in the workspace
			const allMessages = await ctx.db
				.query("messages")
				.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
				.collect();

			// Get all members in the workspace
			const members = await ctx.db
				.query("members")
				.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
				.collect();

			return {
				messages: allMessages,
				members,
			};
		} catch (error) {
			console.error("getAllWorkspaceMessages - Error:", error);
			throw error;
		}
	},
});

export const getThreadMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		const userId = identity.subject;
		const baseUserId = userId.split("|")[0];

		// Get the current member using the base user ID
		const currentMember = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("userId", baseUserId as Id<"users">)
			)
			.unique();

		// If no member found, return empty array
		if (!currentMember) {
			return [];
		}

		// Get all thread messages in the workspace
		const threadMessages = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.neq(q.field("parentMessageId"), null))
			.order("desc")
			.collect();

		// Get all parent messages in one go
		const parentMessageIds = new Set(
			threadMessages
				.map((msg) => msg.parentMessageId)
				.filter((id): id is Id<"messages"> => id !== null && id !== undefined)
		);

		if (parentMessageIds.size === 0) {
			return [];
		}

		const parentMessages = await Promise.all(
			Array.from(parentMessageIds).map((id) => ctx.db.get(id))
		);
		const parentMessageMap = new Map(
			parentMessages.filter(Boolean).map((msg) => [msg?._id, msg])
		);

		// Get all members and users in one go
		const memberIds = new Set<Id<"members">>();
		threadMessages.forEach((message) => memberIds.add(message.memberId));
		parentMessages.forEach((message) => {
			if (message?.memberId) memberIds.add(message.memberId);
		});

		const members = await Promise.all(
			Array.from(memberIds).map((id) => ctx.db.get(id))
		);
		const memberMap = new Map(
			members.filter(Boolean).map((member) => [member?._id, member])
		);

		const userIds = new Set<Id<"users">>();
		members.forEach((member) => {
			if (member?.userId) userIds.add(member.userId);
		});

		const users = await Promise.all(
			Array.from(userIds).map((id) => ctx.db.get(id))
		);
		const userMap = new Map(
			users.filter(Boolean).map((user) => [user?._id, user])
		);

		// Get all channels and conversations in one go
		const [channels, conversations] = await Promise.all([
			ctx.db
				.query("channels")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect(),
			ctx.db
				.query("conversations")
				.withIndex("by_workspace_id", (q) =>
					q.eq("workspaceId", args.workspaceId)
				)
				.collect(),
		]);

		const channelMap = new Map(
			channels.map((channel) => [channel._id, channel])
		);
		const conversationMap = new Map(
			conversations.map((conversation) => [conversation._id, conversation])
		);

		// Get thread messages with context
		const threadsWithContext = threadMessages
			.map((message) => {
				if (!message.parentMessageId) return null;

				const parentMessage = parentMessageMap.get(message.parentMessageId);
				if (!parentMessage) return null;

				const parentMember = memberMap.get(parentMessage.memberId);
				if (!parentMember) return null;

				const parentUser = userMap.get(parentMember.userId);
				if (!parentUser) return null;

				const currentMember = memberMap.get(message.memberId);
				if (!currentMember) return null;

				const currentUser = userMap.get(currentMember.userId);
				if (!currentUser) return null;

				let context: {
					name: string;
					type: "channel" | "conversation";
					id: Id<"channels"> | Id<"conversations">;
					memberId?: Id<"members">;
				} | null = null;

				if (message.channelId) {
					const channel = channelMap.get(message.channelId);
					if (channel) {
						context = {
							name: channel.name,
							type: "channel",
							id: channel._id,
						};
					}
				} else if (message.conversationId) {
					const conversation = conversationMap.get(message.conversationId);
					if (conversation) {
						const otherMemberId =
							conversation.memberOneId === currentMember._id
								? conversation.memberTwoId
								: conversation.memberOneId;
						const otherMember = memberMap.get(otherMemberId);
						if (otherMember) {
							const otherUser = userMap.get(otherMember.userId);
							if (otherUser) {
								context = {
									name: `Direct Message with ${otherUser.name}`,
									type: "conversation",
									id: conversation._id,
									memberId: otherMember._id,
								};
							}
						}
					}
				}

				// Return null if context couldn't be determined
				if (!context) {
					return null;
				}

				return {
					message,
					parentMessage,
					parentUser,
					currentUser,
					context,
				};
			})
			.filter(
				(thread): thread is NonNullable<typeof thread> => thread !== null
			);

		return threadsWithContext;
	},
});

export const getMessageBodies = query({
	args: {
		messageIds: v.array(v.id("messages")),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) return [];

			// Early return if no message IDs provided
			if (args.messageIds.length === 0) return [];

			// Fetch all messages in a single batch query
			const messages = await ctx.db
				.query("messages")
				.filter((q) =>
					q.or(...args.messageIds.map((id) => q.eq(q.field("_id"), id)))
				)
				.collect();

			if (messages.length === 0) return [];

			// Extract all unique member IDs from messages
			const memberIds = new Set(messages.map((msg) => msg.memberId));

			// Fetch all members in a single batch
			const members = await ctx.db
				.query("members")
				.filter((q) =>
					q.or(...Array.from(memberIds).map((id) => q.eq(q.field("_id"), id)))
				)
				.collect();

			// Create a map of member ID to member
			const memberMap = new Map(members.map((member) => [member._id, member]));

			// Extract all unique user IDs from members
			const userIds = new Set(members.map((member) => member.userId));

			// Fetch all users in a single batch
			const users = await ctx.db
				.query("users")
				.filter((q) =>
					q.or(...Array.from(userIds).map((id) => q.eq(q.field("_id"), id)))
				)
				.collect();

			// Create a map of user ID to user
			const userMap = new Map(users.map((user) => [user._id, user]));

			// Map messages to the required format
			const formattedMessages = messages.map((message) => {
				const member = memberMap.get(message.memberId);
				if (!member) return null;

				const user = userMap.get(member.userId);
				if (!user) return null;

				return {
					id: message._id,
					body: message.body,
					authorName: user.name,
					creationTime: message._creationTime,
					memberId: message.memberId,
				};
			});

			return formattedMessages.filter(
				(msg): msg is NonNullable<typeof msg> => msg !== null
			);
		} catch (error) {
			console.error("Error in getMessageBodies:", error);
			return [];
		}
	},
});

export const getMentionedMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				return [];
			}

			// Get the current member
			const currentMember = await ctx.db
				.query("members")
				.withIndex("by_workspace_id_user_id", (q) =>
					q
						.eq("workspaceId", args.workspaceId)
						.eq("userId", userId as Id<"users">)
				)
				.unique();

			if (!currentMember) {
				return [];
			}

			const limit = args.limit ?? 50;

			// Mentions are the authoritative source of truth; message bodies can be stored
			// as structured JSON and are not safe to string-match.
			const mentions = await ctx.db
				.query("mentions")
				.withIndex("by_workspace_id_mentioned_member_id", (q) =>
					q
						.eq("workspaceId", args.workspaceId)
						.eq("mentionedMemberId", currentMember._id)
				)
				.order("desc")
				.take(limit);

			const mentionedMessages: any[] = [];
			const seenMessageIds = new Set<string>();

			const messageIds = Array.from(
				new Set(
					mentions
						.map((m) => m.messageId)
						.filter((id): id is Id<"messages"> => Boolean(id))
				)
			);

			const fetchedMessages = await Promise.all(
				messageIds.map(async (id) => ctx.db.get(id))
			);
			const messageById = new Map(
				fetchedMessages
					.filter((m): m is Doc<"messages"> => Boolean(m))
					.map((m) => [m._id, m])
			);

			for (const mention of mentions) {
				if (!mention.messageId) continue;
				const message = messageById.get(mention.messageId);
				if (!message) continue;
				if (message.workspaceId !== args.workspaceId) continue;
				if (seenMessageIds.has(String(message._id))) continue;
				seenMessageIds.add(String(message._id));

				// Get the member who sent the message
				const member = await populateMember(ctx, message.memberId);
				if (!member) continue;

				// Get the user associated with the member
				const user = await populateUser(ctx, member.userId);
				if (!user) continue;

				// Get reactions for the message
				const reactions = await populateReactions(ctx, message._id);

				// Get image URL if present
				const image = message.image
					? await ctx.storage.getUrl(message.image)
					: undefined;

				// Format reactions with counts
				const reactionsWithCounts = reactions.reduce(
					(acc, reaction) => {
						const existingReaction = acc.find(
							(r) => r.value === reaction.value
						);

						if (existingReaction) {
							existingReaction.count += 1;
							existingReaction.memberIds.push(reaction.memberId);
							return acc;
						}

						return [
							...acc,
							{
								...reaction,
								count: 1,
								memberIds: [reaction.memberId],
							},
						];
					},
					[] as Array<
						Omit<Doc<"reactions">, "memberId"> & {
							count: number;
							memberIds: Id<"members">[];
						}
					>
				);

				// Get thread information if this message has replies
				const thread = await populateThread(ctx, message._id);

				// Add context information (channel or conversation)
				let context = null;

				if (message.channelId) {
					const channel = await ctx.db.get(message.channelId);
					if (channel) {
						context = {
							type: "channel",
							name: channel.name,
							id: channel._id,
						};
					}
				} else if (message.conversationId) {
					const conversation = await ctx.db.get(message.conversationId);
					if (conversation) {
						const otherMemberId =
							conversation.memberOneId === message.memberId
								? conversation.memberTwoId
								: conversation.memberOneId;
						const otherMember = await populateMember(ctx, otherMemberId);
						if (otherMember) {
							const otherUser = await populateUser(ctx, otherMember.userId);
							if (otherUser) {
								context = {
									type: "conversation",
									name: `Direct Message with ${otherUser.name}`,
									id: conversation._id,
									memberId: otherMember._id,
								};
							}
						}
					}
				}

				mentionedMessages.push({
					...message,
					user: {
						name: user.name,
						image: user.image,
					},
					reactions: reactionsWithCounts,
					image,
					threadCount: thread?.count,
					threadImage: thread?.image,
					threadName: thread?.name,
					threadTimestamp: thread?.timestamp,
					context,
				});
			}

			return mentionedMessages;
		} catch (error) {
			console.error("Error in getMentionedMessages:", error);
			return [];
		}
	},
});

export const getRecentWorkspaceChannelMessages = query({
	args: {
		workspaceId: v.id("workspaces"),
		from: v.number(),
		to: v.optional(v.number()),
		limit: v.number(),
		perChannelLimit: v.number(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			return [];
		}

		// Get all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		if (channels.length === 0) {
			return [];
		}

		const allMessages: Array<{
			channelName: string;
			authorName: string;
			body: string;
			_creationTime: number;
		}> = [];

		// Fetch messages from each channel
		for (const channel of channels) {
			const messages = await ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.order("desc")
				.filter((q) => {
					if (args.to) {
						return q.and(
							q.gte(q.field("_creationTime"), args.from),
							q.lte(q.field("_creationTime"), args.to)
						);
					}
					// If from is 0, return all messages (no time filter)
					return args.from > 0
						? q.gte(q.field("_creationTime"), args.from)
						: true;
				})
				.take(args.perChannelLimit);

			// Filter out thread replies
			const nonThreadMessages = messages.filter((msg) => !msg.parentMessageId);

			// Get author info for each message
			for (const message of nonThreadMessages) {
				if (message.body) {
					const member = await ctx.db.get(message.memberId);
					if (member) {
						const user = await ctx.db.get(member.userId);
						allMessages.push({
							channelName: channel.name,
							authorName: user?.name || "Unknown",
							body: message.body,
							_creationTime: message._creationTime,
						});
					}
				}
			}

			// Stop if we've reached the overall limit
			if (allMessages.length >= args.limit) {
				break;
			}
		}

		// Sort by creation time and limit total results
		return allMessages
			.sort((a, b) => a._creationTime - b._creationTime)
			.slice(-args.limit);
	},
});

export const getRecentChannelMessages = query({
	args: {
		channelId: v.id("channels"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		try {
			const userId = await getAuthUserId(ctx);
			if (!userId) {
				return [];
			}

			const limit = args.limit || 20; // Default to 20 messages if not specified

			// Query for messages in this specific channel
			const messages = await ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", args.channelId))
				.order("desc") // Most recent first
				.take(limit);

			// Filter out thread replies after fetching
			const nonThreadMessages = messages.filter((msg) => !msg.parentMessageId);

			// Use the filtered messages for processing
			const filteredMessages =
				nonThreadMessages.length > 0 ? nonThreadMessages : messages;

			if (filteredMessages.length === 0) {
				return [];
			}

			// Extract all unique member IDs from filtered messages
			const memberIds = new Set(filteredMessages.map((msg) => msg.memberId));

			// Fetch all members in a single batch
			const members = await ctx.db
				.query("members")
				.filter((q) =>
					q.or(...Array.from(memberIds).map((id) => q.eq(q.field("_id"), id)))
				)
				.collect();

			// Create a map of member ID to member
			const memberMap = new Map(members.map((member) => [member._id, member]));

			// Extract all unique user IDs from members
			const userIds = new Set(members.map((member) => member.userId));

			// Fetch all users in a single batch
			const users = await ctx.db
				.query("users")
				.filter((q) =>
					q.or(...Array.from(userIds).map((id) => q.eq(q.field("_id"), id)))
				)
				.collect();

			// Create a map of user ID to user
			const userMap = new Map(users.map((user) => [user._id, user]));

			// Map filtered messages to the required format and reverse to get chronological order
			const formattedMessages = filteredMessages
				.map((message) => {
					const member = memberMap.get(message.memberId);
					if (!member) {
						return null;
					}

					const user = userMap.get(member.userId);
					if (!user) {
						return null;
					}

					return {
						id: message._id,
						body: message.body,
						authorName: user.name,
						creationTime: message._creationTime,
					};
				})
				.filter((msg): msg is NonNullable<typeof msg> => msg !== null)
				.reverse(); // Reverse to get chronological order (oldest first)

			return formattedMessages;
		} catch (error) {
			console.error("Error in getRecentChannelMessages:", error);
			return [];
		}
	},
});

export const getThreadReplyCounts = query({
	args: {
		parentMessageIds: v.array(v.id("messages")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		try {
			// If no parent message IDs provided, return empty array
			if (args.parentMessageIds.length === 0) return [];

			// Fetch all replies in a single query using 'or' filter
			const allReplies = await ctx.db
				.query("messages")
				.withIndex("by_parent_message_id")
				.filter((q) =>
					q.or(
						...args.parentMessageIds.map((id) =>
							q.eq(q.field("parentMessageId"), id)
						)
					)
				)
				.collect();

			// Group replies by parent message ID and count
			const countsByParent = new Map<string, number>();
			for (const reply of allReplies) {
				if (reply.parentMessageId) {
					const key = reply.parentMessageId;
					countsByParent.set(key, (countsByParent.get(key) ?? 0) + 1);
				}
			}

			// Build result array with counts (0 for parents with no replies)
			const counts = args.parentMessageIds.map((parentMessageId) => ({
				parentMessageId,
				count: countsByParent.get(parentMessageId) ?? 0,
			}));

			return counts;
		} catch (error) {
			console.error("Error in getThreadReplyCounts:", error);
			return [];
		}
	},
});
