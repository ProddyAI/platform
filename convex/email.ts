import { v } from "convex/values";
import { logger } from "../src/lib/logger";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, type QueryCtx, query } from "./_generated/server";

// Email notification result type (exported for use in email-actions.ts)
export type EmailNotificationResult = {
	success: boolean;
	error?: string;
	skipped?: boolean;
};

export type EmailNotificationKey =
	| "mentions"
	| "directMessage"
	| "threadReply"
	| "assignee";

// Get weekly digest data for a user across all their workspaces
export const getUserWeeklyDigest = query({
	args: {
		userId: v.id("users"),
		startDate: v.number(),
		endDate: v.number(),
	},
	handler: async (ctx, args): Promise<any> => {
		// Get all workspaces the user is a member of
		const memberships = await ctx.db
			.query("members")
			.withIndex("by_user_id", (q) => q.eq("userId", args.userId))
			.collect();

		const workspaceDigests = [];
		let totalMessages = 0;
		let totalTasks = 0;

		for (const membership of memberships) {
			const workspace = await ctx.db.get(membership.workspaceId);
			if (!workspace) continue;

			// Get workspace stats for the week
			const workspaceStats = await getWorkspaceWeeklyStats(ctx, {
				workspaceId: membership.workspaceId,
				startDate: args.startDate,
				endDate: args.endDate,
			});

			if (workspaceStats) {
				workspaceDigests.push({
					workspaceName: workspace.name,
					workspaceUrl: `${process.env.SITE_URL}/workspace/${workspace._id}`,
					stats: workspaceStats.stats,
					topChannels: workspaceStats.topChannels,
					recentTasks: workspaceStats.recentTasks,
				});

				totalMessages += workspaceStats.stats.totalMessages;
				totalTasks += workspaceStats.stats.totalTasks;
			}
		}

		return {
			workspaces: workspaceDigests,
			totalStats: {
				totalMessages,
				totalTasks,
				totalWorkspaces: workspaceDigests.length,
			},
		};
	},
});

// Get weekly stats for a specific workspace
async function getWorkspaceWeeklyStats(
	ctx: QueryCtx,
	args: {
		workspaceId: any;
		startDate: number;
		endDate: number;
	}
) {
	// Get messages count
	const messages = await ctx.db
		.query("messages")
		.withIndex("by_workspace_id", (q: any) =>
			q.eq("workspaceId", args.workspaceId)
		)
		.filter((q: any) =>
			q.and(
				q.gte(q.field("_creationTime"), args.startDate),
				q.lte(q.field("_creationTime"), args.endDate)
			)
		)
		.collect();

	// Get tasks count
	const tasks = await ctx.db
		.query("tasks")
		.withIndex("by_workspace_id", (q: any) =>
			q.eq("workspaceId", args.workspaceId)
		)
		.filter((q: any) =>
			q.and(
				q.gte(q.field("createdAt"), args.startDate),
				q.lte(q.field("createdAt"), args.endDate)
			)
		)
		.collect();

	const completedTasks = tasks.filter(
		(task: any) => task.completed || task.status === "completed"
	);

	// Get active users (users who sent messages)
	const activeUserIds = new Set(messages.map((msg: any) => msg.memberId));

	// Get top channels by message count
	const channelMessageCounts: { [key: string]: number } = {};
	for (const message of messages) {
		if (message.channelId) {
			channelMessageCounts[message.channelId] =
				(channelMessageCounts[message.channelId] || 0) + 1;
		}
	}

	const topChannels = [];
	for (const channelId in channelMessageCounts) {
		if (Object.hasOwn(channelMessageCounts, channelId)) {
			const count = channelMessageCounts[channelId];
			const channel = await ctx.db.get(channelId as any);
			if (channel && "name" in channel && count) {
				topChannels.push({
					name: channel.name,
					messageCount: count,
				});
			}
		}
	}

	// Sort by message count and take top 5
	topChannels.sort((a, b) => b.messageCount - a.messageCount);

	// Get recent tasks (created or updated this week)
	const recentTasks = tasks.slice(0, 5).map((task: any) => ({
		title: task.title,
		status: task.completed ? "completed" : task.status || "not_started",
		dueDate: task.dueDate
			? new Date(task.dueDate).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				})
			: undefined,
	}));

	return {
		stats: {
			totalMessages: messages.length,
			totalTasks: tasks.length,
			completedTasks: completedTasks.length,
			activeUsers: activeUserIds.size,
		},
		topChannels: topChannels.slice(0, 3),
		recentTasks,
	};
}

// Get all users who have weekly digest enabled for a specific day
export const getUsersForWeeklyDigest = query({
	args: {
		dayOfWeek: v.union(
			v.literal("monday"),
			v.literal("tuesday"),
			v.literal("wednesday"),
			v.literal("thursday"),
			v.literal("friday"),
			v.literal("saturday"),
			v.literal("sunday")
		),
	},
	handler: async (ctx, args): Promise<any> => {
		// Get all user preferences where weekly digest is enabled for the specified day
		const preferences = await ctx.db
			.query("preferences")
			.filter((q) =>
				q.and(
					q.eq(q.field("settings.notifications.weeklyDigest"), true),
					q.eq(
						q.field("settings.notifications.weeklyDigestDay"),
						args.dayOfWeek
					)
				)
			)
			.collect();

		const users = [];
		for (const pref of preferences) {
			const user = await ctx.db.get(pref.userId);
			if (user?.email) {
				users.push({
					userId: pref.userId,
					email: user.email,
					name: user.name || "User",
				});
			}
		}

		return users;
	},
});

// Helper function to check if an email should be sent based on user preferences
export const shouldSendEmailNotification = async (
	ctx: ActionCtx,
	userId: Id<"users">,
	key: EmailNotificationKey
): Promise<boolean> => {
	const prefs = await ctx.runQuery(
		api.preferences.getNotificationPreferencesByUserId,
		{
			userId,
		}
	);

	const emailEnabled = prefs?.emailNotificationsEnabled ?? true;
	const emailPrefFromMap = prefs?.notificationEmailPrefs?.[key];
	const emailPrefFromLegacy = prefs?.[key];
	const emailPref =
		typeof emailPrefFromMap === "boolean"
			? emailPrefFromMap
			: (emailPrefFromLegacy ?? true);

	return !!emailEnabled && !!emailPref;
};

// Helper function to escape HTML to prevent XSS
export const escapeHtml = (unsafe: string): string => {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
};

// Helper function to extract message preview from body
export const extractMessagePreview = (
	body: string | undefined,
	defaultText: string
): string => {
	if (!body) return defaultText;

	try {
		// Try to parse as JSON (Quill Delta format)
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.trim();
		}
	} catch (_e) {
		// Not JSON, use as is (might contain HTML)
		return body
			.replace(/<[^>]*>/g, "") // Remove HTML tags
			.trim();
	}

	return defaultText;
};

// Helper function to get week range string
function getWeekRange(): string {
	const now = new Date();
	const startOfWeek = new Date(now);
	startOfWeek.setDate(now.getDate() - now.getDay());

	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(startOfWeek.getDate() + 6);

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}, ${now.getFullYear()}`;
}
