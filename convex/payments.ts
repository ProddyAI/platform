// Payments actions and queries using Dodo Payments Convex adapter
// References:
// - Convex Component: https://docs.dodopayments.com/developer-resources/convex-component
// - Checkout Sessions: https://docs.dodopayments.com/developer-resources/checkout-session

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	action,
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
	query,
} from "./_generated/server";
import { checkout, customerPortal } from "./dodo";
import { PLANS, type PlanName } from "./plans";

type PaidPlanName = "pro" | "enterprise";
type DodoSubscription = Record<string, unknown> & {
	subscription_id?: string;
	product_id?: string;
	product?: { product_id?: string; id?: string };
	metadata?: { plan?: string };
	quantity?: number;
	status?: string;
	currency?: string;
	previous_billing_date?: string;
	next_billing_date?: string;
	current_period_end?: string;
	customer?: { customer_id?: string };
	customer_id?: string;
	cancel_at_next_billing_date?: boolean;
	scheduled_change?: {
		product_id?: string;
		quantity?: number;
	};
};
type DodoPayment = Record<string, unknown> & {
	payment_id?: string;
	id?: string;
	status?: string;
	total_amount?: number;
	amount?: number;
	currency?: string;
	created_at?: string;
	tax?: number;
	invoice_url?: string;
	invoiceUrl?: string;
	receipt_url?: string;
	refunds?: Array<{ status?: string; amount?: number }>;
};
type DodoRefund = Record<string, unknown> & {
	refund_id?: string;
	amount?: number;
	currency?: string;
};
type DodoLineItem = Record<string, unknown> & {
	item_id?: string;
	items_id?: string;
	id?: string;
	line_item_id?: string;
	lineItemId?: string;
	refundable_amount?: number;
	refundableAmount?: number;
	amount_refundable?: number;
	remaining_refundable_amount?: number;
	remainingRefundableAmount?: number;
};
type DodoPaymentsApi = {
	listForSubscription: (
		ctx: ActionCtx,
		args: { subscription_id: string; page_size: number }
	) => Promise<{ items?: DodoPayment[] } | null | undefined>;
	retrieveLineItems: (
		ctx: ActionCtx,
		args: { payment_id: string }
	) => Promise<unknown>;
};
type DodoRefundsApi = {
	create: (
		ctx: ActionCtx,
		args: {
			payment_id: string;
			item_id: string;
			amount: number;
			reason: string;
			metadata: Record<string, string>;
		}
	) => Promise<DodoRefund>;
};
type ReadableCtx = Pick<QueryCtx | MutationCtx, "db">;

const parseDodoErrorCode = (error: unknown): string | null => {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return error.code;
	}

	const message = error instanceof Error ? error.message : String(error);
	const raw = message.replace(/^Dodo API Error(?: \([^)]+\))?:\s*/, "");

	try {
		const parsed = JSON.parse(raw);
		return typeof parsed?.code === "string" ? parsed.code : null;
	} catch {
		return null;
	}
};

const isDodoRbacAccessDenied = (error: unknown): boolean => {
	if (parseDodoErrorCode(error) === "RBAC_ACCESS_DENIED") return true;
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("RBAC: access denied");
};

const isDodoProviderError = (error: unknown): boolean => {
	if (error && typeof error === "object" && "code" in error) return true;
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("Dodo API Error");
};

const dodoBillingPermissionRequiredResult = () => ({
	success: false,
	status: "billing_permission_required",
	message:
		"Dodo denied the subscription update. Update the Dodo API key permissions to allow subscription plan changes, then try again.",
});

const dodoProviderErrorResult = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	return {
		success: false,
		status: "billing_provider_error",
		message:
			message && message !== "Dodo API Error:"
				? message
				: "Dodo rejected the subscription update. Please check the subscription status in Dodo and try again.",
	};
};

const dodoPreviousPaymentPendingResult = () => ({
	success: false,
	status: "previous_payment_pending",
	message:
		"Dodo is still processing the previous subscription payment. Please wait for the payment.succeeded webhook to finish, then try again.",
});

const inactiveSubscriptionCheckoutResult = () => ({
	success: false,
	status: "inactive_subscription",
	message:
		"This workspace does not have an active paid subscription. Continue through checkout to start a new plan.",
});

const isActivePaidSubscription = (
	workspacePlan: string | null | undefined,
	subscriptionStatus: string | null | undefined,
	dodoSubscriptionId: string | null | undefined
) =>
	Boolean(dodoSubscriptionId) &&
	workspacePlan !== "free" &&
	subscriptionStatus === "active";

const findDodoPaymentUrl = (value: unknown): string | null => {
	if (!value || typeof value !== "object") return null;
	for (const [key, nestedValue] of Object.entries(value)) {
		if (
			typeof nestedValue === "string" &&
			(key === "payment_link" ||
				key === "checkout_url" ||
				key === "payment_url" ||
				key === "url") &&
			nestedValue.startsWith("http")
		) {
			return nestedValue;
		}
		const nestedUrl = findDodoPaymentUrl(nestedValue);
		if (nestedUrl) return nestedUrl;
	}
	return null;
};

const planNameFromDodoProductId = (
	productId: string
): "pro" | "enterprise" | null => {
	if (PLANS.pro.dodoProductId === productId) return "pro";
	if (PLANS.enterprise.dodoProductId === productId) return "enterprise";
	return null;
};

const planNameFromDodoSubscription = (
	subscription: DodoSubscription | null | undefined
): PaidPlanName | null => {
	const productIds = [
		subscription?.product_id,
		subscription?.product?.product_id,
		subscription?.product?.id,
	];
	for (const productId of productIds) {
		if (typeof productId !== "string") continue;
		const planName = planNameFromDodoProductId(productId);
		if (planName) return planName;
	}

	const metadataPlan = subscription?.metadata?.plan;
	if (metadataPlan === "pro" || metadataPlan === "enterprise") {
		return metadataPlan;
	}

	return null;
};

const BILLABLE_MEMBER_ROLES = new Set(["owner", "admin", "member"]);

const planRank = (plan: string | null | undefined) => {
	if (plan === "enterprise") return 2;
	if (plan === "pro") return 1;
	return 0;
};

const planChangeType = (
	previousPlan: string | null | undefined,
	newPlan: string
): "upgrade" | "downgrade" =>
	planRank(newPlan) > planRank(previousPlan) ? "upgrade" : "downgrade";

const getBillableMembers = async (
	ctx: ReadableCtx,
	workspaceId: Id<"workspaces">
) => {
	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.take(1000);

	if (members.length >= 1000) {
		throw new Error(
			"This workspace has too many members for self-serve billing changes. Please contact support."
		);
	}

	return members.filter((member) => BILLABLE_MEMBER_ROLES.has(member.role));
};

const requireSeatsForEveryMember = (
	quantity: number,
	billableMemberCount: number
) => {
	if (quantity < billableMemberCount) {
		throw new Error(
			`Choose at least ${billableMemberCount} seats to cover every workspace owner, admin, and member.`
		);
	}
};

const parseTime = (value: unknown) => {
	if (typeof value !== "string") return null;
	const time = Date.parse(value);
	return Number.isFinite(time) ? time : null;
};

const sumSucceededRefunds = (payment: DodoPayment | null | undefined) => {
	const refunds = Array.isArray(payment?.refunds) ? payment.refunds : [];
	return refunds.reduce((total: number, refund) => {
		if (refund?.status !== "succeeded") return total;
		return total + (typeof refund?.amount === "number" ? refund.amount : 0);
	}, 0);
};

const getPaymentInvoiceUrl = (payment: DodoPayment | null | undefined) => {
	const invoiceUrl =
		payment?.invoice_url ?? payment?.invoiceUrl ?? payment?.receipt_url;
	return typeof invoiceUrl === "string" ? invoiceUrl : undefined;
};

const calculateUnusedPeriodRefundAmount = (
	subscription: DodoSubscription | null | undefined,
	payment: DodoPayment | null | undefined
) => {
	const periodStart = parseTime(subscription?.previous_billing_date);
	const periodEnd = parseTime(subscription?.next_billing_date);
	const totalAmount =
		typeof payment?.total_amount === "number" ? payment.total_amount : 0;
	if (
		!periodStart ||
		!periodEnd ||
		periodEnd <= periodStart ||
		totalAmount <= 0
	) {
		return 0;
	}

	const now = Date.now();
	if (now >= periodEnd) return 0;

	const remainingRatio = Math.max(
		0,
		Math.min(1, (periodEnd - now) / (periodEnd - periodStart))
	);
	const alreadyRefunded = sumSucceededRefunds(payment);
	const refundableAmount = Math.max(0, totalAmount - alreadyRefunded);
	return Math.min(
		refundableAmount,
		Math.floor(refundableAmount * remainingRatio)
	);
};

const getPlanMonthlyValueCents = (
	planName: "pro" | "enterprise",
	quantity: number
) => PLANS[planName].pricePerSeatMonthly * 100 * quantity;

const calculateFairBillingDelta = (
	subscription: DodoSubscription | null | undefined,
	args: {
		currentPlan: "pro" | "enterprise";
		currentQuantity: number;
		nextPlan: "pro" | "enterprise";
		nextQuantity: number;
	}
) => {
	const periodStart = parseTime(subscription?.previous_billing_date);
	const periodEnd =
		parseTime(subscription?.next_billing_date) ??
		parseTime(subscription?.current_period_end);
	const currentMonthlyValue = getPlanMonthlyValueCents(
		args.currentPlan,
		args.currentQuantity
	);
	const nextMonthlyValue = getPlanMonthlyValueCents(
		args.nextPlan,
		args.nextQuantity
	);
	const monthlyDelta = nextMonthlyValue - currentMonthlyValue;

	if (
		!periodStart ||
		!periodEnd ||
		periodEnd <= periodStart ||
		monthlyDelta === 0
	) {
		return {
			amountDue: 0,
			refundAmount: 0,
			remainingRatio: 0,
			periodStart,
			periodEnd,
			monthlyDelta,
			currentMonthlyValue,
			nextMonthlyValue,
		};
	}

	const now = Date.now();
	if (now >= periodEnd) {
		return {
			amountDue: 0,
			refundAmount: 0,
			remainingRatio: 0,
			periodStart,
			periodEnd,
			monthlyDelta,
			currentMonthlyValue,
			nextMonthlyValue,
		};
	}

	const remainingRatio = Math.max(
		0,
		Math.min(1, (periodEnd - now) / (periodEnd - periodStart))
	);
	const proratedDelta = Math.floor(Math.abs(monthlyDelta) * remainingRatio);
	return {
		amountDue: monthlyDelta > 0 ? proratedDelta : 0,
		refundAmount: monthlyDelta < 0 ? proratedDelta : 0,
		remainingRatio,
		periodStart,
		periodEnd,
		monthlyDelta,
		currentMonthlyValue,
		nextMonthlyValue,
	};
};

const getLatestSucceededSubscriptionPayment = async (
	ctx: ActionCtx,
	paymentsApi: DodoPaymentsApi,
	subscriptionId: string
) => {
	const paymentList = await paymentsApi.listForSubscription(ctx, {
		subscription_id: subscriptionId,
		page_size: 10,
	});
	return Array.isArray(paymentList?.items)
		? paymentList.items
				.filter((payment) => payment?.status === "succeeded")
				.sort(
					(a, b) =>
						Date.parse(b?.created_at ?? "") - Date.parse(a?.created_at ?? "")
				)[0]
		: null;
};

const collectLineItems = (value: unknown): DodoLineItem[] => {
	if (!value || typeof value !== "object") return [];
	if (Array.isArray(value)) {
		return value.flatMap((item) => collectLineItems(item));
	}

	const objectValue = value as Record<string, unknown>;
	const hasLineItemShape = [
		"item_id",
		"items_id",
		"id",
		"refundable_amount",
		"refundableAmount",
		"amount_refundable",
	].some((key) => key in objectValue);

	return [
		...(hasLineItemShape ? [objectValue] : []),
		...Object.values(objectValue).flatMap((item) => collectLineItems(item)),
	];
};

const getRefundableAmount = (item: DodoLineItem | null | undefined): number => {
	const amount =
		item?.refundable_amount ??
		item?.refundableAmount ??
		item?.amount_refundable ??
		item?.remaining_refundable_amount ??
		item?.remainingRefundableAmount;
	return typeof amount === "number" ? amount : 0;
};

const refundLatestSubscriptionPayment = async (
	ctx: ActionCtx,
	paymentsApi: DodoPaymentsApi,
	refundsApi: DodoRefundsApi,
	args: {
		latestPayment: DodoPayment | null | undefined;
		amount: number;
		reason: string;
		metadata: Record<string, string>;
	}
) => {
	if (args.amount <= 0 || !args.latestPayment?.payment_id) {
		return {
			refund: null,
			requestedRefundAmount: Math.max(0, args.amount),
		};
	}

	const lineItems = await paymentsApi.retrieveLineItems(ctx, {
		payment_id: args.latestPayment.payment_id,
	});
	const refundableLineItem =
		collectLineItems(lineItems).find((item) => getRefundableAmount(item) > 0) ??
		null;
	const refundItemId =
		refundableLineItem?.item_id ??
		refundableLineItem?.items_id ??
		refundableLineItem?.id ??
		refundableLineItem?.line_item_id ??
		refundableLineItem?.lineItemId;
	const maxRefundableAmount = getRefundableAmount(refundableLineItem);
	const refundRequestAmount = Math.min(args.amount, maxRefundableAmount);

	if (!refundItemId || refundRequestAmount <= 0) {
		throw new Error(
			"Unable to find a refundable line item for the latest subscription payment"
		);
	}

	const refund = await refundsApi.create(ctx, {
		payment_id: args.latestPayment.payment_id,
		item_id: String(refundItemId),
		amount: refundRequestAmount,
		reason: args.reason,
		metadata: args.metadata,
	});

	return {
		refund,
		requestedRefundAmount: refundRequestAmount,
	};
};

const getWorkspacePortalCustomerId = async (
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">
) => {
	const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
		internal.workspaces.getWorkspaceByIdInternal,
		{
			id: workspaceId,
		}
	);
	return workspace?.dodoCustomerId ?? workspace?.customerId ?? null;
};

const sendDodoCustomerPortalEmail = async (
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">
) => {
	try {
		const appUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		const customerId = await getWorkspacePortalCustomerId(ctx, workspaceId);
		if (customerId) {
			const { customerPortals } = await import("./dodo");
			await customerPortals.create(ctx, {
				customer_id: customerId,
				send_email: true,
				...(appUrl
					? { return_url: `${appUrl}/workspace/${workspaceId}/manage#billing` }
					: {}),
			});
			return;
		}

		await customerPortal(ctx, { send_email: true });
	} catch (error) {
		console.warn("[Dodo] Failed to send customer portal email:", error);
	}
};

const syncDodoSubscriptionToWorkspace = async (
	ctx: ActionCtx,
	args: {
		workspaceId?: string;
		subscriptionId: string;
		status: string;
		plan?: "pro" | "enterprise" | null;
		customerId?: string | null;
		quantity?: number | null;
		cancelAtNextBillingDate?: boolean | null;
		nextBillingDate?: string | null;
		paymentConfirmed?: boolean | null;
		raw: string;
	}
) => {
	const mutationArgs: {
		workspaceId?: string;
		subscriptionId: string;
		status: string;
		plan?: "pro" | "enterprise";
		customerId?: string;
		quantity?: number;
		cancelAtNextBillingDate?: boolean;
		nextBillingDate?: string;
		paymentConfirmed?: boolean;
		raw?: string;
	} = {
		subscriptionId: args.subscriptionId,
		status: args.status,
		raw: args.raw,
	};

	if (args.workspaceId) mutationArgs.workspaceId = args.workspaceId;
	if (args.plan) mutationArgs.plan = args.plan;
	if (args.customerId) mutationArgs.customerId = args.customerId;
	if (typeof args.quantity === "number") mutationArgs.quantity = args.quantity;
	if (typeof args.cancelAtNextBillingDate === "boolean") {
		mutationArgs.cancelAtNextBillingDate = args.cancelAtNextBillingDate;
	}
	if (args.nextBillingDate) mutationArgs.nextBillingDate = args.nextBillingDate;
	if (typeof args.paymentConfirmed === "boolean") {
		mutationArgs.paymentConfirmed = args.paymentConfirmed;
	}

	await ctx.runMutation(internal.webhooks.updateSubscription, mutationArgs);
};

// Internal query: identify the Dodo customer ID for a user
export const identifyDodoCustomer = internalQuery({
	args: { userId: v.optional(v.string()) },
	handler: async (ctx, args): Promise<string | null> => {
		let baseUserId = args.userId;

		if (!baseUserId) {
			const identity = await ctx.auth.getUserIdentity();
			if (!identity) {
				return null;
			}
			baseUserId = (identity.subject || "").split("|")[0];
		}

		const userId = baseUserId as Id<"users">;

		// Try preferences first
		const pref = await ctx.db
			.query("preferences")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.unique();

		let workspace = null;
		if (pref?.lastActiveWorkspaceId) {
			workspace = await ctx.db.get(pref.lastActiveWorkspaceId);
		}

		// Fallback to first owned workspace
		if (!workspace) {
			workspace = await ctx.db
				.query("workspaces")
				.withIndex("by_user_id", (q) => q.eq("userId", userId))
				.first();
		}

		const customerId =
			workspace?.dodoCustomerId || workspace?.customerId || null;
		return customerId;
	},
});

// Internal query: check if current user is admin/owner of the workspace
export const checkWorkspaceAdmin = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return false;

		const baseUserId = (identity.subject || "").split("|")[0];
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", baseUserId as Id<"users">)
			)
			.unique();
		return member && (member.role === "admin" || member.role === "owner");
	},
});

export const getBillingSeatContext = internalQuery({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const billableMembers = await getBillableMembers(ctx, workspaceId);
		return {
			workspacePlan: workspace.plan ?? "free",
			subscriptionStatus: workspace.subscriptionStatus ?? null,
			dodoSubscriptionId: workspace.dodoSubscriptionId ?? null,
			proSeats: workspace.proSeats ?? 0,
			enterpriseSeats: workspace.enterpriseSeats ?? 0,
			billableMemberCount: billableMembers.length,
			minimumSeatCount: Math.max(1, billableMembers.length),
		};
	},
});

export const applyWorkspaceSubscriptionQuantity = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
		subscriptionStatus: v.string(),
		auditAction: v.string(),
		invoiceUrl: v.optional(v.string()),
		amountDue: v.optional(v.number()),
		currency: v.optional(v.string()),
		taxAmount: v.optional(v.number()),
		usedAmount: v.optional(v.number()),
		refundAmount: v.optional(v.number()),
		refundCurrency: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const billableMembers = await getBillableMembers(ctx, args.workspaceId);
		const quantity = Math.max(1, Math.floor(args.quantity));
		requireSeatsForEveryMember(quantity, billableMembers.length);
		const previousSeats =
			args.planName === "enterprise"
				? (workspace.enterpriseSeats ?? 0)
				: (workspace.proSeats ?? 0);

		const patch: Record<string, unknown> = {
			plan: args.planName,
			subscriptionStatus: args.subscriptionStatus,
			totalPaidSeats: quantity,
			activeUserCount: billableMembers.length,
			cancellationAtPeriodEnd: false,
			scheduledCancellationDate: undefined,
		};
		if (args.planName === "enterprise") {
			patch.enterpriseSeats = quantity;
			patch.proSeats = 0;
		} else {
			patch.proSeats = quantity;
			patch.enterpriseSeats = 0;
		}

		await ctx.db.patch(args.workspaceId, patch);
		for (const member of billableMembers) {
			await ctx.db.patch(member._id, { seatTier: args.planName });
		}
		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: args.auditAction,
			previousValue: {
				plan: workspace.plan ?? null,
				quantity: previousSeats,
			},
			newValue: {
				plan: args.planName,
				quantity,
			},
			timestamp: Date.now(),
		});
		if ((workspace.plan ?? "free") !== args.planName) {
			const emailArgs: {
				workspaceId: Id<"workspaces">;
				previousPlan: string;
				newPlan: string;
				changeType: "upgrade" | "downgrade";
				invoiceUrl?: string;
				amountDue?: number;
				currency?: string;
				taxAmount?: number;
				usedAmount?: number;
				refundAmount?: number;
				refundCurrency?: string;
			} = {
				workspaceId: args.workspaceId,
				previousPlan: workspace.plan ?? "free",
				newPlan: args.planName,
				changeType: planChangeType(workspace.plan, args.planName),
			};
			if (args.invoiceUrl) emailArgs.invoiceUrl = args.invoiceUrl;
			if (typeof args.amountDue === "number")
				emailArgs.amountDue = args.amountDue;
			if (args.currency) emailArgs.currency = args.currency;
			if (typeof args.taxAmount === "number")
				emailArgs.taxAmount = args.taxAmount;
			if (typeof args.usedAmount === "number")
				emailArgs.usedAmount = args.usedAmount;
			if (typeof args.refundAmount === "number")
				emailArgs.refundAmount = args.refundAmount;
			if (args.refundCurrency) emailArgs.refundCurrency = args.refundCurrency;
			await ctx.scheduler.runAfter(
				0,
				internal.email.sendWorkspacePlanChangeEmail,
				emailArgs
			);
		}

		return { quantity };
	},
});

export const applyWorkspaceFreePlan = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		refundAmount: v.number(),
		refundCurrency: v.optional(v.string()),
		refundId: v.optional(v.string()),
		invoiceUrl: v.optional(v.string()),
		usedAmount: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		const billableMembers = await getBillableMembers(ctx, args.workspaceId);
		await ctx.db.patch(args.workspaceId, {
			plan: "free",
			subscriptionStatus: "cancelled",
			subscriptionId: undefined,
			dodoSubscriptionId: undefined,
			proSeats: 0,
			enterpriseSeats: 0,
			totalPaidSeats: 0,
			activeUserCount: billableMembers.length,
			cancellationAtPeriodEnd: false,
			scheduledCancellationDate: undefined,
		});

		for (const member of billableMembers) {
			await ctx.db.patch(member._id, { seatTier: undefined });
		}

		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: "subscription_cancelled",
			previousValue: {
				plan: workspace.plan ?? null,
				proSeats: workspace.proSeats ?? 0,
				enterpriseSeats: workspace.enterpriseSeats ?? 0,
			},
			newValue: {
				plan: "free",
				refundAmount: args.refundAmount,
				refundCurrency: args.refundCurrency ?? null,
				refundId: args.refundId ?? null,
			},
			timestamp: Date.now(),
		});
		if ((workspace.plan ?? "free") !== "free") {
			const emailArgs: {
				workspaceId: Id<"workspaces">;
				previousPlan: string;
				newPlan: string;
				changeType: "downgrade";
				invoiceUrl?: string;
				usedAmount?: number;
				refundAmount?: number;
				refundCurrency?: string;
			} = {
				workspaceId: args.workspaceId,
				previousPlan: workspace.plan ?? "free",
				newPlan: "free",
				changeType: "downgrade",
			};
			if (args.invoiceUrl) emailArgs.invoiceUrl = args.invoiceUrl;
			if (typeof args.usedAmount === "number")
				emailArgs.usedAmount = args.usedAmount;
			if (args.refundAmount > 0) emailArgs.refundAmount = args.refundAmount;
			if (args.refundCurrency) emailArgs.refundCurrency = args.refundCurrency;
			await ctx.scheduler.runAfter(
				0,
				internal.email.sendWorkspacePlanChangeEmail,
				emailArgs
			);
		}

		return { ok: true };
	},
});

export const recordBillingHistoryEntry = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		amount: v.number(),
		currency: v.string(),
		status: v.string(),
		taxAmount: v.optional(v.number()),
		type: v.union(v.literal("payment"), v.literal("refund")),
		description: v.string(),
		dodoInvoiceId: v.string(),
		plan: v.optional(v.string()),
		seats: v.optional(v.number()),
		invoiceUrl: v.optional(v.string()),
		usedAmount: v.optional(v.number()),
		createdAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billingHistory")
			.withIndex("by_dodo_invoice_id", (q) =>
				q.eq("dodoInvoiceId", args.dodoInvoiceId)
			)
			.unique();
		if (existing) return { ok: true, reason: "already_recorded" };

		const historyEntry: {
			workspaceId: Id<"workspaces">;
			amount: number;
			currency: string;
			status: string;
			taxAmount?: number;
			type: "payment" | "refund";
			description: string;
			plan?: string;
			seats?: number;
			invoiceUrl?: string;
			usedAmount?: number;
			dodoInvoiceId: string;
			createdAt: number;
		} = {
			workspaceId: args.workspaceId,
			amount: args.amount,
			currency: args.currency,
			status: args.status,
			type: args.type,
			description: args.description,
			dodoInvoiceId: args.dodoInvoiceId,
			createdAt: args.createdAt ?? Date.now(),
		};
		if (typeof args.taxAmount === "number") {
			historyEntry.taxAmount = args.taxAmount;
		}
		if (args.plan) historyEntry.plan = args.plan;
		if (typeof args.seats === "number") historyEntry.seats = args.seats;
		if (args.invoiceUrl) historyEntry.invoiceUrl = args.invoiceUrl;
		if (typeof args.usedAmount === "number") {
			historyEntry.usedAmount = args.usedAmount;
		}
		await ctx.db.insert("billingHistory", historyEntry);

		return { ok: true };
	},
});

export const clearWorkspaceScheduledCancellation = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		auditAction: v.string(),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		await ctx.db.patch(args.workspaceId, {
			subscriptionStatus: workspace.subscriptionStatus ?? "active",
			cancellationAtPeriodEnd: false,
			scheduledCancellationDate: undefined,
		});

		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: args.auditAction,
			previousValue: {
				cancellationAtPeriodEnd: workspace.cancellationAtPeriodEnd ?? false,
				scheduledCancellationDate: workspace.scheduledCancellationDate ?? null,
			},
			newValue: {
				cancellationAtPeriodEnd: false,
				scheduledCancellationDate: null,
			},
			timestamp: Date.now(),
		});

		return { ok: true };
	},
});

export const markWorkspaceCancellationScheduled = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		scheduledCancellationDate: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new Error("Workspace not found");
		}

		await ctx.db.patch(args.workspaceId, {
			subscriptionStatus: workspace.subscriptionStatus ?? "active",
			cancellationAtPeriodEnd: true,
			scheduledCancellationDate: args.scheduledCancellationDate,
		});

		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: "cancellation_scheduled",
			previousValue: {
				cancellationAtPeriodEnd: workspace.cancellationAtPeriodEnd ?? false,
				scheduledCancellationDate: workspace.scheduledCancellationDate ?? null,
			},
			newValue: {
				cancellationAtPeriodEnd: true,
				scheduledCancellationDate: args.scheduledCancellationDate ?? null,
			},
			timestamp: Date.now(),
		});

		return { ok: true };
	},
});

// Query: subscription status for UI
export const getSubscriptionStatus = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const identity = await ctx.auth.getUserIdentity();
		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) return null;
		const billableMembers = await getBillableMembers(ctx, workspaceId);

		let memberPlan = "free";
		if (identity) {
			const baseUserId = (identity.subject || "").split("|")[0] as Id<"users">;
			const member = await ctx.db
				.query("members")
				.withIndex("by_workspace_id_user_id", (q) =>
					q.eq("workspaceId", workspaceId).eq("userId", baseUserId)
				)
				.unique();

			// Use the member's assigned seat tier, defaulting to free
			memberPlan = member?.seatTier ?? "free";
		}

		return {
			plan: (workspace.plan as PlanName) ?? "free",
			memberPlan: memberPlan as PlanName,
			subscriptionStatus: workspace.subscriptionStatus ?? null,
			cancellationAtPeriodEnd: workspace.cancellationAtPeriodEnd ?? false,
			scheduledCancellationDate: workspace.scheduledCancellationDate ?? null,
			nextBillingDate: workspace.nextBillingDate ?? null,
			currentPeriodEnd:
				workspace.currentPeriodEnd ?? workspace.nextBillingDate ?? null,
			dodoCustomerId: workspace.dodoCustomerId ?? workspace.customerId ?? null,
			dodoSubscriptionId: workspace.dodoSubscriptionId ?? null,
			proSeats: workspace.proSeats ?? 0,
			enterpriseSeats: workspace.enterpriseSeats ?? 0,
			billableMemberCount: billableMembers.length,
			minimumSeatCount: Math.max(1, billableMembers.length),
		};
	},
});

export const getBillingSummary = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error("Unauthorized");

		const baseUserId = (identity.subject || "").split("|")[0] as Id<"users">;
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q) =>
				q.eq("workspaceId", workspaceId).eq("userId", baseUserId)
			)
			.unique();
		if (!member || (member.role !== "admin" && member.role !== "owner")) {
			throw new Error("Only workspace admins can view billing");
		}

		const history = await ctx.db
			.query("billingHistory")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.order("desc")
			.take(20);

		const auditLogs = await ctx.db
			.query("billingAuditLogs")
			.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
			.order("desc")
			.take(20);

		const successfulPayments = history.filter(
			(entry) =>
				(entry.type ?? "payment") === "payment" &&
				(entry.status === "succeeded" ||
					(entry as { settled?: boolean }).settled === true)
		);
		const paidTotal = successfulPayments.reduce(
			(total, entry) => total + entry.amount,
			0
		);
		const taxTotal = successfulPayments.reduce(
			(total, entry) => total + (entry.taxAmount ?? 0),
			0
		);
		const refundedTotal = history
			.filter((entry) => entry.type === "refund")
			.reduce((total, entry) => total + entry.amount, 0);
		const currency = history.find((entry) => entry.currency)?.currency ?? "USD";

		return {
			history,
			auditLogs,
			paidTotal,
			taxTotal,
			refundedTotal,
			netPaid: paidTotal - refundedTotal,
			currency,
		};
	},
});

export const getPlanChangePreview = action({
	args: {
		workspaceId: v.id("workspaces"),
		newPlan: v.union(v.literal("pro"), v.literal("enterprise")),
		newQuantity: v.number(),
	},
	// skipcq: JS-0128
	handler: async (ctx, args): Promise<Record<string, unknown>> => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId: args.workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
			internal.workspaces.getWorkspaceByIdInternal,
			{ id: args.workspaceId }
		);
		if (!workspace?.dodoSubscriptionId || workspace.plan === "free") {
			return {
				status: "new_subscription",
				amountDue:
					PLANS[args.newPlan].pricePerSeatMonthly *
					100 *
					Math.max(1, Math.floor(args.newQuantity)),
				refundAmount: 0,
				currency: "USD",
			};
		}

		const { subscriptions } = await import("./dodo");
		const subscription: DodoSubscription = await subscriptions.retrieve(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		const currentPlan: PaidPlanName =
			workspace.plan === "enterprise" ? "enterprise" : "pro";
		const currentQuantity = Math.max(
			1,
			Math.floor(
				currentPlan === "enterprise"
					? (workspace.enterpriseSeats ??
							workspace.totalPaidSeats ??
							subscription?.quantity ??
							1)
					: (workspace.proSeats ??
							workspace.totalPaidSeats ??
							subscription?.quantity ??
							1)
			)
		);
		const nextQuantity = Math.max(1, Math.floor(args.newQuantity));
		const fairBilling = calculateFairBillingDelta(subscription, {
			currentPlan,
			currentQuantity,
			nextPlan: args.newPlan,
			nextQuantity,
		});

		return {
			status: "fair_billing",
			amountDue: fairBilling.amountDue,
			refundAmount: fairBilling.refundAmount,
			currency: subscription?.currency ?? "USD",
			periodStart: fairBilling.periodStart,
			periodEnd: fairBilling.periodEnd,
			remainingRatio: fairBilling.remainingRatio,
			currentMonthlyAmount: getPlanMonthlyValueCents(
				currentPlan,
				currentQuantity
			),
			nextMonthlyAmount: getPlanMonthlyValueCents(args.newPlan, nextQuantity),
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
		const billingContext: {
			workspacePlan: string;
			subscriptionStatus: string | null;
			dodoSubscriptionId: string | null;
			minimumSeatCount: number;
			billableMemberCount: number;
		} = await ctx.runQuery(internal.payments.getBillingSeatContext, {
			workspaceId,
		});
		if (
			isActivePaidSubscription(
				billingContext.workspacePlan,
				billingContext.subscriptionStatus,
				billingContext.dodoSubscriptionId
			)
		) {
			throw new Error(
				"This workspace already has a subscription. Use Change Plan to switch plans."
			);
		}

		const seatCount = Math.max(1, Math.floor(quantity));
		requireSeatsForEveryMember(seatCount, billingContext.billableMemberCount);
		const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		if (!siteUrl) throw new Error("SITE_URL not configured");
		const identity = await ctx.auth.getUserIdentity();
		const checkoutCustomer: { email: string; name?: string } | undefined =
			typeof identity?.email === "string" && identity.email.length > 0
				? {
						email: identity.email,
						...(identity.name ? { name: identity.name } : {}),
					}
				: undefined;

		const payload: {
			product_cart: Array<{ product_id: string; quantity: number }>;
			metadata: { workspace_id: string; plan: "pro" | "enterprise" };
			customer?: { email: string; name?: string };
			return_url: string;
			billing_currency: "USD";
			feature_flags: { allow_discount_code: boolean };
		} = {
			product_cart: [
				{
					product_id: plan.dodoProductId,
					quantity: seatCount,
				},
			],
			metadata: {
				workspace_id: workspaceId,
				plan: planName,
			},
			return_url: `${siteUrl}/workspace/${workspaceId}/manage#billing`,
			billing_currency: "USD",
			feature_flags: {
				allow_discount_code: true,
			},
		};
		if (checkoutCustomer) {
			payload.customer = checkoutCustomer;
		}

		// Build Checkout Session payload
		const session = await checkout(ctx, {
			payload,
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
		workspaceId: v.optional(v.id("workspaces")),
		send_email: v.optional(v.boolean()),
	},
	handler: async (ctx, args): Promise<string> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("You must be logged in to access the billing portal");
		}

		if (args.workspaceId) {
			const isAdmin = await ctx.runQuery(
				internal.payments.checkWorkspaceAdmin,
				{
					workspaceId: args.workspaceId,
				}
			);
			if (!isAdmin) {
				throw new Error("Only workspace admins can manage billing");
			}

			const customerId = await getWorkspacePortalCustomerId(
				ctx,
				args.workspaceId
			);
			if (!customerId) {
				throw new Error(
					"No billing customer is associated with this workspace."
				);
			}

			const appUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
			const { customerPortals, customers } = await import("./dodo");
			if (identity.email) {
				try {
					await customers.update(ctx, {
						customer_id: customerId,
						email: identity.email,
						name: identity.name ?? null,
					});
				} catch (error) {
					console.warn(
						"[getCustomerPortal] Failed to sync Dodo customer email:",
						error
					);
				}
			}
			const portal = await customerPortals.create(ctx, {
				customer_id: customerId,
				send_email: args.send_email ?? false,
				...(appUrl
					? {
							return_url: `${appUrl}/workspace/${args.workspaceId}/manage#billing`,
						}
					: {}),
			});
			return portal.portal_url;
		}

		// Customer identification is handled by dodo.identify() in convex/dodo.ts
		const portal = await customerPortal(ctx, {
			send_email: args.send_email ?? false,
		});

		if (!portal?.portal_url) {
			console.error("[getCustomerPortal] Portal session failed:", portal);
			throw new Error(
				"Failed to generate billing portal link. Ensure you have an active workspace."
			);
		}
		return portal.portal_url;
	},
});

export const syncWorkspaceSubscription = action({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, { workspaceId }) => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const workspace = await ctx.runQuery(
			internal.workspaces.getWorkspaceByIdInternal,
			{
				id: workspaceId,
			}
		);
		if (!workspace?.dodoSubscriptionId) {
			return { success: true, status: "no_subscription" };
		}

		const { subscriptions, payments } = await import("./dodo");
		const subscription = await subscriptions.retrieve(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		const plan = planNameFromDodoSubscription(subscription);
		let syncedPayments: DodoPayment[] = [];
		try {
			const paymentList = await payments.listForSubscription(ctx, {
				subscription_id: workspace.dodoSubscriptionId,
				page_size: 10,
			});
			syncedPayments = Array.isArray(paymentList?.items)
				? paymentList.items
				: [];
		} catch (error) {
			console.warn("[Dodo] Failed to fetch payment history:", error);
		}
		const hasSucceededPayment = syncedPayments.some(
			(payment) => payment?.status === "succeeded"
		);

		await syncDodoSubscriptionToWorkspace(ctx, {
			workspaceId,
			subscriptionId:
				subscription?.subscription_id ?? workspace.dodoSubscriptionId,
			status: subscription?.status ?? "unknown",
			plan,
			customerId:
				subscription?.customer?.customer_id ??
				subscription?.customer_id ??
				null,
			quantity:
				typeof subscription?.quantity === "number"
					? subscription.quantity
					: null,
			cancelAtNextBillingDate:
				typeof subscription?.cancel_at_next_billing_date === "boolean"
					? subscription.cancel_at_next_billing_date
					: null,
			nextBillingDate:
				typeof subscription?.next_billing_date === "string"
					? subscription.next_billing_date
					: null,
			paymentConfirmed: hasSucceededPayment,
			raw: JSON.stringify(subscription),
		});

		try {
			for (const payment of syncedPayments) {
				const paymentId = payment?.payment_id ?? payment?.id;
				const amount = payment?.total_amount ?? payment?.amount;
				const currency = payment?.currency ?? subscription?.currency ?? "USD";
				if (typeof paymentId !== "string" || typeof amount !== "number") {
					continue;
				}
				const createdAt = parseTime(payment?.created_at) ?? Date.now();
				const recordArgs: {
					workspaceId: Id<"workspaces">;
					amount: number;
					currency: string;
					status: string;
					type: "payment";
					description: string;
					dodoInvoiceId: string;
					taxAmount?: number;
					plan?: string;
					seats?: number;
					invoiceUrl?: string;
					createdAt: number;
				} = {
					workspaceId,
					amount,
					currency,
					status: payment?.status ?? "succeeded",
					type: "payment",
					description: plan
						? `${PLANS[plan].label} plan payment`
						: "Subscription payment",
					dodoInvoiceId: paymentId,
					createdAt,
				};
				if (typeof payment?.tax === "number") {
					recordArgs.taxAmount = payment.tax;
				}
				if (plan) recordArgs.plan = plan;
				if (typeof subscription?.quantity === "number") {
					recordArgs.seats = subscription.quantity;
				}
				const invoiceUrl =
					payment?.invoice_url ?? payment?.invoiceUrl ?? payment?.receipt_url;
				if (typeof invoiceUrl === "string") {
					recordArgs.invoiceUrl = invoiceUrl;
				}
				await ctx.runMutation(
					internal.payments.recordBillingHistoryEntry,
					recordArgs
				);
			}
		} catch (error) {
			console.warn("[Dodo] Failed to sync payment history:", error);
		}

		return {
			success: true,
			status: "synced",
			plan,
			quantity: subscription?.quantity ?? null,
		};
	},
});

// Action: Update subscription quantity (seat expansion) or change plan
export const updateSubscriptionQuantity = action({
	args: {
		workspaceId: v.id("workspaces"),
		newQuantity: v.number(),
		newPlan: v.optional(v.union(v.literal("pro"), v.literal("enterprise"))),
	},
	// skipcq: JS-0128
	handler: async (
		ctx,
		{ workspaceId, newQuantity, newPlan }
	): Promise<Record<string, unknown>> => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
			internal.workspaces.getWorkspaceByIdInternal,
			{
				id: workspaceId,
			}
		);
		if (!workspace) {
			return inactiveSubscriptionCheckoutResult();
		}

		const dodoSubscriptionId: string | null =
			typeof workspace?.dodoSubscriptionId === "string"
				? workspace.dodoSubscriptionId
				: null;
		if (!dodoSubscriptionId) {
			return inactiveSubscriptionCheckoutResult();
		}

		// Ask Dodo first so stale local workspace state cannot fall back to
		// a full checkout and bypass fair-billing proration.
		const {
			subscriptions,
			payments: dodoPayments,
			refunds: dodoRefunds,
		} = await import("./dodo");
		let currentSubscription: DodoSubscription;
		try {
			currentSubscription = await subscriptions.retrieve(ctx, {
				subscription_id: dodoSubscriptionId,
			});
		} catch (error) {
			if (isDodoRbacAccessDenied(error)) {
				return dodoBillingPermissionRequiredResult();
			}
			if (isDodoProviderError(error)) {
				return dodoProviderErrorResult(error);
			}
			throw error;
		}

		const dodoPlan = planNameFromDodoSubscription(currentSubscription);
		const workspacePaidPlan =
			workspace?.plan === "enterprise" || workspace?.plan === "pro"
				? workspace.plan
				: null;
		const workspacePlan = dodoPlan ?? workspacePaidPlan;
		const subscriptionStatus =
			currentSubscription?.status ?? workspace.subscriptionStatus ?? "unknown";
		if (!workspacePlan) {
			return inactiveSubscriptionCheckoutResult();
		}
		if (
			!isActivePaidSubscription(
				workspacePlan,
				subscriptionStatus,
				dodoSubscriptionId
			)
		) {
			return inactiveSubscriptionCheckoutResult();
		}

		if (
			dodoPlan &&
			(workspace?.plan !== dodoPlan ||
				workspace?.subscriptionStatus !== subscriptionStatus)
		) {
			await syncDodoSubscriptionToWorkspace(ctx, {
				workspaceId,
				subscriptionId:
					currentSubscription?.subscription_id ?? dodoSubscriptionId,
				status: subscriptionStatus,
				plan: dodoPlan,
				customerId:
					currentSubscription?.customer?.customer_id ??
					currentSubscription?.customer_id ??
					null,
				quantity:
					typeof currentSubscription?.quantity === "number"
						? currentSubscription.quantity
						: null,
				cancelAtNextBillingDate:
					typeof currentSubscription?.cancel_at_next_billing_date === "boolean"
						? currentSubscription.cancel_at_next_billing_date
						: null,
				nextBillingDate:
					typeof currentSubscription?.next_billing_date === "string"
						? currentSubscription.next_billing_date
						: null,
				paymentConfirmed: true,
				raw: JSON.stringify(currentSubscription),
			});
		}

		const planName: "pro" | "enterprise" = newPlan ?? workspacePlan;
		const plan = PLANS[planName];
		if (!plan?.dodoProductId) {
			throw new Error(
				`Missing Dodo product mapping for plan "${planName}". Set PLANS.${planName}.dodoProductId`
			);
		}
		const dodoProductId = plan.dodoProductId;
		const quantity = Math.max(1, Math.floor(newQuantity));
		const billingContext: {
			billableMemberCount: number;
		} = await ctx.runQuery(internal.payments.getBillingSeatContext, {
			workspaceId,
		});
		requireSeatsForEveryMember(quantity, billingContext.billableMemberCount);

		const firstPositiveSeatCount = (
			...values: Array<number | null | undefined>
		) => values.find((value) => typeof value === "number" && value > 0);
		const currentQuantityBase =
			workspacePlan === "enterprise"
				? firstPositiveSeatCount(
						workspace.enterpriseSeats,
						workspace.totalPaidSeats,
						currentSubscription?.quantity
					)
				: firstPositiveSeatCount(
						workspace.proSeats,
						workspace.totalPaidSeats,
						currentSubscription?.quantity
					);
		const currentQuantity = Math.max(
			1,
			Math.floor(currentQuantityBase ?? quantity)
		);
		let fairBilling = calculateFairBillingDelta(currentSubscription, {
			currentPlan: workspacePlan,
			currentQuantity,
			nextPlan: planName,
			nextQuantity: quantity,
		});
		const isPaidUpgrade = fairBilling.monthlyDelta > 0;
		const shouldRefundDowngrade = fairBilling.refundAmount > 0;
		const shouldChargeUpgrade = fairBilling.amountDue > 0 || isPaidUpgrade;
		let downgradeRefundCurrency: string | null = null;
		let latestPaymentForDowngradeRefund: DodoPayment | null = null;
		if (shouldRefundDowngrade) {
			latestPaymentForDowngradeRefund =
				await getLatestSucceededSubscriptionPayment(
					ctx,
					dodoPayments,
					dodoSubscriptionId
				);
			downgradeRefundCurrency =
				latestPaymentForDowngradeRefund?.currency ??
				currentSubscription?.currency ??
				null;
			const latestTotalAmount =
				typeof latestPaymentForDowngradeRefund?.total_amount === "number"
					? latestPaymentForDowngradeRefund.total_amount
					: null;
			if (
				latestTotalAmount &&
				fairBilling.currentMonthlyValue > 0 &&
				fairBilling.refundAmount > 0
			) {
				const taxInclusiveRefund = Math.floor(
					fairBilling.refundAmount *
						(latestTotalAmount / fairBilling.currentMonthlyValue)
				);
				fairBilling = {
					...fairBilling,
					refundAmount: Math.min(latestTotalAmount, taxInclusiveRefund),
				};
			}
		}

		const changeSubscriptionPlan = async () => {
			const result = await subscriptions.changePlan(ctx, {
				subscription_id: dodoSubscriptionId,
				product_id: dodoProductId,
				quantity,
				metadata: {
					workspace_id: workspaceId,
					plan: planName,
				},
				// Fair billing: charge only the prorated difference for upgrades,
				// and do not let Dodo also credit/refund when we refund downgrades.
				proration_billing_mode: shouldRefundDowngrade
					? "do_not_bill"
					: "prorated_immediately",
				// Do not unlock locally until Dodo confirms payment and emits webhooks.
				on_payment_failure: "prevent_change",
			});
			return result;
		};

		const appUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
		const paymentReturnUrl = appUrl
			? `${appUrl}/workspace/${workspaceId}/manage#billing`
			: undefined;

		const paymentRequiredResult = async (
			changeResult: unknown
		): Promise<Record<string, unknown>> => {
			const paymentUrl: string | null =
				findDodoPaymentUrl(changeResult) ??
				findDodoPaymentUrl(
					await subscriptions.updatePaymentMethod(ctx, {
						subscription_id: dodoSubscriptionId,
						return_url: paymentReturnUrl,
					})
				);

			if (!paymentUrl) {
				return {
					success: true,
					status: "pending_plan_change",
					message:
						"Dodo is processing the prorated fair-billing charge using the saved payment method. Your workspace will update after the payment succeeds.",
				};
			}

			return {
				success: true,
				status: "payment_required",
				paymentUrl,
				message:
					"Dodo created the fair-billing plan change. Complete the payment flow; your workspace plan will update after payment succeeds.",
			};
		};

		const refundedDowngradeResult = async (): Promise<
			Record<string, unknown>
		> => {
			const downgradeApplyArgs: {
				workspaceId: Id<"workspaces">;
				planName: "pro" | "enterprise";
				quantity: number;
				subscriptionStatus: string;
				auditAction: string;
				invoiceUrl?: string;
				amountDue?: number;
				currency?: string;
				taxAmount?: number;
				usedAmount?: number;
				refundAmount?: number;
				refundCurrency?: string;
			} = {
				workspaceId,
				planName,
				quantity,
				subscriptionStatus: "active",
				auditAction: "subscription_downgraded_refunded",
			};
			const downgradeInvoiceUrl = getPaymentInvoiceUrl(
				latestPaymentForDowngradeRefund
			);
			if (downgradeInvoiceUrl)
				downgradeApplyArgs.invoiceUrl = downgradeInvoiceUrl;
			const latestTotalAmount =
				typeof latestPaymentForDowngradeRefund?.total_amount === "number"
					? latestPaymentForDowngradeRefund.total_amount
					: null;
			const latestTaxAmount =
				typeof latestPaymentForDowngradeRefund?.tax === "number"
					? latestPaymentForDowngradeRefund.tax
					: null;
			let refund: DodoRefund | null = null;
			let refundAmount = 0;
			let refundError: unknown = null;
			const downgradeCurrency =
				downgradeRefundCurrency ?? currentSubscription?.currency ?? "USD";
			if (latestTotalAmount && latestTotalAmount > 0) {
				downgradeApplyArgs.amountDue = latestTotalAmount;
				downgradeApplyArgs.currency = downgradeCurrency;
				downgradeApplyArgs.usedAmount = Math.max(
					0,
					latestTotalAmount - fairBilling.refundAmount
				);
			}
			if (latestTaxAmount && latestTaxAmount > 0) {
				downgradeApplyArgs.taxAmount = latestTaxAmount;
			}
			if (fairBilling.refundAmount > 0) {
				downgradeApplyArgs.refundAmount = fairBilling.refundAmount;
				downgradeApplyArgs.refundCurrency = downgradeCurrency;
			}
			await ctx.runMutation(
				internal.payments.applyWorkspaceSubscriptionQuantity,
				downgradeApplyArgs
			);
			await sendDodoCustomerPortalEmail(ctx, workspaceId);

			if (fairBilling.refundAmount > 0) {
				try {
					const refundResult = await refundLatestSubscriptionPayment(
						ctx,
						dodoPayments,
						dodoRefunds,
						{
							latestPayment: latestPaymentForDowngradeRefund,
							amount: fairBilling.refundAmount,
							reason:
								"Workspace subscription downgraded with unused time remaining",
							metadata: {
								workspace_id: workspaceId,
								subscription_id: dodoSubscriptionId,
							},
						}
					);
					refund = refundResult.refund;
					refundAmount =
						refundResult.refund?.amount ?? refundResult.requestedRefundAmount;
				} catch (error) {
					refundError = error;
					console.error("[updateSubscriptionQuantity] Refund failed:", error);
				}
			}

			if (refundAmount > 0) {
				const usedAmount =
					typeof downgradeApplyArgs.usedAmount === "number"
						? downgradeApplyArgs.usedAmount
						: undefined;
				await ctx.runMutation(internal.payments.recordBillingHistoryEntry, {
					workspaceId,
					amount: refundAmount,
					currency: downgradeCurrency,
					status: "succeeded",
					type: "refund",
					description: `Fair billing refund for ${PLANS[planName].label}`,
					dodoInvoiceId:
						refund?.refund_id ??
						`refund_${dodoSubscriptionId}_${Date.now().toString()}`,
					plan: planName,
					seats: quantity,
					...(downgradeInvoiceUrl ? { invoiceUrl: downgradeInvoiceUrl } : {}),
					...(typeof latestTaxAmount === "number"
						? { taxAmount: latestTaxAmount }
						: {}),
					...(typeof usedAmount === "number" ? { usedAmount } : {}),
				});
			}
			return {
				success: true,
				status: "updated",
				quantity,
				refundAmount,
				refundCurrency: refund?.currency ?? downgradeRefundCurrency,
				refundId: refund?.refund_id ?? null,
				message:
					refundError === null
						? "Plan updated and the unused balance was refunded under fair billing."
						: "Plan updated, but the refund could not be completed automatically. Please contact support.",
			};
		};

		const handlePendingOrProviderError = (error: unknown) => {
			if (isDodoRbacAccessDenied(error)) {
				return dodoBillingPermissionRequiredResult();
			}

			const errorCode = parseDodoErrorCode(error);
			if (errorCode === "PREVIOUS_PAYMENT_PENDING") {
				return dodoPreviousPaymentPendingResult();
			}
			if (isDodoProviderError(error)) {
				return dodoProviderErrorResult(error);
			}
			throw error;
		};

		try {
			const changeResult = await changeSubscriptionPlan();
			if (shouldRefundDowngrade) {
				return await refundedDowngradeResult();
			}

			await sendDodoCustomerPortalEmail(ctx, workspaceId);
			if (!shouldChargeUpgrade) {
				await ctx.runMutation(
					internal.payments.applyWorkspaceSubscriptionQuantity,
					{
						workspaceId,
						planName,
						quantity,
						subscriptionStatus: "active",
						auditAction: "subscription_updated_no_proration",
					}
				);
				return {
					success: true,
					status: "updated",
					quantity,
					amountDue: 0,
					message: "Plan updated with no additional charge under fair billing.",
				};
			}
			return {
				...(await paymentRequiredResult(changeResult)),
				amountDue:
					fairBilling.amountDue > 0
						? fairBilling.amountDue
						: fairBilling.monthlyDelta,
				currency: currentSubscription?.currency ?? "USD",
			};
		} catch (error) {
			if (isDodoRbacAccessDenied(error)) {
				return dodoBillingPermissionRequiredResult();
			}

			const errorCode = parseDodoErrorCode(error);
			if (errorCode === "INACTIVE_SUBSCRIPTION_PLAN_CHANGE_NOT_SUPPORTED") {
				return inactiveSubscriptionCheckoutResult();
			}
			if (errorCode === "PLAN_CHANGE_NOT_ALLOWED_FOR_SCHEDULED_CANCELLATION") {
				try {
					await subscriptions.reactivate(ctx, {
						subscription_id: dodoSubscriptionId,
					});
				} catch (reactivateError) {
					if (isDodoRbacAccessDenied(reactivateError)) {
						return dodoBillingPermissionRequiredResult();
					}
					if (isDodoProviderError(reactivateError)) {
						return dodoProviderErrorResult(reactivateError);
					}
					throw reactivateError;
				}

				await ctx.runMutation(
					internal.payments.clearWorkspaceScheduledCancellation,
					{
						workspaceId,
						auditAction: "subscription_reactivated_before_plan_change",
					}
				);

				try {
					const retryResult = await changeSubscriptionPlan();
					if (shouldRefundDowngrade) {
						return await refundedDowngradeResult();
					}
					await sendDodoCustomerPortalEmail(ctx, workspaceId);
					if (!shouldChargeUpgrade) {
						await ctx.runMutation(
							internal.payments.applyWorkspaceSubscriptionQuantity,
							{
								workspaceId,
								planName,
								quantity,
								subscriptionStatus: "active",
								auditAction: "subscription_updated_no_proration",
							}
						);
						return {
							success: true,
							status: "updated",
							quantity,
							amountDue: 0,
							message:
								"Plan updated with no additional charge under fair billing.",
						};
					}
					return {
						...(await paymentRequiredResult(retryResult)),
						amountDue:
							fairBilling.amountDue > 0
								? fairBilling.amountDue
								: fairBilling.monthlyDelta,
						currency: currentSubscription?.currency ?? "USD",
					};
				} catch (retryError) {
					if (isDodoRbacAccessDenied(retryError)) {
						return dodoBillingPermissionRequiredResult();
					}

					if (parseDodoErrorCode(retryError) !== "PENDING_PLAN_CHANGE_EXISTS") {
						return handlePendingOrProviderError(retryError);
					}

					const subscription = await subscriptions.retrieve(ctx, {
						subscription_id: dodoSubscriptionId,
					});
					const scheduledChange = subscription?.scheduled_change;
					const scheduledPlanName =
						typeof scheduledChange?.product_id === "string"
							? planNameFromDodoProductId(scheduledChange.product_id)
							: null;

					if (
						scheduledPlanName &&
						typeof scheduledChange?.quantity === "number"
					) {
						const scheduledQuantity = Math.max(
							1,
							Math.floor(scheduledChange.quantity)
						);

						return {
							success: true,
							status: "pending_plan_change",
							quantity: scheduledQuantity,
							message:
								"Your subscription was reactivated, but a plan change is already pending. Your workspace will update after Dodo confirms payment.",
						};
					}

					return {
						success: false,
						status: "pending_plan_change",
						message:
							"Your subscription was reactivated, but a seat change is already pending in Dodo. Please wait for the current payment to complete.",
					};
				}
			} else if (errorCode !== "PENDING_PLAN_CHANGE_EXISTS") {
				return handlePendingOrProviderError(error);
			}

			const subscription = await subscriptions.retrieve(ctx, {
				subscription_id: dodoSubscriptionId,
			});
			const scheduledChange = subscription?.scheduled_change;
			const scheduledPlanName =
				typeof scheduledChange?.product_id === "string"
					? planNameFromDodoProductId(scheduledChange.product_id)
					: null;

			if (scheduledPlanName && typeof scheduledChange?.quantity === "number") {
				const scheduledQuantity = Math.max(
					1,
					Math.floor(scheduledChange.quantity)
				);

				return {
					success: true,
					status: "pending_plan_change",
					quantity: scheduledQuantity,
					message:
						"A plan change is already pending. Your workspace will update after Dodo confirms payment.",
				};
			}

			return {
				success: false,
				status: "pending_plan_change",
				message:
					"A seat change is already pending in Dodo. Please wait for the current payment to complete.",
			};
		}
	},
});

// Action: Cancel subscription immediately and refund unused time in the current period
export const cancelSubscription = action({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, { workspaceId }) => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const workspace = await ctx.runQuery(
			internal.workspaces.getWorkspaceByIdInternal,
			{
				id: workspaceId,
			}
		);
		if (!workspace?.dodoSubscriptionId) {
			throw new Error("No active subscription found");
		}

		const { subscriptions, payments, refunds } = await import("./dodo");
		const subscription = await subscriptions.retrieve(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		const latestPayment = await getLatestSucceededSubscriptionPayment(
			ctx,
			payments,
			workspace.dodoSubscriptionId
		);

		const refundAmount = calculateUnusedPeriodRefundAmount(
			subscription,
			latestPayment
		);

		await subscriptions.cancel(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});

		const cancelledSubscription = await subscriptions.retrieve(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		if (
			cancelledSubscription?.status &&
			!["cancelled", "canceled", "expired"].includes(
				cancelledSubscription.status
			)
		) {
			console.warn(
				"[cancelSubscription] Dodo did not report an inactive status after cancellation; applying local Free plan anyway",
				cancelledSubscription
			);
		}

		let requestedRefundAmount = refundAmount;
		let refund: {
			refund_id?: string;
			amount?: number | null;
			currency?: string | null;
		} | null = null;

		if (refundAmount > 0 && latestPayment?.payment_id) {
			const refundResult = await refundLatestSubscriptionPayment(
				ctx,
				payments,
				refunds,
				{
					latestPayment,
					amount: refundAmount,
					reason: "Workspace subscription cancelled with unused time remaining",
					metadata: {
						workspace_id: workspaceId,
						subscription_id: workspace.dodoSubscriptionId,
					},
				}
			);

			requestedRefundAmount = refundResult.requestedRefundAmount;
			refund = refundResult.refund;
		}

		const freePlanArgs: {
			workspaceId: Id<"workspaces">;
			refundAmount: number;
			refundCurrency?: string;
			refundId?: string;
			invoiceUrl?: string;
			usedAmount?: number;
		} = {
			workspaceId,
			refundAmount: refund?.amount ?? requestedRefundAmount,
		};
		const refundCurrency = refund?.currency ?? subscription?.currency;
		if (refundCurrency) freePlanArgs.refundCurrency = refundCurrency;
		if (refund?.refund_id) freePlanArgs.refundId = refund.refund_id;
		const latestInvoiceUrl = getPaymentInvoiceUrl(latestPayment);
		if (latestInvoiceUrl) freePlanArgs.invoiceUrl = latestInvoiceUrl;
		const latestTotalAmount =
			typeof latestPayment?.total_amount === "number"
				? latestPayment.total_amount
				: null;
		if (latestTotalAmount && latestTotalAmount > 0) {
			freePlanArgs.usedAmount = Math.max(
				0,
				latestTotalAmount - freePlanArgs.refundAmount
			);
		}

		await ctx.runMutation(
			internal.payments.applyWorkspaceFreePlan,
			freePlanArgs
		);
		const finalRefundAmount = refund?.amount ?? requestedRefundAmount;
		if (finalRefundAmount > 0) {
			const refundHistoryArgs: {
				workspaceId: Id<"workspaces">;
				amount: number;
				currency: string;
				status: string;
				type: "refund";
				description: string;
				dodoInvoiceId: string;
				invoiceUrl?: string;
				usedAmount?: number;
			} = {
				workspaceId,
				amount: finalRefundAmount,
				currency: refund?.currency ?? subscription?.currency ?? "USD",
				status: "succeeded",
				type: "refund",
				description: "Fair billing refund for downgrade to Free",
				dodoInvoiceId:
					refund?.refund_id ??
					`refund_${workspace.dodoSubscriptionId}_${Date.now().toString()}`,
			};
			if (latestInvoiceUrl) refundHistoryArgs.invoiceUrl = latestInvoiceUrl;
			if (typeof freePlanArgs.usedAmount === "number") {
				refundHistoryArgs.usedAmount = freePlanArgs.usedAmount;
			}
			await ctx.runMutation(
				internal.payments.recordBillingHistoryEntry,
				refundHistoryArgs
			);
		}
		await sendDodoCustomerPortalEmail(ctx, workspaceId);

		return {
			success: true,
			refundAmount: finalRefundAmount,
			refundCurrency: refund?.currency ?? subscription?.currency ?? null,
			refundId: refund?.refund_id ?? null,
		};
	},
});

// Action: Reactivate a subscription that was set to cancel
export const reactivateSubscription = action({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, { workspaceId }) => {
		const isAdmin = await ctx.runQuery(internal.payments.checkWorkspaceAdmin, {
			workspaceId,
		});
		if (!isAdmin) throw new Error("Only workspace admins can manage billing");

		const workspace = await ctx.runQuery(
			internal.workspaces.getWorkspaceByIdInternal,
			{
				id: workspaceId,
			}
		);
		if (!workspace?.dodoSubscriptionId) {
			throw new Error("No subscription found to reactivate");
		}

		const { subscriptions } = await import("./dodo");

		await subscriptions.reactivate(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		await ctx.runMutation(
			internal.payments.clearWorkspaceScheduledCancellation,
			{
				workspaceId,
				auditAction: "subscription_reactivated",
			}
		);

		return { success: true };
	},
});
