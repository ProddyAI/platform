"use client";

import { useAction } from "convex/react";
import { Check, Loader, Minus, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { PLANS, type PlanName } from "@/../convex/plans";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
	workspaceId: Id<"workspaces">;
	currentPlan: PlanName;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	targetPlan?: "pro" | "enterprise";
	initialSeatCount?: number;
	minimumSeatCount?: number;
	hasActiveSubscription?: boolean;
}

const PRO_FEATURES = [
	"1,000 AI Requests",
	"500 Diagram Generations",
	"500 Summaries",
	"50,000 Messages",
	"1,000 Tasks",
	"50 Channels",
	"20 Boards",
	"500 Notes",
];

const ENTERPRISE_FEATURES = [
	"Unlimited AI Requests",
	"Unlimited Diagram Generations",
	"Unlimited Summaries",
	"Unlimited Messages",
	"Unlimited Tasks",
	"Unlimited Channels",
	"Unlimited Boards",
	"Unlimited Notes",
];

export function UpgradeModal({
	workspaceId,
	currentPlan,
	open,
	onOpenChange,
	targetPlan,
	initialSeatCount = 1,
	minimumSeatCount = 1,
	hasActiveSubscription = false,
}: UpgradeModalProps) {
	const createCheckout = useAction(api.payments.createCheckoutSession);
	const updateQuantity = useAction(api.payments.updateSubscriptionQuantity);
	const getPlanChangePreview = useAction(api.payments.getPlanChangePreview);
	const [loading, setLoading] = useState(false);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [fairBillingPreview, setFairBillingPreview] = useState<{
		amountDue?: number;
		refundAmount?: number;
		currency?: string;
		periodEnd?: number | null;
		currentMonthlyAmount?: number;
		nextMonthlyAmount?: number;
	} | null>(null);

	const requiredSeats = Math.max(1, minimumSeatCount);
	const maxSeats = Math.max(1000, requiredSeats);
	const clampedInitialSeats = Math.min(
		Math.max(initialSeatCount, requiredSeats),
		maxSeats
	);

	const [proSeatCount, setProSeatCount] = useState(clampedInitialSeats);
	const [enterpriseSeatCount, setEnterpriseSeatCount] =
		useState(clampedInitialSeats);

	useEffect(() => {
		if (!open) return;
		setProSeatCount(clampedInitialSeats);
		setEnterpriseSeatCount(clampedInitialSeats);
	}, [open, clampedInitialSeats]);

	const proPlan = PLANS.pro;
	const enterprisePlan = PLANS.enterprise;
	const proTotalPrice = proPlan.pricePerSeatMonthly * proSeatCount;
	const enterpriseTotalPrice =
		enterprisePlan.pricePerSeatMonthly * enterpriseSeatCount;
	const selectedSeatCount =
		targetPlan === "enterprise" ? enterpriseSeatCount : proSeatCount;

	const formatMoney = (amount?: number | null, currency?: string | null) => {
		if (amount === null || amount === undefined || amount === 0) return "$0.00";
		try {
			const formatted = new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: currency || "USD",
			}).format(Math.abs(amount) / 100);
			if (amount < 0) return `-${formatted}`;
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: currency || "USD",
			}).format(amount / 100);
		} catch {
			return `${amount} ${currency ?? ""}`.trim();
		}
	};

	useEffect(() => {
		if (!open || !hasActiveSubscription || !targetPlan) {
			setFairBillingPreview(null);
			return;
		}

		let cancelled = false;
		setPreviewLoading(true);
		getPlanChangePreview({
			workspaceId,
			newPlan: targetPlan,
			newQuantity: selectedSeatCount,
		})
			.then((preview) => {
				if (!cancelled) {
					setFairBillingPreview(preview);
				}
			})
			.catch((error) => {
				console.warn("Failed to load fair billing preview:", error);
				if (!cancelled) {
					setFairBillingPreview(null);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setPreviewLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [
		getPlanChangePreview,
		hasActiveSubscription,
		open,
		selectedSeatCount,
		targetPlan,
		workspaceId,
	]);

	const startCheckout = async (
		planName: "pro" | "enterprise",
		quantity: number
	) => {
		const url = await createCheckout({
			workspaceId,
			planName,
			quantity,
		});
		window.location.href = url;
	};

	const handleUpgrade = async (planName: "pro" | "enterprise") => {
		const quantity = planName === "pro" ? proSeatCount : enterpriseSeatCount;
		if (quantity < requiredSeats) {
			toast.error(
				`Choose at least ${requiredSeats} seats to cover every workspace member.`
			);
			return;
		}

		setLoading(true);
		try {
			if (hasActiveSubscription) {
				const result = await updateQuantity({
					workspaceId,
					newPlan: planName,
					newQuantity: quantity,
				});
				const billingResult = result as {
					status?: string;
					message?: string;
					paymentUrl?: string | null;
					amountDue?: number;
					refundAmount?: number;
					refundCurrency?: string | null;
					currency?: string | null;
				};
				if (
					billingResult.status === "billing_permission_required" ||
					billingResult.status === "billing_provider_error" ||
					billingResult.status === "previous_payment_pending"
				) {
					toast.error(
						billingResult.message || "Billing permissions need updating."
					);
				} else if (billingResult.status === "payment_required") {
					if (billingResult.paymentUrl) {
						window.location.href = billingResult.paymentUrl;
						return;
					}
					toast.info(
						billingResult.message ||
							"Complete the payment flow. Your plan will update after payment succeeds."
					);
				} else if (billingResult.status === "pending_plan_change") {
					toast.info(
						billingResult.message || "A plan change is already processing."
					);
				} else if (billingResult.status === "inactive_subscription") {
					await startCheckout(planName, quantity);
					return;
				} else if (billingResult.status === "updated") {
					const refundText = formatMoney(
						billingResult.refundAmount,
						billingResult.refundCurrency ?? billingResult.currency
					);
					toast.success(
						billingResult.refundAmount && billingResult.refundAmount > 0
							? `Plan updated. ${refundText} refund requested.`
							: billingResult.message || "Plan updated."
					);
				} else {
					toast.info(
						`Payment started for ${PLANS[planName].label}. Your workspace will update after Dodo confirms it.`
					);
				}
				onOpenChange(false);
				return;
			}

			await startCheckout(planName, quantity);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to update plan";
			console.error("Failed to update plan:", message);
			toast.error(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className={targetPlan ? "max-w-md" : "max-w-2xl"}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="size-5" />
						Upgrade Your Plan
					</DialogTitle>
					<DialogDescription>
						Choose a plan that fits your team. Pricing is per user, per month.
					</DialogDescription>
				</DialogHeader>

				<div
					className={
						targetPlan ? "mt-4" : "grid grid-cols-1 md:grid-cols-2 gap-6 mt-4"
					}
				>
					{(targetPlan === "pro" || (!targetPlan && currentPlan !== "pro")) && (
						<div className="rounded-lg border border-primary p-5 space-y-4">
							<div>
								<h3 className="text-lg font-semibold">{proPlan.label}</h3>
								<p className="text-2xl font-bold mt-1">
									${proPlan.pricePerSeatMonthly}
									<span className="text-sm font-normal text-muted-foreground">
										/user/mo
									</span>
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{proPlan.description}
								</p>
							</div>

							<div className="rounded-md border p-3 space-y-2">
								<p className="text-sm font-medium">Number of users</p>
								<div className="flex items-center gap-3">
									<Button
										aria-label="Decrease Pro seats"
										className="h-8 w-8"
										disabled={proSeatCount <= requiredSeats}
										onClick={() => {
											setProSeatCount(
												Math.max(requiredSeats, proSeatCount - 1)
											);
										}}
										size="icon"
										variant="outline"
									>
										<Minus className="size-4" />
									</Button>
									<span className="text-lg font-semibold tabular-nums w-8 text-center">
										{proSeatCount}
									</span>
									<Button
										aria-label="Increase Pro seats"
										className="h-8 w-8"
										disabled={proSeatCount >= maxSeats}
										onClick={() => {
											setProSeatCount(Math.min(maxSeats, proSeatCount + 1));
										}}
										size="icon"
										variant="outline"
									>
										<Plus className="size-4" />
									</Button>
								</div>
								<p className="text-sm text-muted-foreground">
									Total:{" "}
									<span className="font-semibold text-foreground">
										${proTotalPrice}/month
									</span>
								</p>
								<p className="text-xs text-muted-foreground">
									Minimum {requiredSeats} seats required for all active
									workspace members.
								</p>
							</div>

							<ul className="space-y-2">
								{PRO_FEATURES.map((feature) => (
									<li className="flex items-center gap-2 text-sm" key={feature}>
										<Check className="size-4 text-green-500 shrink-0" />
										<span>{feature}</span>
									</li>
								))}
							</ul>

							<Button
								className="w-full"
								disabled={loading}
								onClick={() => {
									handleUpgrade("pro");
								}}
								variant="secondary"
							>
								{loading ? (
									<>
										<Loader className="size-4 animate-spin mr-2" />
										Processing...
									</>
								) : (
									<>
										<Sparkles className="size-4 mr-2" />
										{currentPlan === "pro"
											? "Update Pro"
											: currentPlan === "enterprise"
												? "Switch to Pro"
												: "Upgrade to Pro"}
									</>
								)}
							</Button>
						</div>
					)}

					{(targetPlan === "enterprise" ||
						(!targetPlan && currentPlan !== "enterprise")) && (
						<div className="rounded-lg border border-primary p-5 space-y-4">
							<div>
								<h3 className="text-lg font-semibold">
									{enterprisePlan.label}
								</h3>
								<p className="text-2xl font-bold mt-1">
									{enterprisePlan.priceDisplayLabel ?? "Custom"}
									<span className="text-sm font-normal text-muted-foreground">
										/user/mo
									</span>
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{enterprisePlan.description}
								</p>
							</div>

							<div className="rounded-md border p-3 space-y-2">
								<p className="text-sm font-medium">Number of users</p>
								<div className="flex items-center gap-3">
									<Button
										aria-label="Decrease Enterprise seats"
										className="h-8 w-8"
										disabled={enterpriseSeatCount <= requiredSeats}
										onClick={() => {
											setEnterpriseSeatCount(
												Math.max(requiredSeats, enterpriseSeatCount - 1)
											);
										}}
										size="icon"
										variant="outline"
									>
										<Minus className="size-4" />
									</Button>
									<span className="text-lg font-semibold tabular-nums w-8 text-center">
										{enterpriseSeatCount}
									</span>
									<Button
										aria-label="Increase Enterprise seats"
										className="h-8 w-8"
										disabled={enterpriseSeatCount >= maxSeats}
										onClick={() => {
											setEnterpriseSeatCount(
												Math.min(maxSeats, enterpriseSeatCount + 1)
											);
										}}
										size="icon"
										variant="outline"
									>
										<Plus className="size-4" />
									</Button>
								</div>
								<p className="text-sm text-muted-foreground">
									Total:{" "}
									<span className="font-semibold text-foreground">
										${enterpriseTotalPrice}/month
									</span>
								</p>
								<p className="text-xs text-muted-foreground">
									Minimum {requiredSeats} seats required for all active
									workspace members.
								</p>
							</div>

							<ul className="space-y-2">
								{ENTERPRISE_FEATURES.map((feature) => (
									<li className="flex items-center gap-2 text-sm" key={feature}>
										<Check className="size-4 text-green-500 shrink-0" />
										<span>{feature}</span>
									</li>
								))}
							</ul>

							<Button
								className="w-full"
								disabled={loading}
								onClick={() => {
									handleUpgrade("enterprise");
								}}
								variant="secondary"
							>
								{loading ? (
									<>
										<Loader className="size-4 animate-spin mr-2" />
										Processing...
									</>
								) : (
									<>
										<Sparkles className="size-4 mr-2" />
										{currentPlan === "enterprise"
											? "Update Enterprise"
											: "Switch to Enterprise"}
									</>
								)}
							</Button>
						</div>
					)}
				</div>

				{targetPlan && (
					<div className="mt-4 rounded-md border p-3 text-sm">
						<div className="flex items-center justify-between gap-4">
							<span className="font-medium">Fair billing today</span>
							<span className="text-muted-foreground">
								{previewLoading ? "Calculating..." : "Prorated unused period"}
							</span>
						</div>
						{hasActiveSubscription && fairBillingPreview ? (
							<div className="mt-2 grid grid-cols-2 gap-3">
								<div>
									<p className="text-xs text-muted-foreground">Pay now</p>
									<p className="font-semibold">
										{formatMoney(
											fairBillingPreview.amountDue,
											fairBillingPreview.currency
										)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">Refund</p>
									<p className="font-semibold text-emerald-600">
										{formatMoney(
											fairBillingPreview.refundAmount,
											fairBillingPreview.currency
										)}
									</p>
								</div>
							</div>
						) : (
							<p className="mt-2 text-muted-foreground">
								New subscriptions start with the selected monthly seat total.
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
