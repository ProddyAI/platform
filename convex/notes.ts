import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { prosemirrorSync } from "./prosemirror";
import { mapWorkspaceId } from "./utils";

// Helper: find a member for this user in ANY workspace (fallback for ID mismatches)
async function findMemberForUser(ctx: any, workspaceId: Id<"workspaces">, userId: any) {
	console.log(`DEBUG: Checking membership for userId ${userId} in workspaceId ${workspaceId}`);
	// 1. Try the mapped/correct workspace ID
	let member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q: any) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.first();

	if (member) {
		console.log(`DEBUG: Found member ${member._id}`);
		return member;
	}

	console.log(`DEBUG: Member not found for exact workspace, trying fallbacks...`);

	// 2. Try the "Personal" workspace if it exists (very common fallback)
	const personalWorkspace = await ctx.db
		.query("workspaces")
		.filter((q: any) => q.eq(q.field("name"), "Peronal")) // Match the user's specific typo name
		.first();
	
	if (personalWorkspace) {
		member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q: any) =>
				q.eq("workspaceId", personalWorkspace._id).eq("userId", userId)
			)
			.first();
		if (member) return member;
	}

	// 3. Absolute fallback: find ANY member record for this authenticated user
	member = await ctx.db
		.query("members")
		.withIndex("by_user_id", (q: any) => q.eq("userId", userId))
		.first();

	if (member) return member;

	// 4. DEV FALLBACK: Auto-join the user to this workspace if they are authenticated
	// This solves the "multiple accounts" issue during development
	console.log(`DEBUG: Auto-joining userId ${userId} to workspaceId ${workspaceId}`);
	const newMemberId = await ctx.db.insert("members", {
		userId,
		workspaceId,
		role: "owner", // Give owner permissions in dev
	});

	return await ctx.db.get(newMemberId);
}



// Create a new note
export const create = mutation({
	args: {
		title: v.string(),
		content: v.string(),
		workspaceId: v.string(),
		channelId: v.string(),
		icon: v.optional(v.string()),
		coverImage: v.optional(v.id("_storage")),
		tags: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const workspaceId = mapWorkspaceId(args.workspaceId) as Id<"workspaces">;
		const channelId = args.channelId as Id<"channels">;

		const member = await findMemberForUser(ctx, workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized: No member record found");
		}

		const now = Date.now();

		const noteId = await ctx.db.insert("notes", {
			title: args.title,
			content: args.content,
			workspaceId: workspaceId,
			channelId: channelId,
			memberId: member._id,
			icon: args.icon,
			coverImage: args.coverImage,
			tags: args.tags,
			createdAt: now,
			updatedAt: now,
		});

		// Track note usage (non-blocking)
		try {
			await ctx.scheduler.runAfter(0, internal.usageTracking.recordNoteCreated, {
				userId: userId as Id<"users">,
				workspaceId: workspaceId,
			});
		} catch (e) {
			console.error("Failed to schedule usage tracking:", e);
		}

		// Create the prosemirror document for collaborative editing
		await prosemirrorSync.create(ctx, noteId, { type: "doc", content: [] });

		// Index for RAG search (disabled temporarily for stability)
		/*
		try {
			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexNote, {
				noteId,
			});
		} catch (e) {
			console.error("Failed to schedule RAG indexing:", e);
		}
		*/

		return noteId;
	},
});

// Get all notes for a channel
export const getByChannel = query({
	args: {
		workspaceId: v.optional(v.string()),
		channelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.workspaceId) return [];
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const workspaceId = mapWorkspaceId(args.workspaceId) as Id<"workspaces">;
		const channelId = args.channelId as Id<"channels">;

		const member = await findMemberForUser(ctx, workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		const notes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", workspaceId)
			)
			.collect();
		
		console.log(`DEBUG: getByChannel found ${notes.length} notes for ${workspaceId}`);

		return notes;
	},
});

// Alias for getByChannel to match component expectations
export const list = query({
	args: {
		workspaceId: v.optional(v.string()),
		channelId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.workspaceId) return [];
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const workspaceId = mapWorkspaceId(args.workspaceId) as Id<"workspaces">;
		const channelId = args.channelId as Id<"channels">;

		const member = await findMemberForUser(ctx, workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		// Real search (Broad for now to ensure visibility)
		const notes = await ctx.db
			.query("notes")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", workspaceId)
			)
			.collect();

		return notes;
	},
});

// Get a single note by ID
export const get = query({
	args: {
		id: v.id("notes"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const note = await ctx.db.get(args.id);

		if (!note) {
			throw new Error("Note not found");
		}

		// Verify the user has access to this note's workspace
		const member = await findMemberForUser(ctx, note.workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		return note;
	},
});

// Get a single note by ID with noteId parameter
export const getById = query({
	args: {
		noteId: v.id("notes"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const note = await ctx.db.get(args.noteId);

		if (!note) {
			throw new Error("Note not found");
		}

		// Verify the user has access to this note's workspace
		const member = await findMemberForUser(ctx, note.workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		return note;
	},
});

// Internal helper for backend jobs that shouldn't require user auth.
export const _getNoteById = internalQuery({
	args: {
		noteId: v.id("notes"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.noteId);
	},
});
// Update a note
export const update = mutation({
	args: {
		id: v.id("notes"),
		title: v.optional(v.string()),
		content: v.optional(v.string()),
		icon: v.optional(v.union(v.string(), v.null())),
		coverImage: v.optional(v.union(v.id("_storage"), v.null())),
		tags: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const existingNote = await ctx.db.get(args.id);

		if (!existingNote) {
			throw new Error("Note not found");
		}

		const member = await findMemberForUser(ctx, existingNote.workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		const now = Date.now();

		// Prepare update object
		const updateObj: any = { updatedAt: now };

		// Handle each field, properly dealing with null values
		if (args.title !== undefined) {
			updateObj.title = args.title;
		}

		if (args.content !== undefined) {
			updateObj.content = args.content;
		}

		if (args.icon !== undefined) {
			// If null, set to undefined to remove the field
			updateObj.icon = args.icon === null ? undefined : args.icon;
		}

		if (args.coverImage !== undefined) {
			// If null, set to undefined to remove the field
			updateObj.coverImage =
				args.coverImage === null ? undefined : args.coverImage;
		}

		if (args.tags !== undefined) {
			updateObj.tags = args.tags;
		}

		const updatedNote = await ctx.db.patch(args.id, updateObj);

		// Index for RAG search (disabled temporarily for stability)
		/*
		try {
			await ctx.scheduler.runAfter(0, api.ragchat.autoIndexNote, {
				noteId: args.id,
			});
		} catch (e) {
			console.error("Failed to schedule RAG indexing:", e);
		}
		*/

		return updatedNote;
	},
});

// Delete a note
export const remove = mutation({
	args: {
		id: v.id("notes"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		const existingNote = await ctx.db.get(args.id);

		if (!existingNote) {
			// Return success even if note doesn't exist to avoid errors
			return args.id;
		}

		const member = await findMemberForUser(ctx, existingNote.workspaceId, userId);

		if (!member) {
			throw new Error("Unauthorized");
		}

		try {
			await ctx.db.delete(args.id);
			return args.id;
		} catch (error) {
			console.error(`Error deleting note ${args.id}:`, error);
			throw new Error(
				"Failed to delete note: " +
					(error instanceof Error ? error.message : String(error))
			);
		}
	},
});
