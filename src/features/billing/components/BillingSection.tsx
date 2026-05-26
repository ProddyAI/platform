"use client";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import {
	CalendarDays,
	CheckCircle2,
	CreditCard,
	Download,
	ExternalLink,
	Loader,
	Lock,
	ReceiptText,
	ShieldCheck,
	Sparkles,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { PLANS, type PlanName } from "@/../convex/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeModal } from "./UpgradeModal";

interface BillingSectionProps {
	workspaceId: Id<"workspaces">;
	currentMember: Doc<"members">;
	showBillingSummary?: boolean;
}

type BillingHistoryEntry = Doc<"billingHistory">;
type BillingAuditLogEntry = Doc<"billingAuditLogs">;

export function BillingSection({
	workspaceId,
	currentMember,
	showBillingSummary = true,
}: BillingSectionProps) {
	const isOwner = currentMember.role === "owner";
	const canManageBilling = isOwner;
	const { isAuthenticated } = useConvexAuth();
	const router = useRouter();
	const subscription = useQuery(
		api.payments.getSubscriptionStatus,
		isAuthenticated ? { workspaceId } : "skip"
	);
	const billingSummary = useQuery(
		api.payments.getBillingSummary,
		isAuthenticated && canManageBilling && showBillingSummary
			? { workspaceId }
			: "skip"
	);
	const billingHistory = (billingSummary?.history ??
		[]) as BillingHistoryEntry[];
	const billingAuditLogs = (billingSummary?.auditLogs ??
		[]) as BillingAuditLogEntry[];
	const createPortal = useAction(api.payments.getCustomerPortal);
	const cancelPlan = useAction(api.payments.cancelSubscription);
	const syncSubscription = useAction(api.payments.syncWorkspaceSubscription);
	const [portalLoading, setPortalLoading] = useState(false);
	const [cancelLoading, setCancelLoading] = useState(false);
	const [billingDetailsOpen, setBillingDetailsOpen] = useState(false);
	const [upgradeOpen, setUpgradeOpen] = useState(false);
	const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");
	const lastSyncedSubscriptionId = useRef<string | null>(null);

	useEffect(() => {
		if (!(canManageBilling && subscription?.dodoSubscriptionId)) return;
		if (lastSyncedSubscriptionId.current === subscription.dodoSubscriptionId) {
			return;
		}

		lastSyncedSubscriptionId.current = subscription.dodoSubscriptionId;
		syncSubscription({ workspaceId }).catch((error) => {
			console.warn("Failed to sync Dodo subscription:", error);
		});
	}, [
		canManageBilling,
		subscription?.dodoSubscriptionId,
		syncSubscription,
		workspaceId,
	]);

	if (!subscription) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!canManageBilling) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in duration-300">
				<div className="bg-amber-100 p-6 rounded-full mb-6">
					<Lock className="size-12 text-amber-600" />
				</div>
				<h2 className="text-2xl font-bold text-gray-900 mb-2">
					Billing is restricted to workspace owners.
				</h2>
				<p className="text-muted-foreground max-w-md mx-auto">
					Only a workspace owner can view payment details, update plans, or
					manage billing. Please contact the workspace owner if you need a
					billing change.
				</p>
			</div>
		);
	}

	const planName = (subscription.plan ?? "free") as PlanName;
	const workspacePlan = PLANS[planName];
	const currentPlan = workspacePlan;
	const hasActiveSubscription =
		planName !== "free" &&
		Boolean(subscription.dodoSubscriptionId) &&
		!["cancelled", "canceled", "expired", "failed"].includes(
			subscription.subscriptionStatus ?? ""
		);
	const canOpenBillingPortal =
		Boolean(subscription.dodoSubscriptionId) ||
		Boolean(subscription.dodoCustomerId) ||
		Boolean(billingSummary?.history?.length);
	const isFreeSeatInPaidWorkspace =
		subscription.memberPlan === "free" && planName !== "free";
	const latestRefund = billingHistory.find((entry) => entry.type === "refund");
	const latestCancellation = billingAuditLogs.find(
		(entry) =>
			entry.action === "subscription_cancelled" ||
			entry.action === "subscription_downgraded_refunded"
	);
	const latestPayment = billingHistory.find(
		(entry) => (entry.type ?? "payment") === "payment"
	);
	const currentSeatCount =
		planName === "enterprise"
			? (subscription.enterpriseSeats ?? 0)
			: planName === "pro"
				? (subscription.proSeats ?? 0)
				: 0;
	const minimumSeatCount = subscription.minimumSeatCount ?? 1;
	const planChangeInitialSeatCount =
		selectedPlan === "enterprise"
			? Math.max(
					subscription.enterpriseSeats ?? 0,
					currentSeatCount,
					minimumSeatCount
				)
			: Math.max(
					subscription.proSeats ?? 0,
					currentSeatCount,
					minimumSeatCount
				);
	const monthlySeatAmount =
		planName === "free"
			? 0
			: currentPlan.pricePerSeatMonthly * 100 * currentSeatCount;
	const latestTaxAmount = latestPayment?.taxAmount ?? 0;
	const paidTotalForDisplay =
		billingSummary && billingSummary.paidTotal > 0
			? billingSummary.paidTotal
			: monthlySeatAmount;
	const taxTotalForDisplay =
		billingSummary && billingSummary.taxTotal > 0
			? billingSummary.taxTotal
			: latestTaxAmount;
	const refundedTotalForDisplay = billingSummary?.refundedTotal ?? 0;
	const planSubtotalForDisplay = Math.max(
		0,
		paidTotalForDisplay - taxTotalForDisplay
	);
	const netPaidForDisplay = Math.max(
		0,
		paidTotalForDisplay - refundedTotalForDisplay
	);
	const latestTotalWithTax =
		latestPayment && latestPayment.amount > 0
			? latestPayment.amount
			: monthlySeatAmount + latestTaxAmount;

	const handleManageBilling = async () => {
		if (!showBillingSummary) {
			router.push(`/workspace/${workspaceId}/manage#billing`);
			return;
		}

		setBillingDetailsOpen(true);
	};

	const handleOpenPaymentPortal = async () => {
		setPortalLoading(true);
		try {
			const url = await createPortal({ workspaceId, send_email: true });
			window.open(url, "_blank");
		} catch (err) {
			console.error("Failed to open billing portal:", err);
		} finally {
			setPortalLoading(false);
		}
	};

	const formatMoney = (amount?: number | null, currency?: string | null) => {
		if (amount === null || amount === undefined || amount < 0) return null;
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: currency || "USD",
			}).format(amount / 100);
		} catch {
			return `${amount} ${currency ?? ""}`.trim();
		}
	};

	const formatBillingDate = (value?: number | null) => {
		if (!value) return "Not available";
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(value));
	};

	const handleCancelPlan = async () => {
		if (
			!window.confirm(
				"Downgrade to Free now? This cancels the paid plan immediately and requests a refund for unused time."
			)
		) {
			return;
		}

		setCancelLoading(true);
		try {
			const result = await cancelPlan({ workspaceId });
			const refundText = formatMoney(
				result?.refundAmount,
				result?.refundCurrency
			);
			toast.success(
				refundText
					? `Plan cancelled. ${refundText} refund requested.`
					: "Plan cancelled. Workspace moved to Free."
			);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to cancel plan";
			console.error("Failed to cancel plan:", message);
			toast.error(message);
		} finally {
			setCancelLoading(false);
		}
	};

	const openPlanChange = (targetPlan: "pro" | "enterprise") => {
		setSelectedPlan(targetPlan);
		setUpgradeOpen(true);
	};

	const getPlanActionLabel = (optionName: PlanName) => {
		if (optionName === "free") return "Downgrade to Free";
		if (planName === "enterprise" && optionName === "pro") {
			return "Downgrade to Pro";
		}
		if (planName === "pro" && optionName === "enterprise") {
			return "Upgrade to Enterprise";
		}
		return `Upgrade to ${PLANS[optionName].label}`;
	};

	const handlePlanAction = (optionName: PlanName) => {
		if (optionName === "free") {
			void handleCancelPlan();
			return;
		}
		openPlanChange(optionName);
	};

	const formatPlanPrice = (plan: (typeof PLANS)[PlanName]) => {
		if (plan.priceDisplayLabel) return plan.priceDisplayLabel;
		if (plan.name === "free") return "Free";
		return `$${plan.pricePerSeatMonthly}`;
	};

	const currentPriceLabel =
		currentPlan.name === "free"
			? "Free"
			: `${formatPlanPrice(currentPlan)}/user/month`;
	const seatLabel =
		planName === "free"
			? "No paid seats"
			: `${currentSeatCount} paid seat${currentSeatCount === 1 ? "" : "s"}`;
	const nextBillingLabel =
		planName === "free"
			? "No active renewal"
			: formatBillingDate(
					subscription.currentPeriodEnd ?? subscription.nextBillingDate
				);

	const billingDetails = showBillingSummary ? (
		<div className="space-y-4">
			{planName !== "free" && (
				<div className="rounded-md border p-3">
					<p className="text-xs text-muted-foreground">Current billing total</p>
					<p className="text-lg font-semibold">
						{formatMoney(
							latestTotalWithTax,
							billingSummary?.currency ?? latestPayment?.currency
						) ?? "$0.00"}
					</p>
					<p className="text-xs text-muted-foreground">
						Includes{" "}
						{formatMoney(
							latestTaxAmount,
							billingSummary?.currency ?? latestPayment?.currency
						) ?? "$0.00"}{" "}
						tax.
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 gap-3 md:grid-cols-4">
				<div className="rounded-md border p-3">
					<p className="text-xs text-muted-foreground">Plan amount</p>
					<p className="text-lg font-semibold">
						{formatMoney(planSubtotalForDisplay, billingSummary?.currency) ??
							"$0.00"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-xs text-muted-foreground">Tax paid</p>
					<p className="text-lg font-semibold">
						{formatMoney(taxTotalForDisplay, billingSummary?.currency) ??
							"$0.00"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-xs text-muted-foreground">Refunded</p>
					<p className="text-lg font-semibold">
						{formatMoney(refundedTotalForDisplay, billingSummary?.currency) ??
							"$0.00"}
					</p>
				</div>
				<div className="rounded-md border p-3">
					<p className="text-xs text-muted-foreground">Deducted / net paid</p>
					<p className="text-lg font-semibold">
						{formatMoney(netPaidForDisplay, billingSummary?.currency) ??
							"$0.00"}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-3 rounded-md border p-3">
				<CalendarDays className="size-5 text-muted-foreground" />
				<div>
					<p className="text-sm font-medium">
						{subscription.cancellationAtPeriodEnd
							? "Scheduled cancellation"
							: planName === "free"
								? latestRefund
									? "Refunded on"
									: "Downgraded to Free"
								: "Next billing date"}
					</p>
					<p className="text-sm text-muted-foreground">
						{subscription.cancellationAtPeriodEnd
							? formatBillingDate(subscription.scheduledCancellationDate)
							: planName === "free"
								? formatBillingDate(
										latestRefund?.createdAt ?? latestCancellation?.timestamp
									)
								: formatBillingDate(
										subscription.currentPeriodEnd ??
											subscription.nextBillingDate
									)}
					</p>
				</div>
			</div>

			<div className="space-y-2">
				<p className="text-sm font-medium">Recent billing activity</p>
				{billingHistory.length ? (
					<div className="max-h-72 divide-y overflow-y-auto rounded-md border">
						{billingHistory.slice(0, 10).map((entry) => (
							<div
								className="flex items-center justify-between gap-4 p-3"
								key={entry._id}
							>
								<div>
									<p className="text-sm font-medium">
										{entry.description ||
											(entry.type === "refund" ? "Refund" : "Payment")}
									</p>
									<p className="text-xs text-muted-foreground">
										{formatBillingDate(entry.createdAt)}
										{entry.seats ? ` - ${entry.seats} seats` : ""}
										{entry.taxAmount
											? ` - tax ${formatMoney(entry.taxAmount, entry.currency)}`
											: ""}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<p
										className={`text-sm font-semibold ${
											entry.type === "refund"
												? "text-emerald-600"
												: "text-foreground"
										}`}
									>
										{entry.type === "refund" ? "-" : ""}
										{formatMoney(entry.amount, entry.currency) ?? "$0.00"}
									</p>
									{entry.invoiceUrl && (
										<Button asChild size="iconSm" variant="outline">
											<a
												aria-label="Download invoice"
												href={entry.invoiceUrl}
												rel="noreferrer"
												target="_blank"
											>
												<Download className="size-4" />
											</a>
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="rounded-md border p-3 text-sm text-muted-foreground">
						No payments recorded yet. New Dodo payments and fair-billing refunds
						will appear here.
					</p>
				)}
			</div>

			{canOpenBillingPortal && (
				<Button
					disabled={portalLoading}
					onClick={handleOpenPaymentPortal}
					variant="outline"
				>
					{portalLoading ? (
						<Loader className="mr-2 size-4 animate-spin" />
					) : (
						<ExternalLink className="mr-2 size-4" />
					)}
					Open payment portal
				</Button>
			)}
		</div>
	) : null;

	return (
		<>
			<div className="space-y-5">
				<Card className="overflow-hidden border-primary/15 shadow-sm">
					<div className="border-b bg-primary/5 px-6 py-5">
						<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
							<div className="min-w-0">
								<div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
									<span className="flex size-8 items-center justify-center rounded-md bg-primary/10">
										<CreditCard className="size-4" />
									</span>
									Current Plan
								</div>
								<div className="flex flex-wrap items-end gap-3">
									<h3 className="text-3xl font-semibold leading-none">
										{currentPlan.label}
									</h3>
									<Badge className="bg-secondary px-3 py-1 text-white hover:bg-secondary">
										{currentPriceLabel}
									</Badge>
								</div>
								<p className="mt-3 max-w-2xl text-sm text-muted-foreground">
									{isFreeSeatInPaidWorkspace ? (
										<>
											You are on a <span className="font-semibold">Free</span>{" "}
											seat. The workspace is on the{" "}
											<span className="font-semibold">
												{workspacePlan.label}
											</span>{" "}
											plan.
										</>
									) : (
										currentPlan.description
									)}
								</p>
							</div>

							<div className="flex flex-col gap-2 sm:flex-row">
								{canOpenBillingPortal && (
									<Button
										className="border-primary/20 bg-white/80 hover:border-primary/40"
										disabled={portalLoading}
										onClick={handleManageBilling}
										variant="outline"
									>
										{portalLoading ? (
											<Loader className="mr-2 size-4 animate-spin" />
										) : (
											<ExternalLink className="mr-2 size-4" />
										)}
										Manage Billing
									</Button>
								)}
								{planName !== "enterprise" ? (
									<Button
										className="bg-secondary px-5 text-white shadow-md hover:bg-secondary/90"
										onClick={() =>
											openPlanChange(planName === "free" ? "pro" : "enterprise")
										}
									>
										<Sparkles className="mr-2 size-4" />
										{planName === "free"
											? "Upgrade Plan"
											: "Upgrade to Enterprise"}
									</Button>
								) : (
									<Button
										className="border-primary/20 bg-white/80 hover:border-primary/40"
										onClick={() => openPlanChange("pro")}
										variant="outline"
									>
										Downgrade to Pro
									</Button>
								)}
							</div>
						</div>
					</div>
					<CardContent className="grid gap-3 p-6 sm:grid-cols-3">
						<div className="rounded-md border bg-background p-4">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<Users className="size-4 text-primary" />
								Seats
							</div>
							<p className="text-xl font-semibold">{seatLabel}</p>
						</div>
						<div className="rounded-md border bg-background p-4">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<CalendarDays className="size-4 text-primary" />
								Billing
							</div>
							<p className="text-xl font-semibold">{nextBillingLabel}</p>
						</div>
						<div className="rounded-md border bg-background p-4">
							<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
								<ShieldCheck className="size-4 text-primary" />
								Status
							</div>
							<p className="text-xl font-semibold capitalize">
								{subscription.subscriptionStatus ?? "active"}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="border-primary/10 shadow-sm">
					<CardHeader className="pb-4">
						<CardTitle className="text-xl">Available Plans</CardTitle>
						<CardDescription>
							Compare plans and choose the best fit for your team
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{(["free", "pro", "enterprise"] as const).map((optionName) => {
								return (
									<PlanOptionCard
										cancelLoading={cancelLoading}
										formatPlanPrice={formatPlanPrice}
										getPlanActionLabel={getPlanActionLabel}
										handlePlanAction={handlePlanAction}
										key={optionName}
										optionName={optionName}
										planName={planName}
									/>
								);
							})}
						</div>
					</CardContent>
				</Card>
			</div>

			<UpgradeModal
				currentPlan={planName}
				hasActiveSubscription={hasActiveSubscription}
				initialSeatCount={planChangeInitialSeatCount}
				minimumSeatCount={minimumSeatCount}
				onOpenChange={setUpgradeOpen}
				open={upgradeOpen}
				targetPlan={selectedPlan}
				workspaceId={workspaceId}
			/>
			<Dialog onOpenChange={setBillingDetailsOpen} open={billingDetailsOpen}>
				<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<ReceiptText className="size-5" />
							Billing Details
						</DialogTitle>
						<DialogDescription>
							Payments, taxes, refunds, invoice links, and billing dates for
							this workspace.
						</DialogDescription>
					</DialogHeader>
					{billingDetails}
				</DialogContent>
			</Dialog>
		</>
	);
}

function PlanOptionCard({
	optionName,
	planName,
	cancelLoading,
	handlePlanAction,
	getPlanActionLabel,
	formatPlanPrice,
}: {
	optionName: PlanName;
	planName: PlanName;
	cancelLoading: boolean;
	handlePlanAction: (optionName: PlanName) => void;
	getPlanActionLabel: (optionName: PlanName) => string;
	formatPlanPrice: (plan: typeof PLANS[PlanName]) => string;
}) {
	const plan = PLANS[optionName];
	const isCurrent = planName === optionName;
	const isPaid = optionName !== "free";
	return (
		<div
			className={`flex min-h-[250px] flex-col rounded-lg border p-5 transition-standard ${
				isCurrent
					? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
					: isPaid
						? "border-primary/40 bg-primary/[0.03] hover:border-primary/70 hover:bg-primary/5"
						: "border-border bg-background hover:border-primary/30"
			}`}
		>
			<PlanOptionHeader formatPlanPrice={formatPlanPrice} isCurrent={isCurrent} plan={plan} />

			<p className="mt-5 flex-1 text-sm leading-6 text-muted-foreground">
				{plan.description}
			</p>

			<PlanOptionAction
				cancelLoading={cancelLoading}
				getPlanActionLabel={getPlanActionLabel}
				handlePlanAction={handlePlanAction}
				isCurrent={isCurrent}
				optionName={optionName}
				planName={planName}
			/>
		</div>
	);
}

function PlanOptionHeader({
	plan,
	isCurrent,
	formatPlanPrice,
}: {
	plan: typeof PLANS[PlanName];
	isCurrent: boolean;
	formatPlanPrice: (plan: typeof PLANS[PlanName]) => string;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div>
				<h4 className="text-base font-semibold">{plan.label}</h4>
				<div className="mt-3 flex items-baseline gap-1">
					<span className="text-3xl font-semibold leading-none">
						{formatPlanPrice(plan)}
					</span>
					{plan.pricePerSeatMonthly > 0 && (
						<span className="text-sm text-muted-foreground">/user/mo</span>
					)}
				</div>
			</div>
			{isCurrent && (
				<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
					<CheckCircle2 className="size-4" />
				</span>
			)}
		</div>
	);
}

function PlanOptionAction({
	optionName,
	planName,
	isCurrent,
	cancelLoading,
	handlePlanAction,
	getPlanActionLabel,
}: {
	optionName: PlanName;
	planName: PlanName;
	isCurrent: boolean;
	cancelLoading: boolean;
	handlePlanAction: (optionName: PlanName) => void;
	getPlanActionLabel: (optionName: PlanName) => string;
}) {
	return (
		<div className="mt-5 border-t pt-4">
			{isCurrent ? (
				<div className="flex h-9 items-center justify-center rounded-[10px] border border-primary/20 bg-background text-sm font-medium text-primary">
					Current Plan
				</div>
			) : (
				<Button
					className={`w-full ${
						optionName !== "free" && planName !== "enterprise"
							? "bg-secondary text-white shadow-md hover:bg-secondary/90"
							: ""
					}`}
					disabled={optionName === "free" && cancelLoading}
					onClick={() => handlePlanAction(optionName)}
					size="sm"
					variant={
						optionName === "free" || planName === "enterprise"
							? "outline"
							: "default"
					}
				>
					{optionName === "free" && cancelLoading ? (
						<>
							<Loader className="mr-2 size-4 animate-spin" />
							Cancelling...
						</>
					) : (
						getPlanActionLabel(optionName)
					)}
				</Button>
			)}
		</div>
	);
}
