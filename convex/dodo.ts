// Dodo Payments Convex adapter bootstrap
// Docs:
// - Convex Component: https://docs.dodopayments.com/developer-resources/convex-component
// - Adapters (Convex): https://github.com/dodopayments/dodo-adapters/blob/main/packages/convex/README.md

import {
	DodoPayments,
	type DodoPaymentsClientConfig,
} from "@dodopayments/convex";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Identify the current user's active workspace and map to its Dodo customer
// We prefer preferences.lastActiveWorkspaceId, otherwise fall back to first workspace owned by the user.
async function identifyCustomer(
	ctx: any
): Promise<{ dodoCustomerId: string } | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;

	// identity.subject may contain "userId|provider" — strip suffix
	const baseUserId = (identity.subject || "").split("|")[0] as Id<"users">;

	// Try to use preferences.lastActiveWorkspaceId
	const pref = await ctx.db
		.query("preferences")
		.withIndex("by_user_id", (q: any) => q.eq("userId", baseUserId))
		.unique()
		.catch(() => null);

	let workspace: any = null;
	if (pref?.lastActiveWorkspaceId) {
		workspace = await ctx.db.get(pref.lastActiveWorkspaceId).catch(() => null);
	}

	// Fallback: any workspace owned by the user
	if (!workspace) {
		workspace = await ctx.db
			.query("workspaces")
			.withIndex("by_user_id", (q: any) => q.eq("userId", baseUserId))
			.first()
			.catch(() => null);
	}

	const dodoCustomerId: string | undefined = workspace?.dodoCustomerId;
	if (!dodoCustomerId) return null;

	return { dodoCustomerId };
}

export const dodo = new DodoPayments((components as any).dodopayments, {
	identify: identifyCustomer,
	apiKey: process.env.DODO_PAYMENTS_API_KEY!,
	environment:
		process.env.DODO_PAYMENTS_ENVIRONMENT || `test_mode` || `live_mode`,
} as DodoPaymentsClientConfig);

// Export API surface for use in Convex actions
export const { checkout, customerPortal } = dodo.api();
