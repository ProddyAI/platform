import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	sources?: Array<{
		id: string;
		type: string;
		text: string;
	}>;
	actions?: Array<{
		label: string;
		type: string;
		url: string;
		noteId?: string;
		channelId?: string;
	}>;
};

type ChatHistory = {
	messages: ChatMessage[];
};

type Priority = "lowest" | "low" | "medium" | "high" | "highest";

function isDefined<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function normalizePriority(input: unknown): Priority | undefined {
	if (typeof input !== "string") return undefined;
	const p = input.trim().toLowerCase();
	if (p === "lowest") return "lowest";
	if (p === "low") return "low";
	if (p === "medium") return "medium";
	if (p === "high") return "high";
	if (p === "highest") return "highest";
	return undefined;
}

function startOfDayMs(date: Date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function endOfDayMs(date: Date) {
	const d = new Date(date);
	d.setHours(23, 59, 59, 999);
	return d.getTime();
}

// Get the current member for a workspace
async function getCurrentMember(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Unauthorized");

	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Not a member of this workspace");
	return member;
}

export const getMyTasksInRange = query({
	args: {
		workspaceId: v.id("workspaces"),
		from: v.number(),
		to: v.number(),
		onlyIncomplete: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		// Ensure membership (privacy).
		await getCurrentMember(ctx, args.workspaceId);

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.filter((q) =>
				q.and(
					q.neq(q.field("dueDate"), undefined),
					q.gte(q.field("dueDate"), args.from),
					q.lte(q.field("dueDate"), args.to)
				)
			)
			.collect();

		const filtered = args.onlyIncomplete
			? tasks.filter((t) => !t.completed && t.status !== "completed")
			: tasks;

		// Return only minimal fields.
		return filtered
			.map((t) => ({
				_id: t._id,
				title: t.title,
				dueDate: t.dueDate,
				priority: t.priority,
				status: t.status,
				completed: t.completed,
			}))
			.sort(
				(a, b) =>
					(a.dueDate ?? Number.MAX_SAFE_INTEGER) -
					(b.dueDate ?? Number.MAX_SAFE_INTEGER)
			)
			.slice(0, 40);
	},
});

export const getMyUpcomingTasks = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		await getCurrentMember(ctx, args.workspaceId);

		const tasks = await ctx.db
			.query("tasks")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.filter((q) => q.neq(q.field("status"), "completed"))
			.collect();

		return tasks
			.filter((t) => !t.completed && t.status !== "completed")
			.map((t) => ({
				_id: t._id,
				title: t.title,
				dueDate: t.dueDate,
				priority: t.priority,
				status: t.status,
			}))
			.sort(
				(a, b) =>
					(a.dueDate ?? Number.MAX_SAFE_INTEGER) -
					(b.dueDate ?? Number.MAX_SAFE_INTEGER)
			)
			.slice(0, args.limit ?? 25);
	},
});

export const getMyCalendarEventsInRange = query({
	args: {
		workspaceId: v.id("workspaces"),
		from: v.number(),
		to: v.number(),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		// Strict: only the current member's events.
		const events = await ctx.db
			.query("events")
			.withIndex("by_member_id", (q) => q.eq("memberId", member._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("workspaceId"), args.workspaceId),
					q.gte(q.field("date"), args.from),
					q.lte(q.field("date"), args.to)
				)
			)
			.collect();

		return events
			.map((e) => ({
				_id: e._id,
				title: e.title,
				date: e.date,
				time: e.time,
			}))
			.sort((a, b) => a.date - b.date)
			.slice(0, 40);
	},
});

export const getMyAssignedCardsInRange = query({
	args: {
		workspaceId: v.id("workspaces"),
		from: v.number(),
		to: v.number(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const mentions = await ctx.db
			.query("mentions")
			.withIndex("by_workspace_id_mentioned_member_id", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("mentionedMemberId", member._id)
			)
			.filter((q) => q.neq(q.field("cardId"), undefined))
			.order("desc")
			.take(200);

		const uniqueCardMentions: Array<{
			cardId: Id<"cards">;
			channelId?: Id<"channels">;
			cardTitle?: string;
		}> = [];
		const seen = new Set<string>();
		for (const m of mentions) {
			if (!m.cardId) continue;
			const key = String(m.cardId);
			if (seen.has(key)) continue;
			seen.add(key);
			uniqueCardMentions.push({
				cardId: m.cardId as Id<"cards">,
				channelId: m.channelId as Id<"channels"> | undefined,
				cardTitle: m.cardTitle,
			});
			if (uniqueCardMentions.length >= (args.limit ?? 20)) break;
		}

		const cards = await Promise.all(
			uniqueCardMentions.map(async (m) => {
				const card = await ctx.db.get(m.cardId);
				return { mention: m, card };
			})
		);

		const channelIds = Array.from(
			new Set(
				cards
					.map((c) => c.mention.channelId)
					.filter(Boolean)
					.map((id) => String(id))
			)
		);
		const channels = await Promise.all(
			channelIds.map(async (id) => ctx.db.get(id as Id<"channels">))
		);
		const channelMap = new Map(
			channels.filter(Boolean).map((c) => [String(c?._id), c!])
		);

		const inRange = cards
			.map(({ mention, card }) => {
				if (!card?.dueDate) return null;
				if (card.dueDate < args.from || card.dueDate > args.to) return null;
				const channelName = mention.channelId
					? channelMap.get(String(mention.channelId))?.name
					: undefined;
				return {
					_id: card._id,
					title: String(card.title ?? mention.cardTitle ?? "Untitled card"),
					dueDate: card.dueDate,
					priority: normalizePriority(card.priority),
					boardName: channelName ? `#${channelName}` : "Board",
				};
			})
			.filter(isDefined);

		return inRange
			.sort((a, b) => a.dueDate - b.dueDate)
			.slice(0, args.limit ?? 20);
	},
});

export const getMyBoardsSummary = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const mentions = await ctx.db
			.query("mentions")
			.withIndex("by_workspace_id_mentioned_member_id", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.eq("mentionedMemberId", member._id)
			)
			.filter((q) => q.neq(q.field("cardId"), undefined))
			.order("desc")
			.take(300);

		const byChannel = new Map<
			string,
			{
				channelId: Id<"channels">;
				count: number;
				hasOverdueOrToday: boolean;
				hasUpcoming: boolean;
			}
		>();
		const now = new Date();
		const _todayStart = startOfDayMs(now);
		const todayEnd = endOfDayMs(now);
		const upcomingEnd = todayEnd + 7 * 24 * 60 * 60 * 1000;

		for (const m of mentions) {
			if (!m.channelId) continue;
			const key = String(m.channelId);
			const entry = byChannel.get(key) ?? {
				channelId: m.channelId as Id<"channels">,
				count: 0,
				hasOverdueOrToday: false,
				hasUpcoming: false,
			};
			entry.count += 1;
			byChannel.set(key, entry);
		}

		// Fetch channel docs (no N+1: only unique channels).
		const channelDocs = await Promise.all(
			Array.from(byChannel.values()).map(async (b) => ctx.db.get(b.channelId))
		);
		const channelNameById = new Map(
			channelDocs.filter(Boolean).map((c) => [String(c?._id), c?.name])
		);

		// Light signal for urgency: sample a small set of recent mentioned cards to detect due dates.
		const sampleMentions = mentions
			.filter((m) => Boolean(m.cardId))
			.slice(0, 25);
		const sampleCards = await Promise.all(
			sampleMentions.map(async (m) => ({
				m,
				c: await ctx.db.get(m.cardId as Id<"cards">),
			}))
		);
		for (const { m, c } of sampleCards) {
			if (!m.channelId || !c?.dueDate) continue;
			const entry = byChannel.get(String(m.channelId));
			if (!entry) continue;
			if (c.dueDate <= todayEnd) entry.hasOverdueOrToday = true;
			else if (c.dueDate <= upcomingEnd) entry.hasUpcoming = true;
		}

		return Array.from(byChannel.entries())
			.map(([id, b]) => ({
				id,
				name: `#${channelNameById.get(id) ?? "unknown"}`,
				assignedCards: b.count,
				hasOverdueOrToday: b.hasOverdueOrToday,
				hasUpcoming: b.hasUpcoming,
			}))
			.sort((a, b) => b.assignedCards - a.assignedCards)
			.slice(0, 30);
	},
});

// Get chat history for the current user in a workspace
export const getChatHistory = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args): Promise<ChatHistory> => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const chatHistory = await ctx.db
			.query("chatHistory")
			.withIndex("by_workspace_id_member_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("memberId", member._id)
			)
			.first();

		if (!chatHistory) {
			// Return empty history if none exists
			return {
				messages: [],
			};
		}

		return {
			messages: chatHistory.messages,
		};
	},
});

// Add a message to chat history
export const addMessage = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		content: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		sources: v.optional(
			v.array(
				v.object({
					id: v.string(),
					type: v.string(),
					text: v.string(),
				})
			)
		),
		actions: v.optional(
			v.array(
				v.object({
					label: v.string(),
					type: v.string(),
					url: v.string(),
					noteId: v.optional(v.string()),
					channelId: v.optional(v.string()),
				})
			)
		),
	},
	handler: async (ctx: any, args: any): Promise<any> => {
		try {
			const member = await getCurrentMember(ctx, args.workspaceId);
			const timestamp = Date.now();

			// Persist a single message with the given role (dashboard sends user then assistant separately)
			const message = {
				role: args.role,
				content: args.content,
				timestamp,
				sources: args.sources ?? [],
				actions: args.actions ?? [],
			};

			const chatHistory = await ctx.db
				.query("chatHistory")
				.withIndex("by_workspace_id_member_id", (q: any) =>
					q.eq("workspaceId", args.workspaceId).eq("memberId", member._id)
				)
				.first();

			if (chatHistory) {
				await ctx.db.patch(chatHistory._id, {
					messages: [...chatHistory.messages, message],
					updatedAt: timestamp,
				});
			} else {
				await ctx.db.insert("chatHistory", {
					workspaceId: args.workspaceId,
					memberId: member._id,
					messages: [message],
					updatedAt: timestamp,
				});
			}

			return { ok: true };
		} catch (_e) {
			return { ok: false };
		}
	},
});

// Clear chat history
export const clearChatHistory = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const member = await getCurrentMember(ctx, args.workspaceId);

		const chatHistory = await ctx.db
			.query("chatHistory")
			.withIndex("by_workspace_id_member_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("memberId", member._id)
			)
			.first();

		if (chatHistory) {
			// Reset to just the welcome message
			const timestamp = Date.now();
			return await ctx.db.patch(chatHistory._id, {
				messages: [
					{
						role: "assistant",
						content:
							"Hello! I'm your workspace assistant. How can I help you today?",
						timestamp,
					},
				],
				updatedAt: timestamp,
			});
		}

		// If no history exists, do nothing
		return null;
	},
});
