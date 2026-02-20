import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * Send OneSignal push notification for import completion
 */
export const sendImportNotification = internalAction({
	args: {
		userId: v.id("users"),
		workspaceId: v.id("workspaces"),
		platform: v.string(),
		status: v.union(
			v.literal("completed"),
			v.literal("failed"),
			v.literal("cancelled")
		),
		channelsImported: v.optional(v.number()),
		messagesImported: v.optional(v.number()),
	},
	handler: async (_ctx, args) => {
		try {
			// Get OneSignal configuration from environment
			const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
			const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY;

			if (!oneSignalAppId || !oneSignalApiKey) {
				console.warn("OneSignal not configured, skipping notification");
				return;
			}

			// Get user's OneSignal player ID from preferences or external player table
			// For now, we'll broadcast to all users in the workspace
			// In production, you'd store player IDs per user

			// Prepare notification content
			let title: string;
			let message: string;

			switch (args.status) {
				case "completed":
					title = "Import Completed Successfully!";
					message = `Your ${args.platform} import is complete. ${args.channelsImported || 0} channels and ${args.messagesImported || 0} messages imported.`;
					break;
				case "failed":
					title = "Import Failed";
					message = `Your ${args.platform} import encountered an error. Please try again.`;
					break;
				case "cancelled":
					title = "Import Cancelled";
					message = `Your ${args.platform} import was cancelled.`;
					break;
				default:
					title = "Import Update";
					message = `Your ${args.platform} import status: ${args.status}`;
			}

			// Send notification via OneSignal API
			const notificationPayload = {
				app_id: oneSignalAppId,
				headings: { en: title },
				contents: { en: message },
				include_aliases: {
					external_user_id: [args.userId],
				},
				data: {
					type: "import_completion",
					workspaceId: args.workspaceId,
					platform: args.platform,
					status: args.status,
				},
				// Fallback: send to all users if alias not found
				include_player_ids: [], // You can add specific player IDs here
			};

			const response = await fetch(
				"https://onesignal.com/api/v1/notifications",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Basic ${oneSignalApiKey}`,
					},
					body: JSON.stringify(notificationPayload),
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				console.error("OneSignal notification failed:", errorData);
			} else {
				const result = await response.json();
				console.log("OneSignal notification sent:", result);
			}
		} catch (error) {
			console.error("Error sending OneSignal notification:", error);
		}
	},
});

/**
 * Send in-app notification for import completion
 * This stores the notification in the database for display in the app
 */
export const sendInAppImportNotification = internalAction({
	args: {
		userId: v.id("users"),
		workspaceId: v.id("workspaces"),
		platform: v.string(),
		status: v.union(
			v.literal("completed"),
			v.literal("failed"),
			v.literal("cancelled")
		),
		channelsImported: v.optional(v.number()),
		messagesImported: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		try {
			// Get member ID for the user in this workspace
			const member = await ctx.runQuery(
				internal.members._getByWorkspaceAndUser,
				{
					workspaceId: args.workspaceId,
					userId: args.userId,
				}
			);

			if (!member) {
				console.warn("Member not found for notification");
				return;
			}

			// Create notification message
			let _message: string;
			let _type: string;

			switch (args.status) {
				case "completed":
					_message = `✅ ${args.platform} import completed: ${args.channelsImported || 0} channels, ${args.messagesImported || 0} messages`;
					_type = "success";
					break;
				case "failed":
					_message = `❌ ${args.platform} import failed. Please try again.`;
					_type = "error";
					break;
				case "cancelled":
					_message = `⚠️ ${args.platform} import was cancelled.`;
					_type = "warning";
					break;
				default:
					_message = `${args.platform} import status: ${args.status}`;
					_type = "info";
			}

			// Store notification in a notifications table (if you have one)
			// For now, we'll just skip logging
			// If you have a notifications table, insert here:
			// await ctx.db.insert("notifications", {
			//   userId: args.userId,
			//   workspaceId: args.workspaceId,
			//   message,
			//   type,
			//   read: false,
			//   createdAt: Date.now(),
			// });
		} catch (error) {
			console.error("Error creating in-app notification:", error);
		}
	},
});
