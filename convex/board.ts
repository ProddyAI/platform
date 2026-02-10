import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserEmailFromMemberId, getUserNameFromMemberId } from "./utils";

// LISTS
export const createList = mutation({
	args: { channelId: v.id("channels"), title: v.string(), order: v.number() },
	handler: async (
		ctx: MutationCtx,
		args: { channelId: Id<"channels">; title: string; order: number }
	) => {
		return await ctx.db.insert("lists", args);
	},
});

export const updateList = mutation({
	args: {
		listId: v.id("lists"),
		title: v.optional(v.string()),
		order: v.optional(v.number()),
	},
	handler: async (
		ctx: MutationCtx,
		{
			listId,
			...updates
		}: { listId: Id<"lists">; title?: string; order?: number }
	) => {
		return await ctx.db.patch(listId, updates);
	},
});

export const deleteList = mutation({
	args: { listId: v.id("lists") },
	handler: async (ctx: MutationCtx, { listId }: { listId: Id<"lists"> }) => {
		// Delete all cards in the list
		const cards = await ctx.db
			.query("cards")
			.withIndex("by_list_id", (q) => q.eq("listId", listId))
			.collect();
		for (const card of cards) {
			await ctx.db.delete(card._id);
		}
		// Delete the list
		return await ctx.db.delete(listId);
	},
});

export const reorderLists = mutation({
	args: {
		listOrders: v.array(v.object({ listId: v.id("lists"), order: v.number() })),
	},
	handler: async (
		ctx: MutationCtx,
		{ listOrders }: { listOrders: { listId: Id<"lists">; order: number }[] }
	) => {
		for (const { listId, order } of listOrders) {
			await ctx.db.patch(listId, { order });
		}
		return true;
	},
});

// CARDS
export const createCard = mutation({
	args: {
		listId: v.id("lists"),
		title: v.string(),
		description: v.optional(v.string()),
		order: v.number(),
		labels: v.optional(v.array(v.string())),
		priority: v.optional(
			v.union(
				v.literal("lowest"),
				v.literal("low"),
				v.literal("medium"),
				v.literal("high"),
				v.literal("highest")
			)
		),
		dueDate: v.optional(v.number()),
		assignees: v.optional(v.array(v.id("members"))),
		parentCardId: v.optional(v.id("cards")),
		isCompleted: v.optional(v.boolean()),
		estimate: v.optional(v.number()),
		timeSpent: v.optional(v.number()),
		watchers: v.optional(v.array(v.id("members"))),
		blockedBy: v.optional(v.array(v.id("cards"))),
	},
	handler: async (
		ctx: MutationCtx,
		args: {
			listId: Id<"lists">;
			title: string;
			description?: string;
			order: number;
			labels?: string[];
			priority?: "lowest" | "low" | "medium" | "high" | "highest";
			dueDate?: number;
			assignees?: Id<"members">[];
			parentCardId?: Id<"cards">;
			isCompleted?: boolean;
			estimate?: number;
			timeSpent?: number;
			watchers?: Id<"members">[];
			blockedBy?: Id<"cards">[];
		}
	) => {
		// Get the list to find the channel and workspace
		const list = await ctx.db.get(args.listId);
		if (!list) throw new Error("List not found");

		const channel = await ctx.db.get(list.channelId);
		if (!channel) throw new Error("Channel not found");

		// Insert the card
		const cardId = await ctx.db.insert("cards", args);

		// Create mentions for assignees if any
		if (args.assignees && args.assignees.length > 0) {
			try {
				// Get the current user/member who is creating the card
				const auth = await ctx.auth.getUserIdentity();
				if (!auth) throw new Error("Not authenticated");

				const userId = auth.subject.split("|")[0] as Id<"users">;

				const creator = await ctx.db
					.query("members")
					.withIndex("by_workspace_id_user_id", (q) =>
						q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
					)
					.unique();

				if (!creator) throw new Error("Creator not found");

				// Create a mention for each assignee
				for (const assigneeId of args.assignees) {
					// Create a mention
					await ctx.db.insert("mentions", {
						mentionedMemberId: assigneeId,
						mentionerMemberId: creator._id,
						workspaceId: channel.workspaceId,
						channelId: list.channelId,
						read: false,
						createdAt: Date.now(),
						cardId: cardId, // Add the card ID to the mention
						cardTitle: args.title, // Include the card title for context
					});

					// Send email notification
					await ctx.scheduler.runAfter(0, api.email.sendCardAssignmentEmail, {
						assigneeId,
						cardId,
						assignerId: creator._id,
					});
				}
			} catch (error) {
				console.error("Error creating mentions for card assignees:", error);
				// Don't throw the error, as we still want to return the card ID
			}
		}

		return cardId;
	},
});

export const updateCard = mutation({
	args: {
		cardId: v.id("cards"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		order: v.optional(v.number()),
		listId: v.optional(v.id("lists")),
		labels: v.optional(v.array(v.string())),
		priority: v.optional(
			v.union(
				v.literal("lowest"),
				v.literal("low"),
				v.literal("medium"),
				v.literal("high"),
				v.literal("highest")
			)
		),
		dueDate: v.optional(v.number()),
		assignees: v.optional(v.array(v.id("members"))),
		isCompleted: v.optional(v.boolean()),
		estimate: v.optional(v.number()),
		timeSpent: v.optional(v.number()),
		watchers: v.optional(v.array(v.id("members"))),
		blockedBy: v.optional(v.array(v.id("cards"))),
	},
	handler: async (
		ctx: MutationCtx,
		{
			cardId,
			...updates
		}: {
			cardId: Id<"cards">;
			title?: string;
			description?: string;
			order?: number;
			listId?: Id<"lists">;
			labels?: string[];
			priority?: "lowest" | "low" | "medium" | "high" | "highest";
			dueDate?: number;
			assignees?: Id<"members">[];
			isCompleted?: boolean;
			estimate?: number;
			timeSpent?: number;
			watchers?: Id<"members">[];
			blockedBy?: Id<"cards">[];
		}
	) => {
		// Get the current card to check for changes in assignees
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		// Get the list to find the channel and workspace
		const list = await ctx.db.get(updates.listId || card.listId);
		if (!list) throw new Error("List not found");

		const channel = await ctx.db.get(list.channelId);
		if (!channel) throw new Error("Channel not found");

		// Update the card
		await ctx.db.patch(cardId, updates);

		// Check if assignees were updated
		if (updates.assignees !== undefined) {
			try {
				// Get the current user/member who is updating the card
				const auth = await ctx.auth.getUserIdentity();
				if (!auth) throw new Error("Not authenticated");

				const userId = auth.subject.split("|")[0] as Id<"users">;

				const updater = await ctx.db
					.query("members")
					.withIndex("by_workspace_id_user_id", (q) =>
						q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
					)
					.unique();

				if (!updater) throw new Error("Updater not found");

				// Find new assignees (those in updates.assignees but not in card.assignees)
				const currentAssignees = card.assignees || [];
				const newAssignees = updates.assignees.filter(
					(assigneeId) => !currentAssignees.includes(assigneeId)
				);

				// Create mentions for new assignees
				for (const assigneeId of newAssignees) {
					// Create a mention
					await ctx.db.insert("mentions", {
						mentionedMemberId: assigneeId,
						mentionerMemberId: updater._id,
						workspaceId: channel.workspaceId,
						channelId: list.channelId,
						read: false,
						createdAt: Date.now(),
						cardId: cardId, // Add the card ID to the mention
						cardTitle: updates.title || card.title, // Include the card title for context
					});

					// Send email notification
					await ctx.scheduler.runAfter(0, api.email.sendCardAssignmentEmail, {
						assigneeId,
						cardId,
						assignerId: updater._id,
					});
				}
			} catch (error) {
				console.error("Error creating mentions for card assignees:", error);
				// Don't throw the error, as we still want to return the card ID
			}
		}

		await ctx.scheduler.runAfter(0, api.ragchat.autoIndexCard, {
			cardId,
		});

		return cardId;
	},
});

export const deleteCard = mutation({
	args: { cardId: v.id("cards") },
	handler: async (ctx: MutationCtx, { cardId }: { cardId: Id<"cards"> }) => {
		// Delete all subtasks first
		const subtasks = await ctx.db
			.query("cards")
			.withIndex("by_parent_card_id", (q) => q.eq("parentCardId", cardId))
			.collect();
		for (const subtask of subtasks) {
			await ctx.db.delete(subtask._id);
		}

		// Delete all comments
		const comments = await ctx.db
			.query("card_comments")
			.withIndex("by_card_id", (q) => q.eq("cardId", cardId))
			.collect();
		for (const comment of comments) {
			await ctx.db.delete(comment._id);
		}

		// Delete all activity
		const activities = await ctx.db
			.query("card_activity")
			.withIndex("by_card_id", (q) => q.eq("cardId", cardId))
			.collect();
		for (const activity of activities) {
			await ctx.db.delete(activity._id);
		}

		// Delete the card itself
		return await ctx.db.delete(cardId);
	},
});

export const moveCard = mutation({
	args: { cardId: v.id("cards"), toListId: v.id("lists"), order: v.number() },
	handler: async (
		ctx: MutationCtx,
		{
			cardId,
			toListId,
			order,
		}: { cardId: Id<"cards">; toListId: Id<"lists">; order: number }
	) => {
		return await ctx.db.patch(cardId, { listId: toListId, order });
	},
});

export const updateCardInGantt = mutation({
	args: {
		cardId: v.id("cards"),
		dueDate: v.number(),
		listId: v.optional(v.id("lists")),
	},
	handler: async (
		ctx: MutationCtx,
		{
			cardId,
			dueDate,
			listId,
		}: { cardId: Id<"cards">; dueDate: number; listId?: Id<"lists"> }
	) => {
		const updates: any = { dueDate };

		if (listId) {
			updates.listId = listId;

			// If we're changing the list, put the card at the end of the new list
			const cards = await ctx.db
				.query("cards")
				.withIndex("by_list_id", (q) => q.eq("listId", listId))
				.collect();

			updates.order = cards.length;
		}

		return await ctx.db.patch(cardId, updates);
	},
});

// QUERIES
export const getLists = query({
	args: { channelId: v.id("channels") },
	handler: async (
		ctx: QueryCtx,
		{ channelId }: { channelId: Id<"channels"> }
	) => {
		return await ctx.db
			.query("lists")
			.withIndex("by_channel_id_order", (q) => q.eq("channelId", channelId))
			.collect();
	},
});

export const getCards = query({
	args: { listId: v.id("lists") },
	handler: async (ctx: QueryCtx, { listId }: { listId: Id<"lists"> }) => {
		const cards = await ctx.db
			.query("cards")
			.withIndex("by_list_id", (q) => q.eq("listId", listId))
			.order("asc")
			.collect();

		// Filter out subtasks (only show parent cards at top level)
		const parentCards = cards.filter((card) => !card.parentCardId);

		// Enhance cards with subtask stats
		const cardsWithStats = await Promise.all(
			parentCards.map(async (card) => {
				const subtasks = await ctx.db
					.query("cards")
					.withIndex("by_parent_card_id", (q) => q.eq("parentCardId", card._id))
					.collect();

				const completedCount = subtasks.filter((s) => s.isCompleted).length;
				const totalCount = subtasks.length;

				return {
					...card,
					subtaskStats: {
						completed: completedCount,
						total: totalCount,
						percentage:
							totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
					},
				};
			})
		);

		return cardsWithStats;
	},
});

export const getAllCardsForChannel = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		const lists = await ctx.db
			.query("lists")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();
		const allCards = [];
		for (const list of lists) {
			const cards = await ctx.db
				.query("cards")
				.withIndex("by_list_id", (q) => q.eq("listId", list._id))
				.collect();
			allCards.push(...cards);
		}
		return allCards;
	},
});

export const getUniqueLabels = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		const lists = await ctx.db
			.query("lists")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();
		const allLabels = new Set<string>();

		for (const list of lists) {
			const cards = await ctx.db
				.query("cards")
				.withIndex("by_list_id", (q) => q.eq("listId", list._id))
				.collect();

			// Collect all labels
			for (const card of cards) {
				if (card.labels && Array.isArray(card.labels)) {
					card.labels.forEach((label) => {
						if (label) allLabels.add(label);
					});
				}
			}
		}

		return Array.from(allLabels);
	},
});

export const getCardsWithDueDate = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		// Get all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		const cardsWithDueDate = [];

		// For each channel, get all lists and cards
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			for (const list of lists) {
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.filter((q) => q.neq(q.field("dueDate"), undefined))
					.collect();

				// Add channel and list info to each card
				const cardsWithContext = cards.map((card) => ({
					...card,
					channelId: channel._id,
					channelName: channel.name,
					listTitle: list.title,
				}));

				cardsWithDueDate.push(...cardsWithContext);
			}
		}

		return cardsWithDueDate;
	},
});

// Get members for a channel's workspace (for assignee selection)
export const getMembersForChannel = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		// First get the channel to find its workspace
		const channel = await ctx.db.get(channelId);
		if (!channel) return [];

		const workspaceId = channel.workspaceId;

		// Get all members in the workspace
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		// Populate user data for each member
		const membersWithUserData = [];
		for (const member of members) {
			const user = await ctx.db.get(member.userId);
			if (user) {
				membersWithUserData.push({
					...member,
					user: {
						name: user.name,
						image: user.image,
					},
				});
			}
		}

		return membersWithUserData;
	},
});

// NOTE: Email functions have been moved to convex/email.ts

// SUBTASK MUTATIONS
export const createSubtask = mutation({
	args: {
		parentCardId: v.id("cards"),
		title: v.string(),
		description: v.optional(v.string()),
		assignees: v.optional(v.array(v.id("members"))),
	},
	handler: async (ctx: MutationCtx, args) => {
		const parentCard = await ctx.db.get(args.parentCardId);
		if (!parentCard) throw new Error("Parent card not found");

		// Prevent nested subtasks (subtasks of subtasks)
		if (parentCard.parentCardId) {
			throw new Error("Cannot create subtasks of subtasks");
		}

		// Get the highest order for existing subtasks
		const existingSubtasks = await ctx.db
			.query("cards")
			.withIndex("by_parent_card_id", (q) =>
				q.eq("parentCardId", args.parentCardId)
			)
			.collect();

		const order = existingSubtasks.length;

		// Create subtask with parent's listId and new fields
		const subtaskId = await ctx.db.insert("cards", {
			listId: parentCard.listId,
			title: args.title,
			description: args.description,
			order,
			parentCardId: args.parentCardId,
			isCompleted: false,
			assignees: args.assignees,
		});

		// Log activity
		const auth = await ctx.auth.getUserIdentity();
		if (auth) {
			const userId = auth.subject.split("|")[0] as Id<"users">;
			const list = await ctx.db.get(parentCard.listId);
			if (list) {
				const channel = await ctx.db.get(list.channelId);
				if (channel) {
					const creator = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (creator) {
						await ctx.db.insert("card_activity", {
							cardId: args.parentCardId,
							memberId: creator._id,
							workspaceId: channel.workspaceId,
							action: "created",
							details: JSON.stringify({ subtaskId, title: args.title }),
							timestamp: Date.now(),
						});
					}
				}
			}
		}

		return subtaskId;
	},
});

export const toggleCardCompletion = mutation({
	args: { cardId: v.id("cards") },
	handler: async (ctx: MutationCtx, { cardId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const newCompletedState = !card.isCompleted;
		await ctx.db.patch(cardId, { isCompleted: newCompletedState });

		// Log activity
		const list = await ctx.db.get(card.listId);
		if (list) {
			const channel = await ctx.db.get(list.channelId);
			if (channel) {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const member = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (member) {
						await ctx.db.insert("card_activity", {
							cardId,
							memberId: member._id,
							workspaceId: channel.workspaceId,
							action: newCompletedState ? "completed" : "reopened",
							timestamp: Date.now(),
						});
					}
				}
			}
		}

		return newCompletedState;
	},
});

// COMMENT MUTATIONS
export const addComment = mutation({
	args: {
		cardId: v.id("cards"),
		content: v.string(),
	},
	handler: async (ctx: MutationCtx, { cardId, content }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const list = await ctx.db.get(card.listId);
		if (!list) throw new Error("List not found");

		const channel = await ctx.db.get(list.channelId);
		if (!channel) throw new Error("Channel not found");

		const auth = await ctx.auth.getUserIdentity();
		if (!auth) throw new Error("Not authenticated");

		const userId = auth.subject.split("|")[0] as Id<"users">;
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Member not found");

		const commentId = await ctx.db.insert("card_comments", {
			cardId,
			memberId: member._id,
			workspaceId: channel.workspaceId,
			content,
			createdAt: Date.now(),
		});

		// Log activity
		await ctx.db.insert("card_activity", {
			cardId,
			memberId: member._id,
			workspaceId: channel.workspaceId,
			action: "commented",
			timestamp: Date.now(),
		});

		// TODO: Handle @mentions in comments and send notifications

		return commentId;
	},
});

// WATCHER MUTATIONS
export const addWatcher = mutation({
	args: { cardId: v.id("cards"), memberId: v.id("members") },
	handler: async (ctx: MutationCtx, { cardId, memberId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const currentWatchers = card.watchers || [];
		if (currentWatchers.includes(memberId)) {
			return; // Already watching
		}

		await ctx.db.patch(cardId, {
			watchers: [...currentWatchers, memberId],
		});
	},
});

export const removeWatcher = mutation({
	args: { cardId: v.id("cards"), memberId: v.id("members") },
	handler: async (ctx: MutationCtx, { cardId, memberId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const currentWatchers = card.watchers || [];
		await ctx.db.patch(cardId, {
			watchers: currentWatchers.filter((id) => id !== memberId),
		});
	},
});

// BLOCKING RELATIONSHIP MUTATIONS
export const addBlockingRelationship = mutation({
	args: { cardId: v.id("cards"), blockedByCardId: v.id("cards") },
	handler: async (ctx: MutationCtx, { cardId, blockedByCardId }) => {
		if (cardId === blockedByCardId) {
			throw new Error("A card cannot block itself");
		}

		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const blockerCard = await ctx.db.get(blockedByCardId);
		if (!blockerCard) throw new Error("Blocker card not found");

		// Check for circular dependencies (simple check)
		const blockerBlockedBy = blockerCard.blockedBy || [];
		if (blockerBlockedBy.includes(cardId)) {
			throw new Error("Circular dependency detected");
		}

		const currentBlockedBy = card.blockedBy || [];
		if (currentBlockedBy.includes(blockedByCardId)) {
			return; // Already blocked by this card
		}

		await ctx.db.patch(cardId, {
			blockedBy: [...currentBlockedBy, blockedByCardId],
		});

		// Log activity
		const list = await ctx.db.get(card.listId);
		if (list) {
			const channel = await ctx.db.get(list.channelId);
			if (channel) {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const member = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (member) {
						await ctx.db.insert("card_activity", {
							cardId,
							memberId: member._id,
							workspaceId: channel.workspaceId,
							action: "blocked",
							details: JSON.stringify({
								blockedByCardId,
								blockedByTitle: blockerCard.title,
							}),
							timestamp: Date.now(),
						});
					}
				}
			}
		}
	},
});

export const removeBlockingRelationship = mutation({
	args: { cardId: v.id("cards"), blockedByCardId: v.id("cards") },
	handler: async (ctx: MutationCtx, { cardId, blockedByCardId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const currentBlockedBy = card.blockedBy || [];
		await ctx.db.patch(cardId, {
			blockedBy: currentBlockedBy.filter((id) => id !== blockedByCardId),
		});

		// Log activity
		const list = await ctx.db.get(card.listId);
		if (list) {
			const channel = await ctx.db.get(list.channelId);
			if (channel) {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const member = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (member) {
						await ctx.db.insert("card_activity", {
							cardId,
							memberId: member._id,
							workspaceId: channel.workspaceId,
							action: "unblocked",
							details: JSON.stringify({ blockedByCardId }),
							timestamp: Date.now(),
						});
					}
				}
			}
		}
	},
});

// TIME TRACKING MUTATIONS
export const updateTimeTracking = mutation({
	args: {
		cardId: v.id("cards"),
		estimate: v.optional(v.number()),
		timeSpent: v.optional(v.number()),
	},
	handler: async (ctx: MutationCtx, { cardId, estimate, timeSpent }) => {
		const card = await ctx.db.get(cardId);
		if (!card) throw new Error("Card not found");

		const updates: any = {};
		if (estimate !== undefined) updates.estimate = estimate;
		if (timeSpent !== undefined) updates.timeSpent = timeSpent;

		await ctx.db.patch(cardId, updates);
		return true;
	},
});

// SUBTASK QUERIES
export const getSubtasks = query({
	args: { parentCardId: v.id("cards") },
	handler: async (ctx: QueryCtx, { parentCardId }) => {
		return await ctx.db
			.query("cards")
			.withIndex("by_parent_card_id", (q) => q.eq("parentCardId", parentCardId))
			.order("asc")
			.collect();
	},
});

export const getCardWithSubtasks = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx: QueryCtx, { cardId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) return null;

		const subtasks = await ctx.db
			.query("cards")
			.withIndex("by_parent_card_id", (q) => q.eq("parentCardId", cardId))
			.order("asc")
			.collect();

		// Calculate completion stats
		const completedCount = subtasks.filter((s) => s.isCompleted).length;
		const totalCount = subtasks.length;

		return {
			...card,
			subtasks,
			subtaskStats: {
				completed: completedCount,
				total: totalCount,
				percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
			},
		};
	},
});

// COMMENT QUERIES
export const getComments = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx: QueryCtx, { cardId }) => {
		const comments = await ctx.db
			.query("card_comments")
			.withIndex("by_card_id", (q) => q.eq("cardId", cardId))
			.order("asc")
			.collect();

		// Populate member data
		const commentsWithMembers = await Promise.all(
			comments.map(async (comment) => {
				const member = await ctx.db.get(comment.memberId);
				if (!member) return null;

				const user = await ctx.db.get(member.userId);
				return {
					...comment,
					member: {
						...member,
						user: {
							name: user?.name,
							image: user?.image,
						},
					},
				};
			})
		);

		return commentsWithMembers.filter((c) => c !== null);
	},
});

// BLOCKING RELATIONSHIP QUERIES
export const getBlockingCards = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx: QueryCtx, { cardId }) => {
		const card = await ctx.db.get(cardId);
		if (!card || !card.blockedBy) return [];

		const blockingCards = await Promise.all(
			card.blockedBy.map(async (blockerCardId) => {
				const blockerCard = await ctx.db.get(blockerCardId);
				if (!blockerCard) return null;

				const list = await ctx.db.get(blockerCard.listId);
				return {
					...blockerCard,
					listTitle: list?.title,
				};
			})
		);

		return blockingCards.filter((c) => c !== null);
	},
});

// ACTIVITY LOG QUERIES
export const getCardActivity = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx: QueryCtx, { cardId }) => {
		const activities = await ctx.db
			.query("card_activity")
			.withIndex("by_card_id_timestamp", (q) => q.eq("cardId", cardId))
			.order("desc")
			.collect();

		// Populate member data
		const activitiesWithMembers = await Promise.all(
			activities.map(async (activity) => {
				const member = await ctx.db.get(activity.memberId);
				if (!member) return null;

				const user = await ctx.db.get(member.userId);
				return {
					...activity,
					member: {
						...member,
						user: {
							name: user?.name,
							image: user?.image,
						},
					},
				};
			})
		);

		return activitiesWithMembers.filter((a) => a !== null);
	},
});

// Helper query to get card details for email
export const _getCardDetails = query({
	args: { cardId: v.id("cards") },
	handler: async (ctx, { cardId }) => {
		const card = await ctx.db.get(cardId);
		if (!card) return null;

		// Get list details
		const list = await ctx.db.get(card.listId);
		if (!list) return null;

		// Get channel details
		const channel = await ctx.db.get(list.channelId);
		if (!channel) return null;

		return {
			...card,
			listName: list.title,
			channelId: list.channelId,
			channelName: channel.name,
			workspaceId: channel.workspaceId,
		};
	},
});

// Helper query to get member email
export const _getMemberEmail = query({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		return await getUserEmailFromMemberId(ctx, memberId);
	},
});

// Query to get all cards assigned to a specific member across all channels in a workspace
export const getAssignedCards = query({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
	},
	handler: async (ctx, { workspaceId, memberId }) => {
		// Get all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		const assignedCards = [];

		// For each channel, get all lists and cards
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			for (const list of lists) {
				// Get all cards in the list
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.collect();

				// Filter cards that have the member as an assignee
				const memberCards = cards.filter(
					(card) =>
						card.assignees &&
						Array.isArray(card.assignees) &&
						card.assignees.includes(memberId)
				);

				// Add channel and list info to each card
				const cardsWithContext = memberCards.map((card) => ({
					...card,
					channelId: channel._id,
					channelName: channel.name,
					listTitle: list.title,
				}));

				assignedCards.push(...cardsWithContext);
			}
		}

		return assignedCards;
	},
});

// Helper query to get member name
export const _getMemberName = query({
	args: { memberId: v.id("members") },
	handler: async (ctx, { memberId }) => {
		return await getUserNameFromMemberId(ctx, memberId);
	},
});
