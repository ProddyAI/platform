// Payments actions and queries using Dodo Payments Convex adapter
// References:
// - Convex Component: https://docs.dodopayments.com/developer-resources/convex-component
// - Checkout Sessions: https://docs.dodopayments.com/developer-resources/checkout-session

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
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
	customer?: string | { customer_id?: string; id?: string };
	customer_id?: string;
	cancel_at_next_billing_date?: boolean;
	scheduled_change?: {
		product_id?: string;
		quantity?: number;
	};
};
type WorkspacePortalBillingContext = {
	customerId: string | null;
	subscriptionId: string | null;
	plan: PlanName;
	proSeats: number;
	enterpriseSeats: number;
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

const DODO_MINIMUM_PAYMENT_AMOUNT_CENTS = 100;
const BILLING_MINIMUM_CONSUMED_PERCENT = 0;
const PENDING_PAYMENT_LINK_TTL_MS = 14 * 60 * 1000;

const BILLING_USAGE_UNIT_COST_CENTS: Record<string, number> = {
	ai_generation: 5,
	ai_request: 5,
	ai_diagram: 7,
	ai_summary: 4,
	api_call: 1,
	export_download: 10,
	file_upload: 2,
	storage_gb_day: 3,
	automation_run: 2,
	token_1k: 1,
	team_member_added: 50,
	premium_workspace_action: 3,
	message: 0,
	task: 1,
	channel: 5,
	board: 10,
	note: 2,
};

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

const isMissingScheduledPlanChangeCode = (code: string | null) =>
	code === "NOT_FOUND" ||
	code === "SCHEDULED_CHANGE_NOT_FOUND" ||
	code === "SCHEDULED_PLAN_CHANGE_NOT_FOUND";

const inactiveSubscriptionCheckoutResult = () => ({
	success: false,
	status: "inactive_subscription",
	message:
		"This workspace does not have an active paid subscription. Continue through checkout to start a new plan.",
});

const hasActivePendingBillingPayment = (
	workspace: Doc<"workspaces"> | null | undefined,
	args: {
		subscriptionId: string;
		planName: PaidPlanName;
		quantity: number;
		now?: number;
	}
) =>
	workspace?.pendingBillingStatus === "pending_payment" &&
	workspace?.pendingBillingSubscriptionId === args.subscriptionId &&
	workspace.pendingBillingPlan === args.planName &&
	workspace.pendingBillingQuantity === args.quantity &&
	typeof workspace.pendingBillingExpiresAt === "number" &&
	workspace.pendingBillingExpiresAt > (args.now ?? Date.now());

const getActivePendingBillingPayment = (
	workspace: Doc<"workspaces"> | null | undefined,
	subscriptionId: string,
	now = Date.now()
) => {
	if (
		workspace?.pendingBillingStatus !== "pending_payment" ||
		workspace.pendingBillingSubscriptionId !== subscriptionId ||
		typeof workspace.pendingBillingExpiresAt !== "number" ||
		workspace.pendingBillingExpiresAt <= now
	) {
		return null;
	}

	return {
		planName: workspace.pendingBillingPlan,
		quantity: workspace.pendingBillingQuantity,
		paymentUrl:
			typeof workspace.pendingBillingPaymentUrl === "string" &&
			workspace.pendingBillingPaymentUrl.startsWith("http")
				? workspace.pendingBillingPaymentUrl
				: null,
		amountDue: workspace.pendingBillingAmount ?? 0,
		currency: workspace.pendingBillingCurrency ?? "USD",
		taxAmount: workspace.pendingBillingTaxAmount ?? 0,
		expiresAt: workspace.pendingBillingExpiresAt,
	};
};

const clearLocalAndDodoPendingPlanChange = async (
	ctx: ActionCtx,
	args: {
		workspaceId: Id<"workspaces">;
		subscriptionId: string;
		reason: string;
	}
) => {
	await ctx.runMutation(internal.payments.clearPendingUpgrade, {
		workspaceId: args.workspaceId,
	});

	try {
		const { subscriptions } = await import("./dodo");
		await subscriptions.cancelPlanChange(ctx, {
			subscription_id: args.subscriptionId,
		});
	} catch (error) {
		const code = parseDodoErrorCode(error);
		if (!isMissingScheduledPlanChangeCode(code)) {
			console.warn(
				`[billing] Failed to cancel stale pending Dodo plan change (${args.reason}):`,
				error
			);
		}
	}
};

const clearWorkspacePendingBilling = async (
	ctx: MutationCtx,
	workspaceId: Id<"workspaces">
) => {
	await ctx.db.patch(workspaceId, {
		pendingBillingStatus: undefined,
		pendingBillingPlan: undefined,
		pendingBillingQuantity: undefined,
		pendingBillingCheckoutSessionId: undefined,
		pendingBillingPaymentUrl: undefined,
		pendingBillingAmount: undefined,
		pendingBillingCurrency: undefined,
		pendingBillingTaxAmount: undefined,
		pendingBillingCreatedAt: undefined,
		pendingBillingExpiresAt: undefined,
		pendingBillingSubscriptionId: undefined,
	});
	console.log("[billing] pending upgrade cleared", {
		workspaceId,
	});
	return { ok: true };
};

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

const findDodoCheckoutSessionId = (value: unknown): string | null => {
	if (!value || typeof value !== "object") return null;
	for (const [key, nestedValue] of Object.entries(value)) {
		if (
			typeof nestedValue === "string" &&
			(key === "checkout_session_id" ||
				key === "checkoutSessionId" ||
				key === "session_id" ||
				key === "payment_id")
		) {
			return nestedValue;
		}
		const nestedId = findDodoCheckoutSessionId(nestedValue);
		if (nestedId) return nestedId;
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

const getUsageMonthKeys = (periodStart: number, periodEnd: number) => {
	const months: Array<{ month: string; isFullMonth: boolean }> = [];
	const cursor = new Date(periodStart);
	cursor.setUTCDate(1);
	cursor.setUTCHours(0, 0, 0, 0);
	const end = new Date(periodEnd);
	end.setUTCDate(1);
	end.setUTCHours(0, 0, 0, 0);

	while (cursor.getTime() <= end.getTime()) {
		const monthStart = cursor.getTime();
		const nextMonth = new Date(cursor);
		nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
		const monthEnd = nextMonth.getTime() - 1;
		months.push({
			month: cursor.toISOString().slice(0, 7),
			isFullMonth: periodStart <= monthStart && periodEnd >= monthEnd,
		});
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}

	return months;
};

const isNegativeBillingAdjustment = (entry: Doc<"billingHistory">) =>
	entry.type === "refund" || entry.type === "credit";

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

const calculateUnusedPeriodRefundAmount = async (
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">,
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

	try {
		const usage = await ctx.runQuery(
			internal.payments.getBillingConsumptionForPeriod,
			{
				workspaceId,
				periodStart,
				periodEnd: Math.min(now, periodEnd),
			}
		);
		const actualUsageCost =
			usage.featureUsageCost + usage.workspaceActivityCost;
		const consumedRatio =
			totalAmount > 0 ? Math.min(1.0, actualUsageCost / totalAmount) : 0;
		const remainingRatio = Math.max(0, 1.0 - consumedRatio);
		const alreadyRefunded = sumSucceededRefunds(payment);
		const refundableAmount = Math.max(0, totalAmount - alreadyRefunded);
		return Math.min(
			refundableAmount,
			Math.floor(refundableAmount * remainingRatio)
		);
	} catch (error) {
		console.warn(
			"Failed to fetch billing consumption for activity-based refund calculation:",
			error
		);
		return 0;
	}
};

const getPlanMonthlyValueCents = async (
	ctx: ActionCtx,
	planName: "pro" | "enterprise",
	quantity: number
) => {
	const { products } = await import("./dodo");
	let price = PLANS[planName].pricePerSeatMonthly * 100;
	try {
		const productId =
			planName === "pro"
				? process.env.DODO_PAYMENTS_PRODUCTID_PRO
				: process.env.DODO_PAYMENTS_PRODUCTID_ENTERPRISE;
		if (productId) {
			const product = (await products.retrieve(ctx, {
				product_id: productId,
			})) as { price?: number };
			if (typeof product?.price === "number") price = product.price;
		}
	} catch (error) {
		console.warn(
			"Failed to fetch live product price for fallback calculation:",
			error
		);
	}
	return price * quantity;
};

const calculateUsageCost = (usage: {
	aiRequestCount: number;
	aiDiagramCount: number;
	aiSummaryCount: number;
	apiCallCount: number;
	exportDownloadCount: number;
	fileUploadCount: number;
	storageGbDays: number;
	automationRunCount: number;
	token1kCount: number;
	premiumUsageEventCost: number;
}) =>
	usage.premiumUsageEventCost +
	usage.aiRequestCount * BILLING_USAGE_UNIT_COST_CENTS.ai_request +
	usage.aiDiagramCount * BILLING_USAGE_UNIT_COST_CENTS.ai_diagram +
	usage.aiSummaryCount * BILLING_USAGE_UNIT_COST_CENTS.ai_summary +
	usage.apiCallCount * BILLING_USAGE_UNIT_COST_CENTS.api_call +
	usage.exportDownloadCount * BILLING_USAGE_UNIT_COST_CENTS.export_download +
	usage.fileUploadCount * BILLING_USAGE_UNIT_COST_CENTS.file_upload +
	usage.storageGbDays * BILLING_USAGE_UNIT_COST_CENTS.storage_gb_day +
	usage.automationRunCount * BILLING_USAGE_UNIT_COST_CENTS.automation_run +
	usage.token1kCount * BILLING_USAGE_UNIT_COST_CENTS.token_1k;

const calculateWorkspaceActivityCost = (usage: {
	messageCount: number;
	taskCount: number;
	channelCount: number;
	boardCount: number;
	noteCount: number;
	userActivityCount: number;
	teamMemberAddCount: number;
}) =>
	usage.messageCount * BILLING_USAGE_UNIT_COST_CENTS.message +
	usage.taskCount * BILLING_USAGE_UNIT_COST_CENTS.task +
	usage.channelCount * BILLING_USAGE_UNIT_COST_CENTS.channel +
	usage.boardCount * BILLING_USAGE_UNIT_COST_CENTS.board +
	usage.noteCount * BILLING_USAGE_UNIT_COST_CENTS.note +
	usage.teamMemberAddCount * BILLING_USAGE_UNIT_COST_CENTS.team_member_added +
	usage.userActivityCount *
		BILLING_USAGE_UNIT_COST_CENTS.premium_workspace_action;

const calculateRefundOrCredit = (args: {
	paidAmountCents: number;
	maxRefundableCents: number;
	periodStart: number | null;
	periodEnd: number | null;
	featureUsageCostCents: number;
	workspaceActivityCostCents: number;
	now?: number;
}) => {
	const actualUsageCost =
		args.featureUsageCostCents + args.workspaceActivityCostCents;
	const minimumConsumed = Math.max(
		Math.floor((args.paidAmountCents * BILLING_MINIMUM_CONSUMED_PERCENT) / 100),
		actualUsageCost
	);

	// Activity-based billing charges only for metered premium usage and
	// workspace activity. All values are integer cents.
	const consumedAmount = Math.min(
		args.paidAmountCents,
		Math.max(actualUsageCost, minimumConsumed)
	);
	const refundOrCreditAmount = Math.min(
		args.maxRefundableCents,
		Math.max(0, args.paidAmountCents - consumedAmount)
	);

	return {
		featureUsageCost: args.featureUsageCostCents,
		workspaceActivityCost: args.workspaceActivityCostCents,
		minimumConsumed,
		consumedAmount,
		refundOrCreditAmount,
	};
};

const calculateFairBillingDelta = async (
	ctx: ActionCtx,
	subscription: DodoSubscription | null | undefined,
	args: {
		currentPlan: "pro" | "enterprise";
		currentQuantity: number;
		nextPlan: "pro" | "enterprise";
		nextQuantity: number;
		periodStartFallback?: number | null;
		periodEndFallback?: number | null;
		workspaceId?: Id<"workspaces">;
	}
) => {
	const periodStart =
		parseTime(subscription?.previous_billing_date) ??
		args.periodStartFallback ??
		null;
	const periodEnd =
		parseTime(subscription?.next_billing_date) ??
		parseTime(subscription?.current_period_end) ??
		args.periodEndFallback ??
		null;
	const currentMonthlyValue = await getPlanMonthlyValueCents(
		ctx,
		args.currentPlan,
		args.currentQuantity
	);
	const nextMonthlyValue = await getPlanMonthlyValueCents(
		ctx,
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

	if (!args.workspaceId) {
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

	let remainingRatio = 0;
	try {
		const usage = await ctx.runQuery(
			internal.payments.getBillingConsumptionForPeriod,
			{
				workspaceId: args.workspaceId,
				periodStart,
				periodEnd: Math.min(now, periodEnd),
			}
		);
		const actualUsageCost =
			usage.featureUsageCost + usage.workspaceActivityCost;
		const consumedRatio =
			currentMonthlyValue > 0
				? Math.min(1.0, actualUsageCost / currentMonthlyValue)
				: 0;
		remainingRatio = Math.max(0, 1.0 - consumedRatio);
	} catch (error) {
		console.warn(
			"Failed to fetch billing consumption for activity-based billing:",
			error
		);
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

	const activityBasedDelta = Math.floor(
		Math.abs(monthlyDelta) * remainingRatio
	);
	return {
		amountDue: monthlyDelta > 0 ? activityBasedDelta : 0,
		refundAmount: monthlyDelta < 0 ? activityBasedDelta : 0,
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

const getPaymentCreatedAt = (payment: DodoPayment | null | undefined) => {
	const createdAt = Date.parse(payment?.created_at ?? "");
	return Number.isFinite(createdAt) ? createdAt : null;
};

const getPaymentPeriodEndFallback = (
	payment: DodoPayment | null | undefined,
	workspaceCurrentPeriodEnd: number | null | undefined
) => {
	if (typeof workspaceCurrentPeriodEnd === "number")
		return workspaceCurrentPeriodEnd;
	const paymentCreatedAt = getPaymentCreatedAt(payment);
	return paymentCreatedAt ? paymentCreatedAt : null;
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

const _refundLatestSubscriptionPayment = async (
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

const getWorkspacePortalBillingContext = async (
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">
): Promise<WorkspacePortalBillingContext> => {
	const workspace: Doc<"workspaces"> | null = await ctx.runQuery(
		internal.workspaces.getWorkspaceByIdInternal,
		{
			id: workspaceId,
		}
	);
	return {
		customerId: workspace?.dodoCustomerId ?? workspace?.customerId ?? null,
		subscriptionId:
			workspace?.dodoSubscriptionId ?? workspace?.subscriptionId ?? null,
		plan: workspace?.plan ?? "free",
		proSeats: workspace?.proSeats ?? 0,
		enterpriseSeats: workspace?.enterpriseSeats ?? 0,
	};
};

const getWorkspacePortalCustomerId = async (
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">
) => {
	const billingContext = await getWorkspacePortalBillingContext(
		ctx,
		workspaceId
	);
	return billingContext.customerId;
};

const getCustomerIdFromSubscription = (
	subscription: DodoSubscription | null | undefined
) =>
	(typeof subscription?.customer === "string"
		? subscription.customer
		: (subscription?.customer?.customer_id ?? subscription?.customer?.id)) ??
	(typeof subscription?.customer_id === "string"
		? subscription.customer_id
		: null);

const createRecoveryCheckoutUrl = async (
	ctx: ActionCtx,
	args: {
		workspaceId: Id<"workspaces">;
		planName: PaidPlanName;
		quantity: number;
		identity: { email?: string; name?: string };
	}
) => {
	const plan = PLANS[args.planName];
	if (!plan?.dodoProductId) {
		throw new Error(
			`Missing Dodo product mapping for plan "${args.planName}". Set PLANS.${args.planName}.dodoProductId`
		);
	}

	const billingContext: {
		billableMemberCount: number;
	} = await ctx.runQuery(internal.payments.getBillingSeatContext, {
		workspaceId: args.workspaceId,
	});
	const seatCount = Math.max(
		1,
		Math.floor(args.quantity),
		billingContext.billableMemberCount
	);
	const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
	if (!siteUrl) throw new Error("SITE_URL not configured");
	const checkoutCustomer: { email: string; name?: string } | undefined =
		typeof args.identity.email === "string" && args.identity.email.length > 0
			? {
					email: args.identity.email,
					...(args.identity.name ? { name: args.identity.name } : {}),
				}
			: undefined;

	const payload: {
		product_cart: Array<{ product_id: string; quantity: number }>;
		metadata: { workspace_id: string; workspaceId: string; plan: PaidPlanName };
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
			workspace_id: args.workspaceId,
			workspaceId: args.workspaceId,
			plan: args.planName,
		},
		return_url: `${siteUrl}/workspace/${args.workspaceId}/manage#billing`,
		billing_currency: "USD",
		feature_flags: {
			allow_discount_code: true,
		},
	};
	if (checkoutCustomer) payload.customer = checkoutCustomer;

	const session = await checkout(ctx, { payload });
	if (!session?.checkout_url) {
		throw new Error("Checkout session did not return a checkout_url");
	}
	return session.checkout_url;
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
		plan?: "pro" | "enterprise" | "free" | null;
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
		plan?: "pro" | "enterprise" | "free";
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

export const getRecentSuccessfulSeatPayment = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
		since: v.number(),
	},
	handler: async (ctx, args) => {
		const recentPayments = await ctx.db
			.query("billingHistory")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.order("desc")
			.take(20);

		return (
			recentPayments.find(
				(entry) =>
					(entry.type ?? "payment") === "payment" &&
					entry.status === "succeeded" &&
					entry.plan === args.planName &&
					entry.seats === Math.max(1, Math.floor(args.quantity)) &&
					entry.createdAt >= args.since
			) ?? null
		);
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
			pendingBillingStatus: undefined,
			pendingBillingPlan: undefined,
			pendingBillingQuantity: undefined,
			pendingBillingCheckoutSessionId: undefined,
			pendingBillingPaymentUrl: undefined,
			pendingBillingAmount: undefined,
			pendingBillingCurrency: undefined,
			pendingBillingTaxAmount: undefined,
			pendingBillingCreatedAt: undefined,
			pendingBillingExpiresAt: undefined,
			pendingBillingSubscriptionId: undefined,
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

export const recordWorkspacePendingPlanPayment = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		subscriptionId: v.string(),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
		checkoutSessionId: v.optional(v.string()),
		paymentUrl: v.optional(v.string()),
		amountDue: v.optional(v.number()),
		currency: v.optional(v.string()),
		taxAmount: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		const now = Date.now();
		await ctx.db.patch(args.workspaceId, {
			pendingBillingStatus: "pending_payment",
			pendingBillingPlan: args.planName,
			pendingBillingQuantity: Math.max(1, Math.floor(args.quantity)),
			pendingBillingCheckoutSessionId: args.checkoutSessionId,
			pendingBillingPaymentUrl: args.paymentUrl,
			pendingBillingAmount: args.amountDue,
			pendingBillingCurrency: args.currency,
			pendingBillingTaxAmount: args.taxAmount,
			pendingBillingCreatedAt: now,
			pendingBillingExpiresAt: now + PENDING_PAYMENT_LINK_TTL_MS,
			pendingBillingSubscriptionId: args.subscriptionId,
		});
		console.log("[billing] checkout created", {
			workspaceId: args.workspaceId,
			subscriptionId: args.subscriptionId,
			plan: args.planName,
			quantity: Math.max(1, Math.floor(args.quantity)),
			hasPaymentUrl: Boolean(args.paymentUrl),
		});

		return { ok: true };
	},
});

export const clearWorkspacePendingPlanPayment = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		return await clearWorkspacePendingBilling(ctx, args.workspaceId);
	},
});

export const clearPendingUpgrade = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		return await clearWorkspacePendingBilling(ctx, args.workspaceId);
	},
});

export const expirePendingUpgrade = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		now: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace?.pendingBillingExpiresAt) {
			return { expired: false, reason: "no_pending_upgrade" };
		}
		const now = args.now ?? Date.now();
		if (
			workspace.pendingBillingStatus !== "pending_payment" ||
			workspace.pendingBillingExpiresAt > now
		) {
			return { expired: false, reason: "pending_upgrade_still_active" };
		}

		await ctx.db.patch(args.workspaceId, {
			pendingBillingStatus: "expired",
			pendingBillingPlan: undefined,
			pendingBillingQuantity: undefined,
			pendingBillingCheckoutSessionId: undefined,
			pendingBillingPaymentUrl: undefined,
			pendingBillingAmount: undefined,
			pendingBillingCurrency: undefined,
			pendingBillingTaxAmount: undefined,
			pendingBillingCreatedAt: undefined,
			pendingBillingExpiresAt: undefined,
			pendingBillingSubscriptionId: undefined,
		});
		console.log("[billing] pending upgrade expired", {
			workspaceId: args.workspaceId,
		});
		return { expired: true };
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
			pendingBillingStatus: undefined,
			pendingBillingPlan: undefined,
			pendingBillingQuantity: undefined,
			pendingBillingCheckoutSessionId: undefined,
			pendingBillingPaymentUrl: undefined,
			pendingBillingAmount: undefined,
			pendingBillingCurrency: undefined,
			pendingBillingTaxAmount: undefined,
			pendingBillingCreatedAt: undefined,
			pendingBillingExpiresAt: undefined,
			pendingBillingSubscriptionId: undefined,
		});

		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.collect();
		for (const member of members) {
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

export const getLivePlanPrices = action({
	args: {},
	handler: async (ctx) => {
		const { products } = await import("./dodo");
		const proProductId = process.env.DODO_PAYMENTS_PRODUCTID_PRO;
		const enterpriseProductId = process.env.DODO_PAYMENTS_PRODUCTID_ENTERPRISE;

		let proPrice = PLANS.pro.pricePerSeatMonthly * 100;
		let enterprisePrice = PLANS.enterprise.pricePerSeatMonthly * 100;

		try {
			if (proProductId) {
				const proProduct = (await products.retrieve(ctx, {
					product_id: proProductId,
				})) as { price?: number };
				if (typeof proProduct?.price === "number") proPrice = proProduct.price;
			}
			if (enterpriseProductId) {
				const entProduct = (await products.retrieve(ctx, {
					product_id: enterpriseProductId,
				})) as { price?: number };
				if (typeof entProduct?.price === "number")
					enterprisePrice = entProduct.price;
			}
		} catch (error) {
			console.warn("Failed to fetch live prices from Dodo:", error);
		}

		return {
			pro: proPrice,
			enterprise: enterprisePrice,
		};
	},
});

export const recordBillingHistoryEntry = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		amount: v.number(),
		currency: v.string(),
		status: v.string(),
		taxAmount: v.optional(v.number()),
		type: v.union(
			v.literal("payment"),
			v.literal("refund"),
			v.literal("credit")
		),
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
			type: "payment" | "refund" | "credit";
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

export const recordPremiumUsage = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		eventType: v.string(),
		quantity: v.optional(v.number()),
		unitCostCents: v.optional(v.number()),
		occurredAt: v.optional(v.number()),
		idempotencyKey: v.optional(v.string()),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		if (args.idempotencyKey) {
			const existing = await ctx.db
				.query("billingUsageEvents")
				.withIndex("by_idempotency_key", (q) =>
					q.eq("idempotencyKey", args.idempotencyKey)
				)
				.unique();
			if (existing) return { ok: true, reason: "already_recorded" };
		}

		const quantity = Math.max(1, Math.floor(args.quantity ?? 1));
		const unitCostCents =
			typeof args.unitCostCents === "number"
				? Math.max(0, Math.floor(args.unitCostCents))
				: (BILLING_USAGE_UNIT_COST_CENTS[args.eventType] ?? 0);
		await ctx.db.insert("billingUsageEvents", {
			workspaceId: args.workspaceId,
			eventType: args.eventType,
			quantity,
			unitCostCents,
			totalCostCents: quantity * unitCostCents,
			occurredAt: args.occurredAt ?? Date.now(),
			...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
			...(args.metadata ? { metadata: args.metadata } : {}),
		});

		return { ok: true };
	},
});

export const addWorkspaceBillingCredit = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		amount: v.number(),
		currency: v.string(),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		if (args.amount <= 0) return { ok: true, creditedAmount: 0 };
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");
		const creditedAmount = Math.max(0, Math.floor(args.amount));
		const previousCredit = workspace.billingCredits ?? 0;
		await ctx.db.patch(args.workspaceId, {
			billingCredits: previousCredit + creditedAmount,
		});
		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: "billing_credit_added",
			previousValue: {
				creditAmount: previousCredit,
				creditCurrency: args.currency,
			},
			newValue: {
				creditAmount: previousCredit + creditedAmount,
				creditCurrency: args.currency,
			},
			timestamp: Date.now(),
		});
		return { ok: true, creditedAmount };
	},
});

export const getBillingConsumptionForPeriod = internalQuery({
	args: {
		workspaceId: v.id("workspaces"),
		periodStart: v.number(),
		periodEnd: v.number(),
	},
	handler: async (ctx, args) => {
		const periodStart = Math.max(0, args.periodStart);
		const periodEnd = Math.max(periodStart, args.periodEnd);
		const fullUsageMonths = getUsageMonthKeys(periodStart, periodEnd).filter(
			({ isFullMonth }) => isFullMonth
		);
		const usageRows = (
			await Promise.all(
				fullUsageMonths.map(({ month }) =>
					ctx.db
						.query("usageStats")
						.withIndex("by_workspace_month", (q) =>
							q.eq("workspaceId", args.workspaceId).eq("month", month)
						)
						.take(1000)
				)
			)
		).flat();
		const premiumEvents = await ctx.db
			.query("billingUsageEvents")
			.withIndex("by_workspace_id_occurred_at", (q) =>
				q
					.eq("workspaceId", args.workspaceId)
					.gte("occurredAt", periodStart)
					.lte("occurredAt", periodEnd)
			)
			.take(1000);
		const activities = await ctx.db
			.query("userActivities")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(1000);
		const periodActivities = activities.filter(
			(activity) =>
				activity.timestamp >= periodStart && activity.timestamp <= periodEnd
		);
		const members = await ctx.db
			.query("members")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.take(1000);

		const totals = {
			aiRequestCount: 0,
			aiDiagramCount: 0,
			aiSummaryCount: 0,
			messageCount: 0,
			taskCount: 0,
			channelCount: 0,
			boardCount: 0,
			noteCount: 0,
			apiCallCount: 0,
			exportDownloadCount: 0,
			fileUploadCount: 0,
			storageGbDays: 0,
			automationRunCount: 0,
			token1kCount: 0,
			premiumUsageEventCost: 0,
			userActivityCount: periodActivities.length,
			teamMemberAddCount: members.filter(
				(member) =>
					member._creationTime >= periodStart &&
					member._creationTime <= periodEnd
			).length,
		};

		for (const row of usageRows) {
			totals.aiRequestCount += row.aiRequestCount ?? 0;
			totals.aiDiagramCount += row.aiDiagramCount ?? 0;
			totals.aiSummaryCount += row.aiSummaryCount ?? 0;
			totals.messageCount += row.messageCount ?? 0;
			totals.taskCount += row.taskCount ?? 0;
			totals.channelCount += row.channelCount ?? 0;
			totals.boardCount += row.boardCount ?? 0;
			totals.noteCount += row.noteCount ?? 0;
		}

		for (const event of premiumEvents) {
			totals.premiumUsageEventCost += event.totalCostCents;
			if (event.eventType === "api_call") totals.apiCallCount += event.quantity;
			if (event.eventType === "export_download") {
				totals.exportDownloadCount += event.quantity;
			}
			if (event.eventType === "file_upload") {
				totals.fileUploadCount += event.quantity;
			}
			if (event.eventType === "storage_gb_day") {
				totals.storageGbDays += event.quantity;
			}
			if (event.eventType === "automation_run") {
				totals.automationRunCount += event.quantity;
			}
			if (event.eventType === "token_1k") totals.token1kCount += event.quantity;
		}

		const featureUsageCost = calculateUsageCost(totals);
		const workspaceActivityCost = calculateWorkspaceActivityCost(totals);
		return {
			...totals,
			featureUsageCost,
			workspaceActivityCost,
		};
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

function mapSubscriptionStatus(
	workspace: Doc<"workspaces">,
	billableMemberCount: number,
	memberPlan: string
) {
	const plan = workspace.plan;
	const status = workspace.subscriptionStatus;
	const subId = workspace.dodoSubscriptionId ?? workspace.subscriptionId;
	const activePlan =
		(plan === "pro" || plan === "enterprise") &&
		subId &&
		["active", "trialing", "on_hold"].includes(status ?? "")
			? plan
			: "free";

	return {
		plan: activePlan as PlanName,
		memberPlan: activePlan === "free" ? "free" : (memberPlan as PlanName),
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
		billableMemberCount,
		minimumSeatCount: Math.max(1, billableMemberCount),
	};
}

// Query: subscription status for UI
export const getSubscriptionStatus = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		// Refactored to drop complexity
		const identity = await ctx.auth.getUserIdentity();
		const workspace = await ctx.db.get(workspaceId);
		if (!workspace) return null;
		const billableMembers = await getBillableMembers(ctx, workspaceId);

		const plan = workspace.plan;
		const status = workspace.subscriptionStatus;
		const subId = workspace.dodoSubscriptionId ?? workspace.subscriptionId;
		const activePlan =
			(plan === "pro" || plan === "enterprise") &&
			subId &&
			["active", "trialing", "on_hold"].includes(status ?? "")
				? plan
				: "free";

		let memberPlan = "free";
		if (identity && activePlan !== "free") {
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

		return mapSubscriptionStatus(workspace, billableMembers.length, memberPlan);
	},
});

function buildBillingSummary(
	history: Doc<"billingHistory">[],
	auditLogs: Doc<"billingAuditLogs">[]
) {
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
		.filter(isNegativeBillingAdjustment)
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
}

export const getBillingSummary = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, { workspaceId }) => {
		// Refactored to drop complexity
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

		return buildBillingSummary(history, auditLogs);
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
		const { payments: dodoPayments } = await import("./dodo");
		const latestPayment = await getLatestSucceededSubscriptionPayment(
			ctx,
			dodoPayments,
			workspace.dodoSubscriptionId
		);
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
		if (
			hasActivePendingBillingPayment(workspace, {
				subscriptionId: workspace.dodoSubscriptionId,
				planName: args.newPlan,
				quantity: nextQuantity,
			})
		) {
			return {
				status: "pending_payment",
				amountDue: workspace.pendingBillingAmount ?? 0,
				refundAmount: 0,
				currency:
					workspace.pendingBillingCurrency ?? subscription?.currency ?? "USD",
				taxAmount: workspace.pendingBillingTaxAmount ?? 0,
				priceSource: "pending_payment",
				paymentUrl: workspace.pendingBillingPaymentUrl,
				pendingExpiresAt: workspace.pendingBillingExpiresAt,
			};
		}
		const previewCurrency = subscription?.currency ?? "USD";
		const fairBilling = await calculateFairBillingDelta(ctx, subscription, {
			currentPlan,
			currentQuantity,
			nextPlan: args.newPlan,
			nextQuantity,
			periodStartFallback: getPaymentCreatedAt(latestPayment),
			periodEndFallback: getPaymentPeriodEndFallback(
				latestPayment,
				workspace.currentPeriodEnd
			),
			workspaceId: args.workspaceId,
		});
		const isPaidUpgrade = fairBilling.monthlyDelta > 0;
		const activityBasedAmountDue =
			fairBilling.amountDue > 0
				? fairBilling.amountDue
				: isPaidUpgrade &&
						(!fairBilling.periodStart ||
							!fairBilling.periodEnd ||
							fairBilling.periodEnd <= fairBilling.periodStart)
					? fairBilling.monthlyDelta
					: 0;
		const shouldChargeFullPlanDifference =
			isPaidUpgrade &&
			activityBasedAmountDue > 0 &&
			activityBasedAmountDue < DODO_MINIMUM_PAYMENT_AMOUNT_CENTS &&
			fairBilling.monthlyDelta >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;
		const amountDue = shouldChargeFullPlanDifference
			? fairBilling.monthlyDelta
			: activityBasedAmountDue;

		return {
			status: "fair_billing",
			amountDue: amountDue >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS ? amountDue : 0,
			refundAmount:
				fairBilling.refundAmount >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS
					? fairBilling.refundAmount
					: 0,
			currency: previewCurrency,
			taxAmount: 0,
			priceSource: "activity_based",
			periodStart: fairBilling.periodStart,
			periodEnd: fairBilling.periodEnd,
			remainingRatio: fairBilling.remainingRatio,
			currentMonthlyAmount: fairBilling.currentMonthlyValue,
			nextMonthlyAmount: fairBilling.nextMonthlyValue,
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

			const billingContext = await getWorkspacePortalBillingContext(
				ctx,
				args.workspaceId
			);
			let customerId = billingContext.customerId;
			if (!customerId && billingContext.subscriptionId) {
				const { subscriptions } = await import("./dodo");
				const subscription: DodoSubscription = await subscriptions.retrieve(
					ctx,
					{
						subscription_id: billingContext.subscriptionId,
					}
				);
				customerId = getCustomerIdFromSubscription(subscription);
				if (customerId) {
					await syncDodoSubscriptionToWorkspace(ctx, {
						workspaceId: args.workspaceId,
						subscriptionId:
							subscription.subscription_id ?? billingContext.subscriptionId,
						status: subscription.status ?? "active",
						plan: planNameFromDodoSubscription(subscription),
						customerId,
						quantity:
							typeof subscription.quantity === "number"
								? subscription.quantity
								: null,
						cancelAtNextBillingDate:
							typeof subscription.cancel_at_next_billing_date === "boolean"
								? subscription.cancel_at_next_billing_date
								: null,
						nextBillingDate:
							typeof subscription.next_billing_date === "string"
								? subscription.next_billing_date
								: null,
						paymentConfirmed: false,
						raw: JSON.stringify(subscription),
					});
				}
			}
			if (!customerId) {
				if (
					billingContext.plan === "pro" ||
					billingContext.plan === "enterprise"
				) {
					return await createRecoveryCheckoutUrl(ctx, {
						workspaceId: args.workspaceId,
						planName: billingContext.plan,
						quantity:
							billingContext.plan === "enterprise"
								? billingContext.enterpriseSeats
								: billingContext.proSeats,
						identity,
					});
				}
				throw new Error(
					"No billing customer is associated with this workspace."
				);
			}

			const appUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
			const { customerPortals, customers, subscriptions } = await import(
				"./dodo"
			);
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
			const portalArgs = {
				send_email: args.send_email ?? false,
				...(appUrl
					? {
							return_url: `${appUrl}/workspace/${args.workspaceId}/manage#billing`,
						}
					: {}),
			};
			let portal: { portal_url?: string };
			try {
				portal = await customerPortals.create(ctx, {
					customer_id: customerId,
					...portalArgs,
				});
			} catch (error) {
				const isMissingCustomer =
					error instanceof Error &&
					(error.message.includes('"code":"NOT_FOUND"') ||
						error.message.includes('"code": "NOT_FOUND"') ||
						error.message.includes("NOT_FOUND"));
				if (!(isMissingCustomer && billingContext.subscriptionId)) {
					if (
						isMissingCustomer &&
						(billingContext.plan === "pro" ||
							billingContext.plan === "enterprise")
					) {
						return await createRecoveryCheckoutUrl(ctx, {
							workspaceId: args.workspaceId,
							planName: billingContext.plan,
							quantity:
								billingContext.plan === "enterprise"
									? billingContext.enterpriseSeats
									: billingContext.proSeats,
							identity,
						});
					}
					throw error;
				}

				const subscription: DodoSubscription = await subscriptions.retrieve(
					ctx,
					{
						subscription_id: billingContext.subscriptionId,
					}
				);
				const liveCustomerId = getCustomerIdFromSubscription(subscription);
				if (!liveCustomerId || liveCustomerId === customerId) {
					const recoveryPlan =
						billingContext.plan === "enterprise" ? "enterprise" : "pro";
					const recoveryQuantity =
						recoveryPlan === "enterprise"
							? billingContext.enterpriseSeats
							: billingContext.proSeats;
					return await createRecoveryCheckoutUrl(ctx, {
						workspaceId: args.workspaceId,
						planName: recoveryPlan,
						quantity: recoveryQuantity,
						identity,
					});
				}

				await syncDodoSubscriptionToWorkspace(ctx, {
					workspaceId: args.workspaceId,
					subscriptionId:
						subscription.subscription_id ?? billingContext.subscriptionId,
					status: subscription.status ?? "active",
					plan: planNameFromDodoSubscription(subscription),
					customerId: liveCustomerId,
					quantity:
						typeof subscription.quantity === "number"
							? subscription.quantity
							: null,
					cancelAtNextBillingDate:
						typeof subscription.cancel_at_next_billing_date === "boolean"
							? subscription.cancel_at_next_billing_date
							: null,
					nextBillingDate:
						typeof subscription.next_billing_date === "string"
							? subscription.next_billing_date
							: null,
					paymentConfirmed: false,
					raw: JSON.stringify(subscription),
				});

				customerId = liveCustomerId;
				portal = await customerPortals.create(ctx, {
					customer_id: customerId,
					...portalArgs,
				});
			}
			if (!portal?.portal_url) {
				throw new Error("Portal session did not return a portal_url");
			}
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
			customerId: getCustomerIdFromSubscription(subscription),
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

async function processRefundedDowngrade(
	ctx: ActionCtx,
	args: {
		workspaceId: Id<"workspaces">;
		planName: "pro" | "enterprise";
		quantity: number;
		fairBilling: any;
		dodoSubscriptionId: string;
		downgradeRefundCurrency: string | null;
		currentSubscription: DodoSubscription;
		downgradeInvoiceUrl: string | undefined;
		latestTotalAmount: number | null;
		latestTaxAmount: number | null;
		billingAdjustment?: ReturnType<typeof calculateRefundOrCredit>;
	}
): Promise<Record<string, unknown>> {
	const {
		workspaceId,
		planName,
		quantity,
		fairBilling,
		dodoSubscriptionId,
		downgradeRefundCurrency,
		currentSubscription,
		downgradeInvoiceUrl,
		latestTotalAmount,
		latestTaxAmount,
		billingAdjustment,
	} = args;
	const creditAmount =
		billingAdjustment?.refundOrCreditAmount ?? fairBilling.refundAmount;

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

	if (downgradeInvoiceUrl) {
		downgradeApplyArgs.invoiceUrl = downgradeInvoiceUrl;
	}

	const downgradeCurrency =
		downgradeRefundCurrency ?? currentSubscription?.currency ?? "USD";

	if (latestTotalAmount && latestTotalAmount > 0) {
		downgradeApplyArgs.amountDue = latestTotalAmount;
		downgradeApplyArgs.currency = downgradeCurrency;
		downgradeApplyArgs.usedAmount = Math.max(
			0,
			billingAdjustment?.consumedAmount ?? latestTotalAmount - creditAmount
		);
	}
	if (latestTaxAmount && latestTaxAmount > 0) {
		downgradeApplyArgs.taxAmount = latestTaxAmount;
	}
	if (creditAmount > 0) {
		downgradeApplyArgs.refundAmount = creditAmount;
		downgradeApplyArgs.refundCurrency = downgradeCurrency;
	}

	await ctx.runMutation(
		internal.payments.applyWorkspaceSubscriptionQuantity,
		downgradeApplyArgs
	);
	await sendDodoCustomerPortalEmail(ctx, workspaceId);

	if (creditAmount > 0) {
		const usedAmount =
			typeof downgradeApplyArgs.usedAmount === "number"
				? downgradeApplyArgs.usedAmount
				: undefined;
		await ctx.runMutation(internal.payments.recordBillingHistoryEntry, {
			workspaceId,
			amount: creditAmount,
			currency: downgradeCurrency,
			status: "succeeded",
			type: "credit",
			description: `Fair billing credit for ${PLANS[planName].label}`,
			dodoInvoiceId: `credit_${dodoSubscriptionId}_${Date.now().toString()}`,
			plan: planName,
			seats: quantity,
			...(downgradeInvoiceUrl ? { invoiceUrl: downgradeInvoiceUrl } : {}),
			...(typeof latestTaxAmount === "number"
				? { taxAmount: latestTaxAmount }
				: {}),
			...(typeof usedAmount === "number" ? { usedAmount } : {}),
		});
		await ctx.runMutation(internal.payments.addWorkspaceBillingCredit, {
			workspaceId,
			amount: creditAmount,
			currency: downgradeCurrency,
			reason: `Account credit from ${PLANS[planName].label} downgrade`,
		});
	}

	return {
		success: true,
		status: "updated",
		quantity,
		refundAmount: 0,
		creditAmount,
		creditCurrency: downgradeCurrency,
		message:
			creditAmount > 0
				? "Plan updated and the fair-billing amount was added as account credit."
				: "Plan updated. Usage and minimum consumed charges used the available downgrade credit.",
	};
}

// Action: Update subscription quantity (seat expansion) or change plan
export const updateSubscriptionQuantity = action({
	args: {
		workspaceId: v.id("workspaces"),
		newQuantity: v.number(),
		newPlan: v.optional(v.union(v.literal("pro"), v.literal("enterprise"))),
	},
	handler: async (
		// Refactored to drop complexity
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
		const earlyRequestedPlan =
			newPlan ??
			(workspace?.plan === "enterprise" || workspace?.plan === "pro"
				? workspace.plan
				: null);
		const earlyQuantity = Math.max(1, Math.floor(newQuantity));
		const earlyWorkspaceSeatQuantity =
			earlyRequestedPlan === "enterprise"
				? (workspace.enterpriseSeats ?? workspace.totalPaidSeats ?? 0)
				: earlyRequestedPlan === "pro"
					? (workspace.proSeats ?? workspace.totalPaidSeats ?? 0)
					: 0;
		const isDirectSeatIncreaseRequest =
			earlyRequestedPlan !== null &&
			workspace.plan === earlyRequestedPlan &&
			earlyQuantity > earlyWorkspaceSeatQuantity;
		if (
			earlyRequestedPlan &&
			hasActivePendingBillingPayment(workspace, {
				subscriptionId: dodoSubscriptionId,
				planName: earlyRequestedPlan,
				quantity: earlyQuantity,
			})
		) {
			const reusablePaymentUrl =
				typeof workspace.pendingBillingPaymentUrl === "string" &&
				workspace.pendingBillingPaymentUrl.startsWith("http")
					? workspace.pendingBillingPaymentUrl
					: null;
			if (reusablePaymentUrl) {
				if (isDirectSeatIncreaseRequest) {
					await clearLocalAndDodoPendingPlanChange(ctx, {
						workspaceId,
						subscriptionId: dodoSubscriptionId,
						reason: "direct seat increase replaces pending payment",
					});
				} else {
					console.log("[billing] reusing pending upgrade checkout", {
						workspaceId,
						plan: earlyRequestedPlan,
						quantity: earlyQuantity,
					});
					return {
						success: true,
						status: "payment_required",
						paymentUrl: reusablePaymentUrl,
						amountDue: workspace.pendingBillingAmount ?? 0,
						currency: workspace.pendingBillingCurrency ?? "USD",
						taxAmount: workspace.pendingBillingTaxAmount ?? 0,
						message:
							"An upgrade payment is already pending. Complete that payment; your workspace will update after Dodo confirms it.",
					};
				}
			}
			await ctx.runMutation(internal.payments.clearPendingUpgrade, {
				workspaceId,
			});
		}
		if (
			workspace.pendingBillingStatus === "pending_payment" &&
			typeof workspace.pendingBillingExpiresAt === "number" &&
			workspace.pendingBillingExpiresAt <= Date.now()
		) {
			await ctx.runMutation(internal.payments.expirePendingUpgrade, {
				workspaceId,
			});
		}

		const activePendingPayment = getActivePendingBillingPayment(
			workspace,
			dodoSubscriptionId
		);
		if (activePendingPayment) {
			const pendingMatchesRequest =
				activePendingPayment.planName === earlyRequestedPlan &&
				activePendingPayment.quantity === earlyQuantity;
			if (!activePendingPayment.paymentUrl || !pendingMatchesRequest) {
				await clearLocalAndDodoPendingPlanChange(ctx, {
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					reason: pendingMatchesRequest
						? "missing payment url"
						: "requested plan or quantity changed",
				});
			} else if (isDirectSeatIncreaseRequest) {
				await clearLocalAndDodoPendingPlanChange(ctx, {
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					reason: "direct seat increase replaces active pending payment",
				});
			} else {
				console.log("[billing] blocked duplicate Dodo upgrade while pending", {
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					pendingPlan: activePendingPayment.planName,
					pendingQuantity: activePendingPayment.quantity,
					requestedPlan: earlyRequestedPlan,
					requestedQuantity: earlyQuantity,
				});
				return {
					success: true,
					status: "payment_required",
					paymentUrl: activePendingPayment.paymentUrl,
					amountDue: activePendingPayment.amountDue,
					currency: activePendingPayment.currency,
					taxAmount: activePendingPayment.taxAmount,
					pendingExpiresAt: activePendingPayment.expiresAt,
					message:
						"A Dodo upgrade payment is already pending for this subscription. Complete that payment before starting another plan or seat change.",
				};
			}
		}

		// Ask Dodo first so stale local workspace state cannot fall back to
		// a full checkout and bypass fair billing.
		const { subscriptions, payments: dodoPayments } = await import("./dodo");
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

		let dodoPlan = planNameFromDodoSubscription(currentSubscription);
		const workspacePaidPlan =
			workspace?.plan === "enterprise" || workspace?.plan === "pro"
				? workspace.plan
				: null;
		let subscriptionStatus =
			currentSubscription?.status ?? workspace.subscriptionStatus ?? "unknown";
		const requestedPlan = newPlan ?? workspacePaidPlan;
		if (
			subscriptionStatus === "on_hold" &&
			workspacePaidPlan !== null &&
			requestedPlan !== null &&
			(requestedPlan !== workspacePaidPlan ||
				workspace.pendingBillingQuantity !== earlyQuantity)
		) {
			try {
				await subscriptions.cancelPlanChange(ctx, {
					subscription_id: dodoSubscriptionId,
				});
				currentSubscription = await subscriptions.retrieve(ctx, {
					subscription_id: dodoSubscriptionId,
				});
				dodoPlan = planNameFromDodoSubscription(currentSubscription);
				subscriptionStatus =
					currentSubscription?.status ??
					workspace.subscriptionStatus ??
					"unknown";
			} catch (cancelError) {
				console.warn(
					"[updateSubscriptionQuantity] Failed to clear pending Dodo upgrade:",
					cancelError
				);
			}
		}
		const isUnconfirmedDodoPlanChange =
			dodoPlan !== null &&
			workspacePaidPlan !== null &&
			dodoPlan !== workspacePaidPlan;
		const workspacePlan = isUnconfirmedDodoPlanChange
			? workspacePaidPlan
			: (dodoPlan ?? workspacePaidPlan);
		if (!workspacePlan) {
			return inactiveSubscriptionCheckoutResult();
		}
		if (
			subscriptionStatus !== "on_hold" &&
			!isActivePaidSubscription(
				workspacePlan,
				subscriptionStatus,
				dodoSubscriptionId
			)
		) {
			return inactiveSubscriptionCheckoutResult();
		}
		const dodoQuantity =
			typeof currentSubscription?.quantity === "number"
				? currentSubscription.quantity
				: null;
		const workspaceSeatQuantity =
			dodoPlan === "enterprise"
				? (workspace.enterpriseSeats ?? workspace.totalPaidSeats ?? 0)
				: dodoPlan === "pro"
					? (workspace.proSeats ?? workspace.totalPaidSeats ?? 0)
					: 0;
		if (
			dodoPlan &&
			(workspace?.plan !== dodoPlan ||
				workspace?.subscriptionStatus !== subscriptionStatus ||
				(dodoQuantity !== null && dodoQuantity !== workspaceSeatQuantity))
		) {
			await syncDodoSubscriptionToWorkspace(ctx, {
				workspaceId,
				subscriptionId:
					currentSubscription?.subscription_id ?? dodoSubscriptionId,
				status: subscriptionStatus,
				plan: dodoPlan,
				customerId: getCustomerIdFromSubscription(currentSubscription),
				quantity: dodoQuantity,
				cancelAtNextBillingDate:
					typeof currentSubscription?.cancel_at_next_billing_date === "boolean"
						? currentSubscription.cancel_at_next_billing_date
						: null,
				nextBillingDate:
					typeof currentSubscription?.next_billing_date === "string"
						? currentSubscription.next_billing_date
						: null,
				paymentConfirmed: false,
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
		if (
			isUnconfirmedDodoPlanChange &&
			dodoPlan === planName &&
			(dodoQuantity === null || dodoQuantity === quantity)
		) {
			await ctx.runMutation(
				internal.payments.applyWorkspaceSubscriptionQuantity,
				{
					workspaceId,
					planName,
					quantity,
					subscriptionStatus: subscriptionStatus ?? "active",
					auditAction: "subscription_reconciled_from_dodo_plan_change",
				}
			);
			return {
				success: true,
				status: "updated",
				quantity,
				amountDue: 0,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
				message:
					"Enterprise is active in Dodo, so your workspace has been updated.",
			};
		}
		if (
			hasActivePendingBillingPayment(workspace, {
				subscriptionId: dodoSubscriptionId,
				planName,
				quantity,
			})
		) {
			const reusablePaymentUrl =
				typeof workspace.pendingBillingPaymentUrl === "string" &&
				workspace.pendingBillingPaymentUrl.startsWith("http")
					? workspace.pendingBillingPaymentUrl
					: null;
			if (reusablePaymentUrl) {
				return {
					success: true,
					status: "payment_required",
					paymentUrl: reusablePaymentUrl,
					amountDue: workspace.pendingBillingAmount ?? 0,
					currency:
						workspace.pendingBillingCurrency ??
						currentSubscription?.currency ??
						"USD",
					taxAmount: workspace.pendingBillingTaxAmount ?? 0,
					message:
						"An Enterprise upgrade payment is already pending. Complete that payment; your workspace will update after Dodo confirms it.",
				};
			}
			await ctx.runMutation(internal.payments.clearPendingUpgrade, {
				workspaceId,
			});
		}
		if (
			workspace.pendingBillingSubscriptionId === dodoSubscriptionId &&
			typeof workspace.pendingBillingExpiresAt === "number" &&
			workspace.pendingBillingExpiresAt <= Date.now()
		) {
			await ctx.runMutation(internal.payments.expirePendingUpgrade, {
				workspaceId,
			});
			try {
				await subscriptions.cancelPlanChange(ctx, {
					subscription_id: dodoSubscriptionId,
				});
			} catch (cancelError) {
				const cancelCode = parseDodoErrorCode(cancelError);
				if (!isMissingScheduledPlanChangeCode(cancelCode)) {
					console.warn(
						"[updateSubscriptionQuantity] Failed to cancel expired pending Dodo plan change:",
						cancelError
					);
				}
			}
		}

		const firstPositiveSeatCount = (
			...values: Array<number | null | undefined>
		) => values.find((value) => typeof value === "number" && value > 0);
		const dodoQuantityIsUnconfirmed =
			subscriptionStatus === "on_hold" ||
			isUnconfirmedDodoPlanChange ||
			workspace.pendingBillingStatus === "pending_payment";
		const currentQuantityBase =
			workspacePlan === "enterprise"
				? dodoQuantityIsUnconfirmed
					? firstPositiveSeatCount(
							workspace.enterpriseSeats,
							workspace.totalPaidSeats,
							currentSubscription?.quantity
						)
					: firstPositiveSeatCount(
							currentSubscription?.quantity,
							workspace.enterpriseSeats,
							workspace.totalPaidSeats
						)
				: dodoQuantityIsUnconfirmed
					? firstPositiveSeatCount(
							workspace.proSeats,
							workspace.totalPaidSeats,
							currentSubscription?.quantity
						)
					: firstPositiveSeatCount(
							currentSubscription?.quantity,
							workspace.proSeats,
							workspace.totalPaidSeats
						);
		const currentQuantity = Math.max(
			1,
			Math.floor(currentQuantityBase ?? quantity)
		);
		const isSeatOnlyIncrease =
			planName === workspacePlan &&
			requestedPlan === workspacePlan &&
			quantity > currentQuantity;
		if (isSeatOnlyIncrease) {
			let updatedSubscription: DodoSubscription | null = null;
			try {
				updatedSubscription = await subscriptions.changePlan(ctx, {
					subscription_id: dodoSubscriptionId,
					product_id: dodoProductId,
					quantity,
					proration_billing_mode: "do_not_bill",
					effective_at: "immediately",
					on_payment_failure: "apply_change",
					metadata: {
						workspace_id: workspaceId,
						plan: planName,
					},
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

			if (!updatedSubscription) {
				try {
					updatedSubscription = await subscriptions.retrieve(ctx, {
						subscription_id: dodoSubscriptionId,
					});
				} catch (retrieveError) {
					console.warn(
						"[updateSubscriptionQuantity] Failed to retrieve Dodo subscription after direct no-bill seat change:",
						retrieveError
					);
				}
			}

			await ctx.runMutation(
				internal.payments.applyWorkspaceSubscriptionQuantity,
				{
					workspaceId,
					planName,
					quantity,
					subscriptionStatus:
						updatedSubscription?.status ?? subscriptionStatus ?? "active",
					auditAction: "seat_quantity_updated_directly",
				}
			);

			return {
				success: true,
				status: "updated",
				quantity,
				amountDue: 0,
				currency:
					updatedSubscription?.currency ??
					currentSubscription?.currency ??
					"USD",
				taxAmount: 0,
				message:
					"Seat added directly. Dodo subscription quantity and workspace seats were updated without payment.",
			};
		}
		const recentPaidSeatChange: Doc<"billingHistory"> | null =
			quantity > currentQuantity
				? await ctx.runQuery(internal.payments.getRecentSuccessfulSeatPayment, {
						workspaceId,
						planName,
						quantity,
						since: Date.now() - 24 * 60 * 60 * 1000,
					})
				: null;
		if (recentPaidSeatChange) {
			const updatedSubscription = await subscriptions.changePlan(ctx, {
				subscription_id: dodoSubscriptionId,
				product_id: dodoProductId,
				quantity,
				proration_billing_mode: "do_not_bill",
				effective_at: "immediately",
				on_payment_failure: "apply_change",
				metadata: {
					workspace_id: workspaceId,
					plan: planName,
				},
			});
			await ctx.runMutation(
				internal.payments.applyWorkspaceSubscriptionQuantity,
				{
					workspaceId,
					planName,
					quantity,
					subscriptionStatus: updatedSubscription?.status ?? "active",
					auditAction: "seat_quantity_reconciled_after_payment",
					amountDue: recentPaidSeatChange.amount,
					currency: recentPaidSeatChange.currency,
					taxAmount: recentPaidSeatChange.taxAmount ?? 0,
				}
			);
			return {
				success: true,
				status: "updated",
				quantity,
				amountDue: recentPaidSeatChange.amount,
				currency: recentPaidSeatChange.currency,
				taxAmount: recentPaidSeatChange.taxAmount ?? 0,
				message:
					"Dodo quantity was updated using your recent successful seat payment. No extra charge was collected.",
			};
		}
		let fairBilling = await calculateFairBillingDelta(
			ctx,
			currentSubscription,
			{
				currentPlan: workspacePlan,
				currentQuantity,
				nextPlan: planName,
				nextQuantity: quantity,
				workspaceId,
			}
		);
		const isPaidUpgrade = fairBilling.monthlyDelta > 0;
		const shouldWaiveSmallDowngradeRefund =
			fairBilling.refundAmount > 0 &&
			fairBilling.refundAmount < DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;
		const shouldRefundDowngrade =
			fairBilling.refundAmount >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;
		let downgradeRefundCurrency: string | null = null;
		let latestPaymentForDowngradeRefund: DodoPayment | null = null;
		let latestPaymentForFairBilling: DodoPayment | null = null;
		if (isPaidUpgrade || shouldRefundDowngrade) {
			latestPaymentForFairBilling = await getLatestSucceededSubscriptionPayment(
				ctx,
				dodoPayments,
				dodoSubscriptionId
			);
		}
		if (isPaidUpgrade) {
			fairBilling = await calculateFairBillingDelta(ctx, currentSubscription, {
				currentPlan: workspacePlan,
				currentQuantity,
				nextPlan: planName,
				nextQuantity: quantity,
				periodStartFallback: getPaymentCreatedAt(latestPaymentForFairBilling),
				periodEndFallback: getPaymentPeriodEndFallback(
					latestPaymentForFairBilling,
					workspace.currentPeriodEnd
				),
				workspaceId,
			});
		}
		const activityBasedUpgradeChargeAmount =
			fairBilling.amountDue > 0
				? fairBilling.amountDue
				: isPaidUpgrade &&
						(!fairBilling.periodStart ||
							!fairBilling.periodEnd ||
							fairBilling.periodEnd <= fairBilling.periodStart)
					? fairBilling.monthlyDelta
					: 0;
		const shouldChargeFullPlanDifference =
			isPaidUpgrade &&
			activityBasedUpgradeChargeAmount > 0 &&
			activityBasedUpgradeChargeAmount < DODO_MINIMUM_PAYMENT_AMOUNT_CENTS &&
			fairBilling.monthlyDelta >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;
		const upgradeChargeAmount = shouldChargeFullPlanDifference
			? fairBilling.monthlyDelta
			: activityBasedUpgradeChargeAmount;
		const shouldWaiveSmallUpgradeCharge =
			upgradeChargeAmount > 0 &&
			upgradeChargeAmount < DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;
		const shouldChargeUpgrade =
			upgradeChargeAmount >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS;

		const pendingPaymentRecoveryResult = async (message: string) => {
			let paymentUrl: string | null = null;
			const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
			try {
				const paymentSetupResult = await subscriptions.updatePaymentMethod(
					ctx,
					{
						subscription_id: dodoSubscriptionId,
						return_url: siteUrl
							? `${siteUrl}/workspace/${workspaceId}/manage#billing`
							: undefined,
					}
				);
				paymentUrl = findDodoPaymentUrl(paymentSetupResult);
			} catch (paymentSetupError) {
				console.warn(
					"[updateSubscriptionQuantity] Failed to create Dodo payment-method recovery link:",
					paymentSetupError
				);
			}
			await ctx.runMutation(
				internal.payments.recordWorkspacePendingPlanPayment,
				{
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					planName,
					quantity,
					...(paymentUrl ? { paymentUrl } : {}),
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
				}
			);

			if (paymentUrl) {
				return {
					success: true,
					status: "payment_required",
					paymentUrl,
					quantity,
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
					message,
				};
			}

			return {
				success: false,
				status: "billing_provider_error",
				quantity,
				amountDue: upgradeChargeAmount,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
				message:
					"Dodo has a pending unpaid subscription change, but did not return a payment link. Clear or complete the pending change in Dodo, then add the seat again.",
			};
		};
		let downgradeBillingAdjustment: ReturnType<
			typeof calculateRefundOrCredit
		> | null = null;
		if (shouldRefundDowngrade) {
			latestPaymentForDowngradeRefund = latestPaymentForFairBilling;
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
			const periodStart = fairBilling.periodStart ?? null;
			const periodEnd = fairBilling.periodEnd ?? null;
			if (periodStart && periodEnd) {
				const usage = await ctx.runQuery(
					internal.payments.getBillingConsumptionForPeriod,
					{
						workspaceId,
						periodStart,
						periodEnd: Math.min(Date.now(), periodEnd),
					}
				);
				downgradeBillingAdjustment = calculateRefundOrCredit({
					paidAmountCents:
						latestTotalAmount && latestTotalAmount > 0
							? latestTotalAmount
							: fairBilling.currentMonthlyValue,
					maxRefundableCents: fairBilling.refundAmount,
					periodStart,
					periodEnd,
					featureUsageCostCents: usage.featureUsageCost,
					workspaceActivityCostCents: usage.workspaceActivityCost,
				});
				fairBilling = {
					...fairBilling,
					refundAmount: downgradeBillingAdjustment.refundOrCreditAmount,
				};
			}
		}

		const shouldSkipDodoProration =
			shouldRefundDowngrade ||
			shouldWaiveSmallUpgradeCharge ||
			shouldWaiveSmallDowngradeRefund;
		const shouldApplyImmediatelyWithoutProration =
			shouldWaiveSmallUpgradeCharge || shouldWaiveSmallDowngradeRefund;
		const changeSubscriptionPlan = async (
			mode: "immediate" | "no_proration" | "full_difference" = "immediate"
		) => {
			const prorationBillingMode =
				mode === "no_proration" || shouldSkipDodoProration
					? "do_not_bill"
					: "difference_immediately";
			const result = await subscriptions.changePlan(ctx, {
				subscription_id: dodoSubscriptionId,
				product_id: dodoProductId,
				quantity,
				metadata: {
					workspace_id: workspaceId,
					plan: planName,
				},
				// Fair billing: charge only the activity-based difference for upgrades,
				// and do not let Dodo also credit/refund when we refund downgrades.
				proration_billing_mode: prorationBillingMode,
				effective_at: "immediately",
				// Paid activity-based upgrades must stay pending until payment succeeds.
				// No-proration changes have no payment to wait for, so apply them now.
				on_payment_failure:
					mode === "no_proration" || shouldSkipDodoProration
						? "apply_change"
						: "prevent_change",
			});
			return result;
		};

		const paymentRequiredResult = async (
			changeResult: unknown
		): Promise<Record<string, unknown>> => {
			let paymentUrl: string | null = findDodoPaymentUrl(changeResult);
			let checkoutSessionId: string | null =
				findDodoCheckoutSessionId(changeResult);

			if (!paymentUrl) {
				const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
				try {
					const paymentSetupResult = await subscriptions.updatePaymentMethod(
						ctx,
						{
							subscription_id: dodoSubscriptionId,
							return_url: siteUrl
								? `${siteUrl}/workspace/${workspaceId}/manage#billing`
								: undefined,
						}
					);
					paymentUrl = findDodoPaymentUrl(paymentSetupResult);
					checkoutSessionId =
						checkoutSessionId ?? findDodoCheckoutSessionId(paymentSetupResult);
				} catch (paymentSetupError) {
					console.warn(
						"[updateSubscriptionQuantity] Dodo did not return a payment link and payment setup could not be created:",
						paymentSetupError
					);
				}
			}

			if (!paymentUrl) {
				try {
					const liveSubscription: DodoSubscription =
						await subscriptions.retrieve(ctx, {
							subscription_id: dodoSubscriptionId,
						});
					const livePlan = planNameFromDodoSubscription(liveSubscription);
					const liveQuantity =
						typeof liveSubscription?.quantity === "number"
							? Math.max(1, Math.floor(liveSubscription.quantity))
							: null;
					if (
						livePlan === planName &&
						(liveQuantity === null || liveQuantity === quantity)
					) {
						await ctx.runMutation(
							internal.payments.applyWorkspaceSubscriptionQuantity,
							{
								workspaceId,
								planName,
								quantity,
								subscriptionStatus: liveSubscription.status ?? "active",
								auditAction: "subscription_updated_without_payment_link",
								amountDue: upgradeChargeAmount,
								currency: liveSubscription.currency ?? "USD",
								taxAmount: 0,
							}
						);
						return {
							success: true,
							status: "updated",
							quantity,
							amountDue: upgradeChargeAmount,
							currency: liveSubscription.currency ?? "USD",
							taxAmount: 0,
							message:
								"Enterprise is active in Dodo, so your workspace has been updated.",
						};
					}
				} catch (retrieveError) {
					console.warn(
						"[updateSubscriptionQuantity] Failed to verify Dodo subscription after missing payment link:",
						retrieveError
					);
				}

				await ctx.runMutation(
					internal.payments.recordWorkspacePendingPlanPayment,
					{
						workspaceId,
						subscriptionId: dodoSubscriptionId,
						planName,
						quantity,
						...(checkoutSessionId ? { checkoutSessionId } : {}),
						amountDue: upgradeChargeAmount,
						currency: currentSubscription?.currency ?? "USD",
						taxAmount: 0,
					}
				);
				return {
					success: true,
					status: "pending_payment",
					message:
						"Dodo is preparing the fair-billing payment. Try again in a moment to continue the upgrade.",
				};
			}

			await ctx.runMutation(
				internal.payments.recordWorkspacePendingPlanPayment,
				{
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					planName,
					quantity,
					...(checkoutSessionId ? { checkoutSessionId } : {}),
					paymentUrl,
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
				}
			);

			return {
				success: true,
				status: "payment_required",
				paymentUrl,
				message:
					"Dodo created the fair-billing plan change. Complete the payment flow; your workspace plan will update after payment succeeds.",
			};
		};

		const updateSeatQuantityBeforePendingPayment = async () => {
			const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
			await subscriptions.update(ctx, {
				subscription_id: dodoSubscriptionId,
				quantity,
				metadata: {
					workspace_id: workspaceId,
					plan: planName,
				},
			});
			const paymentSetupResult = await subscriptions.updatePaymentMethod(ctx, {
				subscription_id: dodoSubscriptionId,
				return_url: siteUrl
					? `${siteUrl}/workspace/${workspaceId}/manage#billing`
					: undefined,
			});
			const paymentUrl = findDodoPaymentUrl(paymentSetupResult);
			const checkoutSessionId = findDodoCheckoutSessionId(paymentSetupResult);
			if (!paymentUrl) {
				return await pendingPaymentRecoveryResult(
					"Dodo has a pending seat payment. Complete it in billing to activate the new seats."
				);
			}
			await ctx.runMutation(
				internal.payments.recordWorkspacePendingPlanPayment,
				{
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					planName,
					quantity,
					...(checkoutSessionId ? { checkoutSessionId } : {}),
					paymentUrl,
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
				}
			);
			return {
				success: true,
				status: "payment_required",
				paymentUrl,
				amountDue: upgradeChargeAmount,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
				message:
					"Dodo recalculated the pending seat payment for the requested seat count. Complete the payment to activate the new seats.",
			};
		};

		const recreatePaidUpgradeAfterPendingChange = async () => {
			try {
				await subscriptions.cancelPlanChange(ctx, {
					subscription_id: dodoSubscriptionId,
				});
			} catch (cancelError) {
				const cancelCode = parseDodoErrorCode(cancelError);
				if (!isMissingScheduledPlanChangeCode(cancelCode)) {
					console.warn(
						"[updateSubscriptionQuantity] Failed to cancel pending Dodo plan change:",
						cancelError
					);
				}
			}

			try {
				const changeResult = await changeSubscriptionPlan();
				return {
					...(await paymentRequiredResult(changeResult)),
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
				};
			} catch (changeError) {
				if (parseDodoErrorCode(changeError) !== "PENDING_PLAN_CHANGE_EXISTS") {
					throw changeError;
				}

				const isSeatOnlyChange =
					planName === workspacePlan && requestedPlan === workspacePlan;
				if (isSeatOnlyChange) {
					try {
						return await updateSeatQuantityBeforePendingPayment();
					} catch (seatQuantityError) {
						console.warn(
							"[updateSubscriptionQuantity] Failed to refresh Dodo pending seat quantity:",
							seatQuantityError
						);
					}
				}

				await ctx.runMutation(
					internal.payments.recordWorkspacePendingPlanPayment,
					{
						workspaceId,
						subscriptionId: dodoSubscriptionId,
						planName,
						quantity,
						amountDue: upgradeChargeAmount,
						currency: currentSubscription?.currency ?? "USD",
						taxAmount: 0,
					}
				);
				return {
					success: true,
					status: "pending_payment",
					amountDue: upgradeChargeAmount,
					currency: currentSubscription?.currency ?? "USD",
					taxAmount: 0,
					message:
						"Dodo is holding an unpaid seat change for this subscription. The amount has been recalculated for the requested seat count; complete or clear the pending payment in Dodo, then try again.",
				};
			}
		};

		const applyNoImmediateBillingUpdate = async (message: string) => {
			await sendDodoCustomerPortalEmail(ctx, workspaceId);
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
				message,
			};
		};

		const applyImmediateNoProrationPlanChange = async (message: string) => {
			try {
				await changeSubscriptionPlan("no_proration");
			} catch (noProrationError) {
				if (
					parseDodoErrorCode(noProrationError) !==
					"TOTAL_PAYMENT_AMOUNT_BELOW_MINIMUM_AMOUNT"
				) {
					throw noProrationError;
				}
				console.warn(
					"[updateSubscriptionQuantity] Dodo rejected no-proration plan change below minimum; applying local no-charge update:",
					noProrationError
				);
			}
			const result = await applyNoImmediateBillingUpdate(message);
			if (
				shouldWaiveSmallDowngradeRefund &&
				fairBilling.refundAmount > 0 &&
				fairBilling.periodStart &&
				fairBilling.periodEnd
			) {
				const usage = await ctx.runQuery(
					internal.payments.getBillingConsumptionForPeriod,
					{
						workspaceId,
						periodStart: fairBilling.periodStart,
						periodEnd: Math.min(Date.now(), fairBilling.periodEnd),
					}
				);
				const adjustment = calculateRefundOrCredit({
					paidAmountCents: fairBilling.currentMonthlyValue,
					maxRefundableCents: fairBilling.refundAmount,
					periodStart: fairBilling.periodStart,
					periodEnd: fairBilling.periodEnd,
					featureUsageCostCents: usage.featureUsageCost,
					workspaceActivityCostCents: usage.workspaceActivityCost,
				});
				if (adjustment.refundOrCreditAmount > 0) {
					await ctx.runMutation(internal.payments.addWorkspaceBillingCredit, {
						workspaceId,
						amount: adjustment.refundOrCreditAmount,
						currency: currentSubscription?.currency ?? "USD",
						reason: "Small fair-billing downgrade credit below payment minimum",
					});
					await ctx.runMutation(internal.payments.recordBillingHistoryEntry, {
						workspaceId,
						amount: adjustment.refundOrCreditAmount,
						currency: currentSubscription?.currency ?? "USD",
						status: "succeeded",
						type: "credit",
						description: "Small fair-billing downgrade credit",
						dodoInvoiceId: `credit_${dodoSubscriptionId}_${Date.now().toString()}`,
						plan: planName,
						seats: quantity,
						usedAmount: adjustment.consumedAmount,
					});
					return {
						...result,
						creditAmount: adjustment.refundOrCreditAmount,
						creditCurrency: currentSubscription?.currency ?? "USD",
					};
				}
			}
			return result;
		};

		const chargeFullDifferenceUpgrade = async () => {
			const changeResult = await changeSubscriptionPlan("full_difference");
			await sendDodoCustomerPortalEmail(ctx, workspaceId);
			return {
				...(await paymentRequiredResult(changeResult)),
				amountDue: upgradeChargeAmount,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
			};
		};

		const cancelPendingDodoPlanChange = async (context: string) => {
			try {
				await subscriptions.cancelPlanChange(ctx, {
					subscription_id: dodoSubscriptionId,
				});
				return true;
			} catch (cancelError) {
				const cancelCode = parseDodoErrorCode(cancelError);
				if (!isMissingScheduledPlanChangeCode(cancelCode)) {
					console.warn(
						`[updateSubscriptionQuantity] Failed to cancel pending Dodo plan change ${context}:`,
						cancelError
					);
					return false;
				}
				return true;
			}
		};

		const createExactActivityChargePayment = async () => {
			const currency = currentSubscription?.currency ?? "USD";
			await ctx.runMutation(
				internal.payments.recordWorkspacePendingPlanPayment,
				{
					workspaceId,
					subscriptionId: dodoSubscriptionId,
					planName,
					quantity,
					amountDue: upgradeChargeAmount,
					currency,
					taxAmount: 0,
				}
			);

			try {
				const chargeResult = await subscriptions.charge(ctx, {
					subscription_id: dodoSubscriptionId,
					product_price: upgradeChargeAmount,
					product_currency: currency,
					product_description: `${PLANS[planName].label} seat expansion (${quantity} seats)`,
					metadata: {
						workspace_id: workspaceId,
						workspaceId,
						plan: planName,
						quantity: String(quantity),
						billing_reason: "seat_expansion_activity_charge",
					},
				});
				const paymentUrl = findDodoPaymentUrl(chargeResult);
				const checkoutSessionId = findDodoCheckoutSessionId(chargeResult);
				if (paymentUrl || checkoutSessionId) {
					await ctx.runMutation(
						internal.payments.recordWorkspacePendingPlanPayment,
						{
							workspaceId,
							subscriptionId: dodoSubscriptionId,
							planName,
							quantity,
							...(checkoutSessionId ? { checkoutSessionId } : {}),
							...(paymentUrl ? { paymentUrl } : {}),
							amountDue: upgradeChargeAmount,
							currency,
							taxAmount: 0,
						}
					);
				}
				if (paymentUrl) {
					return {
						success: true,
						status: "payment_required",
						paymentUrl,
						quantity,
						amountDue: upgradeChargeAmount,
						currency,
						taxAmount: 0,
						message:
							"Dodo created the seat expansion payment. Complete payment to activate the added seats.",
					};
				}

				return {
					success: true,
					status: "pending_payment",
					quantity,
					amountDue: upgradeChargeAmount,
					currency,
					taxAmount: 0,
					message:
						"Dodo is processing the exact seat expansion charge. The added seats will activate after payment succeeds.",
				};
			} catch (chargeError) {
				if (isDodoRbacAccessDenied(chargeError)) {
					return dodoBillingPermissionRequiredResult();
				}
				const errorCode = parseDodoErrorCode(chargeError);
				if (
					errorCode === "PREVIOUS_PAYMENT_PENDING" ||
					errorCode === "PENDING_PLAN_CHANGE_EXISTS"
				) {
					return await pendingPaymentRecoveryResult(
						"Dodo has a pending seat payment. Complete it to activate the new seats."
					);
				}
				if (isDodoProviderError(chargeError)) {
					const recovery = await pendingPaymentRecoveryResult(
						"Dodo needs a payment method for the exact seat expansion charge. Complete payment to activate the new seats."
					);
					if (recovery.status === "payment_required") {
						return recovery;
					}
					return dodoProviderErrorResult(chargeError);
				}
				throw chargeError;
			}
		};

		const completeChangedSubscription = async (changeResult: unknown) => {
			if (shouldRefundDowngrade) {
				const latestTotalAmount =
					typeof latestPaymentForDowngradeRefund?.total_amount === "number"
						? latestPaymentForDowngradeRefund.total_amount
						: null;
				const latestTaxAmount =
					typeof latestPaymentForDowngradeRefund?.tax === "number"
						? latestPaymentForDowngradeRefund.tax
						: null;
				return await processRefundedDowngrade(ctx, {
					workspaceId,
					planName,
					quantity,
					fairBilling,
					dodoSubscriptionId,
					downgradeRefundCurrency,
					currentSubscription,
					downgradeInvoiceUrl: getPaymentInvoiceUrl(
						latestPaymentForDowngradeRefund
					),
					latestTotalAmount,
					latestTaxAmount,
					billingAdjustment: downgradeBillingAdjustment ?? undefined,
				});
			}

			if (!shouldChargeUpgrade) {
				return await applyNoImmediateBillingUpdate(
					shouldWaiveSmallUpgradeCharge
						? "Plan updated. The activity-based charge was below Dodo's $1.00 minimum, so no immediate payment was collected."
						: shouldWaiveSmallDowngradeRefund
							? "Plan updated. The activity-based refund was below Dodo's $1.00 minimum, so no refund was issued."
							: "Plan updated with no additional charge under fair billing."
				);
			}

			await sendDodoCustomerPortalEmail(ctx, workspaceId);
			return {
				...(await paymentRequiredResult(changeResult)),
				amountDue: upgradeChargeAmount,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
			};
		};

		const handlePendingOrProviderError = async (error: unknown) => {
			if (isDodoRbacAccessDenied(error)) {
				return dodoBillingPermissionRequiredResult();
			}

			const errorCode = parseDodoErrorCode(error);
			if (errorCode === "PREVIOUS_PAYMENT_PENDING") {
				try {
					await clearLocalAndDodoPendingPlanChange(ctx, {
						workspaceId,
						subscriptionId: dodoSubscriptionId,
						reason: "Dodo reported previous payment pending",
					});
					return await recreatePaidUpgradeAfterPendingChange();
				} catch (retryError) {
					console.warn(
						"[updateSubscriptionQuantity] Failed to recreate plan change after previous pending payment:",
						retryError
					);
					return await pendingPaymentRecoveryResult(
						"Dodo has a pending unpaid subscription change. Complete it in billing to continue adding seats."
					);
				}
			}
			if (isDodoProviderError(error)) {
				return dodoProviderErrorResult(error);
			}
			throw error;
		};

		try {
			if (shouldChargeUpgrade) {
				return await createExactActivityChargePayment();
			}

			if (shouldApplyImmediatelyWithoutProration) {
				return await applyImmediateNoProrationPlanChange(
					shouldWaiveSmallUpgradeCharge
						? "Plan updated immediately. The activity-based charge was below Dodo's $1.00 minimum, so no immediate payment was collected."
						: "Plan updated immediately. The activity-based refund was below Dodo's $1.00 minimum, so no refund was issued."
				);
			}

			const changeResult = await changeSubscriptionPlan();
			if (shouldRefundDowngrade) {
				const latestTotalAmount =
					typeof latestPaymentForDowngradeRefund?.total_amount === "number"
						? latestPaymentForDowngradeRefund.total_amount
						: null;
				const latestTaxAmount =
					typeof latestPaymentForDowngradeRefund?.tax === "number"
						? latestPaymentForDowngradeRefund.tax
						: null;
				return await processRefundedDowngrade(ctx, {
					workspaceId,
					planName,
					quantity,
					fairBilling,
					dodoSubscriptionId,
					downgradeRefundCurrency,
					currentSubscription,
					downgradeInvoiceUrl: getPaymentInvoiceUrl(
						latestPaymentForDowngradeRefund
					),
					latestTotalAmount,
					latestTaxAmount,
					billingAdjustment: downgradeBillingAdjustment ?? undefined,
				});
			}

			if (!shouldChargeUpgrade) {
				return await applyNoImmediateBillingUpdate(
					shouldWaiveSmallUpgradeCharge
						? "Plan updated. The activity-based charge was below Dodo's $1.00 minimum, so no immediate payment was collected."
						: shouldWaiveSmallDowngradeRefund
							? "Plan updated. The activity-based refund was below Dodo's $1.00 minimum, so no refund was issued."
							: "Plan updated with no additional charge under fair billing."
				);
			}
			await sendDodoCustomerPortalEmail(ctx, workspaceId);
			return {
				...(await paymentRequiredResult(changeResult)),
				amountDue: upgradeChargeAmount,
				currency: currentSubscription?.currency ?? "USD",
				taxAmount: 0,
			};
		} catch (error) {
			if (isDodoRbacAccessDenied(error)) {
				return dodoBillingPermissionRequiredResult();
			}

			const errorCode = parseDodoErrorCode(error);
			if (errorCode === "TOTAL_PAYMENT_AMOUNT_BELOW_MINIMUM_AMOUNT") {
				if (
					isPaidUpgrade &&
					fairBilling.monthlyDelta >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS
				) {
					return await chargeFullDifferenceUpgrade();
				}
				return await applyImmediateNoProrationPlanChange(
					"Plan updated immediately. The activity-based payment was below Dodo's $1.00 minimum, so no immediate charge or refund was processed."
				);
			}
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
						const latestTotalAmount =
							typeof latestPaymentForDowngradeRefund?.total_amount === "number"
								? latestPaymentForDowngradeRefund.total_amount
								: null;
						const latestTaxAmount =
							typeof latestPaymentForDowngradeRefund?.tax === "number"
								? latestPaymentForDowngradeRefund.tax
								: null;
						return await processRefundedDowngrade(ctx, {
							workspaceId,
							planName,
							quantity,
							fairBilling,
							dodoSubscriptionId,
							downgradeRefundCurrency,
							currentSubscription,
							downgradeInvoiceUrl: getPaymentInvoiceUrl(
								latestPaymentForDowngradeRefund
							),
							latestTotalAmount,
							latestTaxAmount,
							billingAdjustment: downgradeBillingAdjustment ?? undefined,
						});
					}
					if (!shouldChargeUpgrade) {
						return await applyNoImmediateBillingUpdate(
							shouldWaiveSmallUpgradeCharge
								? "Plan updated. The activity-based charge was below Dodo's $1.00 minimum, so no immediate payment was collected."
								: shouldWaiveSmallDowngradeRefund
									? "Plan updated. The activity-based refund was below Dodo's $1.00 minimum, so no refund was issued."
									: "Plan updated with no additional charge under fair billing."
						);
					}
					await sendDodoCustomerPortalEmail(ctx, workspaceId);
					return {
						...(await paymentRequiredResult(retryResult)),
						amountDue: upgradeChargeAmount,
						currency: currentSubscription?.currency ?? "USD",
						taxAmount: 0,
					};
				} catch (retryError) {
					if (isDodoRbacAccessDenied(retryError)) {
						return dodoBillingPermissionRequiredResult();
					}

					if (
						parseDodoErrorCode(retryError) ===
						"TOTAL_PAYMENT_AMOUNT_BELOW_MINIMUM_AMOUNT"
					) {
						if (
							isPaidUpgrade &&
							fairBilling.monthlyDelta >= DODO_MINIMUM_PAYMENT_AMOUNT_CENTS
						) {
							return await chargeFullDifferenceUpgrade();
						}
						return await applyImmediateNoProrationPlanChange(
							"Plan updated immediately. The activity-based payment was below Dodo's $1.00 minimum, so no immediate charge or refund was processed."
						);
					}

					if (parseDodoErrorCode(retryError) !== "PENDING_PLAN_CHANGE_EXISTS") {
						return await handlePendingOrProviderError(retryError);
					}
					if (shouldChargeUpgrade) {
						return await recreatePaidUpgradeAfterPendingChange();
					}

					if (await cancelPendingDodoPlanChange("after reactivation")) {
						try {
							const retryAfterCancelResult = await changeSubscriptionPlan();
							return await completeChangedSubscription(retryAfterCancelResult);
						} catch (retryAfterCancelError) {
							if (
								parseDodoErrorCode(retryAfterCancelError) !==
								"PENDING_PLAN_CHANGE_EXISTS"
							) {
								return await handlePendingOrProviderError(
									retryAfterCancelError
								);
							}
						}
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
						if (shouldChargeUpgrade) {
							return await pendingPaymentRecoveryResult(
								"Dodo has a pending seat payment. Complete it in billing to activate the new seats."
							);
						}

						return {
							success: true,
							status: "pending_plan_change",
							quantity: scheduledQuantity,
							message:
								"Your subscription was reactivated, but a plan change is already pending. Your workspace will update after Dodo confirms payment.",
						};
					}

					return await pendingPaymentRecoveryResult(
						"Dodo has a pending seat payment. Complete it in billing to activate the new seats."
					);
				}
			} else if (errorCode !== "PENDING_PLAN_CHANGE_EXISTS") {
				return await handlePendingOrProviderError(error);
			}
			if (shouldChargeUpgrade) {
				return await recreatePaidUpgradeAfterPendingChange();
			}

			if (await cancelPendingDodoPlanChange("before non-upgrade plan change")) {
				try {
					const retryAfterCancelResult = await changeSubscriptionPlan();
					return await completeChangedSubscription(retryAfterCancelResult);
				} catch (retryAfterCancelError) {
					if (
						parseDodoErrorCode(retryAfterCancelError) !==
						"PENDING_PLAN_CHANGE_EXISTS"
					) {
						return await handlePendingOrProviderError(retryAfterCancelError);
					}
				}
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
				if (shouldChargeUpgrade) {
					return await pendingPaymentRecoveryResult(
						"Dodo has a pending seat payment. Complete it in billing to activate the new seats."
					);
				}

				return {
					success: true,
					status: "pending_plan_change",
					quantity: scheduledQuantity,
					message:
						"A plan change is already pending. Your workspace will update after Dodo confirms payment.",
				};
			}

			return await pendingPaymentRecoveryResult(
				"Dodo has a pending seat payment. Complete it in billing to activate the new seats."
			);
		}
	},
});

export const createUpgradeCheckout = action({
	args: {
		workspaceId: v.id("workspaces"),
		planName: v.union(v.literal("pro"), v.literal("enterprise")),
		quantity: v.number(),
	},
	handler: async (ctx, args): Promise<Record<string, unknown>> => {
		console.log("[billing] createUpgradeCheckout requested", {
			workspaceId: args.workspaceId,
			plan: args.planName,
			quantity: Math.max(1, Math.floor(args.quantity)),
		});
		return await ctx.runAction(api.payments.updateSubscriptionQuantity, {
			workspaceId: args.workspaceId,
			newPlan: args.planName,
			newQuantity: args.quantity,
		});
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

		const { subscriptions, payments } = await import("./dodo");
		const subscription = await subscriptions.retrieve(ctx, {
			subscription_id: workspace.dodoSubscriptionId,
		});
		const latestPayment = await getLatestSucceededSubscriptionPayment(
			ctx,
			payments,
			workspace.dodoSubscriptionId
		);

		const refundAmount = await calculateUnusedPeriodRefundAmount(
			ctx,
			workspaceId,
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

		let refundSuccess = false;
		let refundId: string | undefined;

		const finalRefundAmount = refundAmount;
		if (finalRefundAmount > 0 && latestPayment) {
			const { refunds } = await import("./dodo");
			try {
				const dodoRefundResult = await _refundLatestSubscriptionPayment(
					ctx,
					payments,
					refunds,
					{
						latestPayment,
						amount: finalRefundAmount,
						reason: "Subscription cancelled / downgrade to Free",
						metadata: {
							workspaceId,
							subscriptionId: workspace.dodoSubscriptionId,
						},
					}
				);
				const refundObj = (dodoRefundResult as Record<string, unknown>)
					?.refund as Record<string, unknown> | undefined;
				if (refundObj) {
					refundSuccess = true;
					refundId = String(refundObj.refund_id ?? refundObj.id ?? "");
				}
			} catch (refundError) {
				console.error(
					"[cancelSubscription] Dodo real money refund failed, falling back to credit:",
					refundError
				);
			}
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
			refundAmount,
		};
		const refundCurrency = subscription?.currency;
		if (refundCurrency) freePlanArgs.refundCurrency = refundCurrency;
		const latestInvoiceUrl = getPaymentInvoiceUrl(latestPayment);
		if (latestInvoiceUrl) freePlanArgs.invoiceUrl = latestInvoiceUrl;
		if (refundId) freePlanArgs.refundId = refundId;
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

		if (finalRefundAmount > 0) {
			if (refundSuccess && refundId) {
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
					currency: subscription?.currency ?? "USD",
					status: "succeeded",
					type: "refund",
					description: "UPI/payment source refund for downgrade to Free",
					dodoInvoiceId: refundId,
				};
				if (latestInvoiceUrl) refundHistoryArgs.invoiceUrl = latestInvoiceUrl;
				if (typeof freePlanArgs.usedAmount === "number") {
					refundHistoryArgs.usedAmount = freePlanArgs.usedAmount;
				}
				await ctx.runMutation(
					internal.payments.recordBillingHistoryEntry,
					refundHistoryArgs
				);
			} else {
				const refundHistoryArgs: {
					workspaceId: Id<"workspaces">;
					amount: number;
					currency: string;
					status: string;
					type: "credit";
					description: string;
					dodoInvoiceId: string;
					invoiceUrl?: string;
					usedAmount?: number;
				} = {
					workspaceId,
					amount: finalRefundAmount,
					currency: subscription?.currency ?? "USD",
					status: "succeeded",
					type: "credit",
					description: "Fair billing credit for downgrade to Free",
					dodoInvoiceId: `credit_${workspace.dodoSubscriptionId}_${Date.now().toString()}`,
				};
				if (latestInvoiceUrl) refundHistoryArgs.invoiceUrl = latestInvoiceUrl;
				if (typeof freePlanArgs.usedAmount === "number") {
					refundHistoryArgs.usedAmount = freePlanArgs.usedAmount;
				}
				await ctx.runMutation(
					internal.payments.recordBillingHistoryEntry,
					refundHistoryArgs
				);
				await ctx.runMutation(internal.payments.addWorkspaceBillingCredit, {
					workspaceId,
					amount: finalRefundAmount,
					currency: subscription?.currency ?? "USD",
					reason: "Account credit from downgrade to Free",
				});
			}
		}
		await sendDodoCustomerPortalEmail(ctx, workspaceId);

		return {
			success: true,
			refundAmount: refundSuccess ? finalRefundAmount : 0,
			refundCurrency: subscription?.currency ?? null,
			refundId: refundId ?? null,
			creditAmount: refundSuccess ? 0 : finalRefundAmount,
			creditCurrency: subscription?.currency ?? null,
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
