// Dodo Payments Convex adapter bootstrap
// Docs:
// - Convex Component: https://docs.dodopayments.com/developer-resources/convex-component
// - Adapters (Convex): https://github.com/dodopayments/dodo-adapters/blob/main/packages/convex/README.md

import {
	DodoPayments,
	type DodoPaymentsClientConfig,
} from "@dodopayments/convex";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type ConvexCtx = QueryCtx | MutationCtx | ActionCtx;

export class DodoApiError extends Error {
	code: string | null;

	constructor(message: string, code: string | null = null) {
		super(message);
		this.name = "DodoApiError";
		this.code = code;
	}
}

const parseDodoErrorCode = (error: string): string | null => {
	try {
		const parsed = JSON.parse(error);
		return typeof parsed?.code === "string" ? parsed.code : null;
	} catch {
		return null;
	}
};

const throwDodoApiError = (operation: string, error: string): never => {
	const errorMessage = error.trim() || "No response body";
	const code = errorMessage.includes("RBAC: access denied")
		? "RBAC_ACCESS_DENIED"
		: parseDodoErrorCode(errorMessage);
	const log = code === "RBAC_ACCESS_DENIED" ? console.warn : console.error;
	log(`[Dodo REST] ${operation} failed:`, errorMessage);

	throw new DodoApiError(
		`Dodo API Error (${operation}): ${errorMessage}`,
		code
	);
};

const DODO_REQUEST_TIMEOUT_MS = 30_000;

const fetchDodo = async <T>(
	operation: string,
	input: string,
	init: RequestInit,
	parse: (response: Response) => Promise<T>
): Promise<T> => {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		DODO_REQUEST_TIMEOUT_MS
	);

	try {
		const res = await fetch(input, { ...init, signal: controller.signal });
		return await parse(res);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throwDodoApiError(operation, "request timed out");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
};

// Identify the current user's active workspace and map to its Dodo customer
async function identifyCustomer(
	ctx: ConvexCtx
): Promise<{ dodoCustomerId: string } | null> {
	let dodoCustomerId: string | null = null;

	if ("db" in ctx) {
		// We are in a Query or Mutation
		const dbCtx = ctx as MutationCtx;
		const identity = await dbCtx.auth.getUserIdentity();
		if (!identity?.subject) return null;
		const baseUserId = identity.subject.split("|")[0];
		if (!baseUserId) return null;

		const pref = await dbCtx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", baseUserId as Id<"users">))
			.unique();

		let workspace = null;
		if (pref?.lastActiveWorkspaceId) {
			workspace = await dbCtx.db.get(pref.lastActiveWorkspaceId);
		}

		if (!workspace) {
			workspace = await dbCtx.db
				.query("workspaces")
				.withIndex("by_user_id", (q) =>
					q.eq("userId", baseUserId as Id<"users">)
				)
				.first();
		}
		dodoCustomerId = workspace?.dodoCustomerId || null;
	} else {
		// We are in an Action
		const identity = await ctx.auth.getUserIdentity();
		if (!identity?.subject) return null;
		const baseUserId = identity.subject.split("|")[0];

		dodoCustomerId = await ctx.runQuery(
			internal.payments.identifyDodoCustomer,
			{
				userId: baseUserId,
			}
		);
	}

	if (!dodoCustomerId) return null;
	return { dodoCustomerId };
}

export const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY;
if (!dodoApiKey) {
	throw new Error("DODO_PAYMENTS_API_KEY environment variable is required");
}

const dodoEnvironment =
	process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
		? "live_mode"
		: "test_mode";

export const apiBase =
	dodoEnvironment === "test_mode"
		? "https://test.dodopayments.com"
		: "https://live.dodopayments.com";

export const dodo = new DodoPayments((components as any).dodopayments, {
	identify: identifyCustomer,
	apiKey: dodoApiKey,
	environment: dodoEnvironment,
} as DodoPaymentsClientConfig);

// Export API surface for use in Convex actions
export const { checkout, customerPortal } = dodo.api();

export const customerPortals = {
	create: async (
		_ctx: ConvexCtx,
		args: {
			customer_id: string;
			return_url?: string;
			send_email?: boolean;
		}
	) => {
		const params = new URLSearchParams();
		if (args.return_url) {
			params.set("return_url", args.return_url);
		}
		if (typeof args.send_email === "boolean") {
			params.set("send_email", String(args.send_email));
		}

		const query = params.toString();
		return await fetchDodo(
			"customer portal",
			`${apiBase}/customers/${args.customer_id}/customer-portal/session${
				query ? `?${query}` : ""
			}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
				},
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"customer portal",
						error || `${res.status} ${res.statusText}`
					);
				}

				const session = await res.json();
				const portalUrl = session?.link ?? session?.portal_url;
				if (typeof portalUrl !== "string" || portalUrl.length === 0) {
					throwDodoApiError(
						"customer portal",
						"Customer portal session did not return a link"
					);
				}

				return { portal_url: portalUrl };
			}
		);
	},
};

export const customers = {
	update: async (
		_ctx: ConvexCtx,
		args: {
			customer_id: string;
			email?: string | null;
			name?: string | null;
		}
	) => {
		const { customer_id, ...body } = args;
		return await fetchDodo(
			"update customer",
			`${apiBase}/customers/${customer_id}`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"update customer",
						error || `${res.status} ${res.statusText}`
					);
				}
				return await res.json();
			}
		);
	},
};

type SubscriptionBillingAddress = Record<string, unknown>;

type SubscriptionUpdate = {
	billing?: SubscriptionBillingAddress | null;
	cancel_at_next_billing_date?: boolean | null;
	cancel_reason?:
		| "cancelled_by_customer"
		| "cancelled_by_merchant"
		| "cancelled_by_merchant_send_dunning"
		| "dodo_team"
		| null;
	cancellation_comment?: string | null;
	cancellation_feedback?:
		| "too_expensive"
		| "missing_features"
		| "switched_service"
		| "unused"
		| "customer_service"
		| "low_quality"
		| "too_complex"
		| "other"
		| null;
	customer_name?: string | null;
	metadata?: Record<string, string> | null;
	next_billing_date?: string | null;
	status?:
		| "pending"
		| "active"
		| "on_hold"
		| "cancelled"
		| "failed"
		| "expired"
		| null;
	tax_id?: string | null;
};

export const subscriptions = {
	retrieve: async (_ctx: ConvexCtx, args: { subscription_id: string }) => {
		return await fetchDodo(
			"retrieve",
			`${apiBase}/subscriptions/${args.subscription_id}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
				},
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"retrieve",
						error || `${res.status} ${res.statusText}`
					);
				}
				return await res.json();
			}
		);
	},

	changePlan: async (
		_ctx: ConvexCtx,
		args: {
			subscription_id: string;
			product_id: string;
			quantity: number;
			proration_billing_mode?:
				| "prorated_immediately"
				| "full_immediately"
				| "difference_immediately"
				| "do_not_bill";
			on_payment_failure?: "prevent_change" | "apply_change";
			metadata?: Record<string, string>;
		}
	) => {
		const body: Record<string, unknown> = {
			product_id: args.product_id,
			quantity: args.quantity,
			proration_billing_mode:
				args.proration_billing_mode || "difference_immediately",
			effective_at: "immediately",
			on_payment_failure: args.on_payment_failure || "prevent_change",
		};
		if (args.metadata) {
			body.metadata = args.metadata;
		}

		return await fetchDodo(
			"changePlan",
			`${apiBase}/subscriptions/${args.subscription_id}/change-plan`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"changePlan",
						error || `${res.status} ${res.statusText}`
					);
				}
				return res.headers.get("content-type")?.includes("application/json")
					? await res.json()
					: null;
			}
		);
	},

	cancel: async (ctx: ConvexCtx, args: { subscription_id: string }) => {
		return await subscriptions.update(ctx, {
			subscription_id: args.subscription_id,
			status: "cancelled",
			cancel_reason: "cancelled_by_customer",
			cancellation_feedback: "unused",
			cancellation_comment:
				"Workspace downgraded to Free from the application billing page.",
		});
	},

	update: async (
		_ctx: ConvexCtx,
		args: { subscription_id: string } & SubscriptionUpdate
	) => {
		const { subscription_id, ...body } = args;
		return await fetchDodo(
			"update",
			`${apiBase}/subscriptions/${subscription_id}`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"update",
						error || `${res.status} ${res.statusText}`
					);
				}
				return res.headers.get("content-type")?.includes("application/json")
					? await res.json()
					: null;
			}
		);
	},

	reactivate: async (ctx: ConvexCtx, args: { subscription_id: string }) => {
		const updated = await subscriptions.update(ctx, {
			subscription_id: args.subscription_id,
			cancel_at_next_billing_date: false,
		});

		if (updated?.cancel_at_next_billing_date === false) {
			return updated;
		}

		for (const delayMs of [500, 1500]) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			const subscription = await subscriptions.retrieve(ctx, {
				subscription_id: args.subscription_id,
			});
			if (subscription?.cancel_at_next_billing_date === false) {
				return subscription;
			}
		}

		return throwDodoApiError(
			"reactivate",
			"Subscription is still scheduled for cancellation after update"
		);
	},

	updatePaymentMethod: async (
		_ctx: ConvexCtx,
		args: { subscription_id: string; return_url?: string | null }
	) => {
		return await fetchDodo(
			"updatePaymentMethod",
			`${apiBase}/subscriptions/${args.subscription_id}/update-payment-method`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: "new",
					return_url: args.return_url ?? null,
				}),
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"updatePaymentMethod",
						error || `${res.status} ${res.statusText}`
					);
				}
				return res.headers.get("content-type")?.includes("application/json")
					? await res.json()
					: null;
			}
		);
	},
};

export const payments = {
	listForSubscription: async (
		_ctx: ConvexCtx,
		args: { subscription_id: string; page_size?: number }
	) => {
		const params = new URLSearchParams({
			subscription_id: args.subscription_id,
			status: "succeeded",
			page_size: String(args.page_size ?? 10),
			page_number: "0",
		});

		return await fetchDodo(
			"list payments",
			`${apiBase}/payments?${params.toString()}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
				},
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"list payments",
						error || `${res.status} ${res.statusText}`
					);
				}
				return await res.json();
			}
		);
	},

	retrieveLineItems: async (_ctx: ConvexCtx, args: { payment_id: string }) => {
		return await fetchDodo(
			"retrieve line items",
			`${apiBase}/payments/${args.payment_id}/line-items`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
				},
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"retrieve line items",
						error || `${res.status} ${res.statusText}`
					);
				}
				return await res.json();
			}
		);
	},
};

export const refunds = {
	create: async (
		_ctx: ConvexCtx,
		args: {
			payment_id: string;
			item_id: string;
			amount: number;
			reason: string;
			metadata?: Record<string, string>;
		}
	) => {
		return await fetchDodo(
			"refund",
			`${apiBase}/refunds`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${dodoApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					payment_id: args.payment_id,
					items: [
						{
							item_id: args.item_id,
							amount: args.amount,
							tax_inclusive: true,
						},
					],
					reason: args.reason,
					metadata: args.metadata,
				}),
			},
			async (res) => {
				if (!res.ok) {
					const error = await res.text();
					throwDodoApiError(
						"refund",
						error || `${res.status} ${res.statusText}`
					);
				}
				return await res.json();
			}
		);
	},
};
