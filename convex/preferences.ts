import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// Type definitions for workspace preferences
export type ExpandedSections = Record<string, boolean>;

export type WidgetSize = 'small' | 'medium' | 'large';

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

/**
 * Update the last active workspace for a user
 */
export const updateLastActiveWorkspace = mutation({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error('Unauthorized');
		}

		// Check if the user is a member of the workspace
		const member = await ctx.db
			.query('members')
			.withIndex('by_workspace_id_user_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('userId', userId)
			)
			.unique();

		if (!member) {
			throw new Error('User is not a member of this workspace');
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			await ctx.db.insert('preferences', {
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
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
			.unique();

		if (!userPrefs || !userPrefs.lastActiveWorkspaceId) {
			return null;
		}

		// Verify the workspace still exists and the user is still a member
		const workspaceId = userPrefs.lastActiveWorkspaceId as Id<'workspaces'>;

		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) {
			return null;
		}

		// Check if the user is still a member of this workspace
		const member = await ctx.db
			.query('members')
			.withIndex('by_workspace_id_user_id', (q) =>
				q.eq('workspaceId', workspaceId).eq('userId', userId)
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
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
						weeklyDigestDay: v.optional(
							v.union(
								v.literal('monday'),
								v.literal('tuesday'),
								v.literal('wednesday'),
								v.literal('thursday'),
								v.literal('friday'),
								v.literal('saturday'),
								v.literal('sunday')
							)
						),
					})
				),
			})
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error('Unauthorized');
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			await ctx.db.insert('preferences', {
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
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
			.unique();

		const notifications = preferences?.settings?.notifications;

		// Return with defaults
		return {
			mentions: notifications?.mentions ?? true,
			assignee: notifications?.assignee ?? true,
			threadReply: notifications?.threadReply ?? true,
			directMessage: notifications?.directMessage ?? true,
			weeklyDigest: notifications?.weeklyDigest ?? false,
			weeklyDigestDay: notifications?.weeklyDigestDay ?? 'monday',
		};
	},
});

/**
 * Get workspace preferences for a specific workspace
 */
export const getWorkspacePreferences = query({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			return null;
		}

		// Get user preferences
		const userPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
			.unique();

		if (!userPrefs || !userPrefs.workspacePreferences) {
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
		console.log('Starting migration to fix preferences notifications...');

		// Get all preferences documents
		const allPreferences = await ctx.db.query('preferences').collect();

		let fixedCount = 0;
		let skippedCount = 0;

		for (const pref of allPreferences) {
			// Check if settings.notifications is a boolean (the problematic case)
			// Use type assertion to bypass TypeScript checking since we know the data might be inconsistent
			const notifications = pref.settings?.notifications as any;

			if (notifications === true || notifications === false) {
				console.log(
					`Fixing preferences document ${pref._id} - notifications was boolean: ${notifications}`
				);

				// Convert boolean to proper object structure with defaults
				const newSettings = {
					...pref.settings,
					notifications: {
						mentions: true, // Default values
						assignee: true,
						threadReply: true,
						directMessage: true,
						weeklyDigest: notifications === true ? true : false, // Preserve the original boolean intent
						weeklyDigestDay: 'monday' as const,
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

		console.log(
			`Migration completed. Fixed: ${fixedCount}, Skipped: ${skippedCount}, Total: ${allPreferences.length}`
		);

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
		const allPreferences = await ctx.db.query('preferences').collect();

		console.log(`Found ${allPreferences.length} preferences documents`);

		let problematicDocs = [];
		let validDocs = 0;

		for (const pref of allPreferences) {
			const notifications = pref.settings?.notifications as any;

			if (notifications === true || notifications === false) {
				problematicDocs.push({
					id: pref._id,
					userId: pref.userId,
					notificationsValue: notifications,
				});
			} else if (notifications && typeof notifications === 'object') {
				validDocs++;
			}
		}

		console.log(
			`Found ${problematicDocs.length} documents with boolean notifications`
		);
		console.log(`Found ${validDocs} documents with valid object notifications`);

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
		workspaceId: v.id('workspaces'),
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
				size: v.union(v.literal('small'), v.literal('medium'), v.literal('large')),
					})
				)
			),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error('Unauthorized');
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			await ctx.db.insert('preferences', {
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
		workspaceId: v.id('workspaces'),
		isCollapsed: v.boolean(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error('Unauthorized');
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			await ctx.db.insert('preferences', {
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
		workspaceId: v.id('workspaces'),
		dashboardWidgets: v.array(
			v.object({
				id: v.string(),
				title: v.string(),
				description: v.string(),
				visible: v.boolean(),
				size: v.union(v.literal('small'), v.literal('medium'), v.literal('large')),
			})
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error('Unauthorized');
		}

		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', userId))
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
			await ctx.db.insert('preferences', {
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
		userId: v.id('users'),
		notificationKey: v.union(
			v.literal('mentions'),
			v.literal('assignee'),
			v.literal('threadReply'),
			v.literal('directMessage'),
			v.literal('weeklyDigest')
		),
		enabled: v.boolean(),
	},
	handler: async (ctx, args) => {
		// Check if user preferences already exist
		const existingPrefs = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', args.userId))
			.unique();

		if (existingPrefs) {
			// Get current notifications or initialize with defaults
			const currentNotifications = existingPrefs.settings?.notifications || {
				mentions: true,
				assignee: true,
				threadReply: true,
				directMessage: true,
				weeklyDigest: false,
				weeklyDigestDay: 'monday' as const,
			};

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
				mentions: true,
				assignee: true,
				threadReply: true,
				directMessage: true,
				weeklyDigest: false,
				weeklyDigestDay: 'monday' as const,
				[args.notificationKey]: args.enabled,
			};

			await ctx.db.insert('preferences', {
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
		userId: v.id('users'),
	},
	handler: async (ctx, args) => {
		const preferences = await ctx.db
			.query('preferences')
			.withIndex('by_user_id', (q) => q.eq('userId', args.userId))
			.unique();

		const notifications = preferences?.settings?.notifications;

		// Return with defaults
		return {
			mentions: notifications?.mentions ?? true,
			assignee: notifications?.assignee ?? true,
			threadReply: notifications?.threadReply ?? true,
			directMessage: notifications?.directMessage ?? true,
			weeklyDigest: notifications?.weeklyDigest ?? false,
			weeklyDigestDay: notifications?.weeklyDigestDay ?? 'monday',
		};
	},
});
