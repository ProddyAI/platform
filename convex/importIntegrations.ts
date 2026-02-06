import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

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
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();

		// Don't expose sensitive tokens in the response
		return connections.map((conn) => ({
			...conn,
			accessToken: undefined,
			refreshToken: undefined,
		}));
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

		let query = ctx.db
			.query("import_jobs")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", args.workspaceId))
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

		const appUrl = process.env.SITE_URL;
		if (!appUrl) {
			throw new Error("SITE_URL is not configured");
		}
		const redirectUri = `${appUrl}/api/import/slack/callback`;
		
		// Generate state parameter for CSRF protection
		const state = `${args.workspaceId}_${member._id}_${Date.now()}`;

		const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;


		return {
			authUrl,
			state,
		};
	},
});

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
			throw new Error("No Slack connection found. Please connect first.");
		}

		if (connection.status !== "active") {
			throw new Error("Slack connection is not active. Please reconnect.");
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
		await ctx.scheduler.runAfter(0, api.importIntegrations.processSlackImport, {
			jobId,
		});

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
export const processSlackImport = action({
	args: {
		jobId: v.id("import_jobs"),
	},
	handler: async (ctx, args) => {
		try {
			// Get job details
				const job = await ctx.runQuery(internal.importIntegrations._getJob, {
				jobId: args.jobId,
			});

			if (!job) {
				throw new Error("Job not found");
			}

			// Update job status to in_progress
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "in_progress",
				startedAt: Date.now(),
				currentStep: "Fetching Slack data...",
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

			// TODO: Implement actual Slack API calls here
			// For now, we'll simulate the import process
			await ctx.runMutation(internal.importIntegrations.updateJobProgress, {
				jobId: args.jobId,
				currentStep: "Import simulation - would fetch from Slack API",
				channelsImported: 0,
				messagesImported: 0,
				usersImported: 0,
			});

			// Mark job as completed
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "completed",
				completedAt: Date.now(),
				currentStep: "Import completed",
			});

			// Send completion email - will need to get member and user details
			// We can't call the internal action from here, so we'll schedule it
			await ctx.scheduler.runAfter(0, api.importIntegrations.notifyImportComplete, {
				jobId: args.jobId,
			});
		} catch (error) {
			// Mark job as failed
			await ctx.runMutation(internal.importIntegrations.updateJobStatus, {
				jobId: args.jobId,
				status: "failed",
				completedAt: Date.now(),
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},
});

/**
 * Notify user of import completion via email
 */
export const notifyImportComplete = action({
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

		// Only send email for terminal states
		if (
			job.status !== "completed" &&
			job.status !== "failed" &&
			job.status !== "cancelled"
		) {
			return;
		}

		// Send email notification
		await ctx.runAction(internal.email.sendImportCompletionEmail, {
			email: user.email,
			userName: user.name || "User",
			platform: job.platform,
			status: job.status,
			channelsImported: job.result?.channelsCreated.length || 0,
			messagesImported: job.result?.messagesCreated || 0,
			workspaceId: job.workspaceId,
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

		const patch: any = {
			status: updates.status,
		};

		if (updates.startedAt) patch.startedAt = updates.startedAt;
		if (updates.completedAt) patch.completedAt = updates.completedAt;
		if (updates.errorMessage) patch.errorMessage = updates.errorMessage;
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
