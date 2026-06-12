// Internal mutations for handling Dodo Payments webhooks
// Intentionally minimal to avoid schema churn during migration.
// We patch workspaces with Dodo subscription identifiers and log payloads.
//
// Security & Idempotency:
// - These handlers are designed to be idempotent by only setting deterministic fields
//   (e.g., setting the same dodoSubscriptionId repeatedly is safe).
// - For stronger idempotency, introduce a dedicated events table keyed by event_id.

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
} from "./_generated/server";

const BILLABLE_MEMBER_ROLES = new Set(["owner", "admin", "member"]);
const INACTIVE_SUBSCRIPTION_STATUSES = new Set([
	"cancelled",
	"canceled",
	"expired",
	"failed",
]);

export const checkWebhook = internalQuery({
	args: {
		webhookId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("webhookEvents")
			.withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
			.unique();
		return Boolean(existing);
	},
});

export const recordWebhook = internalMutation({
	args: {
		webhookId: v.string(),
		eventType: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("webhookEvents")
			.withIndex("by_webhook_id", (q) => q.eq("webhookId", args.webhookId))
			.unique();
		if (existing) {
			return { recorded: false };
		}

		await ctx.db.insert("webhookEvents", {
			webhookId: args.webhookId,
			eventType: args.eventType,
			processedAt: Date.now(),
		});
		return { recorded: true };
	},
});

export const markDodoSyncManualReview = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) return { ok: false, reason: "workspace_not_found" };

		await ctx.db.patch(args.workspaceId, {
			needsDodoReview: true,
			dodoReviewReason: args.reason,
			dodoReviewUpdatedAt: Date.now(),
		});
		await ctx.db.insert("billingAuditLogs", {
			workspaceId: args.workspaceId,
			action: "dodo_manual_review_required",
			previousValue: {
				plan: workspace.plan ?? null,
				quantity: workspace.totalPaidSeats ?? 0,
			},
			newValue: {
				plan: workspace.plan ?? null,
				quantity: workspace.totalPaidSeats ?? 0,
			},
			timestamp: Date.now(),
		});

		return { ok: true };
	},
});

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

type BillingEmailDetails = {
	invoiceUrl?: string;
	amountDue?: number;
	currency?: string;
	taxAmount?: number;
	usedAmount?: number;
	refundAmount?: number;
	refundCurrency?: string;
};

type WorkspaceBillingPatch = {
	subscriptionId?: string;
	dodoSubscriptionId?: string;
	subscriptionStatus?: string;
	customerId?: string;
	dodoCustomerId?: string;
	plan?: "free" | "pro" | "enterprise";
	proSeats?: number;
	enterpriseSeats?: number;
	totalPaidSeats?: number;
	cancellationAtPeriodEnd?: boolean;
	nextBillingDate?: number;
	currentPeriodEnd?: number;
	scheduledCancellationDate?: number;
	pendingBillingStatus?: "pending_payment" | "expired" | "cleared" | undefined;
	pendingBillingPlan?: undefined;
	pendingBillingQuantity?: undefined;
	pendingBillingCheckoutSessionId?: undefined;
	pendingBillingPaymentUrl?: undefined;
	pendingBillingAmount?: undefined;
	pendingBillingCurrency?: undefined;
	pendingBillingTaxAmount?: undefined;
	pendingBillingCreatedAt?: undefined;
	pendingBillingExpiresAt?: undefined;
	pendingBillingSubscriptionId?: undefined;
};

const notifyAdminsOfPlanChange = async (
	ctx: Pick<MutationCtx, "scheduler">,
	workspaceId: Id<"workspaces">,
	previousPlan: string | null | undefined,
	newPlan: string | undefined,
	billingDetails: BillingEmailDetails = {}
) => {
	if (!newPlan || (previousPlan ?? "free") === newPlan) return;
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
		workspaceId,
		previousPlan: previousPlan ?? "free",
		newPlan,
		changeType: planChangeType(previousPlan, newPlan),
	};
	if (billingDetails.invoiceUrl)
		emailArgs.invoiceUrl = billingDetails.invoiceUrl;
	if (typeof billingDetails.amountDue === "number") {
		emailArgs.amountDue = billingDetails.amountDue;
	}
	if (billingDetails.currency) emailArgs.currency = billingDetails.currency;
	if (typeof billingDetails.taxAmount === "number") {
		emailArgs.taxAmount = billingDetails.taxAmount;
	}
	if (typeof billingDetails.usedAmount === "number") {
		emailArgs.usedAmount = billingDetails.usedAmount;
	}
	if (typeof billingDetails.refundAmount === "number") {
		emailArgs.refundAmount = billingDetails.refundAmount;
	}
	if (billingDetails.refundCurrency) {
		emailArgs.refundCurrency = billingDetails.refundCurrency;
	}
	await ctx.scheduler.runAfter(
		0,
		internal.email.sendWorkspacePlanChangeEmail,
		emailArgs
	);
};

const syncMemberSeatTiers = async (
	ctx: Pick<MutationCtx, "db">,
	workspaceId: Id<"workspaces">,
	plan: "pro" | "enterprise" | "free"
) => {
	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	for (const member of members) {
		if (!BILLABLE_MEMBER_ROLES.has(member.role)) continue;
		await ctx.db.patch(member._id, {
			seatTier: plan === "free" ? undefined : plan,
		});
	}
};

const getBillableMemberCount = async (
	ctx: Pick<MutationCtx, "db">,
	workspaceId: Id<"workspaces">
) => {
	const members = await ctx.db
		.query("members")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.collect();

	return members.filter((member) => BILLABLE_MEMBER_ROLES.has(member.role))
		.length;
};

const findWorkspaceMemberByBillingEmail = async (
	ctx: Pick<MutationCtx, "db">,
	email: string
) => {
	const user = await ctx.db
		.query("users")
		.withIndex("by_email", (q) => q.eq("email", email))
		.first();
	if (!user) return null;

	const memberships = await ctx.db
		.query("members")
		.withIndex("by_user_id", (q) => q.eq("userId", user._id))
		.filter((q) =>
			q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "admin"))
		)
		.collect();

	if (memberships.length === 0) return null;
	if (memberships.length > 1) {
		console.warn(
			`[Billing] Ambiguous workspace mapping for email ${email}: found ${memberships.length} admin/owner memberships. Manual review required.`
		);
		return null;
	}
	return memberships[0];
};

const hasSucceededBillingPayment = async (
	ctx: Pick<MutationCtx, "db">,
	workspaceId: Id<"workspaces">
) => {
	const payment = await ctx.db
		.query("billingHistory")
		.withIndex("by_workspace_id", (q) => q.eq("workspaceId", workspaceId))
		.filter((q) =>
			q.and(
				q.eq(q.field("type"), "payment"),
				q.eq(q.field("status"), "succeeded")
			)
		)
		.first();
	return Boolean(payment);
};

const getEffectiveBilling = (
	workspace: Doc<"workspaces"> | null,
	args: {
		subscriptionId?: string;
		applyPendingBilling?: boolean;
		plan?: "pro" | "enterprise" | "free";
		quantity?: number;
	}
) => {
	const pendingMatchesPayment =
		Boolean(args.subscriptionId) &&
		workspace?.pendingBillingStatus === "pending_payment" &&
		workspace.pendingBillingSubscriptionId === args.subscriptionId;
	const canApplyPendingPayment =
		!pendingMatchesPayment || args.applyPendingBilling !== false;

	if (!canApplyPendingPayment) {
		return { effectivePlan: undefined, effectiveQuantity: undefined };
	}

	const pendingPlan =
		workspace?.pendingBillingPlan === "pro" ||
		workspace?.pendingBillingPlan === "enterprise"
			? workspace.pendingBillingPlan
			: undefined;
	const effectivePlan =
		pendingMatchesPayment && pendingPlan ? pendingPlan : args.plan;

	if (
		pendingMatchesPayment &&
		typeof workspace?.pendingBillingQuantity === "number"
	) {
		return {
			effectivePlan,
			effectiveQuantity: workspace.pendingBillingQuantity,
		};
	}

	return {
		effectivePlan,
		effectiveQuantity:
			typeof args.quantity === "number" && args.quantity > 0
				? args.quantity
				: undefined,
	};
};

// Store payment info (no-op for schema-light approach, but kept for audit/extension)
export const createPayment = internalMutation({
	args: {
		paymentId: v.string(),
		businessId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		subscriptionId: v.optional(v.string()),
		applyPendingBilling: v.optional(v.boolean()),
		plan: v.optional(
			v.union(v.literal("pro"), v.literal("enterprise"), v.literal("free"))
		),
		quantity: v.optional(v.number()),
		customerId: v.optional(v.string()),
		customerEmail: v.optional(v.union(v.string(), v.null())),
		amount: v.number(),
		currency: v.string(),
		status: v.string(),
		taxAmount: v.optional(v.number()),
		invoiceUrl: v.optional(v.string()),
		raw: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billingHistory")
			.withIndex("by_dodo_invoice_id", (q) =>
				q.eq("dodoInvoiceId", args.paymentId)
			)
			.unique();
		if (existing) return { ok: true, reason: "already_recorded" };

		let workspaceObjId: Id<"workspaces"> | undefined;
		if (args.workspaceId) {
			try {
				const workspace = await ctx.db.get(
					args.workspaceId as Id<"workspaces">
				);
				if (workspace) workspaceObjId = workspace._id;
			} catch (err) {
				console.error("Invalid payment workspaceId", err);
			}
		}

		if (!workspaceObjId && args.subscriptionId) {
			const workspace = await ctx.db
				.query("workspaces")
				.withIndex("by_dodo_subscription_id", (q) =>
					q.eq("dodoSubscriptionId", args.subscriptionId as string)
				)
				.first();
			if (workspace) workspaceObjId = workspace._id;
		}

		if (!workspaceObjId) {
			if (args.customerEmail) {
				const member = await findWorkspaceMemberByBillingEmail(
					ctx,
					args.customerEmail
				);
				if (member) workspaceObjId = member.workspaceId;
			}
		}

		if (!workspaceObjId) {
			console.error(
				`[createPayment] Failed to find workspace context for payment ${args.paymentId}`
			);
			return { ok: true, reason: "no_workspace_context" };
		}

		const workspace = await ctx.db.get(workspaceObjId);
		const { effectivePlan, effectiveQuantity } = getEffectiveBilling(
			workspace,
			args
		);

		const historyEntry: {
			workspaceId: Id<"workspaces">;
			amount: number;
			currency: string;
			status: string;
			taxAmount?: number;
			type: "payment";
			description: string;
			plan?: string;
			seats?: number;
			invoiceUrl?: string;
			dodoInvoiceId: string;
			createdAt: number;
		} = {
			workspaceId: workspaceObjId,
			amount: args.amount,
			currency: args.currency,
			status: args.status,
			type: "payment",
			description: effectivePlan
				? `${effectivePlan === "enterprise" ? "Enterprise" : "Pro"} plan payment`
				: "Subscription payment",
			dodoInvoiceId: args.paymentId,
			createdAt: Date.now(),
		};
		if (typeof args.taxAmount === "number") {
			historyEntry.taxAmount = args.taxAmount;
		}
		if (effectivePlan) historyEntry.plan = effectivePlan;
		if (typeof effectiveQuantity === "number")
			historyEntry.seats = effectiveQuantity;
		if (args.invoiceUrl) historyEntry.invoiceUrl = args.invoiceUrl;
		await ctx.db.insert("billingHistory", historyEntry);

		if (effectivePlan === "pro" || effectivePlan === "enterprise") {
			const activeUserCount = await getBillableMemberCount(ctx, workspaceObjId);
			const quantity =
				typeof effectiveQuantity === "number" && effectiveQuantity > 0
					? effectiveQuantity
					: Math.max(1, activeUserCount);

			await ctx.db.patch(workspaceObjId, {
				plan: effectivePlan,
				subscriptionStatus: "active",
				proSeats: effectivePlan === "pro" ? quantity : 0,
				enterpriseSeats: effectivePlan === "enterprise" ? quantity : 0,
				totalPaidSeats: quantity,
				activeUserCount,
				customerId: args.customerId,
				dodoCustomerId: args.customerId,
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
				needsDodoReview: undefined,
				dodoReviewReason: undefined,
				dodoReviewUpdatedAt: undefined,
			});
			console.log("[billing] payment success activated plan", {
				workspaceId: workspaceObjId,
				paymentId: args.paymentId,
				plan: effectivePlan,
				quantity,
			});
			await syncMemberSeatTiers(ctx, workspaceObjId, effectivePlan);
			await notifyAdminsOfPlanChange(
				ctx,
				workspaceObjId,
				workspace?.plan,
				effectivePlan,
				{
					invoiceUrl: args.invoiceUrl,
					amountDue: args.amount,
					currency: args.currency,
					taxAmount: args.taxAmount,
				}
			);
		}

		return { ok: true };
	},
});

export const getPendingSubscriptionChange = internalQuery({
	args: {
		subscriptionId: v.string(),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db
			.query("workspaces")
			.withIndex("by_dodo_subscription_id", (q) =>
				q.eq("dodoSubscriptionId", args.subscriptionId)
			)
			.first();

		if (
			!workspace ||
			workspace.pendingBillingStatus !== "pending_payment" ||
			workspace.pendingBillingSubscriptionId !== args.subscriptionId ||
			!(
				workspace.pendingBillingPlan === "pro" ||
				workspace.pendingBillingPlan === "enterprise"
			) ||
			typeof workspace.pendingBillingQuantity !== "number"
		) {
			return null;
		}

		return {
			workspaceId: workspace._id,
			plan: workspace.pendingBillingPlan,
			quantity: Math.max(1, Math.floor(workspace.pendingBillingQuantity)),
			currentQuantity:
				workspace.pendingBillingPlan === "enterprise"
					? (workspace.enterpriseSeats ?? workspace.totalPaidSeats ?? 0)
					: (workspace.proSeats ?? workspace.totalPaidSeats ?? 0),
			amountDue: workspace.pendingBillingAmount ?? null,
			currency: workspace.pendingBillingCurrency ?? null,
			taxAmount: workspace.pendingBillingTaxAmount ?? null,
		};
	},
});

export const activateEnterprisePlan = internalMutation({
	args: {
		workspaceId: v.id("workspaces"),
		quantity: v.number(),
		paymentId: v.string(),
		customerId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) throw new Error("Workspace not found");

		const activeUserCount = await getBillableMemberCount(ctx, args.workspaceId);
		const quantity = Math.max(
			Math.max(1, activeUserCount),
			Math.floor(args.quantity)
		);
		await ctx.db.patch(args.workspaceId, {
			plan: "enterprise",
			subscriptionStatus: "active",
			proSeats: 0,
			enterpriseSeats: quantity,
			totalPaidSeats: quantity,
			activeUserCount,
			customerId: args.customerId,
			dodoCustomerId: args.customerId,
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
		await syncMemberSeatTiers(ctx, args.workspaceId, "enterprise");
		console.log("[billing] activateEnterprisePlan completed", {
			workspaceId: args.workspaceId,
			paymentId: args.paymentId,
			quantity,
		});
		return { ok: true };
	},
});

interface SubscriptionSyncArgs {
	workspaceId?: string;
	subscriptionId: string;
	status: string;
	plan?: string;
	customerId?: string;
	customerEmail?: string | null;
	quantity?: number;
	cancelAtNextBillingDate?: boolean;
	nextBillingDate?: string;
	invoiceUrl?: string;
	amountDue?: number;
	currency?: string;
	taxAmount?: number;
	paymentConfirmed?: boolean;
	raw?: string;
}

async function processSubscriptionSync(
	ctx: MutationCtx,
	args: SubscriptionSyncArgs,
	contextName: string
) {
	let workspaceObjId: Id<"workspaces"> | undefined;

	if (args.workspaceId) {
		try {
			const workspace = await ctx.db.get(args.workspaceId as Id<"workspaces">);

			if (workspace) {
				workspaceObjId = workspace._id;
			}
		} catch (err) {
			console.error(`[${contextName}] Invalid workspaceId`, err);
		}
	}

	if (!workspaceObjId) {
		const workspace = await ctx.db
			.query("workspaces")
			.withIndex("by_dodo_subscription_id", (q) =>
				q.eq("dodoSubscriptionId", args.subscriptionId)
			)
			.first();
		if (workspace) workspaceObjId = workspace._id;
	}

	if (!workspaceObjId && args.customerId) {
		const workspace = await ctx.db
			.query("workspaces")
			.withIndex("by_dodo_customer_id", (q) =>
				q.eq("dodoCustomerId", args.customerId as string)
			)
			.first();
		if (workspace) workspaceObjId = workspace._id;
	}

	if (!workspaceObjId && args.customerEmail) {
		const member = await findWorkspaceMemberByBillingEmail(
			ctx,
			args.customerEmail
		);
		if (member) workspaceObjId = member.workspaceId;
	}

	if (!workspaceObjId) {
		console.error(
			`[${contextName}] Failed to find workspace context for subscription ${args.subscriptionId}`
		);
		return { ok: true, reason: "no_workspace_context" };
	}

	const previousWorkspace = await ctx.db.get(workspaceObjId);
	const previousPaidPlan =
		previousWorkspace?.plan === "pro" ||
		previousWorkspace?.plan === "enterprise"
			? previousWorkspace.plan
			: null;
	const hasPendingUpgradeForSubscription =
		previousWorkspace?.pendingBillingStatus === "pending_payment" &&
		previousWorkspace.pendingBillingSubscriptionId === args.subscriptionId;
	if (
		previousWorkspace?.needsDodoReview &&
		hasPendingUpgradeForSubscription &&
		args.paymentConfirmed !== true
	) {
		console.warn(
			`[${contextName}] Dodo manual review required before syncing pending billing`,
			{
				workspaceId: workspaceObjId,
				subscriptionId: args.subscriptionId,
				reason: previousWorkspace.dodoReviewReason,
			}
		);
		return { ok: true, reason: "dodo_manual_review_required" };
	}
	const pendingPlan =
		hasPendingUpgradeForSubscription &&
		(previousWorkspace?.pendingBillingPlan === "pro" ||
			previousWorkspace?.pendingBillingPlan === "enterprise")
			? previousWorkspace.pendingBillingPlan
			: null;
	const eventPlan = (
		args.plan === "pro" || args.plan === "enterprise" || args.plan === "free"
			? args.plan
			: null
	) as "pro" | "enterprise" | "free" | null;
	const isStaleSubscriptionEventForPendingUpgrade =
		args.paymentConfirmed !== true &&
		pendingPlan !== null &&
		eventPlan !== null &&
		eventPlan !== pendingPlan;
	if (isStaleSubscriptionEventForPendingUpgrade) {
		console.log(
			`[${contextName}] Ignoring stale subscription event during pending upgrade`,
			{
				workspaceId: workspaceObjId,
				subscriptionId: args.subscriptionId,
				eventPlan,
				pendingPlan,
			}
		);
		return { ok: true, reason: "stale_subscription_event_for_pending_upgrade" };
	}
	const nextPaidPlan =
		(args.paymentConfirmed === true ? pendingPlan : null) ?? eventPlan;
	const nextQuantity =
		typeof args.quantity === "number" && args.quantity > 0
			? args.quantity
			: args.paymentConfirmed === true &&
					hasPendingUpgradeForSubscription &&
					typeof previousWorkspace?.pendingBillingQuantity === "number"
				? previousWorkspace.pendingBillingQuantity
				: undefined;
	const isExistingPaidSubscription =
		(previousWorkspace?.dodoSubscriptionId === args.subscriptionId ||
			previousWorkspace?.subscriptionId === args.subscriptionId) &&
		previousPaidPlan !== null;
	const isPaidPlanOrQuantityChange =
		Boolean(nextPaidPlan) &&
		isExistingPaidSubscription &&
		(previousPaidPlan !== nextPaidPlan ||
			(typeof nextQuantity === "number" &&
				nextQuantity > 0 &&
				nextQuantity !== (previousWorkspace?.totalPaidSeats ?? 0)));
	const hasPriorSucceededPayment = await hasSucceededBillingPayment(
		ctx,
		workspaceObjId
	);
	const hasConfirmedPayment = args.paymentConfirmed === true;
	const canApplyPaidPlan =
		hasConfirmedPayment ||
		args.status === "trialing" ||
		(args.status === "active" &&
			!isPaidPlanOrQuantityChange &&
			previousPaidPlan === nextPaidPlan &&
			hasPriorSucceededPayment);
	const shouldHoldUnpaidActivePlan =
		args.status === "active" &&
		Boolean(nextPaidPlan) &&
		!canApplyPaidPlan &&
		!hasConfirmedPayment;
	const patch: WorkspaceBillingPatch = {
		subscriptionId: args.subscriptionId,
		dodoSubscriptionId: args.subscriptionId,
		subscriptionStatus: args.status,
		customerId: args.customerId,
		dodoCustomerId: args.customerId,
	};
	const isInactive =
		INACTIVE_SUBSCRIPTION_STATUSES.has(args.status) || nextPaidPlan === "free";
	if (isInactive) {
		patch.plan = "free";
		patch.subscriptionId = undefined;
		patch.dodoSubscriptionId = undefined;
		patch.proSeats = 0;
		patch.enterpriseSeats = 0;
		patch.totalPaidSeats = 0;
		patch.cancellationAtPeriodEnd = false;
		patch.nextBillingDate = undefined;
		patch.currentPeriodEnd = undefined;
		patch.scheduledCancellationDate = undefined;
		patch.pendingBillingStatus = undefined;
		patch.pendingBillingPlan = undefined;
		patch.pendingBillingQuantity = undefined;
		patch.pendingBillingCheckoutSessionId = undefined;
		patch.pendingBillingPaymentUrl = undefined;
		patch.pendingBillingAmount = undefined;
		patch.pendingBillingCurrency = undefined;
		patch.pendingBillingTaxAmount = undefined;
		patch.pendingBillingCreatedAt = undefined;
		patch.pendingBillingExpiresAt = undefined;
		patch.pendingBillingSubscriptionId = undefined;
	} else if (shouldHoldUnpaidActivePlan) {
		if (previousPaidPlan && hasPriorSucceededPayment) {
			patch.plan = previousPaidPlan;
		} else {
			patch.plan = "free";
			patch.proSeats = 0;
			patch.enterpriseSeats = 0;
			patch.totalPaidSeats = 0;
		}
	} else if (nextPaidPlan && canApplyPaidPlan) {
		patch.plan = nextPaidPlan;
		const quantity =
			typeof nextQuantity === "number" && nextQuantity > 0
				? nextQuantity
				: Math.max(1, await getBillableMemberCount(ctx, workspaceObjId));
		if (nextPaidPlan === "pro") {
			patch.proSeats = quantity;
			patch.enterpriseSeats = 0;
		}
		if (nextPaidPlan === "enterprise") {
			patch.enterpriseSeats = quantity;
			patch.proSeats = 0;
		}
		patch.totalPaidSeats = quantity;
		if (args.paymentConfirmed === true) {
			patch.pendingBillingStatus = undefined;
			patch.pendingBillingPlan = undefined;
			patch.pendingBillingQuantity = undefined;
			patch.pendingBillingCheckoutSessionId = undefined;
			patch.pendingBillingPaymentUrl = undefined;
			patch.pendingBillingAmount = undefined;
			patch.pendingBillingCurrency = undefined;
			patch.pendingBillingTaxAmount = undefined;
			patch.pendingBillingCreatedAt = undefined;
			patch.pendingBillingExpiresAt = undefined;
			patch.pendingBillingSubscriptionId = undefined;
		}
	}
	if (typeof args.cancelAtNextBillingDate === "boolean") {
		patch.cancellationAtPeriodEnd = args.cancelAtNextBillingDate;
	}
	if (args.nextBillingDate) {
		const nextBillingTime = Date.parse(args.nextBillingDate);
		if (Number.isFinite(nextBillingTime)) {
			patch.nextBillingDate = nextBillingTime;
			patch.currentPeriodEnd = nextBillingTime;
			patch.scheduledCancellationDate = args.cancelAtNextBillingDate
				? nextBillingTime
				: undefined;
		}
	} else if (args.cancelAtNextBillingDate === false) {
		patch.scheduledCancellationDate = undefined;
	}

	await ctx.db.patch(workspaceObjId, patch);
	if (isInactive) {
		await syncMemberSeatTiers(ctx, workspaceObjId, "free");
	} else if (canApplyPaidPlan && nextPaidPlan) {
		await syncMemberSeatTiers(ctx, workspaceObjId, nextPaidPlan);
	}
	await notifyAdminsOfPlanChange(
		ctx,
		workspaceObjId,
		previousWorkspace?.plan,
		patch.plan,
		{
			invoiceUrl: args.invoiceUrl,
			amountDue: args.amountDue,
			currency: args.currency,
			taxAmount: args.taxAmount,
		}
	);

	return { ok: true };
}

// Activate a subscription for a workspace (sets dodoSubscriptionId and optional plan)
export const createSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.string()), // <--- Using string workspace_id now
		subscriptionId: v.string(),
		status: v.string(),
		plan: v.optional(v.string()),
		customerId: v.optional(v.string()),
		customerEmail: v.optional(v.union(v.string(), v.null())),
		quantity: v.optional(v.number()),
		cancelAtNextBillingDate: v.optional(v.boolean()),
		nextBillingDate: v.optional(v.string()),
		invoiceUrl: v.optional(v.string()),
		amountDue: v.optional(v.number()),
		currency: v.optional(v.string()),
		taxAmount: v.optional(v.number()),
		paymentConfirmed: v.optional(v.boolean()),
		raw: v.optional(v.string()),
	},
	handler: (ctx, args) => {
		// Refactored to drop complexity
		return processSubscriptionSync(ctx, args, "createSubscription");
	},
});

// Update subscription (kept minimal; ensures stored subscription id is consistent)
export const updateSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.string()),
		subscriptionId: v.string(),
		status: v.string(),
		plan: v.optional(v.string()),
		customerId: v.optional(v.string()),
		customerEmail: v.optional(v.union(v.string(), v.null())),
		quantity: v.optional(v.number()),
		cancelAtNextBillingDate: v.optional(v.boolean()),
		nextBillingDate: v.optional(v.string()),
		invoiceUrl: v.optional(v.string()),
		amountDue: v.optional(v.number()),
		currency: v.optional(v.string()),
		taxAmount: v.optional(v.number()),
		paymentConfirmed: v.optional(v.boolean()),
		raw: v.optional(v.string()),
	},
	handler: (ctx, args) => {
		// Refactored to drop complexity
		return processSubscriptionSync(ctx, args, "updateSubscription");
	},
});

// Cancel subscription (clears dodoSubscriptionId and resets plan to free)
export const cancelSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.string()),
		subscriptionId: v.string(),
		customerId: v.optional(v.string()),
		raw: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		let workspaceObjId: Id<"workspaces"> | undefined;

		if (args.workspaceId) {
			try {
				const workspace = await ctx.db.get(
					args.workspaceId as Id<"workspaces">
				);

				if (workspace) {
					workspaceObjId = workspace._id;
				}
			} catch (err) {
				console.error("Invalid workspaceId", err);
			}
		}

		if (!workspaceObjId) {
			const workspace = await ctx.db
				.query("workspaces")
				.withIndex("by_dodo_subscription_id", (q) =>
					q.eq("dodoSubscriptionId", args.subscriptionId)
				)
				.first();
			if (workspace) workspaceObjId = workspace._id;
		}

		if (!workspaceObjId && args.customerId) {
			const workspace = await ctx.db
				.query("workspaces")
				.withIndex("by_dodo_customer_id", (q) =>
					q.eq("dodoCustomerId", args.customerId as string)
				)
				.first();
			if (workspace) workspaceObjId = workspace._id;
		}

		if (!workspaceObjId) {
			console.error(
				`[cancelSubscription] Failed to find workspace context for subscription ${args.subscriptionId}`
			);
			return { ok: true, reason: "no_workspace_context" };
		}

		const previousWorkspace = await ctx.db.get(workspaceObjId);

		await ctx.db.patch(workspaceObjId, {
			subscriptionId: undefined,
			dodoSubscriptionId: undefined,
			subscriptionStatus: "cancelled",
			plan: "free",
			proSeats: 0,
			enterpriseSeats: 0,
			totalPaidSeats: 0,
			cancellationAtPeriodEnd: false,
			nextBillingDate: undefined,
			currentPeriodEnd: undefined,
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
		await syncMemberSeatTiers(ctx, workspaceObjId, "free");
		await notifyAdminsOfPlanChange(
			ctx,
			workspaceObjId,
			previousWorkspace?.plan,
			"free"
		);
		return { ok: true };
	},
});
