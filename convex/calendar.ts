import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

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

export const createCalendarEvent = mutation({
	args: {
		title: v.string(),
		date: v.number(),
		time: v.optional(v.string()),
		messageId: v.id("messages"),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await getMember(
			ctx,
			args.workspaceId,
			userId as Id<"users">
		);

		if (!member) throw new Error("Member not found.");

		const message = await ctx.db.get(args.messageId);
		if (!message) throw new Error("Message not found.");

		// Update the message with calendar event info
		await ctx.db.patch(args.messageId, {
			calendarEvent: {
				date: args.date,
				time: args.time,
			},
		});

		// Create a calendar event
		const calendarEventId = await ctx.db.insert("events", {
			title: args.title,
			date: args.date,
			time: args.time,
			messageId: args.messageId,
			memberId: member._id,
			workspaceId: args.workspaceId,
		});

		return calendarEventId;
	},
});

export const getCalendarEvents = query({
	args: {
		workspaceId: v.id("workspaces"),
		month: v.number(), // Month number (0-11)
		year: v.number(), // Year (e.g., 2023)
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await getMember(
			ctx,
			args.workspaceId,
			userId as Id<"users">
		);

		if (!member) throw new Error("Member not found.");

		// Calculate start and end timestamps for the month
		const startDate = new Date(args.year, args.month, 1).getTime();
		const endDate = new Date(
			args.year,
			args.month + 1,
			0,
			23,
			59,
			59
		).getTime();

		// Get all calendar events for the month
		const events = await ctx.db
			.query("events")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) =>
				q.and(
					q.gte(q.field("date"), startDate),
					q.lte(q.field("date"), endDate)
				)
			)
			.collect();

		// Get all messages with calendar events
		const messageIds = events.map((event) => event.messageId);
		const messages = await Promise.all(
			messageIds.map(async (messageId) => {
				const message = await ctx.db.get(messageId);
				return message;
			})
		);

		// Get all members
		const memberIds = messages
			.map((message) => message?.memberId)
			.filter(Boolean) as Id<"members">[];
		// Convert Set to Array explicitly to avoid TypeScript iteration error
		const uniqueMemberIds = Array.from(new Set(memberIds));
		const members = await Promise.all(
			uniqueMemberIds.map(async (memberId) => {
				const member = await ctx.db.get(memberId);
				return member;
			})
		);

		// Get all users
		const userIds = members
			.map((member) => member?.userId)
			.filter(Boolean) as Id<"users">[];
		// Convert Set to Array explicitly to avoid TypeScript iteration error
		const uniqueUserIds = Array.from(new Set(userIds));
		const users = await Promise.all(
			uniqueUserIds.map(async (userId) => {
				const user = await ctx.db.get(userId);
				return user;
			})
		);

		// Create a map of user ID to user
		const userMap = new Map(users.map((user) => [user?._id, user]));
		// Create a map of member ID to member
		const memberMap = new Map(members.map((member) => [member?._id, member]));
		// Create a map of message ID to message
		const messageMap = new Map(
			messages.map((message) => [message?._id, message])
		);

		// Get board cards with due dates for this month
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const boardEvents = [];

		// For each channel, get all lists and cards with due dates in the current month
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.withIndex("by_channel_id", (q) => q.eq("channelId", channel._id))
				.collect();

			for (const list of lists) {
				const cards = await ctx.db
					.query("cards")
					.withIndex("by_list_id", (q) => q.eq("listId", list._id))
					.filter((q) =>
						q.and(
							q.neq(q.field("dueDate"), undefined),
							q.gte(q.field("dueDate"), startDate),
							q.lte(q.field("dueDate"), endDate)
						)
					)
					.collect();

				// Convert cards to calendar events
				for (const card of cards) {
					boardEvents.push({
						_id: card._id as unknown as Id<"events">, // Type cast for compatibility
						_creationTime: card._creationTime,
						date: card.dueDate as number,
						title: card.title,
						time: undefined,
						type: "board-card",
						boardCard: {
							_id: card._id,
							title: card.title,
							description: card.description,
							priority: card.priority,
							labels: card.labels,
							listId: list._id,
							listTitle: list.title,
							channelId: channel._id,
							channelName: channel.name,
						},
						message: {
							_id: card._id as unknown as Id<"messages">, // Type cast for compatibility
							body: JSON.stringify({ ops: [{ insert: card.title }] }),
							_creationTime: card._creationTime,
							channelId: channel._id,
							calendarEvent: {
								date: card.dueDate as number,
								time: undefined,
							},
						},
						user: {
							_id: userId as Id<"users">,
							name: "Board Card",
							image: null,
						},
						memberId: member._id,
						workspaceId: args.workspaceId,
					});
				}
			}
		}

		// Map events to include message and user info
		const messageEvents = events.map((event) => {
			const message = messageMap.get(event.messageId);
			const member = message ? memberMap.get(message.memberId) : null;
			const user = member ? userMap.get(member.userId) : null;

			return {
				...event,
				type: "calendar-event",
				message: message
					? {
							_id: message._id,
							body: message.body,
							_creationTime: message._creationTime,
							channelId: message.channelId,
							conversationId: message.conversationId,
							calendarEvent: message.calendarEvent,
						}
					: null,
				user: user
					? {
							_id: user._id,
							name: user.name,
							image: user.image,
						}
					: null,
			};
		});

		// Get tasks with due dates for this month that belong to the current user
		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id_user_id", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("userId", userId as Id<"users">)
			)
			.filter((q) =>
				q.and(
					q.neq(q.field("dueDate"), undefined),
					q.gte(q.field("dueDate"), startDate),
					q.lte(q.field("dueDate"), endDate)
				)
			)
			.collect();

		// Get categories for tasks
		const categoryIds = tasks
			.map((task) => task.categoryId)
			.filter(Boolean) as Id<"categories">[];

		// Get unique category IDs
		const uniqueCategoryIds = Array.from(new Set(categoryIds));

		// Fetch categories
		const categories = await Promise.all(
			uniqueCategoryIds.map(async (categoryId) => {
				return await ctx.db.get(categoryId);
			})
		);

		// Create a map of category ID to category
		const categoryMap = new Map(
			categories.map((category) => [category?._id, category])
		);

		// Convert tasks to calendar events
		const taskEvents = tasks.map((task) => {
			const category = task.categoryId
				? categoryMap.get(task.categoryId)
				: null;

			return {
				_id: task._id as unknown as Id<"events">, // Type cast for compatibility
				_creationTime: task.createdAt,
				date: task.dueDate as number,
				title: task.title,
				time: undefined,
				type: "task",
				task: {
					_id: task._id,
					title: task.title,
					description: task.description,
					completed: task.completed,
					status: task.status,
					dueDate: task.dueDate,
					priority: task.priority,
					categoryId: task.categoryId,
					categoryName: category ? category.name : undefined,
					categoryColor: category ? category.color : undefined,
					userId: task.userId,
				},
				user: {
					_id: userId as Id<"users">,
					name: "Task",
					image: null,
				},
				memberId: member._id,
				workspaceId: args.workspaceId,
			};
		});

		// Combine all types of events
		return [...messageEvents, ...boardEvents, ...taskEvents];
	},
});

export const getMessagesWithCalendarEvents = query({
	args: {
		workspaceId: v.id("workspaces"),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await getMember(
			ctx,
			args.workspaceId,
			userId as Id<"users">
		);

		if (!member) throw new Error("Member not found.");

		// Get all messages with calendar events
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.neq(q.field("calendarEvent"), undefined))
			.paginate(args.paginationOpts);

		// Get all members
		const memberIds = messages.page.map((message) => message.memberId);
		// Convert Set to Array explicitly to avoid TypeScript iteration error
		const uniqueMemberIds = Array.from(new Set(memberIds));
		const members = await Promise.all(
			uniqueMemberIds.map(async (memberId) => {
				const member = await ctx.db.get(memberId);
				return member;
			})
		);

		// Get all users
		const userIds = members
			.map((member) => member?.userId)
			.filter(Boolean) as Id<"users">[];
		// Convert Set to Array explicitly to avoid TypeScript iteration error
		const uniqueUserIds = Array.from(new Set(userIds));
		const users = await Promise.all(
			uniqueUserIds.map(async (userId) => {
				const user = await ctx.db.get(userId);
				return user;
			})
		);

		// Create a map of user ID to user
		const userMap = new Map(users.map((user) => [user?._id, user]));
		// Create a map of member ID to member
		const memberMap = new Map(members.map((member) => [member?._id, member]));

		// Map messages to include user info
		const messagesWithUsers = messages.page.map((message) => {
			const member = memberMap.get(message.memberId);
			const user = member ? userMap.get(member.userId) : null;

			return {
				...message,
				user: user
					? {
							_id: user._id,
							name: user.name,
							image: user.image,
						}
					: null,
			};
		});

		return {
			...messages,
			page: messagesWithUsers,
		};
	},
});
