/**
 * Internal helpers for importing external items into the personal Tasks feature
 * (the `tasks` table shown at /workspace/<id>/tasks).
 *
 * Kept separate from importIntegrations.ts (which imports into channels/messages
 * and issues) so task-import logic and its idempotency live in one place.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const IMPORT_PLATFORM = v.union(
	v.literal("slack"),
	v.literal("todoist"),
	v.literal("linear"),
	v.literal("notion"),
	v.literal("miro"),
	v.literal("clickup")
);

const TASK_STATUS = v.union(
	v.literal("not_started"),
	v.literal("in_progress"),
	v.literal("completed"),
	v.literal("on_hold"),
	v.literal("cancelled")
);

const TASK_PRIORITY = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high")
);

/**
 * Return the internal task id for an already-imported external item, or null.
 * Looked up by idempotency key (which encodes platform + workspace + externalId).
 */
export const getImportedTaskId = internalQuery({
	args: { idempotencyKey: v.string() },
	handler: async (ctx, args) => {
		const meta = await ctx.db
			.query("import_task_metadata")
			.withIndex("by_idempotency_key", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();

		return meta ? meta.internalTaskId : null;
	},
});

/**
 * Find (by name) or create a task category for the importing user. Categories
 * are per-user + per-workspace, so imported items land in the same place the
 * user manages tasks.
 */
export const getOrCreateImportedCategory = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		name: v.string(),
		color: v.string(),
	},
	handler: async (ctx, args) => {
		const member = await ctx.db.get(args.memberId);
		if (!member) throw new Error("Importing member not found");
		const userId = member.userId;

		const existing = await ctx.db
			.query("categories")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.collect();
		const match = existing.find((c) => c.name === args.name);
		if (match) return match._id;

		return await ctx.db.insert("categories", {
			name: args.name,
			color: args.color,
			workspaceId: args.workspaceId,
			userId,
			isDefault: false,
		});
	},
});

/**
 * Insert an imported item into the `tasks` table (idempotent by idempotency
 * key) and record the mapping in import_task_metadata.
 */
export const storeImportedTask = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		memberId: v.id("members"),
		jobId: v.optional(v.id("import_jobs")),
		platform: IMPORT_PLATFORM,
		externalId: v.string(),
		idempotencyKey: v.string(),
		title: v.string(),
		description: v.optional(v.string()),
		status: TASK_STATUS,
		completed: v.boolean(),
		priority: v.optional(TASK_PRIORITY),
		dueDate: v.optional(v.number()),
		categoryId: v.optional(v.id("categories")),
		tags: v.optional(v.array(v.string())),
		timestamp: v.number(),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		// Idempotency: skip items already imported.
		const existing = await ctx.db
			.query("import_task_metadata")
			.withIndex("by_idempotency_key", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();
		if (existing) return existing.internalTaskId;

		const member = await ctx.db.get(args.memberId);
		if (!member) throw new Error("Importing member not found");
		const userId = member.userId;

		const now = Date.now();

		const taskId = await ctx.db.insert("tasks", {
			title: args.title,
			description: args.description,
			completed: args.completed,
			status: args.status,
			dueDate: args.dueDate,
			priority: args.priority,
			categoryId: args.categoryId,
			tags: args.tags ?? [],
			createdAt: args.timestamp || now,
			updatedAt: now,
			userId,
			workspaceId: args.workspaceId,
		});

		await ctx.db.insert("import_task_metadata", {
			workspaceId: args.workspaceId,
			jobId: args.jobId,
			externalId: args.externalId,
			idempotencyKey: args.idempotencyKey,
			platform: args.platform,
			internalTaskId: taskId,
			authorMemberId: args.memberId,
			timestamp: args.timestamp || now,
			metadata: args.metadata,
			importedAt: now,
		});

		return taskId;
	},
});
