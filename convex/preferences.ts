import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

export type ExpandedSections = Record<string, boolean>;

export type WidgetSize = "small" | "medium" | "large";

export type DashboardWidget = {
	id: string;
	title: string;
	description: string;
	visible: boolean;
	size: WidgetSize;
};

export type WorkspacePreference = {
	sidebarCollapsed?: boolean;
	expandedSections?: ExpandedSections;
	dashboardWidgets?: DashboardWidget[];
};

const notificationDayValidator = v.union(
	v.literal("monday"),
	v.literal("tuesday"),
	v.literal("wednesday"),
	v.literal("thursday"),
	v.literal("friday"),
	v.literal("saturday"),
	v.literal("sunday")
);

type NotificationKey =
	| "mentions"
	| "assignee"
	| "threadReply"
	| "directMessage"
	| "inviteSent"
	| "workspaceJoin"
	| "onlineStatus";

const defaultBrowserPrefs: Record<NotificationKey, boolean> = {
	mentions: true,
	assignee: true,
	threadReply: true,
	directMessage: true,
	inviteSent: true,
	workspaceJoin: false,
	onlineStatus: true,
};

const defaultEmailPrefs: Record<NotificationKey, boolean> = {
	mentions: true,
	assignee: true,
	threadReply: true,
	directMessage: true,
	inviteSent: true,
	workspaceJoin: true,
	onlineStatus: false,
};

const buildNotificationDefaults = (notifications?: Record<string, any>) => {
	const legacy = notifications || {};
	return {
		mentions: legacy.mentions ?? true,
		assignee: legacy.assignee ?? true,
		threadReply: legacy.threadReply ?? true,
		directMessage: legacy.directMessage ?? true,
		weeklyDigest: legacy.weeklyDigest ?? false,
		weeklyDigestDay: legacy.weeklyDigestDay ?? "monday",
		inviteSent: legacy.inviteSent ?? true,
		workspaceJoin: legacy.workspaceJoin ?? true,
		onlineStatus: legacy.onlineStatus ?? false,
		notificationBrowserPrefs: {
			...defaultBrowserPrefs,
			workspaceJoin: legacy.workspaceJoin ?? defaultBrowserPrefs.workspaceJoin,
			onlineStatus: legacy.onlineStatus ?? defaultBrowserPrefs.onlineStatus,
			...(legacy.notificationBrowserPrefs || {}),
		},
		notificationEmailPrefs: {
			...defaultEmailPrefs,
			workspaceJoin: legacy.workspaceJoin ?? defaultEmailPrefs.workspaceJoin,
			onlineStatus: legacy.onlineStatus ?? defaultEmailPrefs.onlineStatus,
			...(legacy.notificationEmailPrefs || {}),
		},
		browserNotificationsEnabled: legacy.browserNotificationsEnabled ?? true,
		emailNotificationsEnabled: legacy.emailNotificationsEnabled ?? true,
		notificationSummaryMode: legacy.notificationSummaryMode ?? "realtime",
	};
};

export const updateLastActiveWorkspace = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		const isOwner = workspace.userId === userId;

		if (!member && !isOwner) {
			throw new Error("User is not a member of this workspace");
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const timestamp = Date.now();

		if (existingPrefs) {
			// Update existing preferences
			await ctx.db.patch(existingPrefs._id, {
				lastActiveWorkspaceId: args.workspaceId,
				lastActiveTimestamp: timestamp,
			});
		} else {
			// Create new preferences
			await ctx.db.insert("preferences", {
				userId,
				lastActiveWorkspaceId: args.workspaceId,
				lastActiveTimestamp: timestamp,
			});
		}

		return { success: true };
	},
});

/**
 * Get the last active workspace for a user
 */
export const getLastActiveWorkspace = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			return null;
		}

		// Get user preferences
		const userPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		if (!userPrefs?.lastActiveWorkspaceId) {
			return null;
		}

		// Verify the workspace still exists and the user is still a member
		const workspaceId = userPrefs.lastActiveWorkspaceId as Id<"workspaces">;

		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) {
			return null;
		}

		if (workspace.userId === userId) {
			return workspaceId;
		}

		// Check if the user is still a member of this workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) {
			return null;
		}

		return workspaceId;
	},
});

/**
 * Get all user preferences
 */
export const getUserPreferences = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			return null;
		}

		return await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();
	},
});

/**
 * Update user preferences
 */
export const updateUserPreferences = mutation({
	args: {
		settings: v.optional(
			v.object({
				theme: v.optional(v.string()),
				statusTracking: v.optional(v.boolean()),
				notifications: v.optional(
					v.object({
						mentions: v.optional(v.boolean()),
						assignee: v.optional(v.boolean()),
						threadReply: v.optional(v.boolean()),
						directMessage: v.optional(v.boolean()),
						weeklyDigest: v.optional(v.boolean()),
						weeklyDigestDay: v.optional(notificationDayValidator),
						inviteSent: v.optional(v.boolean()),
						workspaceJoin: v.optional(v.boolean()),
						onlineStatus: v.optional(v.boolean()),
						notificationBrowserPrefs: v.optional(
							v.object({
								mentions: v.optional(v.boolean()),
								assignee: v.optional(v.boolean()),
								threadReply: v.optional(v.boolean()),
								directMessage: v.optional(v.boolean()),
								inviteSent: v.optional(v.boolean()),
								workspaceJoin: v.optional(v.boolean()),
								onlineStatus: v.optional(v.boolean()),
							})
						),
						notificationEmailPrefs: v.optional(
							v.object({
								mentions: v.optional(v.boolean()),
								assignee: v.optional(v.boolean()),
								threadReply: v.optional(v.boolean()),
								directMessage: v.optional(v.boolean()),
								inviteSent: v.optional(v.boolean()),
								workspaceJoin: v.optional(v.boolean()),
								onlineStatus: v.optional(v.boolean()),
							})
						),
						browserNotificationsEnabled: v.optional(v.boolean()),
						emailNotificationsEnabled: v.optional(v.boolean()),
						notificationSummaryMode: v.optional(
							v.union(v.literal("realtime"), v.literal("batched30m"))
						),
					})
				),
			})
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		if (existingPrefs) {
			// Update existing preferences, merging with existing settings
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					...args.settings,
				},
			});
		} else {
			// Create new preferences
			await ctx.db.insert("preferences", {
				userId,
				settings: args.settings,
			});
		}

		return { success: true };
	},
});

/**
 * Check if user has status tracking enabled (default: true)
 */
export const isStatusTrackingEnabled = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return false;

		const preferences = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		// Default to true if no preference is set
		return preferences?.settings?.statusTracking ?? true;
	},
});

/**
 * Get user notification preferences with defaults
 */
export const getNotificationPreferences = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const preferences = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const notifications = preferences?.settings?.notifications as
			| Record<string, any>
			| undefined;

		return buildNotificationDefaults(notifications);
	},
});

/**
 * Bulk update multiple browser notification preferences in a single atomic operation
 * Prevents race conditions when updating multiple keys at once
 * 
 * IMPORTANT: This is the only way to update browser preferences. Individual key updates
 * (like updateBrowserPref) have been removed due to race condition vulnerability where
 * concurrent patches overwrite each other. Always use this bulk mutation instead.
 */
export const updateBrowserPrefs = mutation({
	args: {
		updates: v.object({
			mentions: v.optional(v.boolean()),
			assignee: v.optional(v.boolean()),
			threadReply: v.optional(v.boolean()),
			directMessage: v.optional(v.boolean()),
			inviteSent: v.optional(v.boolean()),
			workspaceJoin: v.optional(v.boolean()),
			onlineStatus: v.optional(v.boolean()),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const merged = buildNotificationDefaults(
			(existingPrefs?.settings?.notifications as Record<string, any>) ||
				undefined
		);
		const nextNotifications = {
			...merged,
			notificationBrowserPrefs: {
				...merged.notificationBrowserPrefs,
				...args.updates,
			},
		};

		if (existingPrefs) {
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					notifications: nextNotifications,
				},
			});
		} else {
			await ctx.db.insert("preferences", {
				userId,
				settings: { notifications: nextNotifications },
			});
		}

		return { success: true };
	},
});

/**
 * Bulk update multiple email notification preferences in a single atomic operation
 * Prevents race conditions when updating multiple keys at once
 * 
 * IMPORTANT: This is the only way to update email preferences. Individual key updates
 * (like updateEmailPref) have been removed due to race condition vulnerability where
 * concurrent patches overwrite each other. Always use this bulk mutation instead.
 */
export const updateEmailPrefs = mutation({
	args: {
		updates: v.object({
			mentions: v.optional(v.boolean()),
			assignee: v.optional(v.boolean()),
			threadReply: v.optional(v.boolean()),
			directMessage: v.optional(v.boolean()),
			inviteSent: v.optional(v.boolean()),
			workspaceJoin: v.optional(v.boolean()),
			onlineStatus: v.optional(v.boolean()),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const merged = buildNotificationDefaults(
			(existingPrefs?.settings?.notifications as Record<string, any>) ||
				undefined
		);
		const nextNotifications = {
			...merged,
			notificationEmailPrefs: {
				...merged.notificationEmailPrefs,
				...args.updates,
			},
		};

		if (existingPrefs) {
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					notifications: nextNotifications,
				},
			});
		} else {
			await ctx.db.insert("preferences", {
				userId,
				settings: { notifications: nextNotifications },
			});
		}

		return { success: true };
	},
});

export const updateChannelToggle = mutation({
	args: {
		channel: v.union(v.literal("browser"), v.literal("email")),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		const merged = buildNotificationDefaults(
			(existingPrefs?.settings?.notifications as Record<string, any>) ||
				undefined
		);
		const nextNotifications = {
			...merged,
			browserNotificationsEnabled:
				args.channel === "browser"
					? args.enabled
					: merged.browserNotificationsEnabled,
			emailNotificationsEnabled:
				args.channel === "email"
					? args.enabled
					: merged.emailNotificationsEnabled,
		};

		if (existingPrefs) {
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					notifications: nextNotifications,
				},
			});
		} else {
			await ctx.db.insert("preferences", {
				userId,
				settings: { notifications: nextNotifications },
			});
		}

		return { success: true };
	},
});

/**
 * Get workspace preferences for a specific workspace
 */
export const getWorkspacePreferences = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			return null;
		}

		// Get user preferences
		const userPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		if (!userPrefs?.workspacePreferences) {
			return null;
		}

		// Convert workspaceId to string for use as a key in the record
		const workspaceIdStr = args.workspaceId.toString();

		// Return the preferences for this specific workspace
		return userPrefs.workspacePreferences[workspaceIdStr] || null;
	},
});

/**
 * Fix preferences documents where notifications is a boolean instead of an object
 * This fixes the schema validation error where some documents have notifications: true instead of the expected object structure
 */
export const fixNotificationsSchema = mutation({
	args: {},
	handler: async (ctx) => {
		// Get all preferences documents
		const allPreferences = await ctx.db.query("preferences").collect();

		let fixedCount = 0;
		let skippedCount = 0;

		for (const pref of allPreferences) {
			// Check if settings.notifications is a boolean (the problematic case)
			// Use type assertion to bypass TypeScript checking since we know the data might be inconsistent
			const notifications = pref.settings?.notifications as any;

			if (notifications === true || notifications === false) {
				// Convert boolean to proper object structure with defaults
				const newSettings = {
					...pref.settings,
					notifications: {
						mentions: true, // Default values
						assignee: true,
						threadReply: true,
						directMessage: true,
						weeklyDigest: notifications === true, // Preserve the original boolean intent
						weeklyDigestDay: "monday" as const,
					},
				};

				await ctx.db.patch(pref._id, {
					settings: newSettings,
				});

				fixedCount++;
			} else {
				skippedCount++;
			}
		}

		return {
			success: true,
			totalDocuments: allPreferences.length,
			fixedCount,
			skippedCount,
			message: `Migration completed successfully. Fixed ${fixedCount} documents, skipped ${skippedCount} documents.`,
		};
	},
});

/**
 * Check current state of preferences documents for schema issues
 */
export const checkNotificationsSchema = mutation({
	args: {},
	handler: async (ctx) => {
		// Get all preferences documents to check the current state
		const allPreferences = await ctx.db.query("preferences").collect();

		const problematicDocs = [];
		let validDocs = 0;

		for (const pref of allPreferences) {
			const notifications = pref.settings?.notifications as any;

			if (notifications === true || notifications === false) {
				problematicDocs.push({
					id: pref._id,
					userId: pref.userId,
					notificationsValue: notifications,
				});
			} else if (notifications && typeof notifications === "object") {
				validDocs++;
			}
		}

		return {
			totalDocuments: allPreferences.length,
			problematicDocuments: problematicDocs.length,
			validDocuments: validDocs,
			problematicDocs: problematicDocs.slice(0, 5), // Show first 5 for inspection
			needsMigration: problematicDocs.length > 0,
		};
	},
});

/**
 * Update workspace preferences for a specific workspace
 */
export const updateWorkspacePreferences = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		preferences: v.object({
			sidebarCollapsed: v.optional(v.boolean()),
			expandedSections: v.optional(v.record(v.string(), v.boolean())),
			dashboardWidgets: v.optional(
				v.array(
					v.object({
						id: v.string(),
						title: v.string(),
						description: v.string(),
						visible: v.boolean(),
						size: v.union(
							v.literal("small"),
							v.literal("medium"),
							v.literal("large")
						),
					})
				)
			),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		// Convert workspaceId to string for use as a key in the record
		const workspaceIdStr = args.workspaceId.toString();

		if (existingPrefs) {
			// Get current workspace preferences or initialize empty object
			const currentWorkspacePrefs = existingPrefs.workspacePreferences || {};

			// Update the preferences for this specific workspace
			const updatedWorkspacePrefs = {
				...currentWorkspacePrefs,
				[workspaceIdStr]: {
					...currentWorkspacePrefs[workspaceIdStr],
					...args.preferences,
				},
			};

			// Update existing preferences
			await ctx.db.patch(existingPrefs._id, {
				workspacePreferences: updatedWorkspacePrefs,
			});
		} else {
			// Create new preferences with workspace preferences
			await ctx.db.insert("preferences", {
				userId,
				workspacePreferences: {
					[workspaceIdStr]: args.preferences,
				},
			});
		}

		return { success: true };
	},
});

/**
 * Update sidebar collapsed state for a specific workspace
 */
export const updateSidebarCollapsed = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		isCollapsed: v.boolean(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		// Convert workspaceId to string for use as a key in the record
		const workspaceIdStr = args.workspaceId.toString();

		if (existingPrefs) {
			// Get current workspace preferences or initialize empty object
			const currentWorkspacePrefs = existingPrefs.workspacePreferences || {};

			// Get current preferences for this workspace or initialize
			const currentPrefs = currentWorkspacePrefs[workspaceIdStr] || {};

			// Update the sidebar collapsed state
			const updatedWorkspacePrefs = {
				...currentWorkspacePrefs,
				[workspaceIdStr]: {
					...currentPrefs,
					sidebarCollapsed: args.isCollapsed,
				},
			};

			// Update existing preferences
			await ctx.db.patch(existingPrefs._id, {
				workspacePreferences: updatedWorkspacePrefs,
			});
		} else {
			// Create new preferences with workspace preferences
			await ctx.db.insert("preferences", {
				userId,
				workspacePreferences: {
					[workspaceIdStr]: {
						sidebarCollapsed: args.isCollapsed,
					},
				},
			});
		}

		return { success: true };
	},
});

/**
 * Update dashboard widgets for a specific workspace
 */
export const updateDashboardWidgets = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		dashboardWidgets: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.string(),
				visible: v.boolean(),
				size: v.union(
					v.literal("small"),
					v.literal("medium"),
					v.literal("large")
				),
			})
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		// Convert workspaceId to string for use as a key in the record
		const workspaceIdStr = args.workspaceId.toString();

		if (existingPrefs) {
			// Get current workspace preferences or initialize empty object
			const currentWorkspacePrefs = existingPrefs.workspacePreferences || {};

			// Get current preferences for this workspace or initialize
			const currentPrefs = currentWorkspacePrefs[workspaceIdStr] || {};

			// Update the dashboard widgets
			const updatedWorkspacePrefs = {
				...currentWorkspacePrefs,
				[workspaceIdStr]: {
					...currentPrefs,
					dashboardWidgets: args.dashboardWidgets,
				},
			};

			// Update existing preferences
			await ctx.db.patch(existingPrefs._id, {
				workspacePreferences: updatedWorkspacePrefs,
			});
		} else {
			// Create new preferences with workspace preferences
			await ctx.db.insert("preferences", {
				userId,
				workspacePreferences: {
					[workspaceIdStr]: {
						dashboardWidgets: args.dashboardWidgets,
					},
				},
			});
		}

		return { success: true };
	},
});

/**
 * Update notification preferences for a specific user (for unsubscribe functionality)
 * This function doesn't require authentication since it's used by unsubscribe links
 */
export const updateNotificationPreferencesByUserId = mutation({
	args: {
		userId: v.id("users"),
		notificationKey: v.union(
			v.literal("mentions"),
			v.literal("assignee"),
			v.literal("threadReply"),
			v.literal("directMessage"),
			v.literal("weeklyDigest"),
			v.literal("inviteSent"),
			v.literal("workspaceJoin"),
			v.literal("onlineStatus")
		),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", args.userId))
			.unique();

		if (existingPrefs) {
			// Get current notifications or initialize with defaults
			const currentNotifications = buildNotificationDefaults(
				existingPrefs.settings?.notifications as Record<string, any> | undefined
			);

			// Update the specific notification preference
			const updatedNotifications = {
				...currentNotifications,
				[args.notificationKey]: args.enabled,
			};

			// Update existing preferences
			await ctx.db.patch(existingPrefs._id, {
				settings: {
					...existingPrefs.settings,
					notifications: updatedNotifications,
				},
			});
		} else {
			// Create new preferences with the updated notification setting
			const notifications = {
				...buildNotificationDefaults(undefined),
				[args.notificationKey]: args.enabled,
			};

			await ctx.db.insert("preferences", {
				userId: args.userId,
				settings: {
					notifications,
				},
			});
		}

		return { success: true };
	},
});

/**
 * Get notification preferences for a specific user by ID (for unsubscribe functionality)
 */
export const getNotificationPreferencesByUserId = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const preferences = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", args.userId))
			.unique();

		const notifications = preferences?.settings?.notifications as
			| Record<string, any>
			| undefined;

		return buildNotificationDefaults(notifications);
	},
});
