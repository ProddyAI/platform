import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, mutation } from "./_generated/server";

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
		data: v.optional(v.any()),
	},
	handler: async (_ctx, args) => {
		// Get OneSignal API key from environment
		const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
		const oneSignalAppId = process.env.ONESIGNAL_APP_ID;

		if (!oneSignalApiKey || !oneSignalAppId) {
			console.warn("OneSignal not configured");
			return { success: false, error: "OneSignal not configured" };
		}

		// For now, notify all users (actual preference filtering would require DB access)
		// In a production system, you might want to handle preferences differently
		const filteredUserIds = args.userIds;

		if (filteredUserIds.length === 0) {
			return { success: true, message: "No users to notify" };
		}

		try {
			// Send notification via OneSignal REST API
			const response = await fetch(
				"https://onesignal.com/api/v1/notifications",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Basic ${oneSignalApiKey}`,
					},
					body: JSON.stringify({
						app_id: oneSignalAppId,
						include_aliases: {
							external_id: filteredUserIds,
						},
						target_channel: "push",
						headings: { en: args.title },
						contents: { en: args.message },
						data: args.data || {},
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				console.error(`OneSignal error: status ${response.status}`);
				return {
					success: false,
					status: response.status,
					message: "Push notification failed",
				};
			}

			// Sanitize response: only expose safe summary fields
			return {
				success: true,
				id: result.id,
				recipients: result.recipients || result.recipients_count || 0,
			};
		} catch (_error) {
			console.error("Push notification failed");
			return { success: false, message: "Push notification failed" };
		}
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
			0,
			internal.notifications.sendPushNotification,
			{
				userIds,
				title: `New invite in ${workspace.name}`,
				message: `An invitation has been sent to ${args.invitedEmail}`,
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

		// Schedule internal notification
		await ctx.scheduler.runAfter(
			0,
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
		newStatus: v.string(),
		oldStatus: v.string(),
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

		// TODO: Add preference and interaction filtering to reduce notification noise
		const statusMessage =
			args.newStatus === "online" ? "is now online" : "is now offline";

		// Schedule internal notification
		await ctx.scheduler.runAfter(
			0,
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
