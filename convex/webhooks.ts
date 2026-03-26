// Internal mutations for handling Dodo Payments webhooks
// Intentionally minimal to avoid schema churn during migration.
// We patch workspaces with Dodo subscription identifiers and log payloads.
//
// Security & Idempotency:
// - These handlers are designed to be idempotent by only setting deterministic fields
//   (e.g., setting the same dodoSubscriptionId repeatedly is safe).
// - For stronger idempotency, introduce a dedicated events table keyed by event_id.

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// Store payment info (no-op for schema-light approach, but kept for audit/extension)
export const createPayment = internalMutation({
	args: {
		paymentId: v.string(),
		businessId: v.optional(v.string()),
		customerEmail: v.optional(v.union(v.string(), v.null())),
		amount: v.number(),
		currency: v.string(),
		status: v.string(),
		raw: v.optional(v.string()),
	},
	handler: async (_ctx, _args) => {
		// No persistent storage without adding a payments table.
		// Extend here if you decide to persist raw payloads for audit.
		return { ok: true };
	},
});

// Activate a subscription for a workspace (sets dodoSubscriptionId and optional plan)
export const createSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		subscriptionId: v.string(),
		status: v.string(),
		plan: v.optional(v.union(v.literal("pro"), v.literal("enterprise"))),
		raw: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.workspaceId) return { ok: true, reason: "no_workspace_context" };

		const patch: Record<string, any> = {
			dodoSubscriptionId: args.subscriptionId,
		};
		if (args.plan) {
			patch.plan = args.plan;
		}
		await ctx.db.patch(args.workspaceId, patch);
		return { ok: true };
	},
});

// Update subscription (kept minimal; ensures stored subscription id is consistent)
export const updateSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		subscriptionId: v.string(),
		status: v.string(),
		plan: v.optional(v.union(v.literal("pro"), v.literal("enterprise"))),
		raw: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.workspaceId) return { ok: true, reason: "no_workspace_context" };

		const patch: Record<string, any> = {
			dodoSubscriptionId: args.subscriptionId,
		};
		if (args.plan) {
			patch.plan = args.plan;
		}
		await ctx.db.patch(args.workspaceId, patch);
		return { ok: true };
	},
});

// Cancel subscription (clears dodoSubscriptionId and resets plan to free)
export const cancelSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.id("workspaces")),
		raw: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.workspaceId) return { ok: true, reason: "no_workspace_context" };

		await ctx.db.patch(args.workspaceId, {
			dodoSubscriptionId: undefined,
			plan: "free",
		});
		return { ok: true };
	},
});
