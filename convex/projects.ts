import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

const normalizeProjectName = (name: string) => {
	return name.trim().replace(/\s+/g, " ").slice(0, 48);
};

const toBoardChannelName = (name: string) => {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 14);

	const base = slug.length > 0 ? slug : "project";
	return `${base}-board`;
};

const assertWorkspaceMember = async (
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> => {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Unauthorized.");

	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Unauthorized.");
	return member;
};

const assertWorkspaceMemberForRead = async (
	ctx: QueryCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> => {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new Error("Unauthorized.");

	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();

	if (!member) throw new Error("Unauthorized.");
	return member;
};

const assertWorkspaceAdmin = async (
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">
): Promise<Doc<"members">> => {
	const member = await assertWorkspaceMember(ctx, workspaceId);
	if (member.role !== "admin" && member.role !== "owner") {
		throw new Error("Admin role required.");
	}
	return member;
};

export const get = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		await assertWorkspaceMemberForRead(ctx, workspaceId);

		const projects = await ctx.db
			.query("projects")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.collect();

		const channelIds = new Set<Id<"channels">>();
		for (const project of projects) {
			channelIds.add(project.boardChannelId);
			if (project.connectedChannelId) {
				channelIds.add(project.connectedChannelId);
			}
		}

		const channels = await Promise.all(
			Array.from(channelIds).map(async (channelId) => {
				const channel = await ctx.db.get(channelId);
				return channel;
			})
		);

		const channelMap = new Map(
			channels
				.filter((channel): channel is NonNullable<typeof channel> =>
					Boolean(channel)
				)
				.map((channel) => [channel._id, channel])
		);

		return projects
			.map((project) => ({
				...project,
				boardChannelName:
					channelMap.get(project.boardChannelId)?.name ?? "Unknown board",
				connectedChannelName: project.connectedChannelId
					? channelMap.get(project.connectedChannelId)?.name
					: undefined,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	},
});

export const getById = query({
	args: { id: v.id("projects") },
	handler: async (ctx, { id }) => {
		const project = await ctx.db.get(id);
		if (!project) return null;

		await assertWorkspaceMemberForRead(ctx, project.workspaceId);

		const [boardChannel, connectedChannel] = await Promise.all([
			ctx.db.get(project.boardChannelId),
			project.connectedChannelId
				? ctx.db.get(project.connectedChannelId)
				: null,
		]);

		return {
			...project,
			boardChannelName: boardChannel?.name,
			connectedChannelName: connectedChannel?.name,
		};
	},
});

export const create = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		name: v.string(),
		connectedChannelId: v.optional(v.id("channels")),
	},
	handler: async (ctx, { workspaceId, name, connectedChannelId }) => {
		const member = await assertWorkspaceAdmin(ctx, workspaceId);

		const normalizedName = normalizeProjectName(name);
		if (normalizedName.length < 3) {
			throw new Error("Project name must be at least 3 characters.");
		}

		if (connectedChannelId) {
			const connectedChannel = await ctx.db.get(connectedChannelId);
			if (!connectedChannel || connectedChannel.workspaceId !== workspaceId) {
				throw new Error("Connected channel not found.");
			}
			if (connectedChannel.type === "board") {
				throw new Error("Please select a chat channel.");
			}
		}

		const now = Date.now();
		const boardChannelId = await ctx.db.insert("channels", {
			name: toBoardChannelName(normalizedName),
			workspaceId,
			type: "board",
		});

		const projectId = await ctx.db.insert("projects", {
			name: normalizedName,
			workspaceId,
			boardChannelId,
			connectedChannelId,
			createdBy: member._id,
			createdAt: now,
			updatedAt: now,
		});

		return projectId;
	},
});

export const setConnectedChannel = mutation({
	args: {
		projectId: v.id("projects"),
		channelId: v.optional(v.union(v.id("channels"), v.null())),
	},
	handler: async (ctx, { projectId, channelId }) => {
		const project = await ctx.db.get(projectId);
		if (!project) throw new Error("Project not found.");

		await assertWorkspaceAdmin(ctx, project.workspaceId);

		if (channelId === null || channelId === undefined) {
			await ctx.db.patch(projectId, {
				connectedChannelId: undefined,
				updatedAt: Date.now(),
			});
			return projectId;
		}

		const channel = await ctx.db.get(channelId);
		if (!channel || channel.workspaceId !== project.workspaceId) {
			throw new Error("Channel not found.");
		}
		if (channel.type === "board") {
			throw new Error("Please select a chat channel.");
		}

		await ctx.db.patch(projectId, {
			connectedChannelId: channelId,
			updatedAt: Date.now(),
		});

		return projectId;
	},
});
