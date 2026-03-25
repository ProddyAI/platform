import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { PLANS, type PlanName } from "./plans";

function getStripe(): Stripe {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new Error("STRIPE_SECRET_KEY environment variable is required");
	}
	return new Stripe(key);
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const getSubscriptionStatus = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) return null;

		return {
			plan: workspace.plan ?? "free",
			stripeCustomerId: workspace.stripeCustomerId ?? null,
			stripeSubscriptionId: workspace.stripeSubscriptionId ?? null,
		};
	},
});

// ─── Actions (server-side Stripe calls) ─────────────────────────────────────

export const createCheckoutSession = action({
	args: {
		workspaceId: v.id("workspaces"),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
	},
	handler: async (ctx, { workspaceId, planName, quantity }): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		// Verify the user is an admin/owner of this workspace
		const members = await ctx.runQuery(internal.stripe.getMemberRole, {
			workspaceId,
			userId: identity.subject,
		});
		if (!members || (members.role !== "admin" && members.role !== "owner")) {
			throw new Error("Only workspace admins can manage billing");
		}

		const workspace = await ctx.runQuery(internal.stripe.getWorkspaceInternal, {
			workspaceId,
		});
		if (!workspace) throw new Error("Workspace not found");

		const plan = PLANS[planName];
		if (!plan.stripePriceId) {
			throw new Error(`No Stripe price configured for plan: ${planName}`);
		}

		const seatCount = Math.max(quantity, 1);

		const stripe = getStripe();
		const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		if (!siteUrl) throw new Error("SITE_URL not configured");

		// Reuse existing Stripe customer or create a new one
		let customerId = workspace.stripeCustomerId;
		if (!customerId) {
			const customer = await stripe.customers.create({
				metadata: {
					convexWorkspaceId: workspaceId,
				},
				email: identity.email ?? undefined,
				name: workspace.name,
			});
			customerId = customer.id;
			await ctx.runMutation(internal.stripe.setStripeCustomerId, {
				workspaceId,
				stripeCustomerId: customerId,
			});
		}

		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			mode: "subscription",
			line_items: [
				{
					price: plan.stripePriceId,
					quantity: seatCount,
				},
			],
			metadata: {
				convexWorkspaceId: workspaceId,
				planName,
			},
			subscription_data: {
				metadata: {
					convexWorkspaceId: workspaceId,
					planName,
				},
			},
			success_url: `${siteUrl}/workspace/${workspaceId}/billing?success=true`,
			cancel_url: `${siteUrl}/workspace/${workspaceId}/billing?canceled=true`,
		});

		if (!session.url) throw new Error("Failed to create checkout session");
		return session.url;
	},
});

export const createPortalSession = action({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const members = await ctx.runQuery(internal.stripe.getMemberRole, {
			workspaceId,
			userId: identity.subject,
		});
		if (!members || (members.role !== "admin" && members.role !== "owner")) {
			throw new Error("Only workspace admins can manage billing");
		}

		const workspace = await ctx.runQuery(internal.stripe.getWorkspaceInternal, {
			workspaceId,
		});
		if (!workspace?.stripeCustomerId) {
			throw new Error("No billing account found for this workspace");
		}

		const stripe = getStripe();
		const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		if (!siteUrl) throw new Error("SITE_URL not configured");

		const session = await stripe.billingPortal.sessions.create({
			customer: workspace.stripeCustomerId,
			return_url: `${siteUrl}/workspace/${workspaceId}/billing`,
		});

		return session.url;
	},
});

// ─── Internal helpers (not exposed to the client) ───────────────────────────

export const getMemberRole = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.string(),
	},
	handler: async (ctx, { workspaceId, userId }) => {
		// identity.subject may contain "userId|provider" — strip the suffix
		const baseUserId = userId.split("|")[0] as Id<"users">;

		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", baseUserId)
			)
			.unique();

		if (!member) return null;
		return { role: member.role };
	},
});

export const getWorkspaceInternal = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		return await ctx.db.get(workspaceId);
	},
});

export const getWorkspaceMemberCount = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", workspaceId)
			)
			.collect();
		return Math.max(members.length, 1);
	},
});

export const setStripeCustomerId = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		stripeCustomerId: v.string(),
	},
	handler: async (ctx, { workspaceId, stripeCustomerId }) => {
		await ctx.db.patch(workspaceId, { stripeCustomerId });
	},
});

export const updateSubscription = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		stripeSubscriptionId: v.string(),
		plan: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
	},
	handler: async (ctx, { workspaceId, stripeSubscriptionId, plan }) => {
		await ctx.db.patch(workspaceId, {
			stripeSubscriptionId,
			plan,
		});
	},
});

export const cancelSubscription = internalMutation({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		await ctx.db.patch(workspaceId, {
			plan: "free",
			stripeSubscriptionId: undefined,
		});
	},
});
