import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	type ActionCtx,
	internalQuery,
	type QueryCtx,
	query,
} from "../_generated/server";

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
	| "assignee"
	| "inviteSent"
	| "workspaceJoin"
	| "onlineStatus";

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

		const perWorkspace = await Promise.all(
			memberships.map(async (membership) => {
				const [workspace, workspaceStats] = await Promise.all([
					ctx.db.get(membership.workspaceId),
					getWorkspaceWeeklyStats(ctx, {
						workspaceId: membership.workspaceId,
						startDate: args.startDate,
						endDate: args.endDate,
					}),
				]);

				if (!workspace || !workspaceStats) return null;

				return {
					workspaceName: workspace.name,
					workspaceUrl: `${process.env.SITE_URL}/workspace/${workspace._id}`,
					stats: workspaceStats.stats,
					topChannels: workspaceStats.topChannels,
					recentTasks: workspaceStats.recentTasks,
				};
			})
		);

		const workspaceDigests = perWorkspace.filter(
			(digest): digest is NonNullable<typeof digest> => digest !== null
		);
		let totalMessages = 0;
		let totalTasks = 0;
		for (const digest of workspaceDigests) {
			totalMessages += digest.stats.totalMessages;
			totalTasks += digest.stats.totalTasks;
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
		workspaceId: Id<"workspaces">;
		startDate: number;
		endDate: number;
	}
) {
	// Get messages count
	const messages = await ctx.db
		.query("messages")
		.withIndex("by_workspace_id", (q) =>
			q
				.eq("workspaceId", args.workspaceId)
				.gte("_creationTime", args.startDate)
				.lte("_creationTime", args.endDate)
		)
		.collect();

	// Get tasks count
	const tasks = await ctx.db
		.query("tasks")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
		.filter((q) =>
			q.and(
				q.gte(q.field("createdAt"), args.startDate),
				q.lte(q.field("createdAt"), args.endDate)
			)
		)
		.collect();

	const completedTasks = tasks.filter(
		(task) => task.completed || task.status === "completed"
	);

	// Get active users (users who sent messages)
	const activeUserIds = new Set(messages.map((msg) => msg.memberId));

	// Get top channels by message count
	const channelMessageCounts: { [key: string]: number } = {};
	for (const message of messages) {
		if (message.channelId) {
			channelMessageCounts[message.channelId] =
				(channelMessageCounts[message.channelId] || 0) + 1;
		}
	}

	const channelIds = Object.keys(channelMessageCounts).filter((channelId) =>
		Object.hasOwn(channelMessageCounts, channelId)
	);
	const channels = await Promise.all(
		channelIds.map((channelId) => ctx.db.get(channelId as Id<"channels">))
	);

	const topChannels = [];
	for (let i = 0; i < channelIds.length; i++) {
		const count = channelMessageCounts[channelIds[i]];
		const channel = channels[i];
		if (channel && "name" in channel && count) {
			topChannels.push({
				name: channel.name,
				messageCount: count,
			});
		}
	}

	// Sort by message count and take top 5
	topChannels.sort((a, b) => b.messageCount - a.messageCount);

	// Get recent tasks (created or updated this week)
	const recentTasks = tasks.slice(0, 5).map((task) => ({
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
		api.workspace.preferences.getNotificationPreferencesByUserId,
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

	return Boolean(emailEnabled) && Boolean(emailPref);
};

type BillingRecipient = {
	email: string;
	name: string;
	userId: Id<"users">;
	role: "owner" | "admin";
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

export const getWorkspaceBillingRecipients = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (
		ctx,
		args
	): Promise<{
		workspaceName: string;
		recipients: BillingRecipient[];
	}> => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(1000);

		const recipients: BillingRecipient[] = [];
		const seenEmails = new Set<string>();
		for (const member of members) {
			if (member.role !== "owner" && member.role !== "admin") continue;
			const user = await ctx.db.get(member.userId);
			if (!user) continue;
			const email = user.email?.trim();
			if (!email || seenEmails.has(email.toLowerCase())) continue;
			seenEmails.add(email.toLowerCase());
			recipients.push({
				email,
				name: user.name || "Workspace admin",
				userId: user._id,
				role: member.role,
			});
		}

		return {
			workspaceName: workspace.name,
			recipients,
		};
	},
});

export const getLatestWorkspaceBillingEmailDetails = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (
		ctx,
		args
	): Promise<{
		paymentAmount: number | null;
		taxAmount: number | null;
		currency: string | null;
		refundAmount: number | null;
		refundCurrency: string | null;
	}> => {
		const latestEntries = await ctx.db
			.query("billingHistory")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(20);

		const payment = latestEntries.find(
			(entry) => (entry.type ?? "payment") === "payment" && entry.amount > 0
		);
		const refund = latestEntries.find(
			(entry) => entry.type === "refund" && entry.amount > 0
		);

		return {
			paymentAmount: payment?.amount ?? null,
			taxAmount: payment?.taxAmount ?? null,
			currency: payment?.currency ?? refund?.currency ?? null,
			refundAmount: refund?.amount ?? null,
			refundCurrency: refund?.currency ?? null,
		};
	},
});

export const getLatestWorkspaceInvoiceUrl = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args): Promise<string | null> => {
		const latestEntries = await ctx.db
			.query("billingHistory")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(20);

		return (
			latestEntries.find(
				(entry) =>
					(entry.type ?? "payment") === "payment" &&
					entry.amount > 0 &&
					typeof entry.invoiceUrl === "string"
			)?.invoiceUrl ?? null
		);
	},
});

// Shape of a single op in a Quill Delta document - only the field we read
interface QuillDeltaOp {
	insert?: unknown;
}

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
				.map((op: QuillDeltaOp) =>
					typeof op.insert === "string" ? op.insert : ""
				)
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
