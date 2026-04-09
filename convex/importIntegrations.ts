import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all import connections for a workspace
 */
export const getConnections = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get all connections for the workspace
		const connections = await ctx.db
			.query("import_connections")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();

		// Don't expose sensitive tokens in the response
		return connections.map((conn) => {
			const { accessToken, refreshToken, ...safe } = conn;
			return safe;
		});
	},
});

/**
 * Get import jobs for a workspace
 */
export const getJobs = query({
	args: {
		workspaceId: v.id("workspaces"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		const query = ctx.db
			.query("import_jobs")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc");

		if (args.limit) {
			return await query.take(args.limit);
		}

		return await query.collect();
	},
});

/**
 * Get a specific import job
 */
export const getJob = query({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const job = await ctx.db.get(args.jobId);
		if (!job) throw new Error("Job not found");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", job.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		return job;
	},
});

/**
 * Internal get job by id (no auth)
 */
export const _getJob = internalQuery({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.jobId);
	},
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Initiate Slack OAuth flow
 * Returns the authorization URL for the user to visit
 */
export const initiateSlackOAuth = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get Slack OAuth credentials from environment
		const clientId = process.env.SLACK_CLIENT_ID;
		if (!clientId) {
			throw new Error("Slack OAuth not configured");
		}

		// Build OAuth URL with minimal scopes
		const scopes = [
			"channels:read",
			"channels:history",
			"users:read",
			"files:read",
			"team:read",
		].join(",");

		// Get app URL from environment variables
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";
		const redirectUri = `${appUrl}/api/import/slack/callback`;

		// Generate URL-safe state parameter for CSRF protection
		const stateJson = JSON.stringify({
			workspaceId: args.workspaceId,
			memberId: member._id,
		});
		const state = base64UrlEncode(stateJson);

		const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

		return {
			authUrl,
			state,
		};
	},
});

/**
 * Initiate Todoist OAuth flow
 * Returns the authorization URL for the user to visit
 */
export const initiateTodoistOAuth = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get Todoist OAuth credentials from environment
		const clientId = process.env.TODOIST_CLIENT_ID;
		if (!clientId) {
			throw new Error("Todoist OAuth not configured");
		}

		// Get app URL from environment variables
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";
		const redirectUri = `${appUrl}/api/import/todoist/callback`;

		// Generate URL-safe state parameter for CSRF protection
		const stateJson = JSON.stringify({
			workspaceId: args.workspaceId,
			memberId: member._id,
		});
		const state = base64UrlEncode(stateJson);

		// Todoist OAuth - must include response_type=code
		const authUrl = `https://todoist.com/oauth/authorize?client_id=${clientId}&scope=data:read_write&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

		return {
			authUrl,
			state,
		};
	},
});

/**
 * Initiate Linear OAuth flow
 * Returns the authorization URL for the user to visit
 */
export const initiateLinearOAuth = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get Linear OAuth credentials from environment
		const clientId = process.env.LINEAR_CLIENT_ID;
		const clientSecret = process.env.LINEAR_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			throw new Error("Linear OAuth not configured");
		}

		// Get app URL from environment variables
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			"https://localhost:3000";
		const redirectUri = `${appUrl}/api/import/linear/callback`;

		// Generate URL-safe state parameter for CSRF protection
		const stateJson = JSON.stringify({
			workspaceId: args.workspaceId,
			memberId: member._id,
		});
		const state = base64UrlEncode(stateJson);

		// Linear OAuth - must include response_type=code
		const authUrl = `https://linear.app/oauth/authorize?client_id=${clientId}&scope=read&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

		console.log("[LinearOAuth] FULL AUTH URL:", authUrl);

		return {
			authUrl,
			state,
		};
	},
});

function base64UrlEncode(value: string): string {
	const base64 = btoa(value);
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Store Slack OAuth tokens after successful authorization
 * This should be called from the OAuth callback
 */
export const storeSlackConnection = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		accessToken: v.string(),
		refreshToken: v.optional(v.string()),
		expiresAt: v.optional(v.number()),
		scope: v.string(),
		teamId: v.string(),
		teamName: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if connection already exists
		const existing = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", args.memberId).eq("platform", "slack")
			)
			.first();

		const now = Date.now();

		if (existing) {
			// Update existing connection
			await ctx.db.patch(existing._id, {
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				scope: args.scope,
				teamId: args.teamId,
				teamName: args.teamName,
				status: "active",
				lastUsed: now,
			});
			return existing._id;
		}

		// Create new connection
		const connectionId = await ctx.db.insert("import_connections", {
			workspaceId: args.workspaceId,
			memberId: args.memberId,
			platform: "slack",
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			scope: args.scope,
			teamId: args.teamId,
			teamName: args.teamName,
			status: "active",
			connectedAt: now,
			lastUsed: now,
		});

		return connectionId;
	},
});

/**
 * Store Todoist OAuth tokens after successful authorization
 * This should be called from the OAuth callback
 */
export const storeTodoistConnection = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		accessToken: v.string(),
		refreshToken: v.optional(v.string()),
		expiresAt: v.optional(v.number()),
		scope: v.string(),
		userId: v.string(),
		userName: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if connection already exists
		const existing = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", args.memberId).eq("platform", "todoist")
			)
			.first();

		const now = Date.now();

		if (existing) {
			// Update existing connection
			await ctx.db.patch(existing._id, {
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				scope: args.scope,
				teamId: args.userId,
				teamName: args.userName,
				status: "active",
				lastUsed: now,
			});
			return existing._id;
		}

		// Create new connection
		const connectionId = await ctx.db.insert("import_connections", {
			workspaceId: args.workspaceId,
			memberId: args.memberId,
			platform: "todoist",
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			scope: args.scope,
			teamId: args.userId,
			teamName: args.userName,
			status: "active",
			connectedAt: now,
			lastUsed: now,
		});

		return connectionId;
	},
});

/**
 * Store Linear OAuth tokens after successful authorization
 * This should be called from the OAuth callback
 */
export const storeLinearConnection = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		accessToken: v.string(),
		refreshToken: v.optional(v.string()),
		expiresAt: v.optional(v.number()),
		scope: v.string(),
		organizationId: v.string(),
		organizationName: v.string(),
	},
	handler: async (ctx, args) => {
		console.log("[LinearOAuth] Storing connection:", {
			workspaceId: args.workspaceId,
			memberId: args.memberId,
			organizationId: args.organizationId,
			organizationName: args.organizationName,
			tokenLength: args.accessToken.length,
			tokenPreview: args.accessToken.substring(0, 20) + "...",
			hasRefreshToken: !!args.refreshToken,
		});

		// Check if connection already exists
		const existing = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", args.memberId).eq("platform", "linear")
			)
			.first();

		const now = Date.now();

		if (existing) {
			// Update existing connection
			await ctx.db.patch(existing._id, {
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				scope: args.scope,
				teamId: args.organizationId,
				teamName: args.organizationName,
				status: "active",
				lastUsed: now,
			});
			return existing._id;
		}

		// Create new connection
		const connectionId = await ctx.db.insert("import_connections", {
			workspaceId: args.workspaceId,
			memberId: args.memberId,
			platform: "linear",
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			scope: args.scope,
			teamId: args.organizationId,
			teamName: args.organizationName,
			status: "active",
			connectedAt: now,
			lastUsed: now,
		});

		return connectionId;
	},
});

/**
 * Start a Slack import job
 */
export const startSlackImport = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		config: v.object({
			channels: v.optional(v.array(v.string())),
			dateFrom: v.optional(v.number()),
			dateTo: v.optional(v.number()),
			includeFiles: v.optional(v.boolean()),
			includeThreads: v.optional(v.boolean()),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get the Slack connection
		const connection = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", member._id).eq("platform", "slack")
			)
			.first();

		if (!connection) {
			throw new Error("You need to connect to Slack before importing data");
		}

		if (connection.status !== "active") {
			throw new Error("You need to connect to Slack before importing data");
		}

		// Check for existing jobs to prevent duplicate imports
		const existingJob = await ctx.db
			.query("import_jobs")
			.withIndex("by_connection_id", (q) =>
				q.eq("connectionId", connection._id)
			)
			.filter((q) =>
				q.or(
					q.eq(q.field("status"), "pending"),
					q.eq(q.field("status"), "in_progress")
				)
			)
			.first();

		if (existingJob) {
			throw new Error("Import already in progress for this connection");
		}

		// Create import job
		const jobId = await ctx.db.insert("import_jobs", {
			workspaceId: args.workspaceId,
			memberId: member._id,
			connectionId: connection._id,
			platform: "slack",
			status: "pending",
			config: args.config,
			progress: {
				channelsImported: 0,
				channelsTotal: args.config.channels?.length || 0,
				messagesImported: 0,
				usersImported: 0,
				filesImported: 0,
				currentStep: "Initializing import...",
			},
			createdAt: Date.now(),
		});

		// Schedule the import action to run in the background
		await ctx.scheduler.runAfter(
			0,
			internal.importIntegrations.processSlackImport,
			{
				jobId,
			}
		);

		return jobId;
	},
});

/**
 * Find duplicate imported channels for a workspace
 */
export const findDuplicateChannels = query({
	args: {
		workspaceId: v.id("workspaces"),
		platform: v.union(
			v.literal("slack"),
			v.literal("todoist"),
			v.literal("linear"),
			v.literal("notion"),
			v.literal("miro"),
			v.literal("clickup")
		),
	},
	handler: async (ctx, args): Promise<unknown> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Use internal query to find duplicates
		const duplicates: unknown = await ctx.runQuery(
			internal.importIntegrations._findDuplicateChannels as any,
			{
				workspaceId: args.workspaceId,
				platform: args.platform,
			}
		);
		return duplicates;
	},
});

/**
 * Clean up duplicate imported channels for a workspace
 * Keeps the oldest channel and removes duplicates
 * Reassigns messages from duplicate channels to the kept channel
 */
export const cleanupDuplicateChannels = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		platform: v.union(
			v.literal("slack"),
			v.literal("todoist"),
			v.literal("linear"),
			v.literal("notion"),
			v.literal("miro"),
			v.literal("clickup")
		),
	},
	handler: async (ctx, args): Promise<unknown> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Use internal mutation to cleanup duplicates
		const cleanedUp: unknown = await ctx.runMutation(
			internal.importIntegrations._cleanupDuplicateChannels as any,
			{
				workspaceId: args.workspaceId,
				platform: args.platform,
			}
		);
		return cleanedUp;
	},
});

/**
 * Start a Todoist import job
 */
export const startTodoistImport = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		config: v.object({
			projects: v.optional(v.array(v.string())),
			dateFrom: v.optional(v.number()),
			dateTo: v.optional(v.number()),
			includeCompleted: v.optional(v.boolean()),
			includeComments: v.optional(v.boolean()),
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get the Todoist connection
		const connection = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", member._id).eq("platform", "todoist")
			)
			.first();

		if (!connection) {
			throw new Error("You need to connect to Todoist before importing data");
		}

		if (connection.status !== "active") {
			throw new Error("You need to connect to Todoist before importing data");
		}

		// Check for existing jobs to prevent duplicate imports
		const existingJob = await ctx.db
			.query("import_jobs")
			.withIndex("by_connection_id", (q) =>
				q.eq("connectionId", connection._id)
			)
			.filter((q) =>
				q.or(
					q.eq(q.field("status"), "pending"),
					q.eq(q.field("status"), "in_progress")
				)
			)
			.first();

		if (existingJob) {
			throw new Error("Import already in progress for this connection");
		}

		// Create import job
		const jobId = await ctx.db.insert("import_jobs", {
			workspaceId: args.workspaceId,
			memberId: member._id,
			connectionId: connection._id,
			platform: "todoist",
			status: "pending",
			config: args.config,
			progress: {
				channelsImported: 0,
				channelsTotal: 0,
				messagesImported: 0,
				usersImported: 0,
				filesImported: 0,
				currentStep: "Initializing import...",
			},
			createdAt: Date.now(),
		});

		// Schedule the import action to run in the background
		await ctx.scheduler.runAfter(
			0,
			internal.importIntegrations.processTodoistImport,
			{
				jobId,
			}
		);

		return jobId;
	},
});

/**
 * Start a Linear import job
 */
export const startLinearImport = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		config: v.object({
			teams: v.optional(v.array(v.string())), // Linear team IDs to import
			includeArchived: v.optional(v.boolean()),
			includeComments: v.optional(v.boolean()),
			channels: v.optional(v.array(v.string())), // Specific channel IDs to create
			targetChannelId: v.optional(v.id("channels")), // Target channel to import into
		}),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Get the Linear connection
		const connection = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", member._id).eq("platform", "linear")
			)
			.first();

		if (!connection) {
			throw new Error("You need to connect to Linear before importing data");
		}

		if (connection.status !== "active") {
			throw new Error("You need to connect to Linear before importing data");
		}

		// Validate target channel if provided
		if (args.config.targetChannelId) {
			const targetChannel = await ctx.db.get(args.config.targetChannelId);
			if (!targetChannel || targetChannel.workspaceId !== args.workspaceId) {
				throw new Error("Invalid target channel selected");
			}
		}

		// Check for existing jobs to prevent duplicate imports
		const existingJob = await ctx.db
			.query("import_jobs")
			.withIndex("by_connection_id", (q) =>
				q.eq("connectionId", connection._id)
			)
			.filter((q) =>
				q.or(
					q.eq(q.field("status"), "pending"),
					q.eq(q.field("status"), "in_progress")
				)
			)
			.first();

		if (existingJob) {
			throw new Error("Import already in progress for this connection");
		}

		// Create import job
		const jobId = await ctx.db.insert("import_jobs", {
			workspaceId: args.workspaceId,
			memberId: member._id,
			connectionId: connection._id,
			platform: "linear",
			status: "pending",
			config: args.config as any,
			progress: {
				channelsImported: 0,
				channelsTotal: 0,
				messagesImported: 0,
				usersImported: 0,
				filesImported: 0,
				currentStep: "Initializing import...",
			},
			createdAt: Date.now(),
		});

		// Schedule the import action to run in the background
		await ctx.scheduler.runAfter(
			0,
			internal.importIntegrations.processLinearImport,
			{
				jobId,
			}
		);

		return jobId;
	},
});

/**
 * Cancel an import job
 */
export const cancelImportJob = mutation({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const job = await ctx.db.get(args.jobId);
		if (!job) throw new Error("Job not found");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", job.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Can only cancel pending or in_progress jobs
		if (job.status !== "pending" && job.status !== "in_progress") {
			throw new Error("Can only cancel pending or in-progress jobs");
		}

		await ctx.db.patch(args.jobId, {
			status: "cancelled",
			completedAt: Date.now(),
		});

		return true;
	},
});

/**
 * Disconnect an import connection
 */
export const disconnectImportConnection = mutation({
	args: {
		connectionId: v.id("import_connections"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const connection = await ctx.db.get(args.connectionId);
		if (!connection) throw new Error("Connection not found");

		// Verify user owns this connection
		const member = await ctx.db.get(connection.memberId);
		if (!member || member.userId !== userId) {
			throw new Error("Not authorized to disconnect this connection");
		}

		// Update connection status to revoked
		await ctx.db.patch(args.connectionId, {
			status: "revoked",
		});

		return true;
	},
});

// ============================================================================
// ACTIONS - Background Processing
// ============================================================================

/**
 * Process Slack import in the background
 * This is called by the scheduler after a job is created
 */
export const processSlackImport = internalAction({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const startTime = Date.now();

		try {
			// Get job details
			const job = await ctx.runQuery(internal.importIntegrations._getJob, {
				jobId: args.jobId,
			});

			if (!job) {
				throw new Error("Job not found");
			}

			// Check if job was cancelled before we started processing
			if (job.status === "cancelled") {
				return;
			}

			// Update job status to in_progress
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "in_progress",
				startedAt: Date.now(),
				currentStep: "Validating Slack connection...",
			});

			// Get the connection with access token
			const connection = await ctx.runQuery(
				internal.importIntegrations.getConnectionWithToken,
				{
					connectionId: job.connectionId,
				}
			);

			if (!connection) {
				throw new Error("Connection not found");
			}

			if (!connection.accessToken) {
				throw new Error("Access token not found");
			}

			// Check if token is expired
			if (connection.expiresAt && Date.now() >= connection.expiresAt) {
				throw new Error("Slack access token has expired. Please reconnect.");
			}

			// Create import context
			const importContext: any = {
				accessToken: connection.accessToken,
				refreshToken: connection.refreshToken,
				expiresAt: connection.expiresAt,
				config: job.config,
				progress: {
					itemsImported: job.progress.channelsImported,
					itemsTotal: job.progress.channelsTotal,
					subItemsImported: job.progress.messagesImported,
					subItemsTotal: job.progress.messagesTotal,
					usersImported: job.progress.usersImported,
					filesImported: job.progress.filesImported || 0,
					currentStep: job.progress.currentStep,
					channelsImported: job.progress.channelsImported,
					channelsTotal: job.progress.channelsTotal,
					messagesImported: job.progress.messagesImported,
					messagesTotal: job.progress.messagesTotal,
				},
				jobId: args.jobId,
				workspaceId: job.workspaceId,
				memberId: job.memberId,
				isCancelled: async () => {
					const currentJob = await ctx.runQuery(
						internal.importIntegrations._getJob,
						{
							jobId: args.jobId,
						}
					);
					return currentJob?.status === "cancelled";
				},
				updateProgress: async (progress: any) => {
					await ctx.runMutation(internal.importIntegrations.updateJobProgress, {
						jobId: args.jobId,
						currentStep: progress.currentStep || "",
						channelsImported: progress.channelsImported || 0,
						messagesImported: progress.messagesImported || 0,
						usersImported: progress.usersImported || 0,
						filesImported: progress.filesImported,
						messagesTotal: progress.messagesTotal,
					});
				},
				log: async (
					level: "info" | "warn" | "error",
					message: string,
					data?: unknown
				) => {
					console.log(`[SlackImport:${level}] ${message}`, data);
				},
				runMutation: async (mutation: any, args: any) => {
					return await ctx.runMutation(mutation, args);
				},
				runQuery: async (query: any, args: any) => {
					return await ctx.runQuery(query, args);
				},
			};

			// Import the Slack provider and execute the import
			const { SlackImportProvider, executeSlackImport } = await import(
				"./slackImportProvider"
			);
			const provider = new SlackImportProvider();

			// Execute the import
			const result = await executeSlackImport(importContext, provider);

			// Update job with results
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "completed",
				completedAt: Date.now(),
				currentStep: "Import completed successfully",
			});

			// Store result summary
			await ctx.runMutation(internal.importIntegrations.storeImportResult, {
				jobId: args.jobId,
				result: {
					channelsCreated: result.itemsCreated as any[],
					messagesCreated: result.messagesCreated,
					usersMatched: result.usersMatched,
					filesImported: result.filesImported,
					errors: result.errors,
					warnings: result.warnings,
				},
			});

			// Log completion
			const duration = Date.now() - startTime;
			console.log(`[SlackImport] Completed in ${duration}ms`, {
				channels: result.itemsCreated.length,
				messages: result.messagesCreated,
				users: result.usersMatched,
				files: result.filesImported,
			});

			// Schedule completion notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("[SlackImport] Failed:", errorMessage, error);

			// Mark job as failed
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "failed",
				completedAt: Date.now(),
				errorMessage,
				currentStep: `Import failed: ${errorMessage}`,
			});

			// Schedule failure notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		}
	},
});

/**
 * Process Todoist import in the background
 * Follows the same pipeline structure as Slack import
 */
export const processTodoistImport = internalAction({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const _startTime = Date.now();

		try {
			// Get job details
			const job = await ctx.runQuery(internal.importIntegrations._getJob, {
				jobId: args.jobId,
			});

			if (!job) {
				throw new Error("Job not found");
			}

			// Check if job was cancelled
			if (job.status === "cancelled") {
				return;
			}

			// Update job status to in_progress
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "in_progress",
				startedAt: Date.now(),
				currentStep: "Validating Todoist connection...",
			});

			// Get the connection with access token
			const connection = await ctx.runQuery(
				internal.importIntegrations.getConnectionWithToken,
				{
					connectionId: job.connectionId,
				}
			);

			if (!connection) {
				throw new Error("Connection not found");
			}

			if (!connection.accessToken) {
				throw new Error("Access token not found");
			}

			// Create import context
			const importContext: any = {
				accessToken: connection.accessToken,
				config: job.config,
				progress: job.progress,
				jobId: args.jobId,
				workspaceId: job.workspaceId,
				memberId: job.memberId,
				isCancelled: async () => {
					const currentJob = await ctx.runQuery(
						internal.importIntegrations._getJob,
						{
							jobId: args.jobId,
						}
					);
					return currentJob?.status === "cancelled";
				},
				updateProgress: async (progress: any) => {
					await ctx.runMutation(internal.importIntegrations.updateJobProgress, {
						jobId: args.jobId,
						currentStep: progress.currentStep || "",
						channelsImported: progress.channelsImported || 0,
						messagesImported: progress.messagesImported || 0,
						usersImported: progress.usersImported || 0,
						filesImported: progress.filesImported,
						messagesTotal: progress.messagesTotal,
					});
				},
				log: async (
					level: "info" | "warn" | "error",
					message: string,
					data?: unknown
				) => {
					console.log(`[TodoistImport:${level}] ${message}`, data);
				},
				runMutation: async (mutation: any, args: any) => {
					return await ctx.runMutation(mutation, args);
				},
				runQuery: async (query: any, args: any) => {
					return await ctx.runQuery(query, args);
				},
			};

			// Import the Todoist provider and execute the import
			const { TodoistImportProvider, executeTodoistImport } = await import(
				"./todoistImportProvider"
			);
			const provider = new TodoistImportProvider();

			// Execute the import
			const result = await executeTodoistImport(importContext, provider);

			// Update job with results
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "completed",
				completedAt: Date.now(),
				currentStep: "Import completed successfully",
			});

			// Store result summary
			await ctx.runMutation(internal.importIntegrations.storeImportResult, {
				jobId: args.jobId,
				result: {
					channelsCreated: result.itemsCreated as any[],
					messagesCreated: result.messagesCreated,
					usersMatched: result.usersMatched,
					filesImported: result.filesImported,
					errors: result.errors,
					warnings: result.warnings,
				},
			});

			// Schedule completion notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("[TodoistImport] Failed:", errorMessage, error);

			// Mark job as failed
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "failed",
				completedAt: Date.now(),
				errorMessage,
				currentStep: `Import failed: ${errorMessage}`,
			});

			// Schedule failure notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		}
	},
});

/**
 * Process Linear import in the background
 * Follows the same pipeline structure as Slack import
 */
export const processLinearImport = internalAction({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const _startTime = Date.now();

		try {
			// Get job details
			const job = await ctx.runQuery(internal.importIntegrations._getJob, {
				jobId: args.jobId,
			});

			if (!job) {
				throw new Error("Job not found");
			}

			// Check if job was cancelled
			if (job.status === "cancelled") {
				return;
			}

			// Update job status to in_progress
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "in_progress",
				startedAt: Date.now(),
				currentStep: "Validating Linear connection...",
			});

			// Get the connection with access token
			const connection = await ctx.runQuery(
				internal.importIntegrations.getConnectionWithToken,
				{
					connectionId: job.connectionId,
				}
			);

			if (!connection) {
				throw new Error("Connection not found");
			}

			if (!connection.accessToken) {
				console.error("[LinearImport] Access token missing in connection:", {
					connectionId: connection._id,
					platform: connection.platform,
					status: connection.status,
					hasToken: !!connection.accessToken,
				});
				throw new Error("Access token not found. Please reconnect to Linear.");
			}

			console.log("[LinearImport] Connection found:", {
				connectionId: connection._id,
				platform: connection.platform,
				status: connection.status,
				organizationName: connection.teamName,
				tokenLength: connection.accessToken.length,
			});

			// Create import context
			const member = await ctx.runQuery(internal.members._getMemberById, {
				id: job.memberId,
			});

			const importContext: any = {
				accessToken: connection.accessToken,
				config: {
					includeArchived: (job.config as any).includeArchived,
					includeComments: (job.config as any).includeComments,
					targetChannelId: (job.config as any).targetChannelId, // Target channel to import into
				},
				progress: job.progress,
				jobId: args.jobId,
				workspaceId: job.workspaceId,
				memberId: job.memberId,
				userId: member?.userId, // Add userId for rate limiting
				isCancelled: async () => {
					const currentJob = await ctx.runQuery(
						internal.importIntegrations._getJob,
						{
							jobId: args.jobId,
						}
					);
					return currentJob?.status === "cancelled";
				},
				updateProgress: async (progress: any) => {
					await ctx.runMutation(internal.importIntegrations.updateJobProgress, {
						jobId: args.jobId,
						currentStep: progress.currentStep || "",
						channelsImported: progress.channelsImported || 0,
						messagesImported: progress.messagesImported || 0,
						usersImported: progress.usersImported || 0,
						filesImported: progress.filesImported,
						messagesTotal: progress.messagesTotal,
					});
				},
				log: async (
					level: "info" | "warn" | "error",
					message: string,
					data?: unknown
				) => {
					console.log(`[LinearImport:${level}] ${message}`, data);
				},
				runMutation: async (mutation: any, args: any) => {
					return await ctx.runMutation(mutation, args);
				},
				runQuery: async (query: any, args: any) => {
					return await ctx.runQuery(query, args);
				},
			};

			// Import the Linear provider and execute the import
			const { LinearImportProvider, executeLinearImport } = await import(
				"./linearImportProvider"
			);
			const provider = new LinearImportProvider();

			// Execute the import
			const result = await executeLinearImport(importContext, provider);

			// Update job with results
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "completed",
				completedAt: Date.now(),
				currentStep: "Import completed successfully",
			});

			// Store result summary
			await ctx.runMutation(internal.importIntegrations.storeImportResult, {
				jobId: args.jobId,
				result: {
					channelsCreated: result.itemsCreated as any[],
					messagesCreated: result.messagesCreated,
					usersMatched: result.usersMatched,
					filesImported: result.filesImported,
					errors: result.errors,
					warnings: result.warnings,
				},
			});

			// Schedule completion notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			console.error("[LinearImport] Failed:", errorMessage, error);

			// Mark job as failed
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "failed",
				completedAt: Date.now(),
				errorMessage,
				currentStep: `Import failed: ${errorMessage}`,
			});

			// Schedule failure notification
			await ctx.scheduler.runAfter(
				0,
				internal.importIntegrations.notifyImportComplete,
				{
					jobId: args.jobId,
				}
			);
		}
	},
});

/**
 * Notify user of import completion via email
 */
export const notifyImportComplete = internalAction({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		const job = await ctx.runQuery(internal.importIntegrations._getJob, {
			jobId: args.jobId,
		});

		if (!job) return;

		// Get member
		const member = await ctx.runQuery(internal.members._getMemberById, {
			id: job.memberId,
		});

		if (!member) return;

		// Get user
		const user = await ctx.runQuery(internal.users._getUserById, {
			id: member.userId,
		});

		if (!user || !user.email) return;

		// Only send notification for terminal states
		if (
			job.status !== "completed" &&
			job.status !== "failed" &&
			job.status !== "cancelled"
		) {
			return;
		}

		// Send OneSignal push notification
		await ctx.runAction(internal.onesignal.sendImportNotification, {
			userId: user._id,
			workspaceId: job.workspaceId,
			platform: job.platform,
			status: job.status,
			channelsImported: job.result?.channelsCreated?.length || 0,
			messagesImported: job.result?.messagesCreated || 0,
		});

		// Send in-app notification
		await ctx.runAction(internal.onesignal.sendInAppImportNotification, {
			userId: user._id,
			workspaceId: job.workspaceId,
			platform: job.platform,
			status: job.status,
			channelsImported: job.result?.channelsCreated?.length || 0,
			messagesImported: job.result?.messagesCreated || 0,
		});
	},
});

// ============================================================================
// INTERNAL MUTATIONS - Only callable by backend
// ============================================================================

/**
 * Update job status (internal only)
 */
export const updateJobStatus = internalMutation({
	args: {
		jobId: v.id("import_jobs"),
		status: v.union(
			v.literal("pending"),
			v.literal("in_progress"),
			v.literal("completed"),
			v.literal("failed"),
			v.literal("cancelled")
		),
		startedAt: v.optional(v.number()),
		completedAt: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
		currentStep: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { jobId, ...updates } = args;
		const job = await ctx.db.get(jobId);
		if (!job) return;

		const patch: Partial<typeof job> = {
			status: updates.status,
		};

		if (updates.startedAt !== undefined) patch.startedAt = updates.startedAt;
		if (updates.completedAt !== undefined)
			patch.completedAt = updates.completedAt;
		if (updates.errorMessage !== undefined)
			patch.errorMessage = updates.errorMessage;
		if (updates.currentStep) {
			patch.progress = {
				...job.progress,
				currentStep: updates.currentStep,
			};
		}

		await ctx.db.patch(jobId, patch);
	},
});

/**
 * Update job progress (internal only)
 */
export const updateJobProgress = internalMutation({
	args: {
		jobId: v.id("import_jobs"),
		currentStep: v.string(),
		channelsImported: v.number(),
		messagesImported: v.number(),
		usersImported: v.number(),
		filesImported: v.optional(v.number()),
		messagesTotal: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) return;

		await ctx.db.patch(args.jobId, {
			progress: {
				...job.progress,
				currentStep: args.currentStep,
				channelsImported: args.channelsImported,
				messagesImported: args.messagesImported,
				usersImported: args.usersImported,
				filesImported: args.filesImported || 0,
				messagesTotal: args.messagesTotal,
			},
		});
	},
});

/**
 * Update imported channel name (internal only)
 * Used when a user renames a project in the external platform
 */
export const updateImportedChannelName = internalMutation({
	args: {
		channelId: v.id("channels"),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if channel exists and get workspace
		const channel = await ctx.db.get(args.channelId);
		if (!channel) return;

		// Only update if name actually changed
		if (channel.name === args.name) return;

		// Update the channel name
		await ctx.db.patch(args.channelId, {
			name: args.name,
		});
	},
});

/**
 * Find duplicate channels for a workspace (internal only)
 * Returns groups of channels with the same external ID
 */
export const _findDuplicateChannels = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		platform: v.union(
			v.literal("slack"),
			v.literal("todoist"),
			v.literal("linear"),
			v.literal("notion"),
			v.literal("miro"),
			v.literal("clickup")
		),
	},
	handler: async (ctx, args) => {
		// Get all import channel metadata for this workspace and platform
		const allMetadata = await ctx.db
			.query("import_channel_metadata")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("platform"), args.platform))
			.collect();

		// Group by external ID to find duplicates
		const externalIdMap = new Map<string, typeof allMetadata>();
		for (const metadata of allMetadata) {
			const existing = externalIdMap.get(metadata.externalId) || [];
			existing.push(metadata);
			externalIdMap.set(metadata.externalId, existing);
		}

		// Return only groups with duplicates
		const duplicates: Array<{
			externalId: string;
			metadataRecords: typeof allMetadata;
		}> = [];
		for (const [externalId, metadataRecords] of externalIdMap.entries()) {
			if (metadataRecords.length > 1) {
				duplicates.push({ externalId, metadataRecords });
			}
		}

		return duplicates;
	},
});

/**
 * Clean up duplicate channels (internal only)
 * Keeps the oldest channel and removes duplicates
 * Also cleans up duplicate import_channel_metadata records
 */
export const _cleanupDuplicateChannels = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		platform: v.union(
			v.literal("slack"),
			v.literal("todoist"),
			v.literal("linear"),
			v.literal("notion"),
			v.literal("miro"),
			v.literal("clickup")
		),
	},
	handler: async (ctx, args) => {
		// Get all import channel metadata for this workspace and platform
		const allMetadata = await ctx.db
			.query("import_channel_metadata")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("platform"), args.platform))
			.collect();

		// Group by external ID to find duplicates
		const externalIdMap = new Map<
			string,
			Array<(typeof allMetadata)[number]>
		>();
		for (const metadata of allMetadata) {
			const existing = externalIdMap.get(metadata.externalId) || [];
			existing.push(metadata);
			externalIdMap.set(metadata.externalId, existing);
		}

		const cleanedUp = {
			channelsDeleted: 0,
			metadataDeleted: 0,
			messagesReassigned: 0,
		};

		// Process each group of duplicates
		for (const [_externalId, metadataRecords] of externalIdMap.entries()) {
			if (metadataRecords.length <= 1) continue;

			// Sort by importedAt (oldest first) to keep the original
			metadataRecords.sort((a, b) => a.importedAt - b.importedAt);

			// Keep the oldest record
			const keepRecord = metadataRecords[0];
			const duplicateRecords = metadataRecords.slice(1);

			// For each duplicate, reassign messages and delete
			for (const duplicateRecord of duplicateRecords) {
				// Find all messages in the duplicate channel
				const duplicateMessages = await ctx.db
					.query("messages")
					.withIndex("by_workspace_id", (q) =>
						q.eq("workspaceId", args.workspaceId)
					)
					.filter((q) =>
						q.and(
							q.eq(q.field("channelId"), duplicateRecord.internalChannelId),
							q.eq(q.field("tags"), ["imported", args.platform])
						)
					)
					.collect();

				// Reassign messages to the kept channel
				for (const message of duplicateMessages) {
					await ctx.db.patch(message._id, {
						channelId: keepRecord.internalChannelId,
					});
					cleanedUp.messagesReassigned++;
				}

				// Delete the duplicate channel
				await ctx.db.delete(duplicateRecord.internalChannelId);
				cleanedUp.channelsDeleted++;

				// Delete the duplicate metadata record
				await ctx.db.delete(duplicateRecord._id);
				cleanedUp.metadataDeleted++;
			}
		}

		return cleanedUp;
	},
});

/**
 * Get connection with access token (internal only)
 */
export const getConnectionWithToken = internalQuery({
	args: {
		connectionId: v.id("import_connections"),
	},
	handler: async (ctx, args) => {
		// This is internal, so no auth check
		const connection = await ctx.db.get(args.connectionId);
		return connection;
	},
});

/**
 * Store import result summary (internal only)
 */
export const storeImportResult = internalMutation({
	args: {
		jobId: v.id("import_jobs"),
		result: v.object({
			channelsCreated: v.array(v.id("channels")),
			messagesCreated: v.number(),
			usersMatched: v.number(),
			filesImported: v.number(),
			errors: v.optional(v.array(v.string())),
			warnings: v.optional(v.array(v.string())),
		}),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) return;

		await ctx.db.patch(args.jobId, {
			result: args.result,
		});
	},
});

/**
 * Store an imported channel (internal only)
 * Uses idempotency key to prevent duplicates
 * Returns existing channel if already imported
 */
export const storeImportedChannel = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		externalId: v.string(),
		idempotencyKey: v.string(),
		name: v.string(),
		type: v.string(),
		platform: v.union(
			v.literal("slack"),
			v.literal("todoist"),
			v.literal("linear"),
			v.literal("notion"),
			v.literal("miro"),
			v.literal("clickup")
		),
		description: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		// Check for existing channel by idempotency key first
		const existingMetadata = await ctx.db
			.query("import_channel_metadata")
			.withIndex("by_idempotency_key", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();

		if (existingMetadata) {
			// Channel already exists, update its metadata
			await ctx.db.patch(existingMetadata._id, {
				name: args.name,
				type: args.type,
				description: args.description,
				metadata: args.metadata,
				importedAt: Date.now(),
			});

			// Also update the internal channel name if it changed
			const internalChannel = await ctx.db.get(
				existingMetadata.internalChannelId
			);
			if (internalChannel && internalChannel.name !== args.name) {
				await ctx.db.patch(existingMetadata.internalChannelId, {
					name: args.name,
				});
			}

			return existingMetadata.internalChannelId;
		}

		// Create new channel
		const channelId = await ctx.db.insert("channels", {
			workspaceId: args.workspaceId,
			name: args.name,
			icon: args.type === "private" ? "lock" : "hash",
		});

		// Store metadata about the external channel
		await ctx.db.insert("import_channel_metadata", {
			workspaceId: args.workspaceId,
			jobId: undefined, // Will be set by caller if needed
			externalId: args.externalId,
			idempotencyKey: args.idempotencyKey,
			platform: args.platform,
			internalChannelId: channelId,
			name: args.name,
			type: args.type,
			description: args.description,
			metadata: args.metadata,
			importedAt: Date.now(),
		});

		return channelId;
	},
});

/**
 * Store an imported message (internal only)
 * Uses idempotency key to prevent duplicates
 */
export const storeImportedMessage = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		channelId: v.id("channels"),
		externalId: v.string(),
		idempotencyKey: v.string(),
		body: v.string(),
		authorMemberId: v.optional(v.id("members")),
		timestamp: v.number(),
		parentMessageId: v.optional(v.id("messages")),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		// Check for existing message by idempotency key
		// For now, we'll create a new message

		const messageId = await ctx.db.insert("messages", {
			workspaceId: args.workspaceId,
			channelId: args.channelId,
			memberId: args.authorMemberId || args.memberId,
			body: args.body,
			updatedAt: args.timestamp,
			parentMessageId: args.parentMessageId,
			tags: ["imported", "slack"],
		});

		// Store metadata about the external message
		await ctx.db.insert("import_message_metadata", {
			workspaceId: args.workspaceId,
			jobId: undefined, // Will be set by caller if needed
			externalId: args.externalId,
			idempotencyKey: args.idempotencyKey,
			platform: "slack",
			internalMessageId: messageId,
			authorMemberId: args.authorMemberId,
			timestamp: args.timestamp,
			metadata: args.metadata,
			importedAt: Date.now(),
		});

		return messageId;
	},
});

/**
 * Store an imported Linear issue as a proper issue record (internal only)
 * Uses idempotency key to prevent duplicates
 */
export const storeImportedLinearIssue = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.id("channels"),
		externalId: v.string(),
		idempotencyKey: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		statusId: v.id("statuses"),
		priority: v.optional(
			v.union(
				v.literal("urgent"),
				v.literal("high"),
				v.literal("medium"),
				v.literal("low"),
				v.literal("no_priority")
			)
		),
		assignees: v.optional(v.array(v.id("members"))),
		labels: v.optional(v.array(v.string())),
		dueDate: v.optional(v.number()),
		order: v.number(),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		// Check for existing issue by idempotency key
		const existingMetadata = await ctx.db
			.query("import_issue_metadata")
			.withIndex("by_idempotency_key", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();

		if (existingMetadata) {
			// Issue already exists, update it
			const existingIssue = await ctx.db.get(existingMetadata.internalIssueId);
			if (existingIssue) {
				// Update the issue
				await ctx.db.patch(existingMetadata.internalIssueId, {
					title: args.title,
					description: args.description,
					statusId: args.statusId,
					priority: args.priority,
					assignees: args.assignees,
					labels: args.labels,
					dueDate: args.dueDate,
					updatedAt: Date.now(),
				});
				return existingMetadata.internalIssueId;
			}
		}

		// Create new issue
		const issueId = await ctx.db.insert("issues", {
			channelId: args.channelId,
			statusId: args.statusId,
			title: args.title,
			description: args.description,
			priority: args.priority,
			assignees: args.assignees,
			labels: args.labels,
			dueDate: args.dueDate,
			order: args.order,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		// Store metadata about the external issue
		await ctx.db.insert("import_issue_metadata", {
			workspaceId: args.workspaceId,
			jobId: undefined,
			externalId: args.externalId,
			idempotencyKey: args.idempotencyKey,
			platform: "linear",
			internalIssueId: issueId,
			authorMemberId: undefined,
			timestamp: Date.now(),
			metadata: args.metadata,
			importedAt: Date.now(),
		});

		return issueId;
	},
});

/**
 * Store an imported file reference (internal only)
 */
export const storeImportedFile = internalMutation({
	args: {
		messageId: v.id("messages"),
		storageId: v.id("_storage"),
		externalId: v.string(),
		idempotencyKey: v.string(),
		name: v.string(),
		mimeType: v.string(),
		size: v.number(),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const message = await ctx.db.get(args.messageId);
		if (!message) throw new Error("Message not found");

		// Store file metadata
		await ctx.db.insert("import_file_metadata", {
			workspaceId: message.workspaceId,
			jobId: undefined,
			externalId: args.externalId,
			idempotencyKey: args.idempotencyKey,
			platform: "slack",
			internalMessageId: args.messageId,
			storageId: args.storageId,
			name: args.name,
			mimeType: args.mimeType,
			size: args.size,
			metadata: args.metadata,
			importedAt: Date.now(),
		});

		return true;
	},
});

/**
 * Upload a file to Convex storage (internal only)
 */
export const uploadFileToStorage = internalMutation({
	args: {
		fileData: v.array(v.number()),
		fileName: v.string(),
		mimeType: v.string(),
	},
	handler: async (ctx, args) => {
		// Create storage record using Convex storage API
		const blob = new Blob([new Uint8Array(args.fileData)], {
			type: args.mimeType,
		});
		const storageId = await (ctx.storage as any).store(blob);

		return storageId as Id<"_storage">;
	},
});

// ============================================================================
// INTERNAL QUERIES - Only callable by backend
// ============================================================================

/**
 * Get member by ID (internal only)
 */
export const _getMemberById = internalQuery({
	args: {
		id: v.id("members"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

/**
 * Get user by ID (internal only)
 */
export const _getUserById = internalQuery({
	args: {
		id: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

/**
 * Get channel by name (internal only)
 * Used to check for existing channels before importing
 */
export const getChannelByName = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		channelName: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if channel with this name already exists in workspace
		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) => q.eq(q.field("name"), args.channelName))
			.first();

		return channels;
	},
});

/**
 * Get channel by external ID (internal only)
 * Used to check for existing imported channels by external ID (idempotency)
 */
export const getChannelByExternalId = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		externalId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if channel with this external ID already exists (check both slack and todoist)
		const platforms = ["slack", "todoist"] as const;

		for (const platform of platforms) {
			const metadata = await ctx.db
				.query("import_channel_metadata")
				.withIndex("by_platform_external_id", (q) =>
					q.eq("platform", platform).eq("externalId", args.externalId)
				)
				.first();

			if (metadata) {
				// Return the internal channel
				return await ctx.db.get(metadata.internalChannelId);
			}
		}

		return null;
	},
});

/**
 * Get message by external ID (internal only)
 * Used to check for existing messages before importing (idempotency)
 */
export const getMessageByExternalId = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		externalId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if message with this external ID already exists
		const metadata = await ctx.db
			.query("import_message_metadata")
			.withIndex("by_platform_external_id", (q) =>
				q.eq("platform", "slack").eq("externalId", args.externalId)
			)
			.first();

		if (!metadata) return null;

		// Return the internal message
		return await ctx.db.get(metadata.internalMessageId);
	},
});

/**
 * Get Linear issue by external ID (internal only)
 * Used to check for existing issues before importing (idempotency)
 */
export const getLinearIssueByExternalId = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		externalId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if issue with this external ID already exists
		const metadata = await ctx.db
			.query("import_issue_metadata")
			.withIndex("by_platform_external_id", (q) =>
				q.eq("platform", "linear").eq("externalId", args.externalId)
			)
			.first();

		if (!metadata) return null;

		// Return the internal issue
		const issue = await ctx.db.get(metadata.internalIssueId);
		return issue ?? null;
	},
});

/**
 * Get member by email (internal only)
 * Used during import to map external users to members
 */
export const _getMemberByEmail = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		// Find user by email
		const user = await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", args.email))
			.first();

		if (!user) {
			return null;
		}

		// Find member in the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
			)
			.first();

		return member;
	},
});

/**
 * Get member by name with fuzzy matching (internal only)
 * Used during Linear import to match users by name with case-insensitive partial matching
 * Includes conflict resolution when multiple users match
 */
export const _getMemberByName = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		// Get all users to perform fuzzy matching
		const allUsers = await ctx.db.query("users").collect();
		
		const normalizedName = args.name.toLowerCase().trim();
		
		// Find exact match first (case-insensitive)
		const exactMatch = allUsers.find(
			(u) => u.name && u.name.toLowerCase() === normalizedName
		);
		
		if (exactMatch) {
			// Find member in the workspace
			const member = await ctx.db
				.query("members")
				.withIndex("by_workspace_id_user_id", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("userId", exactMatch._id)
				)
				.first();
			
			return member ? { member, matchType: "exact" as const, conflict: false } : null;
		}
		
		// Find partial matches (name contains the search term or vice versa)
		const partialMatches = allUsers.filter((u) => {
			if (!u.name) return false;
			const userName = u.name.toLowerCase();
			return (
				userName.includes(normalizedName) ||
				normalizedName.includes(userName)
			);
		});
		
		// Conflict resolution: if multiple partial matches, return null
		// to let the caller handle the ambiguity
		if (partialMatches.length === 0) {
			return null;
		}
		
		if (partialMatches.length === 1) {
			const user = partialMatches[0];
			const member = await ctx.db
				.query("members")
				.withIndex("by_workspace_id_user_id", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
				)
				.first();
			
			return member ? { member, matchType: "partial" as const, conflict: false } : null;
		}
		
		// Multiple matches found - return conflict information
		const membersInWorkspace = [];
		for (const user of partialMatches) {
			const member = await ctx.db
				.query("members")
				.withIndex("by_workspace_id_user_id", (q) =>
					q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
				)
				.first();
			
			if (member) {
				membersInWorkspace.push({ member, userName: user.name });
			}
		}
		
		// If only one member is in the workspace, use that
		if (membersInWorkspace.length === 1) {
			return { 
				member: membersInWorkspace[0].member, 
				matchType: "partial" as const, 
				conflict: false 
			};
		}
		
		// Return conflict information
		return { 
			member: null, 
			matchType: "partial" as const, 
			conflict: true,
			possibleMatches: membersInWorkspace.map(m => m.userName)
		};
	},
});

/**
 * Result type for member creation
 */
type MemberCreationResult = {
	member: any | null;
	created: boolean;
	createdUser: boolean;
	reason?: string;
	role?: "owner" | "admin" | "member";
};

/**
 * Get or create member by email with auto-invite, rate limiting, notifications, and avatar import (internal only)
 * Used during Linear import to auto-invite users if they don't exist
 */
export const _getOrCreateMemberByEmail = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
		name: v.string(),
		avatarUrl: v.optional(v.string()),
		linearRole: v.optional(v.string()), // Linear role (admin, member, etc.)
		importSource: v.optional(v.string()), // e.g., "Linear Import"
		importJobUserId: v.optional(v.id("users")), // User who started the import (for rate limiting)
	},
	handler: async (ctx, args): Promise<MemberCreationResult> => {
		// Validate inputs
		if (!args.email || !args.email.includes("@")) {
			return { 
				member: null, 
				created: false, 
				createdUser: false,
				reason: `Invalid email address: ${args.email}` 
			};
		}
		
		if (!args.name || args.name.trim().length === 0) {
			return { 
				member: null, 
				created: false, 
				createdUser: false,
				reason: "Name is required" 
			};
		}
		
		const normalizedEmail = args.email.toLowerCase();
		
		// Check rate limit for auto-invites (only if userId provided)
		if (args.importJobUserId) {
			try {
				const rateLimitResult: { allowed: boolean; reason?: string } = await ctx.runMutation(
					internal.rateLimit._validateAutoInviteRateLimitInternal,
					{ 
						workspaceId: args.workspaceId,
						userId: args.importJobUserId
					}
				);
				
				if (!rateLimitResult.allowed) {
					return { 
						member: null, 
						created: false, 
						createdUser: false,
						reason: rateLimitResult.reason 
					};
				}
			} catch (_error) {
				// If rate limiting fails, continue without it (graceful degradation)
			}
		}
		
		// First, try to find existing user by email
		let user = await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", normalizedEmail))
			.first();

		let createdNewUser = false;
		
		// If user doesn't exist, create them
		if (!user) {
			// Validate name length
			const userName = args.name.trim().substring(0, 100);
			
			// Handle avatar URL - just store the external URL since we can't download in mutations
			const imageValue: string | undefined = (args.avatarUrl && args.avatarUrl.startsWith("http")) 
				? args.avatarUrl 
				: undefined;
			
			const userId = await ctx.db.insert("users", {
				email: normalizedEmail,
				name: userName,
				image: imageValue,
			});
			
			user = await ctx.db.get(userId);
			createdNewUser = true;
		}

		if (!user) {
			return { member: null, created: false, createdUser: false, reason: "Failed to create user" };
		}

		// Check if member already exists
		let member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", user._id)
			)
			.first();

		let createdNewMember = false;
		
		// If not a member, create them
		if (!member) {
			// Map Linear role to our role system
			let role: "owner" | "admin" | "member" = "member";
			if (args.linearRole) {
				const linearRoleLower = args.linearRole.toLowerCase();
				if (linearRoleLower.includes("owner") || linearRoleLower.includes("admin")) {
					role = "admin"; // Map Linear owner/admin to our admin role
				}
			}
			
			const memberId = await ctx.db.insert("members", {
				workspaceId: args.workspaceId,
				userId: user._id,
				role,
			});
			
			member = await ctx.db.get(memberId);
			createdNewMember = true;
		}
		
		// Send notification if new member was created
		// Note: Actual notification is sent via the import completion notification
		// to avoid circular dependency issues during Convex codegen
		if (createdNewMember && member) {
			console.log(`[AutoInvite] New member created: ${member._id} for workspace ${args.workspaceId}`);
		}

		return { 
			member, 
			created: createdNewMember, 
			createdUser: createdNewUser,
			role: member?.role
		};
	},
});

/**
 * Get statuses for a channel (internal only)
 * Used during import to avoid authentication requirements
 */
export const getStatusesByChannelId = internalQuery({
	args: {
		channelId: v.id("channels"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("statuses")
			.withIndex("by_channel_id_order", (q) => q.eq("channelId", args.channelId))
			.collect();
	},
});

/**
 * Create a default status for a channel (internal only)
 * Used during import when no statuses exist
 */
export const createDefaultStatus = internalMutation({
	args: {
		channelId: v.id("channels"),
		name: v.string(),
		color: v.string(),
	},
	handler: async (ctx, args) => {
		// Get the channel to find workspace
		const channel = await ctx.db.get(args.channelId);
		if (!channel) {
			throw new Error("Channel not found");
		}

		// Get the highest order value for existing statuses
		const existingStatuses = await ctx.db
			.query("statuses")
			.withIndex("by_channel_id_order", (q) =>
				q.eq("channelId", args.channelId)
			)
			.collect();

		const maxOrder =
			existingStatuses.reduce(
				(max, status) => Math.max(max, status.order),
				-1
			) + 1;

		// Create the new status
		const statusId = await ctx.db.insert("statuses", {
			channelId: args.channelId,
			name: args.name,
			color: args.color,
			order: maxOrder,
		});

		return statusId;
	},
});

/**
 * Disconnect Linear connection (delete the import connection)
 */
export const disconnectLinear = mutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Verify user is a member of the workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Not a member of this workspace");

		// Find the Linear connection
		const connection = await ctx.db
			.query("import_connections")
			.withIndex("by_member_platform", (q) =>
				q.eq("memberId", member._id).eq("platform", "linear")
			)
			.first();

		if (!connection) {
			throw new Error("No Linear connection found");
		}

		// Delete the connection
		await ctx.db.delete(connection._id);

		console.log("[LinearDisconnect] Connection deleted:", {
			connectionId: connection._id,
			organizationName: connection.teamName,
		});

		return { success: true };
	},
});
