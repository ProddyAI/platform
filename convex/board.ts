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

		// Schedule RAG indexing for the new card
		await ctx.scheduler.runAfter(0, api.ragchat.autoIndexCard, {
			cardId,
		});

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

		// Schedule RAG re-indexing for the updated card
		await ctx.scheduler.runAfter(0, api.ragchat.autoIndexCard, {
			cardId,
		});

		return cardId;
	},
});

export const deleteCard = mutation({
	args: { cardId: v.id("cards") },
	handler: async (ctx: MutationCtx, { cardId }: { cardId: Id<"cards"> }) => {
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
		return await ctx.db
			.query("cards")
			.withIndex("by_list_id", (q) => q.eq("listId", listId))
			.order("asc")
			.collect();
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
