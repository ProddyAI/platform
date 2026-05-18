import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { logger } from "../src/lib/logger";
import { api, internal } from "./_generated/api";
import { action, internalAction, mutation } from "./_generated/server";

// Delay push notifications to allow OneSignal client SDK login to complete.
// The OneSignal SDK needs time to register the user on the frontend before the
// push notification is dispatched from the backend. This 2s delay accounts for
// network latency and SDK initialization time.
const PUSH_NOTIFICATION_DELAY_MS = 2000;

type NotificationType =
	| "mentions"
	| "assignee"
	| "threadReply"
	| "directMessage"
	| "inviteSent"
	| "workspaceJoin"
	| "onlineStatus";

/**
 * Send a push notification to specific users
 * This should be called from your backend or Convex actions
 */
export const sendPushNotification = internalAction({
	args: {
		userIds: v.array(v.id("users")),
		title: v.string(),
		message: v.string(),
		notificationType: v.union(
			v.literal("mentions"),
			v.literal("assignee"),
			v.literal("threadReply"),
			v.literal("directMessage"),
			v.literal("inviteSent"),
			v.literal("workspaceJoin"),
			v.literal("onlineStatus")
		),
		data: v.optional(v.record(v.string(), v.any())),
	},
	handler: async (ctx, args) => {
		// Get OneSignal API key from environment
		const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
		const oneSignalAppId = process.env.ONESIGNAL_APP_ID;

		if (!oneSignalApiKey || !oneSignalAppId) {
			console.warn("🔔 OneSignal not configured - missing API key or app ID");
			return { success: false, error: "OneSignal not configured" };
		}

		const filteredUserIds: string[] = [];

		// Fetch all users and preferences in parallel to avoid N+1 query pattern
		const userIds = args.userIds;
		const users = await Promise.all(
			userIds.map((id) => ctx.runQuery(internal.users._getUserById, { id }))
		);
		const notificationPrefs = await Promise.all(
			userIds.map((userId) =>
				ctx.runQuery(api.preferences.getNotificationPreferencesByUserId, {
					userId,
				})
			)
		);

		for (let i = 0; i < userIds.length; i++) {
			const userId = userIds[i];
			const user = users[i]; if (!user) continue;
			const notifications = notificationPrefs[i];

			const browserEnabled = notifications?.browserNotificationsEnabled ?? true;
			const browserPrefs = notifications?.notificationBrowserPrefs;
			const legacyPref =
				notifications?.[args.notificationType as NotificationType];
			const browserPref =
				browserPrefs?.[args.notificationType as NotificationType] ??
				legacyPref ??
				true;

			// Safety fallback: if new browser prefs are absent on legacy docs, preserve old push behavior.
			const allowPush = !browserPrefs
				? browserEnabled !== false
				: browserEnabled && browserPref;

			if (!allowPush) {
				continue;
			}

			// Only add users who have a valid OneSignal external ID
			const oneSignalExternalId = user.onesignalExternalId;
			if (!oneSignalExternalId) {
				logger.warn("User not subscribed to OneSignal", { userId });
				continue;
			}
		}

		if (filteredUserIds.length === 0) {
			logger.warn("No users to notify - empty user list");
			return { success: true, message: "No users to notify" };
		}

		try {
			logger.info("Sending push notification", {
				recipientCount: filteredUserIds.length,
				notificationType: args.notificationType,
			});

			// Send notification via OneSignal REST API
			const response = await fetch("https://api.onesignal.com/notifications", {
				method: "POST",
				headers: {
					Authorization: `Basic ${oneSignalApiKey}`,
					"content-type": "application/json; charset=utf-8",
				},
				body: JSON.stringify({
					app_id: oneSignalAppId,
					include_external_user_ids: filteredUserIds,
					target_channel: "push",
					headings: { en: args.title },
					contents: { en: args.message },
					data: args.data || {},
				}),
			});

			const responseText = await response.text();
			let result: Record<string, any> = {};
			try {
				result = responseText ? JSON.parse(responseText) : {};
			} catch {
				result = { raw: responseText };
			}

			if (!response.ok) {
				logger.error("OneSignal push request failed", {
					status: response.status,
					userCount: filteredUserIds.length,
					errorMessage: result.errors || result.error_message,
				});
				return {
					success: false,
					status: response.status,
					message: "Push notification failed",
				};
			}

			const recipients = Number(
				result.recipients ?? result.recipients_count ?? 0
			);

			if (recipients === 0) {
				logger.warn("OneSignal accepted request but 0 recipients reached", {
					userCount: filteredUserIds.length,
					notificationId: result.id,
				});
			}

			return {
				success: true,
				id: result.id,
				recipients,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			logger.error("OneSignal push notification failed", {
				error: errorMessage,
				userCount: filteredUserIds.length,
			});
			return { success: false, message: "Push notification failed" };
		}
	},
});

export const sendTestPushNotification = action({
	args: {},
	handler: async (ctx): Promise<{ success: boolean; recipients: number }> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const result = await ctx.runAction(internal.notifications.sendPushNotification, {
			userIds: [userId],
			title: "Test notification",
			message: "Your browser push notifications are working.",
			notificationType: "mentions" as const,
			data: {
				type: "test_push",
				userId,
			},
		});

		logger.info("Test push notification sent", {
			recipients: result?.recipients ?? 0,
		});

		return {
			success: !!result?.success,
			recipients: result?.recipients ?? 0,
		};
	},
});

/**
 * Trigger notification for workspace invite
 */
export const notifyInviteSent = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		invitedEmail: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Get workspace details
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		// Get all members in the workspace (not just online)
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const userIds = members.map((m) => m.userId).filter((id) => id !== userId); // Don't notify the sender

		if (userIds.length === 0) return;

		// Schedule internal notification
		await ctx.scheduler.runAfter(
			2000,
			internal.notifications.sendPushNotification,
			{
				userIds,
				title: `New invite in ${workspace.name}`,
				message: "An invitation has been sent",
				notificationType: "inviteSent",
				data: {
					workspaceId: args.workspaceId,
					type: "invite_sent",
				},
			}
		);
	},
});

/**
 * Trigger notification when someone joins a workspace
 */
export const notifyWorkspaceJoin = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		newMemberId: v.id("members"),
	},
	handler: async (ctx, args) => {
		// Require authentication
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Get workspace details
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		// Get new member details
		const newMember = await ctx.db.get(args.newMemberId);
		if (!newMember) throw new Error("Member not found");

		const newUser = await ctx.db.get(newMember.userId);
		if (!newUser) throw new Error("User not found");

		// Get all active members in the workspace (excluding the new member)
		const activeStatuses = await ctx.db
			.query("history")
			.withIndex("by_workspace_id_status", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("status", "active")
			)
			.collect();

		const onlineUserIds = activeStatuses
			.map((s) => s.userId)
			.filter((id) => id !== newMember.userId);

		if (onlineUserIds.length === 0) return;

		// Delay push notification to allow OneSignal client registration
		await ctx.scheduler.runAfter(
			PUSH_NOTIFICATION_DELAY_MS,
			internal.notifications.sendPushNotification,
			{
				userIds: onlineUserIds,
				title: `${newUser.name} joined ${workspace.name}`,
				message: `${newUser.name} has joined the workspace`,
				notificationType: "workspaceJoin",
				data: {
					workspaceId: args.workspaceId,
					userId: newMember.userId,
					type: "workspace_join",
				},
			}
		);
	},
});

/**
 * Trigger notification for online/offline status changes
 */
export const notifyStatusChange = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		newStatus: v.union(
			v.literal("online"),
			v.literal("idle"),
			v.literal("dnd"),
			v.literal("offline")
		),
		oldStatus: v.union(
			v.literal("online"),
			v.literal("idle"),
			v.literal("dnd"),
			v.literal("offline")
		),
	},
	handler: async (ctx, args) => {
		// Require authentication
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) throw new Error("Unauthorized");

		// Only notify for online/offline changes, not DND
		const shouldNotify =
			(args.oldStatus === "offline" && args.newStatus === "online") ||
			(args.oldStatus === "online" && args.newStatus === "offline");

		if (!shouldNotify) return;

		// Get workspace details
		const workspace = await ctx.db.get(args.workspaceId);
		const workspaceName = workspace?.name || "your workspace";

		// Get user details
		const user = await ctx.db.get(args.userId);
		if (!user) return;

		// Get all members in the workspace (excluding the user who changed status)
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		const userIds = members
			.map((m) => m.userId)
			.filter((id) => id !== args.userId);

		if (userIds.length === 0) return;

		// eslint-disable-next-line no-warning-comments
		// TODO: Add preference and interaction filtering to reduce notification noise
		const statusMessage =
			args.newStatus === "online" ? "is now online" : "is now offline";

		// Delay push notification to allow OneSignal client registration
		await ctx.scheduler.runAfter(
			PUSH_NOTIFICATION_DELAY_MS,
			internal.notifications.sendPushNotification,
			{
				userIds,
				title: `${user.name} ${statusMessage}`,
				message: `${user.name} ${statusMessage} in ${workspaceName}`,
				notificationType: "onlineStatus",
				data: {
					workspaceId: args.workspaceId,
					userId: args.userId,
					status: args.newStatus,
					type: "status_change",
				},
			}
		);
	},
});
