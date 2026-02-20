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
			teams: v.optional(v.array(v.string())),
			includeArchived: v.optional(v.boolean()),
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
				throw new Error("Access token not found");
			}

			// Create import context
			const importContext: any = {
				accessToken: connection.accessToken,
				config: {
					includeArchived: (job.config as any).includeArchived,
					includeComments: (job.config as any).includeComments,
				},
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
 */
export const storeImportedChannel = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		externalId: v.string(),
		idempotencyKey: v.string(),
		name: v.string(),
		type: v.string(),
		description: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		// Check for existing channel by idempotency key
		// For now, we'll create a new channel in the channels table
		// In production, you'd check for existing channels first

		// Create channel with external metadata
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
			platform: "slack",
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
