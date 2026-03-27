import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserEmailFromMemberId, getUserNameFromMemberId } from "./utils";

const DONE_STATUS_KEYWORDS = [
	"done",
	"completed",
	"complete",
	"closed",
	"resolved",
];

const isDoneStatusName = (name: string) => {
	const normalized = name.trim().toLowerCase();
	return DONE_STATUS_KEYWORDS.some((keyword) => normalized === keyword);
};

const getCompletedStatusIdsForChannel = async (
	ctx: QueryCtx,
	channelId: Id<"channels">
): Promise<Set<Id<"statuses">>> => {
	const statuses = await ctx.db
		.query("statuses")
		.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
		.collect();

	return new Set(
		statuses
			.filter((status) => isDoneStatusName(status.name))
			.map((status) => status._id)
	);
};

const deleteIssueCascade = async (
	ctx: MutationCtx,
	issueId: Id<"issues">
): Promise<void> => {
	const childIssues = await ctx.db
		.query("issues")
		.withIndex("by_parent_issue_id", (q) => q.eq("parentIssueId", issueId))
		.collect();

	for (const childIssue of childIssues) {
		await deleteIssueCascade(ctx, childIssue._id);
	}

	const comments = await ctx.db
		.query("issueComments")
		.withIndex("by_issue_id", (q) => q.eq("issueId", issueId))
		.collect();
	for (const comment of comments) {
		await ctx.db.delete(comment._id);
	}

	const mentions = await ctx.db
		.query("mentions")
		.withIndex("by_issue_id", (q) => q.eq("issueId", issueId))
		.collect();
	for (const mention of mentions) {
		await ctx.db.delete(mention._id);
	}

	const blockingRelations = await ctx.db
		.query("issueBlocking")
		.withIndex("by_blocking_issue_id", (q) => q.eq("blockingIssueId", issueId))
		.collect();
	for (const relation of blockingRelations) {
		await ctx.db.delete(relation._id);
	}

	const blockedRelations = await ctx.db
		.query("issueBlocking")
		.withIndex("by_blocked_issue_id", (q) => q.eq("blockedIssueId", issueId))
		.collect();
	for (const relation of blockedRelations) {
		await ctx.db.delete(relation._id);
	}

	await ctx.db.delete(issueId);
};

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

		// Track board card usage
		const boardUserId = (await ctx.auth.getUserIdentity())?.subject.split(
			"|"
		)[0];
		if (boardUserId && channel?.workspaceId) {
			await ctx.scheduler.runAfter(
				0,
				internal.usageTracking.recordBoardCreated,
				{
					userId: boardUserId as Id<"users">,
					workspaceId: channel.workspaceId,
				}
			);
		}

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
		const updates: Partial<Pick<Doc<"cards">, "dueDate" | "listId" | "order">> =
			{
				dueDate,
			};

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

// ─── LINEAR-STYLE STATUSES ───────────────────────────────────────────────────

const DEFAULT_STATUSES = [
	{ name: "To-do", color: "#b4b4b4", order: 0 },
	{ name: "In Progress", color: "#f2c94c", order: 1 },
	{ name: "In Review", color: "#6938ef", order: 2 },
	{ name: "Done", color: "#00b341", order: 3 },
];

const STATUS_COLORS = [
	"#b4b4b4",
	"#5e6ad2",
	"#f2c94c",
	"#6938ef",
	"#00b341",
	"#eb5757",
	"#4ea7fc",
	"#e07b39",
];

function mapPriorityToIssue(
	priority?: "lowest" | "low" | "medium" | "high" | "highest"
): "urgent" | "high" | "medium" | "low" | "no_priority" | undefined {
	if (!priority) return undefined;
	switch (priority) {
		case "highest":
			return "urgent";
		case "high":
			return "high";
		case "medium":
			return "medium";
		case "low":
			return "low";
		case "lowest":
			return "no_priority";
		default:
			return undefined;
	}
}

// Helper to assert that the caller is a member of the workspace
async function assertWorkspaceMember(
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> {
	const auth = await ctx.auth.getUserIdentity();
	if (!auth) throw new Error("Not authenticated");

	const userId = auth.subject.split("|")[0] as Id<"users">;
	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Not a member of this workspace");
	return member;
}

async function assertWorkspaceMemberForRead(
	ctx: QueryCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> {
	const auth = await ctx.auth.getUserIdentity();
	if (!auth) throw new Error("Not authenticated");

	const userId = auth.subject.split("|")[0] as Id<"users">;
	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Not a member of this workspace");
	return member;
}

// Helper to assert that the caller has a specific role in the workspace
async function assertWorkspaceRole(
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">,
	requiredRole: "admin" | "member"
): Promise<Doc<"members">> {
	const member = await assertWorkspaceMember(ctx, workspaceId);
	if (
		requiredRole === "admin" &&
		member.role !== "admin" &&
		member.role !== "owner"
	) {
		throw new Error("Admin role required");
	}
	return member;
}

export const getStatuses = query({
	args: { channelId: v.id("channels") },
	handler: async (
		ctx: QueryCtx,
		{ channelId }: { channelId: Id<"channels"> }
	) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		return await ctx.db
			.query("statuses")
			.withIndex("by_channel_id_order", (q) => q.eq("channelId", channelId))
			.collect();
	},
});

export const createStatus = mutation({
	args: {
		channelId: v.id("channels"),
		name: v.string(),
		color: v.string(),
		order: v.number(),
	},
	handler: async (ctx: MutationCtx, args) => {
		// Verify caller is a member of the workspace
		const channel = await ctx.db.get(args.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		return await ctx.db.insert("statuses", args);
	},
});

export const updateStatus = mutation({
	args: {
		statusId: v.id("statuses"),
		name: v.optional(v.string()),
		color: v.optional(v.string()),
		order: v.optional(v.number()),
	},
	handler: async (ctx: MutationCtx, { statusId, ...updates }) => {
		// Verify caller is a member and status belongs to channel
		const status = await ctx.db.get(statusId);
		if (!status) throw new Error("Status not found");
		const channel = await ctx.db.get(status.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		return await ctx.db.patch(statusId, updates);
	},
});

export const deleteStatus = mutation({
	args: { statusId: v.id("statuses") },
	handler: async (
		ctx: MutationCtx,
		{ statusId }: { statusId: Id<"statuses"> }
	) => {
		// Verify caller is admin and status belongs to channel
		const status = await ctx.db.get(statusId);
		if (!status) throw new Error("Status not found");
		const channel = await ctx.db.get(status.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceRole(ctx, channel.workspaceId, "admin");

		// Delete all issues in this status
		const issues = await ctx.db
			.query("issues")
			.withIndex("by_status_id", (q) => q.eq("statusId", statusId))
			.collect();
		for (const issue of issues) {
			const mentions = await ctx.db
				.query("mentions")
				.withIndex("by_issue_id", (q) => q.eq("issueId", issue._id))
				.collect();
			for (const mention of mentions) {
				await ctx.db.delete(mention._id);
			}
			await ctx.db.delete(issue._id);
		}
		return await ctx.db.delete(statusId);
	},
});

export const reorderStatuses = mutation({
	args: {
		statusOrders: v.array(
			v.object({ statusId: v.id("statuses"), order: v.number() })
		),
	},
	handler: async (ctx: MutationCtx, { statusOrders }) => {
		if (statusOrders.length === 0) return true;

		// Verify caller is a member and all statuses belong to the same channel
		const firstStatus = await ctx.db.get(statusOrders[0].statusId);
		if (!firstStatus) throw new Error("Status not found");
		const channel = await ctx.db.get(firstStatus.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Verify all statuses belong to the same channel
		for (const { statusId } of statusOrders) {
			const status = await ctx.db.get(statusId);
			if (!status) throw new Error("Status not found");
			if (status.channelId !== channel._id) {
				throw new Error("Status does not belong to the same channel");
			}
		}

		for (const { statusId, order } of statusOrders) {
			await ctx.db.patch(statusId, { order });
		}
		return true;
	},
});

// ─── LINEAR-STYLE ISSUES ─────────────────────────────────────────────────────

export const getIssues = query({
	args: { channelId: v.id("channels") },
	handler: async (
		ctx: QueryCtx,
		{ channelId }: { channelId: Id<"channels"> }
	) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const issues = await ctx.db
			.query("issues")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		// Filter out sub-issues (only show main issues where parentIssueId is null/undefined)
		return issues.filter((issue) => !issue.parentIssueId);
	},
});

export const createIssue = mutation({
	args: {
		channelId: v.id("channels"),
		statusId: v.id("statuses"),
		title: v.string(),
		description: v.optional(v.string()),
		priority: v.optional(
			v.union(
				v.literal("urgent"),
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
				v.literal("no_priority")
			)
		),
		assignees: v.optional(v.array(v.id("members"))),
		labels: v.optional(v.array(v.string())),
		dueDate: v.optional(v.number()),
		order: v.number(),
	},
	handler: async (ctx: MutationCtx, args) => {
		const now = Date.now();
		const channel = await ctx.db.get(args.channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify status belongs to the channel
		const status = await ctx.db.get(args.statusId);
		if (!status) throw new Error("Status not found");
		if (status.channelId !== args.channelId) {
			throw new Error("Status does not belong to issue's channel");
		}

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		const validatedAssignees =
			args.assignees === undefined
				? undefined
				: (
						await Promise.all(
							args.assignees.map(async (assigneeId) => {
								const assigneeMember = await ctx.db.get(assigneeId);
								if (
									!assigneeMember ||
									assigneeMember.workspaceId !== channel.workspaceId
								) {
									return null;
								}
								return assigneeMember._id;
							})
						)
					).filter((assigneeId): assigneeId is Id<"members"> =>
						Boolean(assigneeId)
					);

		const issueId = await ctx.db.insert("issues", {
			...args,
			assignees: validatedAssignees,
			createdAt: now,
			updatedAt: now,
		});

		// Notify assignees
		if (validatedAssignees && validatedAssignees.length > 0) {
			try {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const creator = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (creator) {
						for (const assigneeId of validatedAssignees) {
							await ctx.db.insert("mentions", {
								mentionedMemberId: assigneeId,
								mentionerMemberId: creator._id,
								workspaceId: channel.workspaceId,
								channelId: args.channelId,
								read: false,
								createdAt: now,
								issueId,
								issueTitle: args.title,
							});

							await ctx.scheduler.runAfter(
								0,
								api.email.sendIssueAssignmentEmail,
								{
									assigneeId,
									issueId,
									assignerId: creator._id,
								}
							);
						}
					}
				}
			} catch (error) {
				console.error("Error creating mentions for issue assignees:", error);
			}
		}

		return issueId;
	},
});

export const updateIssue = mutation({
	args: {
		issueId: v.id("issues"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		statusId: v.optional(v.id("statuses")),
		priority: v.optional(
			v.union(
				v.literal("urgent"),
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
				v.literal("no_priority")
			)
		),
		assignees: v.optional(v.array(v.id("members"))),
		labels: v.optional(v.array(v.string())),
		dueDate: v.optional(v.number()),
		order: v.optional(v.number()),
	},
	handler: async (ctx: MutationCtx, { issueId, ...updates }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");

		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Verify statusId belongs to the channel if provided
		if (updates.statusId) {
			const status = await ctx.db.get(updates.statusId);
			if (!status) throw new Error("Status not found");
			if (status.channelId !== issue.channelId) {
				throw new Error("Status does not belong to issue's channel");
			}
		}

		const validatedAssignees =
			updates.assignees === undefined
				? undefined
				: (
						await Promise.all(
							updates.assignees.map(async (assigneeId) => {
								const assigneeMember = await ctx.db.get(assigneeId);
								if (
									!assigneeMember ||
									assigneeMember.workspaceId !== channel.workspaceId
								) {
									return null;
								}
								return assigneeMember._id;
							})
						)
					).filter((assigneeId): assigneeId is Id<"members"> =>
						Boolean(assigneeId)
					);

		await ctx.db.patch(issueId, {
			...updates,
			...(updates.assignees !== undefined
				? { assignees: validatedAssignees }
				: {}),
			updatedAt: Date.now(),
		});

		// Notify new assignees
		if (validatedAssignees !== undefined) {
			try {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const mentionCreatedAt = Date.now();
					const updater = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (updater) {
						const currentAssignees = issue.assignees || [];
						const newAssignees = validatedAssignees.filter(
							(id) => !currentAssignees.includes(id)
						);

						for (const assigneeId of newAssignees) {
							await ctx.db.insert("mentions", {
								mentionedMemberId: assigneeId,
								mentionerMemberId: updater._id,
								workspaceId: channel.workspaceId,
								channelId: issue.channelId,
								read: false,
								createdAt: mentionCreatedAt,
								issueId,
								issueTitle: updates.title || issue.title,
							});

							await ctx.scheduler.runAfter(
								0,
								api.email.sendIssueAssignmentEmail,
								{
									assigneeId,
									issueId,
									assignerId: updater._id,
								}
							);
						}
					}
				}
			} catch (error) {
				console.error("Error creating mentions for issue assignees:", error);
			}
		}

		return issueId;
	},
});

export const moveIssueStatus = mutation({
	args: {
		issueId: v.id("issues"),
		toStatusId: v.id("statuses"),
		order: v.number(), // treated as target index within the destination status
	},
	handler: async (ctx: MutationCtx, { issueId, toStatusId, order }) => {
		// Fetch the issue to determine its current status
		const issue = await ctx.db.get(issueId);
		if (!issue) {
			// Nothing to do if the issue does not exist
			return;
		}

		// Verify caller is a member of the workspace
		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Verify toStatusId belongs to the issue's channel
		const toStatus = await ctx.db.get(toStatusId);
		if (!toStatus) throw new Error("Status not found");
		if (toStatus.channelId !== issue.channelId) {
			throw new Error("Status does not belong to issue's channel");
		}

		const fromStatusId = issue.statusId as Id<"statuses">;
		const targetIndex = Math.max(0, Math.floor(order));
		const now = Date.now();
		// Helper to sort issues by their current order, falling back to _creationTime
		const sortByOrder = (a: Doc<"issues">, b: Doc<"issues">) => {
			const ao = typeof a.order === "number" ? a.order : 0;
			const bo = typeof b.order === "number" ? b.order : 0;
			if (ao !== bo) return ao - bo;
			return a._creationTime - b._creationTime;
		};
		if (fromStatusId === toStatusId) {
			// Reorder within the same status
			const allIssuesInStatus = await ctx.db
				.query("issues")
				.withIndex("by_status_id", (q) => q.eq("statusId", fromStatusId))
				.collect();
			// Exclude the moved issue from the list before re-inserting
			const otherIssues = allIssuesInStatus
				.filter((i) => i._id !== issueId)
				.sort(sortByOrder);
			const clampedIndex = Math.min(targetIndex, otherIssues.length);
			const newOrderIds: Id<"issues">[] = [];
			for (let i = 0; i < otherIssues.length; i++) {
				if (i === clampedIndex) {
					newOrderIds.push(issueId);
				}
				newOrderIds.push(otherIssues[i]._id);
			}
			if (clampedIndex === otherIssues.length) {
				newOrderIds.push(issueId);
			}
			// Apply contiguous order values
			let idx = 0;
			for (const id of newOrderIds) {
				await ctx.db.patch(id, {
					order: idx++,
					updatedAt: now,
				});
			}
			return;
		}
		// Moving across different statuses
		// Reindex issues in the source status (excluding the moved issue)
		const fromIssues = await ctx.db
			.query("issues")
			.withIndex("by_status_id", (q) => q.eq("statusId", fromStatusId))
			.collect();
		const remainingFromIssues = fromIssues
			.filter((i) => i._id !== issueId)
			.sort(sortByOrder);
		for (let i = 0; i < remainingFromIssues.length; i++) {
			await ctx.db.patch(remainingFromIssues[i]._id, {
				order: i,
				updatedAt: now,
			});
		}
		// Prepare and reindex issues in the destination status, inserting the moved issue
		const toIssues = await ctx.db
			.query("issues")
			.withIndex("by_status_id", (q) => q.eq("statusId", toStatusId))
			.collect();
		const sortedToIssues = toIssues.sort(sortByOrder);
		const clampedDestIndex = Math.min(targetIndex, sortedToIssues.length);
		const destOrderIds: Id<"issues">[] = [];
		for (let i = 0; i < sortedToIssues.length; i++) {
			if (i === clampedDestIndex) {
				destOrderIds.push(issueId);
			}
			destOrderIds.push(sortedToIssues[i]._id);
		}
		if (clampedDestIndex === sortedToIssues.length) {
			destOrderIds.push(issueId);
		}
		for (let i = 0; i < destOrderIds.length; i++) {
			const id = destOrderIds[i];
			if (id === issueId) {
				await ctx.db.patch(id, {
					statusId: toStatusId,
					order: i,
					updatedAt: now,
				});
			} else {
				await ctx.db.patch(id, {
					order: i,
					updatedAt: now,
				});
			}
		}
		return;
	},
});

export const deleteIssue = mutation({
	args: { issueId: v.id("issues") },
	handler: async (ctx: MutationCtx, { issueId }: { issueId: Id<"issues"> }) => {
		// Verify caller is a member of the workspace
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");
		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		await deleteIssueCascade(ctx, issueId);
		return;
	},
});

// ─── SUB-ISSUE FUNCTIONS ─────────────────────────────────────────────────────

export const getSubIssues = query({
	args: { parentIssueId: v.id("issues") },
	handler: async (ctx, { parentIssueId }) => {
		const parentIssue = await ctx.db.get(parentIssueId);
		if (!parentIssue) throw new Error("Parent issue not found");

		const channel = await ctx.db.get(parentIssue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const subIssues = await ctx.db
			.query("issues")
			.withIndex("by_parent_issue_id", (q) =>
				q.eq("parentIssueId", parentIssueId)
			)
			.collect();

		return subIssues.sort((a, b) => {
			if (a.order !== b.order) {
				return a.order - b.order;
			}
			return a._creationTime - b._creationTime;
		});
	},
});

// Helper query to get sub-issue stats for a parent issue
export const getSubIssueStats = query({
	args: { parentIssueId: v.id("issues") },
	handler: async (ctx, { parentIssueId }) => {
		const parentIssue = await ctx.db.get(parentIssueId);
		if (!parentIssue) return { total: 0, completed: 0 };

		const channel = await ctx.db.get(parentIssue.channelId);
		if (!channel) return { total: 0, completed: 0 };
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const subIssues = await ctx.db
			.query("issues")
			.withIndex("by_parent_issue_id", (q) =>
				q.eq("parentIssueId", parentIssueId)
			)
			.collect();

		const completedStatusIds = await getCompletedStatusIdsForChannel(
			ctx,
			parentIssue.channelId
		);

		const total = subIssues.length;
		const completed = subIssues.filter((issue) =>
			completedStatusIds.has(issue.statusId)
		).length;

		return { total, completed };
	},
});

// Batch query to get sub-issue stats for multiple issues at once
export const getBatchSubIssueStats = query({
	args: { issueIds: v.array(v.id("issues")) },
	handler: async (ctx, { issueIds }) => {
		const stats: Record<string, { total: number; completed: number }> = {};
		const checkedWorkspaceIds = new Set<string>();
		const completedStatusIdsByChannel = new Map<string, Set<Id<"statuses">>>();
		const uniqueIssueIds = [...new Set(issueIds)];

		for (const issueId of uniqueIssueIds) {
			const parentIssue = await ctx.db.get(issueId);
			if (!parentIssue) {
				stats[issueId] = { total: 0, completed: 0 };
				continue;
			}

			const channel = await ctx.db.get(parentIssue.channelId);
			if (!channel) {
				stats[issueId] = { total: 0, completed: 0 };
				continue;
			}

			if (!checkedWorkspaceIds.has(channel.workspaceId)) {
				await assertWorkspaceMemberForRead(ctx, channel.workspaceId);
				checkedWorkspaceIds.add(channel.workspaceId);
			}

			const subIssues = await ctx.db
				.query("issues")
				.withIndex("by_parent_issue_id", (q) => q.eq("parentIssueId", issueId))
				.collect();

			let completedStatusIds = completedStatusIdsByChannel.get(
				parentIssue.channelId
			);
			if (!completedStatusIds) {
				completedStatusIds = await getCompletedStatusIdsForChannel(
					ctx,
					parentIssue.channelId
				);
				completedStatusIdsByChannel.set(
					parentIssue.channelId,
					completedStatusIds
				);
			}

			const total = subIssues.length;
			const completed = subIssues.filter((issue) =>
				completedStatusIds.has(issue.statusId)
			).length;

			stats[issueId] = { total, completed };
		}

		return stats;
	},
});

// Batch query to get blocking counts for multiple issues
export const getBatchBlockingStats = query({
	args: { issueIds: v.array(v.id('issues')) },
	handler: async (ctx, { issueIds }) => {
		const stats: Record<
			string,
			{ blockingCount: number; blockedByCount: number }
		> = {};
		const checkedWorkspaceIds = new Set<string>();
		const uniqueIssueIds = [...new Set(issueIds)];

		for (const issueId of uniqueIssueIds) {
			const issue = await ctx.db.get(issueId);
			if (!issue) {
				stats[issueId] = { blockingCount: 0, blockedByCount: 0 };
				continue;
			}

			const channel = await ctx.db.get(issue.channelId);
			if (!channel) {
				stats[issueId] = { blockingCount: 0, blockedByCount: 0 };
				continue;
			}

			if (!checkedWorkspaceIds.has(channel.workspaceId)) {
				await assertWorkspaceMemberForRead(ctx, channel.workspaceId);
				checkedWorkspaceIds.add(channel.workspaceId);
			}

			// Count issues that this one is blocking
			const blockingCount = (
				await ctx.db
					.query('issueBlocking')
					.withIndex('by_blocking_issue_id', (q) =>
						q.eq('blockingIssueId', issueId),
					)
					.collect()
			).length;

			// Count issues that are blocking this one
			const blockedByCount = (
				await ctx.db
					.query('issueBlocking')
					.withIndex('by_blocked_issue_id', (q) =>
						q.eq('blockedIssueId', issueId),
					)
					.collect()
			).length;

			stats[issueId] = { blockingCount, blockedByCount };
		}

		return stats;
	},
});

// Search issues and statuses for the global search
export const searchBoardContent = query({
	args: { channelId: v.id("channels"), query: v.string() },
	handler: async (ctx, { channelId, query }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const lowerQuery = query.toLowerCase();

		// Search issues (excluding sub-issues)
		const issues = await ctx.db
			.query("issues")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		const filteredIssues = issues
			.filter((issue) => !issue.parentIssueId)
			.filter(
				(issue) =>
					issue.title.toLowerCase().includes(lowerQuery) ||
					issue.description?.toLowerCase().includes(lowerQuery) ||
					issue.labels?.some((label) =>
						label.toLowerCase().includes(lowerQuery)
					)
			)
			.slice(0, 10);

		// Search statuses
		const statuses = await ctx.db
			.query("statuses")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		const filteredStatuses = statuses
			.filter(
				(status) =>
					status.name.toLowerCase().includes(lowerQuery) ||
					status.color.toLowerCase().includes(lowerQuery)
			)
			.slice(0, 5);

		return {
			issues: filteredIssues.map((issue) => ({
				...issue,
				type: "issue" as const,
			})),
			statuses: filteredStatuses.map((status) => ({
				...status,
				type: "status" as const,
			})),
		};
	},
});

// ─── ISSUE BLOCKING FUNCTIONS ────────────────────────────────────────────────

export const getBlockingIssues = query({
	args: { issueId: v.id("issues") },
	handler: async (ctx, { issueId }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");
		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		// Get issues that this issue is blocking (blocked by this issue)
		const blockingRels = await ctx.db
			.query("issueBlocking")
			.withIndex("by_blocking_issue_id", (q) =>
				q.eq("blockingIssueId", issueId)
			)
			.collect();

		const blockingIssues = await Promise.all(
			blockingRels.map(async (rel) => {
				const blockedIssue = await ctx.db.get(rel.blockedIssueId);
				return blockedIssue;
			})
		);

		return blockingIssues.filter((i) => i !== null);
	},
});

export const getBlockedByIssues = query({
	args: { issueId: v.id("issues") },
	handler: async (ctx, { issueId }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");
		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		// Get issues that are blocking this issue
		const blockedByRels = await ctx.db
			.query("issueBlocking")
			.withIndex("by_blocked_issue_id", (q) => q.eq("blockedIssueId", issueId))
			.collect();

		const blockedByIssues = await Promise.all(
			blockedByRels.map(async (rel) => {
				const blockingIssue = await ctx.db.get(rel.blockingIssueId);
				return blockingIssue;
			})
		);

		return blockedByIssues.filter((i) => i !== null);
	},
});

export const getAllIssuesForBlocking = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		// Get all main issues (not sub-issues) in the channel
		const issues = await ctx.db
			.query("issues")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		// Filter out sub-issues
		return issues.filter((issue) => !issue.parentIssueId);
	},
});

export const getAllBlockingRelationshipsForChannel = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		return await ctx.db
			.query("issueBlocking")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();
	},
});

export const getChannelBlockingEdges = query({
	args: { channelId: v.id('channels') },
	handler: async (ctx, { channelId }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error('Channel not found');
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const rels = await ctx.db
			.query('issueBlocking')
			.withIndex('by_channel_id', (q) => q.eq('channelId', channelId))
			.collect();

		return Promise.all(
			rels.map(async (rel) => {
				const [blocking, blocked] = await Promise.all([
					ctx.db.get(rel.blockingIssueId),
					ctx.db.get(rel.blockedIssueId),
				]);
				return {
					blockingIssueId: rel.blockingIssueId,
					blockedIssueId: rel.blockedIssueId,
					blockingTitle: blocking?.title ?? String(rel.blockingIssueId),
					blockedTitle: blocked?.title ?? String(rel.blockedIssueId),
				};
			}),
		);
	},
});

export const addIssueBlockingRelationship = mutation({
	args: {
		channelId: v.id("channels"),
		blockedIssueId: v.id("issues"),
		blockingIssueId: v.id("issues"),
	},
	handler: async (
		ctx: MutationCtx,
		{ channelId, blockedIssueId, blockingIssueId }
	) => {
		if (blockedIssueId === blockingIssueId) {
			throw new Error("An issue cannot block itself");
		}

		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");

		const blockedIssue = await ctx.db.get(blockedIssueId);
		const blockingIssue = await ctx.db.get(blockingIssueId);
		if (!blockedIssue || !blockingIssue) {
			throw new Error("Issue not found");
		}

		// Verify both issues belong to the same channel
		if (
			blockedIssue.channelId !== channelId ||
			blockingIssue.channelId !== channelId
		) {
			throw new Error("Issues must belong to the same channel");
		}

		// Check for circular dependency (multi-hop)
		const visited = new Set<string>();
		const queue: Id<"issues">[] = [blockedIssueId];
		while (queue.length > 0) {
			const currentIssueId = queue.shift();
			if (!currentIssueId) continue;

			const visitedKey = String(currentIssueId);
			if (visited.has(visitedKey)) {
				continue;
			}
			visited.add(visitedKey);

			const outboundBlocking = await ctx.db
				.query('issueBlocking')
				.withIndex('by_blocking_issue_id', (q) =>
					q.eq('blockingIssueId', currentIssueId),
				)
				.collect();

			for (const rel of outboundBlocking) {
				if (rel.blockedIssueId === blockingIssueId) {
					throw new Error(
						"Circular dependency detected: the issue you're blocking already blocks this issue"
					);
				}

				if (!visited.has(String(rel.blockedIssueId))) {
					queue.push(rel.blockedIssueId);
				}
			}
		}

		// Check if relationship already exists
		const existing = await ctx.db
			.query("issueBlocking")
			.withIndex("by_channel_id_blocked_issue_id_blocking_issue_id", (q) =>
				q
					.eq("channelId", channelId)
					.eq("blockedIssueId", blockedIssueId)
					.eq("blockingIssueId", blockingIssueId)
			)
			.collect();

		if (existing.length > 0) {
			return; // Already blocked by this issue
		}

		// Verify caller is a member of the workspace
		const member = await assertWorkspaceMember(ctx, channel.workspaceId);

		// Create the blocking relationship
		await ctx.db.insert("issueBlocking", {
			channelId,
			blockedIssueId,
			blockingIssueId,
			createdAt: Date.now(),
			createdBy: member._id,
		});

		return;
	},
});

export const removeIssueBlockingRelationship = mutation({
	args: {
		channelId: v.id("channels"),
		blockedIssueId: v.id("issues"),
		blockingIssueId: v.id("issues"),
	},
	handler: async (
		ctx: MutationCtx,
		{ channelId, blockedIssueId, blockingIssueId }
	) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Find and delete the blocking relationship
		const blockingRels = await ctx.db
			.query("issueBlocking")
			.withIndex("by_channel_id_blocked_issue_id", (q) =>
				q.eq("channelId", channelId).eq("blockedIssueId", blockedIssueId)
			)
			.collect();

		const relToDelete = blockingRels.find(
			(rel) => rel.blockingIssueId === blockingIssueId
		);

		if (relToDelete) {
			await ctx.db.delete(relToDelete._id);
		}

		return;
	},
});

export const createSubIssue = mutation({
	args: {
		parentIssueId: v.id("issues"),
		title: v.string(),
		description: v.optional(v.string()),
		priority: v.optional(
			v.union(
				v.literal("urgent"),
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
				v.literal("no_priority")
			)
		),
		assignees: v.optional(v.array(v.id("members"))),
		labels: v.optional(v.array(v.string())),
		dueDate: v.optional(v.number()),
	},
	handler: async (ctx: MutationCtx, args) => {
		const parentIssue = await ctx.db.get(args.parentIssueId);
		if (!parentIssue) throw new Error("Parent issue not found");
		if (parentIssue.parentIssueId) {
			throw new Error("Cannot create subtask of a subtask");
		}

		const channel = await ctx.db.get(parentIssue.channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Get the next order for sub-issues
		const existingSubIssues = await ctx.db
			.query("issues")
			.withIndex("by_parent_issue_id", (q) =>
				q.eq("parentIssueId", args.parentIssueId)
			)
			.collect();

		const order = existingSubIssues.length;
		const now = Date.now();

		// Validate assignees belong to the workspace
		const validatedAssignees =
			args.assignees === undefined
				? undefined
				: (
						await Promise.all(
							args.assignees.map(async (assigneeId) => {
								const assigneeMember = await ctx.db.get(assigneeId);
								if (
									!assigneeMember ||
									assigneeMember.workspaceId !== channel.workspaceId
								) {
									return null;
								}
								return assigneeMember._id;
							})
						)
					).filter((assigneeId): assigneeId is Id<"members"> =>
						Boolean(assigneeId)
					);

		// Create sub-issue with same channelId and statusId as parent
		const subIssueId = await ctx.db.insert("issues", {
			channelId: parentIssue.channelId,
			statusId: parentIssue.statusId, // Inherit parent's status
			title: args.title,
			description: args.description,
			priority: args.priority,
			assignees: validatedAssignees,
			labels: args.labels,
			dueDate: args.dueDate,
			order,
			parentIssueId: args.parentIssueId,
			createdAt: now,
			updatedAt: now,
		});

		// Notify assignees
		if (validatedAssignees && validatedAssignees.length > 0) {
			try {
				const auth = await ctx.auth.getUserIdentity();
				if (auth) {
					const userId = auth.subject.split("|")[0] as Id<"users">;
					const creator = await ctx.db
						.query("members")
						.withIndex("by_workspace_id_user_id", (q) =>
							q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
						)
						.unique();

					if (creator) {
						for (const assigneeId of validatedAssignees) {
							await ctx.db.insert("mentions", {
								mentionedMemberId: assigneeId,
								mentionerMemberId: creator._id,
								workspaceId: channel.workspaceId,
								channelId: parentIssue.channelId,
								read: false,
								createdAt: now,
								issueId: subIssueId,
								issueTitle: args.title,
							});

							await ctx.scheduler.runAfter(
								0,
								api.email.sendIssueAssignmentEmail,
								{
									assigneeId,
									issueId: subIssueId,
									assignerId: creator._id,
								}
							);
						}
					}
				}
			} catch (error) {
				console.error(
					"Error creating mentions for sub-issue assignees:",
					error
				);
			}
		}

		return subIssueId;
	},
});

export const updateSubIssue = mutation({
	args: {
		subIssueId: v.id("issues"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		priority: v.optional(
			v.union(
				v.literal("urgent"),
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
				v.literal("no_priority")
			)
		),
		assignees: v.optional(v.array(v.id("members"))),
		labels: v.optional(v.array(v.string())),
		dueDate: v.optional(v.number()),
	},
	handler: async (ctx: MutationCtx, { subIssueId, ...updates }) => {
		const subIssue = await ctx.db.get(subIssueId);
		if (!subIssue) throw new Error("Sub-issue not found");
		if (!subIssue.parentIssueId) throw new Error("Not a sub-issue");

		const channel = await ctx.db.get(subIssue.channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Validate assignees
		const validatedAssignees =
			updates.assignees === undefined
				? undefined
				: (
						await Promise.all(
							updates.assignees.map(async (assigneeId) => {
								const assigneeMember = await ctx.db.get(assigneeId);
								if (
									!assigneeMember ||
									assigneeMember.workspaceId !== channel.workspaceId
								) {
									return null;
								}
								return assigneeMember._id;
							})
						)
					).filter((assigneeId): assigneeId is Id<"members"> =>
						Boolean(assigneeId)
					);

		await ctx.db.patch(subIssueId, {
			...updates,
			...(updates.assignees !== undefined
				? { assignees: validatedAssignees }
				: {}),
			updatedAt: Date.now(),
		});

		return subIssueId;
	},
});

export const deleteSubIssue = mutation({
	args: { subIssueId: v.id("issues") },
	handler: async (ctx: MutationCtx, { subIssueId }) => {
		const subIssue = await ctx.db.get(subIssueId);
		if (!subIssue) throw new Error("Sub-issue not found");
		if (!subIssue.parentIssueId) throw new Error("Not a sub-issue");

		const channel = await ctx.db.get(subIssue.channelId);
		if (!channel) throw new Error("Channel not found");

		// Verify caller is a member of the workspace
		await assertWorkspaceMember(ctx, channel.workspaceId);

		await deleteIssueCascade(ctx, subIssueId);
		return;
	},
});

// ─── ISSUE COMMENT FUNCTIONS ─────────────────────────────────────────────────

export const getIssueComments = query({
	args: { issueId: v.id("issues") },
	handler: async (ctx, { issueId }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");

		const channel = await ctx.db.get(issue.channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const comments = await ctx.db
			.query("issueComments")
			.withIndex("by_issue_id_created_at", (q) => q.eq("issueId", issueId))
			.order("asc")
			.collect();

		// Enrich comments with member and user data
		const commentsWithMembers = await Promise.all(
			comments.map(async (comment) => {
				const member = await ctx.db.get(comment.memberId);
				if (!member) return null;

				const user = await ctx.db.get(member.userId);
				const normalizedContent = comment.content ?? comment.message ?? "";
				return {
					...comment,
					content: normalizedContent,
					message: normalizedContent,
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

export const createIssueComment = mutation({
	args: {
		issueId: v.id("issues"),
		message: v.string(),
	},
	handler: async (ctx: MutationCtx, { issueId, message }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) throw new Error("Issue not found");

		const channel = await ctx.db.get(issue.channelId);
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

		const commentId = await ctx.db.insert("issueComments", {
			issueId,
			memberId: member._id,
			workspaceId: channel.workspaceId,
			content: message,
			createdAt: Date.now(),
		});

		return commentId;
	},
});

export const deleteIssueComment = mutation({
	args: { commentId: v.id("issueComments") },
	handler: async (ctx: MutationCtx, { commentId }) => {
		const comment = await ctx.db.get(commentId);
		if (!comment) throw new Error("Comment not found");

		// Verify caller is a member of the workspace
		const channel = await ctx.db.get(comment.issueId);
		if (!channel) throw new Error("Issue not found");

		const issueChannel = await ctx.db.get(channel.channelId);
		if (!issueChannel) throw new Error("Channel not found");

		await assertWorkspaceMember(ctx, issueChannel.workspaceId);

		return await ctx.db.delete(commentId);
	},
});

export const getAssignedIssues = query({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
	},
	handler: async (ctx, { workspaceId, memberId }) => {
		await assertWorkspaceMemberForRead(ctx, workspaceId);

		const requestedMember = await ctx.db.get(memberId);
		if (!requestedMember || requestedMember.workspaceId !== workspaceId) {
			throw new Error("Member does not belong to this workspace");
		}

		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		const assignedIssues = [];

		for (const channel of channels) {
			const issues = await ctx.db
				.query("issues")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			const memberIssues = issues.filter(
				(issue) =>
					issue.assignees &&
					Array.isArray(issue.assignees) &&
					issue.assignees.includes(memberId)
			);

			const issuesWithContext = memberIssues.map((issue) => ({
				...issue,
				channelId: channel._id,
				channelName: channel.name,
			}));

			assignedIssues.push(...issuesWithContext);
		}

		return assignedIssues;
	},
});

// Helper for email: get issue details (internal use - no auth check for scheduled actions)
export const _getIssueDetails = query({
	args: { issueId: v.id("issues") },
	handler: async (ctx, { issueId }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) return null;

		const channel = await ctx.db.get(issue.channelId);
		if (!channel) return null;

		const status = await ctx.db.get(issue.statusId);

		return {
			...issue,
			statusName: status?.name,
			channelId: issue.channelId,
			channelName: channel.name,
			workspaceId: channel.workspaceId,
		};
	},
});

export const getIssueDetails = query({
	args: { issueId: v.id("issues") },
	handler: async (ctx, { issueId }) => {
		const issue = await ctx.db.get(issueId);
		if (!issue) return null;

		const channel = await ctx.db.get(issue.channelId);
		if (!channel) return null;
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const status = await ctx.db.get(issue.statusId);

		return {
			...issue,
			statusName: status?.name,
			channelId: issue.channelId,
			channelName: channel.name,
			workspaceId: channel.workspaceId,
		};
	},
});

export const migrateListsToStatuses = mutation({
	args: { channelId: v.id("channels") },
	handler: async (
		ctx: MutationCtx,
		{ channelId }: { channelId: Id<"channels"> }
	) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMember(ctx, channel.workspaceId);

		// Skip if statuses already exist
		const existingStatuses = await ctx.db
			.query("statuses")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		if (existingStatuses.length > 0) return { alreadyMigrated: true };

		// Get existing lists
		const lists = await ctx.db
			.query("lists")
			.withIndex("by_channel_id_order", (q) => q.eq("channelId", channelId))
			.collect();

		// Build status definitions from lists or use defaults
		const statusDefs =
			lists.length > 0
				? lists.map((list, i) => ({
						name: list.title,
						color: STATUS_COLORS[i % STATUS_COLORS.length],
						order: list.order,
					}))
				: DEFAULT_STATUSES;

		const statusIdByListId: Record<string, Id<"statuses">> = {};

		for (let index = 0; index < statusDefs.length; index++) {
			const def = statusDefs[index];
			const statusId = await ctx.db.insert("statuses", {
				channelId,
				...def,
			});
			if (lists.length > 0) {
				const sourceList = lists[index];
				if (sourceList) {
					statusIdByListId[sourceList._id] = statusId;
				}
			}
		}

		// Migrate cards → issues
		for (const list of lists) {
			const statusId = statusIdByListId[list._id];
			if (!statusId) continue;

			const cards = await ctx.db
				.query("cards")
				.withIndex("by_list_id", (q) => q.eq("listId", list._id))
				.collect();

			const now = Date.now();
			for (const card of cards) {
				if (card.parentCardId) continue; // Skip subtasks
				await ctx.db.insert("issues", {
					channelId,
					statusId,
					title: card.title,
					description: card.description,
					priority: mapPriorityToIssue(card.priority),
					assignees: card.assignees,
					labels: card.labels,
					dueDate: card.dueDate,
					order: card.order,
					createdAt: card._creationTime,
					updatedAt: now,
				});
			}
		}

		return { migrated: true };
	},
});

export const getUniqueIssueLabels = query({
	args: { channelId: v.id("channels") },
	handler: async (ctx, { channelId }) => {
		const channel = await ctx.db.get(channelId);
		if (!channel) throw new Error("Channel not found");
		await assertWorkspaceMemberForRead(ctx, channel.workspaceId);

		const issues = await ctx.db
			.query("issues")
			.withIndex("by_channel_id", (q) => q.eq("channelId", channelId))
			.collect();

		const allLabels = new Set<string>();
		for (const issue of issues) {
			if (issue.labels && Array.isArray(issue.labels)) {
				issue.labels.forEach((label) => {
					if (label) allLabels.add(label);
				});
			}
		}
		return Array.from(allLabels);
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

		const updates: Partial<Pick<Doc<"cards">, "estimate" | "timeSpent">> = {};
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
