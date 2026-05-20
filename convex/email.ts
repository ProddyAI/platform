import { v } from "convex/values";
import { logger } from "../src/lib/logger";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	action,
	internalAction,
	internalMutation,
	internalQuery,
	type QueryCtx,
	query,
} from "./_generated/server";

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

const planLabel = (plan: string | null | undefined): string => {
	if (plan === "pro") return "Pro";
	if (plan === "enterprise") return "Enterprise";
	return "Free";
};

const formatCents = (
	amount: number | null | undefined,
	currency: string | null | undefined
) => {
	if (typeof amount !== "number") return null;
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency || "USD",
		}).format(amount / 100);
	} catch {
		return `${amount} ${currency ?? ""}`.trim();
	}
};

const billingRow = (
	label: string,
	amount: number | null | undefined,
	currency: string | null | undefined
): [string, string] | null => {
	if (typeof amount !== "number" || amount < 0) return null;
	const formatted = formatCents(amount, currency);
	return formatted ? [label, formatted] : null;
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

export const sendWorkspacePlanChangeEmail = internalAction({
	args: {
		workspaceId: v.id("workspaces"),
		previousPlan: v.optional(v.union(v.string(), v.null())),
		newPlan: v.string(),
		changeType: v.union(v.literal("upgrade"), v.literal("downgrade")),
		invoiceUrl: v.optional(v.string()),
		amountDue: v.optional(v.number()),
		currency: v.optional(v.string()),
		taxAmount: v.optional(v.number()),
		usedAmount: v.optional(v.number()),
		refundAmount: v.optional(v.number()),
		refundCurrency: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<EmailNotificationResult> => {
		const apiKey = process.env.RESEND_API_KEY;
		const fromEmail = process.env.RESEND_FROM_EMAIL;
		if (!apiKey || !fromEmail) {
			console.error("Resend email not configured");
			return { success: false, error: "Email service not configured" };
		}

		const { workspaceName, recipients } = await ctx.runQuery(
			internal.email.getWorkspaceBillingRecipients,
			{ workspaceId: args.workspaceId }
		);

		if (recipients.length === 0) {
			return { success: true, skipped: true };
		}

		const appUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		const billingUrl = appUrl
			? `${appUrl}/workspace/${args.workspaceId}/manage#billing`
			: undefined;
		const previousPlanLabel = planLabel(args.previousPlan);
		const newPlanLabel = planLabel(args.newPlan);
		const actionText =
			args.changeType === "upgrade" ? "upgraded" : "downgraded";
		const subject = `${workspaceName} plan ${actionText} to ${newPlanLabel}`;
		const latestInvoiceUrl = args.invoiceUrl;
		const currency = args.currency ?? "USD";
		const invoiceTotal = args.amountDue ?? null;
		const taxAmount = args.taxAmount ?? null;
		const refundAmount = args.refundAmount ?? null;
		const refundCurrency = args.refundCurrency ?? currency;
		const usedAmount = args.usedAmount ?? null;
		const planAmount =
			typeof invoiceTotal === "number" && typeof taxAmount === "number"
				? Math.max(0, invoiceTotal - taxAmount)
				: null;
		const netPaid =
			typeof invoiceTotal === "number" && typeof refundAmount === "number"
				? Math.max(0, invoiceTotal - refundAmount)
				: null;
		const summaryRows = [
			billingRow("Plan amount before tax", planAmount, currency),
			billingRow("Tax", taxAmount, currency),
			billingRow("Paid amount", invoiceTotal, currency),
			billingRow("Deducted amount", usedAmount, currency),
			billingRow("Refunded amount", refundAmount, refundCurrency),
			billingRow("Net paid after refund", netPaid, currency),
		].filter((row): row is [string, string] => Boolean(row?.[1]));

		const results = [];
		for (const recipient of recipients) {
			const summaryHtml = summaryRows.length
				? `<div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin: 18px 0;">
						<p style="font-weight: 600; margin: 0 0 10px;">Fair billing details</p>
						${summaryRows
							.map(
								([label, value]) =>
									`<p style="display: flex; justify-content: space-between; gap: 16px; margin: 6px 0;"><span style="color: #6b7280;">${label}</span><strong>${value}</strong></p>`
							)
							.join("")}
						${
							args.changeType === "downgrade"
								? '<p style="font-size: 12px; color: #6b7280; margin: 10px 0 0;">These amounts come from the Dodo payment and refund records for this plan change.</p>'
								: '<p style="font-size: 12px; color: #6b7280; margin: 10px 0 0;">These amounts come from the Dodo invoice for this plan change.</p>'
						}
					</div>`
				: "";
			const html = `
				<!DOCTYPE html>
				<html>
					<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937;">
						<div style="max-width: 600px; margin: 0 auto; padding: 24px;">
							<h1 style="font-size: 24px; margin: 0 0 16px;">Workspace plan ${actionText}</h1>
							<p>Hi ${escapeHtml(recipient.name)},</p>
							<p>The <strong>${escapeHtml(workspaceName)}</strong> workspace plan was ${actionText} from <strong>${previousPlanLabel}</strong> to <strong>${newPlanLabel}</strong>.</p>
							${summaryHtml}
							${
								billingUrl
									? `<p><a href="${billingUrl}" style="display: inline-block; background: #111827; color: white; text-decoration: none; padding: 10px 16px; border-radius: 6px;">View billing</a></p>`
									: ""
							}
							${
								latestInvoiceUrl
									? `<p><a href="${latestInvoiceUrl}" style="display: inline-block; border: 1px solid #d1d5db; color: #111827; text-decoration: none; padding: 9px 15px; border-radius: 6px;">View invoice</a></p>`
									: ""
							}
							<p style="font-size: 12px; color: #6b7280; margin-top: 24px;">You are receiving this because you are an owner or admin of this workspace.</p>
						</div>
					</body>
				</html>
			`;

			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10_000);
				let response: Response;
				try {
					response = await fetch("https://api.resend.com/emails", {
						method: "POST",
						headers: {
							Authorization: `Bearer ${apiKey}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							from: fromEmail,
							to: recipient.email,
							subject,
							html,
						}),
						signal: controller.signal,
					});
				} finally {
					clearTimeout(timeoutId);
				}

				if (!response.ok) {
					const errorText = await response.text();
					console.error("Plan change email API error:", {
						status: response.status,
						body: errorText,
					});
					results.push({ email: recipient.email, success: false });
					continue;
				}

				results.push({ email: recipient.email, success: true });
			} catch (error) {
				console.error("Error sending plan change email:", error);
				results.push({ email: recipient.email, success: false });
			}
		}

		return {
			success: results.some((result) => result.success),
			...(results.every((result) => !result.success)
				? { error: "Failed to send all plan change emails" }
				: {}),
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
