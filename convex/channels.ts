import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

// Helper query to get a channel by ID (for internal use)
export const _getChannelById = query({
	args: {
		channelId: v.id("channels"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.channelId);
	},
});

export const remove = mutation({
	args: {
		id: v.id("channels"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const channel = await ctx.db.get(args.id);

		if (!channel) throw new Error("Channel not found.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member || (member.role !== "admin" && member.role !== "owner"))
			throw new Error("Unauthorized.");

		const [messages] = await Promise.all([
			ctx.db
				.query("messages")
				.withIndex("by_channel_id", (q) => q.eq("channelId", args.id))
				.collect(),
		]);

		const projectsAsBoardChannel = await ctx.db
			.query("projects")
			.withIndex("by_board_channel_id", (q) => q.eq("boardChannelId", args.id))
			.collect();

		const projectsAsConnectedChannel = await ctx.db
			.query("projects")
			.withIndex("by_connected_channel_id", (q) =>
				q.eq("connectedChannelId", args.id)
			)
			.collect();

		for (const message of messages) await ctx.db.delete(message._id);

		for (const project of projectsAsConnectedChannel) {
			if (project.boardChannelId === args.id) {
				continue;
			}

			await ctx.db.patch(project._id, {
				connectedChannelId: undefined,
				updatedAt: Date.now(),
			});
		}

		for (const project of projectsAsBoardChannel) {
			await ctx.db.delete(project._id);
		}

		await ctx.db.delete(args.id);

		return args.id;
	},
});

export const update = mutation({
	args: {
		id: v.id("channels"),
		name: v.string(),
		icon: v.optional(v.string()),
		iconImage: v.optional(v.union(v.id("_storage"), v.null())),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const channel = await ctx.db.get(args.id);

		if (!channel) throw new Error("Channel not found.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) throw new Error("Unauthorized.");

		// Check if we're changing the name (requires admin/owner)
		if (channel.name !== args.name) {
			// Only admins and owners can change the channel name
			if (member.role !== "admin" && member.role !== "owner") {
				throw new Error("Only admins and owners can change the channel name.");
			}

			if (args.name.length < 3 || args.name.length > 20)
				throw new Error("Invalid channel name.");
		}

		const parsedName = args.name.replace(/\s+/g, "-").toLowerCase();

		const updateData: {
			name: string;
			icon?: string;
			iconImage?: Id<"_storage">;
		} = {
			name: parsedName,
		};

		if (args.icon !== undefined) {
			updateData.icon = args.icon;
		}

		if ("iconImage" in args) {
			updateData.iconImage = args.iconImage ?? undefined;
		}

		await ctx.db.patch(args.id, updateData);

		return args.id;
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		workspaceId: v.id("workspaces"),
		icon: v.optional(v.string()),
		iconImage: v.optional(v.id("_storage")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) throw new Error("Unauthorized.");

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", args.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member || (member.role !== "admin" && member.role !== "owner"))
			throw new Error("Unauthorized.");

		if (args.name.length < 3 || args.name.length > 20)
			throw new Error("Invalid channel name.");

		const parsedName = args.name.replace(/\s+/g, "-").toLowerCase();

		const workspace = await ctx.db.get(args.workspaceId);

		if (!workspace) throw new Error("Workspace not found.");

		const channelId = await ctx.db.insert("channels", {
			name: parsedName,
			workspaceId: args.workspaceId,
			icon: args.icon,
			iconImage: args.iconImage,
			type: "chat",
		});

		// Track channel usage
		await ctx.scheduler.runAfter(
			0,
			internal.usageTracking.recordChannelCreated,
			{
				userId,
				workspaceId: args.workspaceId,
			}
		);

		return channelId;
	},
});

export const getById = query({
	args: {
		id: v.id("channels"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return null;

		const channel = await ctx.db.get(args.id);

		if (!channel) return null;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", channel.workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) return null;

		// Convert iconImage storage ID to URL if it exists
		const iconImageUrl = channel.iconImage
			? await ctx.storage.getUrl(channel.iconImage)
			: undefined;

		return {
			...channel,
			iconImageUrl,
		};
	},
});

export const get = query({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);

		if (!userId) return [];
		if (!args.workspaceId) return [];
		const workspaceId = args.workspaceId;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", userId)
			)
			.unique();

		if (!member) return [];

		const channels = await ctx.db
			.query("channels")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		// Convert iconImage storage IDs to URLs
		const channelsWithUrls = await Promise.all(
			channels.map(async (channel) => {
				const iconImageUrl = channel.iconImage
					? await ctx.storage.getUrl(channel.iconImage)
					: undefined;

				return {
					...channel,
					iconImageUrl,
				};
			})
		);

		return channelsWithUrls;
	},
});
