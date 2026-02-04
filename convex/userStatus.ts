import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Status types: online, idle, dnd, offline, hidden
export type UserStatus = "online" | "idle" | "dnd" | "offline" | "hidden";

/**
 * Set user's custom status (DND, etc.)
 */
export const setUserStatus = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		status: v.union(
			v.literal("online"),
			v.literal("idle"),
			v.literal("dnd"),
			v.literal("offline")
		),
	},
	handler: async (ctx, { workspaceId, status }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) {
			throw new Error("Not a member of this workspace");
		}

		// Update or create user status record in preferences
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		if (existingPrefs) {
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					userStatus: status,
				},
			});
		} else {
			await ctx.db.insert("preferences", {
				userId,
				settings: {
					userStatus: status,
					statusTracking: true,
				},
			});
		}

		return { success: true };
	},
});

/**
 * Get user's current status
 */
export const getUserStatus = query({
	args: {
		userId: v.id("users"),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, { userId, workspaceId }) => {
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) {
			return { status: "offline" as UserStatus, lastSeen: null };
		}

		// Check if user has status tracking enabled
		const userPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

		if (!statusTrackingEnabled) {
			// Return "hidden" status so the bubble doesn't appear
			return { status: "hidden" as UserStatus, lastSeen: null };
		}

		// Get custom status if set
		const customStatus = userPrefs?.settings?.userStatus as UserStatus | undefined;

		// If user has set DND status, return it
		if (customStatus === "dnd") {
			return { status: "dnd" as UserStatus, lastSeen: Date.now() };
		}

		// Check recent presence activity to determine online/idle/offline
		const presenceData = await ctx.db
			.query("history")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.order("desc")
			.first();

		if (!presenceData) {
			return { status: "offline" as UserStatus, lastSeen: null };
		}

		const now = Date.now();
		const timeSinceLastSeen = now - presenceData.lastSeen;

		// Online: Actively connected (real-time presence)
		// Idle/Yellow: Active within last 5 minutes
		// Offline/Gray: No activity for more than 6 minutes

		let status: UserStatus = "offline";
		if (timeSinceLastSeen < 60000) {
			// Less than 1 minute - actively online (green)
			status = "online";
		} else if (timeSinceLastSeen < 300000) {
			// Less than 5 minutes - recently active (yellow)
			status = "idle";
		} else {
			// More than 6 minutes - offline (gray)
			status = "offline";
		}

		return {
			status,
			lastSeen: presenceData.lastSeen,
		};
	},
});

/**
 * Get multiple users' statuses efficiently
 */
export const getMultipleUserStatuses = query({
	args: {
		userIds: v.array(v.id("users")),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, { userIds, workspaceId }) => {
		const authUserId = await getAuthUserId(ctx);
		if (!authUserId) {
			return {};
		}

		const statusMap: Record<Id<"users">, { status: UserStatus; lastSeen: number | null }> = {};

		for (const userId of userIds) {
			// Check if user has status tracking enabled
			const userPrefs = await ctx.db
				.query("preferences")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.unique();

			const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

			if (!statusTrackingEnabled) {
				// If tracking disabled, don't show any status
				continue;
			}

			// Get custom status if set
			const customStatus = userPrefs?.settings?.userStatus as UserStatus | undefined;

			// If user has set DND status, return it
			if (customStatus === "dnd") {
				statusMap[userId] = { status: "dnd", lastSeen: Date.now() };
				continue;
			}

			// Check recent presence activity
			const presenceData = await ctx.db
				.query("history")
				.withIndex("by_workspace_id_user_id", (q) =>
					q.eq("workspaceId", workspaceId).eq("userId", userId)
				)
				.order("desc")
				.first();

			if (!presenceData) {
				statusMap[userId] = { status: "offline", lastSeen: null };
				continue;
			}

			const now = Date.now();
			const timeSinceLastSeen = now - presenceData.lastSeen;

			let status: UserStatus = "offline";
			if (timeSinceLastSeen < 60000) {
				// Less than 1 minute - actively online (green)
				status = "online";
			} else if (timeSinceLastSeen < 300000) {
				// Less than 5 minutes - recently active (yellow)
				status = "idle";
			} else {
				// More than 6 minutes - offline (gray)
				status = "offline";
			}

			statusMap[userId] = {
				status,
				lastSeen: presenceData.lastSeen,
			};
		}

		return statusMap;
	},
});
