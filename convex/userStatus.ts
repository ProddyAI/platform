import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

export type UserStatus = "online" | "idle" | "dnd" | "offline" | "hidden";

// Status threshold constants
const ONLINE_THRESHOLD_MS = 60_000; // 1 minute
const IDLE_THRESHOLD_MS = 300_000; // 5 minutes

/**
 * Determine user status based on time since last seen
 */
function determineStatusFromLastSeen(deltaMs: number): UserStatus {
	if (deltaMs < ONLINE_THRESHOLD_MS) {
		return "online";
	}
	if (deltaMs < IDLE_THRESHOLD_MS) {
		return "idle";
	}
	return "offline";
}

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

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) {
			throw new Error("Not a member of this workspace");
		}

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

		const userPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

		if (!statusTrackingEnabled) {
			return { status: "hidden" as UserStatus, lastSeen: null };
		}

		const customStatus = userPrefs?.settings?.userStatus as
			| UserStatus
			| undefined;

		if (customStatus === "dnd") {
			return { status: "dnd" as UserStatus, lastSeen: Date.now() };
		}

		// Get all active presence records for this user/workspace and find the most recent
		const allPresenceData = await ctx.db
			.query("history")
			.withIndex("by_workspace_id_user_id_status", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId).eq("status", "active")
			)
			.collect();

		// Find the record with the most recent lastSeen timestamp
		const presenceData =
			allPresenceData.length > 0
				? allPresenceData.reduce((latest, current) =>
						current.lastSeen > latest.lastSeen ? current : latest
					)
				: null;
	
		if (!presenceData) {
			return { status: "offline" as UserStatus, lastSeen: null };
		}
	
		const now = Date.now();
		const timeSinceLastSeen = now - presenceData.lastSeen;
	
		const status = determineStatusFromLastSeen(timeSinceLastSeen);

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

		// Batch fetch all user preferences
		const prefsPromises = userIds.map((userId) =>
			ctx.db
				.query("preferences")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.unique()
		);
		const allPrefs = await Promise.all(prefsPromises);

		// Batch fetch all presence data
		const presencePromises = userIds.map(async (userId) => {
			const records = await ctx.db
				.query("history")
				.withIndex("by_workspace_id_user_id_status", (q) =>
					q.eq("workspaceId", workspaceId).eq("userId", userId).eq("status", "active")
				)
				.collect();
	
			// Find the record with the most recent lastSeen timestamp
			return records.length > 0
				? records.reduce((latest, current) =>
						current.lastSeen > latest.lastSeen ? current : latest
					)
				: null;
		});
		const allPresenceData = await Promise.all(presencePromises);

		// Build status map from batched data
		const statusMap: Record<
			Id<"users">,
			{ status: UserStatus; lastSeen: number | null }
		> = {};

		const now = Date.now();

		for (let i = 0; i < userIds.length; i++) {
			const userId = userIds[i];
			const userPrefs = allPrefs[i];
			const presenceData = allPresenceData[i];

			const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

			if (!statusTrackingEnabled) {
				statusMap[userId] = { status: "hidden", lastSeen: null };
				continue;
			}

			const customStatus = userPrefs?.settings?.userStatus as
				| UserStatus
				| undefined;

			if (customStatus === "dnd") {
				statusMap[userId] = { status: "dnd", lastSeen: now };
				continue;
			}

			if (!presenceData) {
				statusMap[userId] = { status: "offline", lastSeen: null };
				continue;
			}

			const timeSinceLastSeen = now - presenceData.lastSeen;

			const status = determineStatusFromLastSeen(timeSinceLastSeen);

			statusMap[userId] = {
				status,
				lastSeen: presenceData.lastSeen,
			};
		}

		return statusMap;
	},
});
