// Payments actions and queries using Dodo Payments Convex adapter
// References:
// - Convex Component: https://docs.dodopayments.com/developer-resources/convex-component
// - Checkout Sessions: https://docs.dodopayments.com/developer-resources/checkout-session

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery, query } from "./_generated/server";
import { checkout, customerPortal } from "./dodo";
import { PLANS, type PlanName } from "./plans";

// Internal query: check if current user is admin/owner of the workspace
export const checkWorkspaceAdmin = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return false;

		const baseUserId = (identity.subject || "").split("|")[0];
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q: any) =>
				q.eq("workspaceId", workspaceId).eq("userId", baseUserId)
			)
			.unique();
		return member && (member.role === "admin" || member.role === "owner");
	},
});

// Query: subscription status for UI
export const getSubscriptionStatus = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) return null;

		return {
			plan: (workspace.plan as PlanName) ?? "free",
			dodoSubscriptionId: workspace.dodoSubscriptionId ?? null,
		};
	},
});

// Action: create Dodo checkout session from a plan & seat quantity
export const createCheckoutSession = action({
	args: {
		workspaceId: v.id("workspaces"),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
	},
	handler: async (
		ctx,
		{ workspaceId, planName, quantity }
	): Promise<string> => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const plan = PLANS[planName];
		if (!plan?.dodoProductId) {
			throw new Error(
				`Missing Dodo product mapping for plan "${planName}". Set PLANS.${planName}.dodoProductId`
			);
		}

		const seatCount = Math.max(1, quantity);
		const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		if (!siteUrl) throw new Error("SITE_URL not configured");

		// Build Checkout Session payload
		const session = await checkout(ctx, {
			payload: {
				product_cart: [
					{
						product_id: plan.dodoProductId,
						quantity: seatCount,
					},
				],
				// Metadata to use in webhooks for mapping back to workspace/plan
				metadata: {
					workspace_id: workspaceId,
					plan: planName,
				},
				return_url: `${siteUrl}/workspace/${workspaceId}/billing`,
				billing_currency: "USD",
				feature_flags: {
					allow_discount_code: true,
				},
			},
		});

		if (!session?.checkout_url) {
			throw new Error("Checkout session did not return a checkout_url");
		}
		return session.checkout_url;
	},
});

// Action: create a Dodo customer portal session for the identified customer
export const getCustomerPortal = action({
	args: {
		send_email: v.optional(v.boolean()),
	},
	handler: async (ctx, args): Promise<string> => {
		// Customer identification is handled by dodo.identify() in convex/dodo.ts
		const portal = await customerPortal(ctx, {
			send_email: args.send_email ?? false,
		});
		if (!portal?.portal_url) {
			throw new Error("Customer portal did not return a portal_url");
		}
		return portal.portal_url;
	},
});
