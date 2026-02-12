import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";

/**
 * Send a push notification to specific users
 * This should be called from your backend or Convex actions
 */
export const sendPushNotification = internalMutation({
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
	handler: async (ctx, args) => {
		// Get OneSignal API key from environment
		const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;
		const oneSignalAppId = process.env.ONESIGNAL_APP_ID;

		if (!oneSignalApiKey || !oneSignalAppId) {
			console.warn("OneSignal not configured");
			return { success: false, error: "OneSignal not configured" };
		}

		// Check notification preferences for each user
		const filteredUserIds: string[] = [];

		for (const userId of args.userIds) {
			const preferences = await ctx.db
				.query("preferences")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.unique();

			const notifications = preferences?.settings?.notifications;

			// Check if user has this notification type enabled
			const isEnabled = notifications?.[args.notificationType] ?? true;

			if (isEnabled) {
				filteredUserIds.push(userId);
			}
		}

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
						include_external_user_ids: filteredUserIds,
						headings: { en: args.title },
						contents: { en: args.message },
						data: args.data || {},
					}),
				}
			);

			const result = await response.json();

			if (!response.ok) {
				console.error("OneSignal error:", result);
				return { success: false, error: result };
			}

			return { success: true, result };
		} catch (error) {
			console.error("Error sending push notification:", error);
			return { success: false, error };
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

		// Get all online members in the workspace
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
			"notifications:sendPushNotification" as any,
			{
				userIds,
				title: `Invite sent to ${workspace.name}`,
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
		// Get workspace details
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		// Get new member details
		const newMember = await ctx.db.get(args.newMemberId);
		if (!newMember) throw new Error("Member not found");

		const newUser = await ctx.db.get(newMember.userId);
		if (!newUser) throw new Error("User not found");

		// Get all online members in the workspace (excluding the new member)
		const onlineStatuses = await ctx.db
			.query("history")
			.withIndex("by_workspace_id_status", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("status", "online")
			)
			.collect();

		const onlineUserIds = onlineStatuses
			.map((s) => s.userId)
			.filter((id) => id !== newMember.userId);

		if (onlineUserIds.length === 0) return;

		// Schedule internal notification
		await ctx.scheduler.runAfter(
			0,
			"notifications:sendPushNotification" as any,
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
		// Only notify for online/offline changes, not DND
		const shouldNotify =
			(args.oldStatus === "offline" && args.newStatus === "online") ||
			(args.oldStatus === "online" && args.newStatus === "offline");

		if (!shouldNotify) return;

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

		const statusMessage =
			args.newStatus === "online" ? "is now online" : "is now offline";

		// Schedule internal notification
		await ctx.scheduler.runAfter(
			0,
			"notifications:sendPushNotification" as any,
			{
				userIds,
				title: `${user.name} ${statusMessage}`,
				message: `${user.name} ${statusMessage} in ${(await ctx.db.get(args.workspaceId))?.name}`,
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
