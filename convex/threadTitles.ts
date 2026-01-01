import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// Get thread title by message ID
export const getByMessageId = query({
	args: {
		messageId: v.id('messages'),
	},
	handler: async (ctx, args) => {
		const threadTitle = await ctx.db
			.query('threadTitles')
			.withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
			.unique();

		return threadTitle;
	},
});

// Get all thread titles for a workspace
export const getByWorkspaceId = query({
	args: {
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const threadTitles = await ctx.db
			.query('threadTitles')
			.withIndex('by_workspace_id', (q) => q.eq('workspaceId', args.workspaceId))
			.collect();

		return threadTitles;
	},
});

// Create or update thread title
export const upsert = mutation({
	args: {
		messageId: v.id('messages'),
		title: v.string(),
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthorized.');

		// Validate title
		const trimmedTitle = args.title.trim();
		if (!trimmedTitle) {
			throw new Error('Title cannot be empty');
		}
		if (trimmedTitle.length > 200) {
			throw new Error('Title is too long (maximum 200 characters)');
		}

		// Get current member
		const member = await ctx.db
			.query('members')
			.withIndex('by_workspace_id_user_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('userId', userId)
			)
			.unique();

		if (!member) throw new Error('Member not found.');

		// Check if thread title already exists
		const existing = await ctx.db
			.query('threadTitles')
			.withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
			.unique();

		if (existing) {
			// Update existing title
			await ctx.db.patch(existing._id, {
				title: trimmedTitle,
				updatedAt: Date.now(),
			});
			return existing._id;
		} else {
			// Create new title
			const id = await ctx.db.insert('threadTitles', {
				messageId: args.messageId,
				title: trimmedTitle,
				workspaceId: args.workspaceId,
				createdBy: member._id,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
			return id;
		}
	},
});

// Delete thread title
export const remove = mutation({
	args: {
		messageId: v.id('messages'),
		workspaceId: v.id('workspaces'),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error('Unauthorized.');

		// Get current member
		const member = await ctx.db
			.query('members')
			.withIndex('by_workspace_id_user_id', (q) =>
				q.eq('workspaceId', args.workspaceId).eq('userId', userId)
			)
			.unique();

		if (!member) throw new Error('Member not found.');

		const threadTitle = await ctx.db
			.query('threadTitles')
			.withIndex('by_message_id', (q) => q.eq('messageId', args.messageId))
			.unique();

		if (!threadTitle) {
			return null;
		}

		// Verify the thread title belongs to the workspace
		if (threadTitle.workspaceId !== args.workspaceId) {
			throw new Error('Thread title does not belong to this workspace.');
		}

		// Only allow deletion if user is the creator or a workspace admin
		const isCreator = threadTitle.createdBy === member._id;
		const isAdmin = member.role === 'admin';

		if (!isCreator && !isAdmin) {
			throw new Error('Only the creator or workspace admins can delete thread titles.');
		}

		await ctx.db.delete(threadTitle._id);

		return threadTitle._id;
	},
});
