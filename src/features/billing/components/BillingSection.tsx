"use client";

import { useAction, useQuery } from "convex/react";
import {
	CalendarDays,
	CreditCard,
	Download,
	ExternalLink,
	Loader,
	Lock,
	ReceiptText,
	Sparkles,
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

export function BillingSection({
	workspaceId,
	currentMember,
	showBillingSummary = true,
}: BillingSectionProps) {
	const isOwner = currentMember.role === "owner";
	const isAdmin = currentMember.role === "admin";
	const canManageBilling = isOwner || isAdmin;
	const router = useRouter();
	const subscription = useQuery(api.payments.getSubscriptionStatus, {
		workspaceId,
	});
	const billingSummary = useQuery(
		api.payments.getBillingSummary,
		canManageBilling && showBillingSummary ? { workspaceId } : "skip"
	);
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
		void syncSubscription({ workspaceId }).catch((error) => {
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
					You do not have permission to access billing settings.
				</h2>
				<p className="text-muted-foreground max-w-md mx-auto">
					Only workspace owners and admins can manage billing. Please contact
					your administrator if you believe this is an error.
				</p>
			</div>
		);
	}

	const planName = (subscription.plan ?? "free") as PlanName;
	const workspacePlan = PLANS[planName];
	const currentPlan = workspacePlan;
	const hasActiveSubscription =
		planName !== "free" &&
		subscription.subscriptionStatus === "active" &&
		Boolean(subscription.dodoSubscriptionId);
	const canOpenBillingPortal =
		Boolean(subscription.dodoSubscriptionId) ||
		Boolean(subscription.dodoCustomerId) ||
		Boolean(billingSummary?.history?.length);
	const isFreeSeatInPaidWorkspace =
		subscription.memberPlan === "free" && planName !== "free";
	const latestRefund = billingSummary?.history?.find(
		(entry) => entry.type === "refund"
	);
	const latestCancellation = billingSummary?.auditLogs?.find(
		(entry) =>
			entry.action === "subscription_cancelled" ||
			entry.action === "subscription_downgraded_refunded"
	);
	const latestPayment = billingSummary?.history?.find(
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
			: Math.max(subscription.proSeats ?? 0, currentSeatCount, minimumSeatCount);
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
		} catch (err: any) {
			console.error("Failed to cancel plan:", err);
			toast.error(err?.message || "Failed to cancel plan");
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
				{billingSummary?.history?.length ? (
					<div className="max-h-72 divide-y overflow-y-auto rounded-md border">
						{billingSummary.history.slice(0, 10).map((entry) => (
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
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="size-5" />
							Current Plan
						</CardTitle>
						<CardDescription>
							{isFreeSeatInPaidWorkspace ? (
								<>
									You are on a <span className="font-semibold">Free</span> seat.
									The workspace is on the{" "}
									<span className="font-semibold">{workspacePlan.label}</span>{" "}
									plan.
								</>
							) : (
								<>
									Your workspace is on the{" "}
									<span className="font-semibold">{currentPlan.label}</span>{" "}
									plan
								</>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h3 className="text-2xl font-bold">{currentPlan.label}</h3>
									<Badge
										variant={
											currentPlan.name === "enterprise"
												? "default"
												: currentPlan.name === "pro"
													? "secondary"
													: "outline"
										}
									>
										{currentPlan.priceDisplayLabel
											? currentPlan.priceDisplayLabel
											: currentPlan.name === "free"
												? "Free"
												: `$${currentPlan.pricePerSeatMonthly}/user/month`}
									</Badge>
								</div>
								<p className="text-sm text-muted-foreground">
									{currentPlan.description}
								</p>
							</div>

							<div className="flex gap-2">
								{canOpenBillingPortal && (
									<Button
										disabled={portalLoading}
										onClick={handleManageBilling}
										variant="outline"
									>
										{portalLoading ? (
											<Loader className="size-4 animate-spin mr-2" />
										) : (
											<ExternalLink className="size-4 mr-2" />
										)}
										Manage Billing
									</Button>
								)}
								{planName !== "enterprise" ? (
									<Button
										onClick={() =>
											openPlanChange(planName === "free" ? "pro" : "enterprise")
										}
									>
										<Sparkles className="size-4 mr-2" />
										{planName === "free" ? "Upgrade" : "Upgrade to Enterprise"}
									</Button>
								) : (
									<Button
										onClick={() => openPlanChange("pro")}
										variant="outline"
									>
										Downgrade to Pro
									</Button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Available Plans</CardTitle>
						<CardDescription>
							Compare plans and choose the best fit for your team
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{(["free", "pro", "enterprise"] as const).map((optionName) => {
								const plan = PLANS[optionName];
								const isCurrent = planName === optionName;
								return (
									<div
										className={`rounded-lg border p-4 flex flex-col h-full ${
											isCurrent ||
											optionName === "pro" ||
											optionName === "enterprise"
												? "border-primary bg-primary/5"
												: "border-border"
										}`}
										key={optionName}
									>
										<div className="mb-3">
											<h4 className="font-semibold">{plan.label}</h4>
											<p className="text-2xl font-bold mt-1">
												{optionName === "enterprise" ? (
													<>
														{plan.priceDisplayLabel}
														<span className="text-sm font-normal text-muted-foreground">
															/user/mo
														</span>
													</>
												) : plan.pricePerSeatMonthly === 0 ? (
													"Free"
												) : (
													<>
														${plan.pricePerSeatMonthly}
														<span className="text-sm font-normal text-muted-foreground">
															/user/mo
														</span>
													</>
												)}
											</p>
										</div>
										<div className="flex-grow">
											<p className="text-sm text-muted-foreground mb-3">
												{plan.description}
											</p>
										</div>
										{isCurrent ? (
											<Badge
												className="w-full justify-center"
												variant="outline"
											>
												Current Plan
											</Badge>
										) : (
											<Button
												className="w-full"
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
														<Loader className="size-4 animate-spin mr-2" />
														Cancelling...
													</>
												) : (
													getPlanActionLabel(optionName)
												)}
											</Button>
										)}
									</div>
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
