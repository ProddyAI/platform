import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	extractAssistantProfileUpdateFromMessage,
	mergeAssistantActiveContexts,
	mergeAssistantMemoryBullets,
} from "./assistant/profile";

const responseStyleValidator = v.union(
	v.literal("concise"),
	v.literal("balanced"),
	v.literal("detailed")
);

const actionPreferenceValidator = v.union(
	v.literal("suggestive"),
	v.literal("proactive")
);

const prioritizationStrategyValidator = v.union(
	v.literal("balanced"),
	v.literal("blockers_first"),
	v.literal("deadlines_first"),
	v.literal("meetings_first")
);

const summaryFocusValidator = v.union(
	v.literal("tasks"),
	v.literal("channels"),
	v.literal("notes"),
	v.literal("general")
);

const assistantProfileValidator = v.object({
	workspaceId: v.id("workspaces"),
	userId: v.id("users"),
	responseStyle: v.optional(responseStyleValidator),
	actionPreference: v.optional(actionPreferenceValidator),
	prioritizationStrategy: v.optional(prioritizationStrategyValidator),
	summaryFocus: v.optional(v.array(summaryFocusValidator)),
	memoryBullets: v.optional(v.array(v.string())),
	activeContexts: v.optional(
		v.array(
			v.object({
				kind: v.union(v.literal("release"), v.literal("project")),
				label: v.string(),
				aliases: v.optional(v.array(v.string())),
				ownerHints: v.optional(v.array(v.string())),
				statusHint: v.optional(v.string()),
				lastMentionedAt: v.number(),
			})
		)
	),
	createdAt: v.number(),
	updatedAt: v.number(),
	lastUsedAt: v.number(),
});

async function getExistingProfile(
	ctx: QueryCtx | MutationCtx,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
) {
	return await ctx.db
		.query("assistantProfiles")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", workspaceId).eq("userId", userId)
		)
		.unique();
}

export const getByWorkspaceAndUser = query({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.union(v.null(), assistantProfileValidator),
	handler: async (ctx, args) => {
		return await getExistingProfile(ctx, args.workspaceId, args.userId);
	},
});

export const recordSignal = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		message: v.string(),
	},
	returns: v.union(v.null(), assistantProfileValidator),
	handler: async (ctx, args) => {
		const existing = await getExistingProfile(
			ctx,
			args.workspaceId,
			args.userId
		);
		const extracted = extractAssistantProfileUpdateFromMessage(args.message);
		const now = Date.now();

		if (!existing && !extracted) {
			return null;
		}

		if (!existing && extracted) {
			const profile = {
				workspaceId: args.workspaceId,
				userId: args.userId,
				responseStyle: extracted.responseStyle,
				actionPreference: extracted.actionPreference,
				prioritizationStrategy: extracted.prioritizationStrategy,
				summaryFocus: extracted.summaryFocus,
				memoryBullets: mergeAssistantMemoryBullets([], extracted.memoryBullet),
				activeContexts: mergeAssistantActiveContexts(
					[],
					extracted.activeContext
				),
				createdAt: now,
				updatedAt: now,
				lastUsedAt: now,
			};
			await ctx.db.insert("assistantProfiles", profile);
			return profile;
		}

		if (!existing) {
			return null;
		}

		const patch: Partial<
			Omit<Doc<"assistantProfiles">, "_id" | "_creationTime">
		> = {
			lastUsedAt: now,
		};

		if (extracted) {
			if (extracted.responseStyle) {
				patch.responseStyle = extracted.responseStyle;
			}
			if (extracted.actionPreference) {
				patch.actionPreference = extracted.actionPreference;
			}
			if (extracted.prioritizationStrategy) {
				patch.prioritizationStrategy = extracted.prioritizationStrategy;
			}
			if (extracted.summaryFocus?.length) {
				patch.summaryFocus = extracted.summaryFocus;
			}
			if (extracted.memoryBullet) {
				patch.memoryBullets = mergeAssistantMemoryBullets(
					existing.memoryBullets,
					extracted.memoryBullet
				);
			}
			if (extracted.activeContext) {
				patch.activeContexts = mergeAssistantActiveContexts(
					existing.activeContexts,
					extracted.activeContext
				);
			}
			patch.updatedAt = now;
		}

		await ctx.db.patch(existing._id, patch);

		return {
			...existing,
			...patch,
			updatedAt: patch.updatedAt ?? existing.updatedAt,
			lastUsedAt: now,
		};
	},
});
