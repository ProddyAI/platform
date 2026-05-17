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
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";

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
		return !!existing;
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

// Store payment info (no-op for schema-light approach, but kept for audit/extension)
export const createPayment = internalMutation({
	args: {
		paymentId: v.string(),
		businessId: v.optional(v.string()),
		workspaceId: v.optional(v.string()),
		plan: v.optional(v.union(v.literal("pro"), v.literal("enterprise"))),
		quantity: v.optional(v.number()),
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

		if (!workspaceObjId) {
			return { ok: true, reason: "no_workspace_context" };
		}

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
			description: args.plan
				? `${args.plan === "enterprise" ? "Enterprise" : "Pro"} plan payment`
				: "Subscription payment",
			dodoInvoiceId: args.paymentId,
			createdAt: Date.now(),
		};
		if (typeof args.taxAmount === "number") {
			historyEntry.taxAmount = args.taxAmount;
		}
		if (args.plan) historyEntry.plan = args.plan;
		if (typeof args.quantity === "number") historyEntry.seats = args.quantity;
		if (args.invoiceUrl) historyEntry.invoiceUrl = args.invoiceUrl;
		await ctx.db.insert("billingHistory", historyEntry);

		return { ok: true };
	},
});

// Activate a subscription for a workspace (sets dodoSubscriptionId and optional plan)
export const createSubscription = internalMutation({
	args: {
		workspaceId: v.optional(v.string()), // <--- Using string workspace_id now
		subscriptionId: v.string(),
		status: v.string(),
		plan: v.optional(v.string()),
		customerId: v.optional(v.string()),
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
			const workspace = await ctx.db
				.query("workspaces")
				.withIndex("by_dodo_subscription_id", (q) =>
					q.eq("dodoSubscriptionId", args.subscriptionId)
				)
				.first();
			if (workspace) workspaceObjId = workspace._id;
		}

		if (!workspaceObjId) {
			console.error(
				`[createSubscription] Failed to find workspace context for subscription ${args.subscriptionId}`
			);
			return { ok: true, reason: "no_workspace_context" };
		}

		const previousWorkspace = await ctx.db.get(workspaceObjId);
		const canApplyPaidPlan = args.paymentConfirmed === true;
		const patch: WorkspaceBillingPatch = {
			subscriptionId: args.subscriptionId,
			dodoSubscriptionId: args.subscriptionId,
			subscriptionStatus: args.status,
			customerId: args.customerId,
			dodoCustomerId: args.customerId,
		};
		const isInactive = INACTIVE_SUBSCRIPTION_STATUSES.has(args.status);
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
		} else if (
			(args.plan === "pro" || args.plan === "enterprise") &&
			canApplyPaidPlan
		) {
			patch.plan = args.plan;
			if (args.quantity) {
				if (args.plan === "pro") {
					patch.proSeats = args.quantity;
					patch.enterpriseSeats = 0;
				}
				if (args.plan === "enterprise") {
					patch.enterpriseSeats = args.quantity;
					patch.proSeats = 0;
				}
				patch.totalPaidSeats = args.quantity;
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
		} else if (
			canApplyPaidPlan &&
			(args.plan === "pro" || args.plan === "enterprise")
		) {
			await syncMemberSeatTiers(ctx, workspaceObjId, args.plan);
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
				`[updateSubscription] Failed to find workspace context for subscription ${args.subscriptionId}`
			);
			return { ok: true, reason: "no_workspace_context" };
		}

		const previousWorkspace = await ctx.db.get(workspaceObjId);
		const canApplyPaidPlan = args.paymentConfirmed === true;
		const patch: WorkspaceBillingPatch = {
			subscriptionId: args.subscriptionId,
			dodoSubscriptionId: args.subscriptionId,
			subscriptionStatus: args.status,
			customerId: args.customerId,
			dodoCustomerId: args.customerId,
		};
		const isInactive = INACTIVE_SUBSCRIPTION_STATUSES.has(args.status);
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
		} else if (
			(args.plan === "pro" || args.plan === "enterprise") &&
			canApplyPaidPlan
		) {
			patch.plan = args.plan;
			if (args.quantity) {
				if (args.plan === "pro") {
					patch.proSeats = args.quantity;
					patch.enterpriseSeats = 0;
				}
				if (args.plan === "enterprise") {
					patch.enterpriseSeats = args.quantity;
					patch.proSeats = 0;
				}
				patch.totalPaidSeats = args.quantity;
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
		} else if (
			canApplyPaidPlan &&
			(args.plan === "pro" || args.plan === "enterprise")
		) {
			await syncMemberSeatTiers(ctx, workspaceObjId, args.plan);
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
