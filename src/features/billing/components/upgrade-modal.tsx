"use client";

import { useAction } from "convex/react";
import {
	ArrowRight,
	Check,
	Loader,
	Minus,
	Plus,
	Sparkles,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { PLANS, type PlanName } from "@/../convex/billing/plans";
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

const PLAN_RANK: Record<PlanName, number> = { enterprise: 2, free: 0, pro: 1 };

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

function formatMoney(amount?: number | null, currency?: string | null) {
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
}

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
	const createCheckout = useAction(api.billing.payments.createCheckoutSession);
	const createUpgradeCheckout = useAction(
		api.billing.payments.createUpgradeCheckout
	);
	const getPlanChangePreview = useAction(
		api.billing.payments.getPlanChangePreview
	);
	const getLivePlanPrices = useAction(api.billing.payments.getLivePlanPrices);
	const [loading, setLoading] = useState(false);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [pricesLoading, setPricesLoading] = useState(false);
	const [livePrices, setLivePrices] = useState<{
		pro: number;
		enterprise: number;
	} | null>(null);
	const [fairBillingPreview, setFairBillingPreview] = useState<{
		amountDue?: number;
		refundAmount?: number;
		currency?: string;
		periodEnd?: number | null;
		currentMonthlyAmount?: number;
		nextMonthlyAmount?: number;
	} | null>(null);
	const [previewError, setPreviewError] = useState(false);
	const [previewRetryToken, setPreviewRetryToken] = useState(0);

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

	const proPriceMonthlyCents = livePrices
		? livePrices.pro
		: proPlan.pricePerSeatMonthly * 100;
	const enterprisePriceMonthlyCents = livePrices
		? livePrices.enterprise
		: enterprisePlan.pricePerSeatMonthly * 100;

	const proTotalPriceCents = proPriceMonthlyCents * proSeatCount;
	const enterpriseTotalPriceCents =
		enterprisePriceMonthlyCents * enterpriseSeatCount;
	const selectedSeatCount =
		targetPlan === "enterprise" ? enterpriseSeatCount : proSeatCount;

	useEffect(() => {
		if (open) {
			setPricesLoading(true);
			getLivePlanPrices()
				.then((prices) => setLivePrices(prices))
				.catch((err) => console.warn("Failed to load live prices", err))
				.finally(() => setPricesLoading(false));
		}
	}, [open, getLivePlanPrices]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: previewRetryToken is a manual trigger to refetch after a failed preview
	useEffect(() => {
		if (!open || !hasActiveSubscription || !targetPlan) {
			setFairBillingPreview(null);
			setPreviewError(false);
			return undefined;
		}

		let cancelled = false;
		setPreviewLoading(true);
		setPreviewError(false);
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
					setPreviewError(true);
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
		previewRetryToken,
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
				const result = await createUpgradeCheckout({
					workspaceId,
					planName,
					quantity,
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
				} else if (
					billingResult.status === "payment_required" ||
					billingResult.status === "pending_payment"
				) {
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

	const isDowngradeContext = targetPlan
		? PLAN_RANK[currentPlan] > PLAN_RANK[targetPlan]
		: currentPlan === "enterprise";
	const modalTitle =
		targetPlan && currentPlan === targetPlan
			? "Update your plan"
			: isDowngradeContext
				? "Change your plan"
				: "Upgrade your plan";

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className={
					targetPlan
						? "max-h-[85vh] max-w-xl gap-0 overflow-y-auto p-0"
						: "max-h-[85vh] max-w-4xl gap-0 overflow-y-auto p-0"
				}
			>
				<DialogHeader className="border-b bg-muted/20 px-5 py-4">
					<DialogTitle className="flex items-center gap-3 text-lg">
						<span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
							<Sparkles className="size-4" />
						</span>
						{modalTitle}
					</DialogTitle>
					<DialogDescription className="max-w-xl text-sm leading-5">
						Choose a plan that fits your team. Pricing is per user, per month.
					</DialogDescription>
				</DialogHeader>

				<div
					className={
						targetPlan
							? "px-5 py-4"
							: "grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2"
					}
				>
					{(targetPlan === "pro" || (!targetPlan && currentPlan !== "pro")) && (
						<PlanCard
							badgeClassName="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground"
							badgeLabel="Growth"
							buttonLabel={
								currentPlan === "pro"
									? "Update Pro"
									: currentPlan === "enterprise"
										? "Switch to Pro"
										: "Upgrade to Pro"
							}
							containerClassName="flex min-h-full flex-col rounded-2xl border bg-card shadow-sm"
							decreaseAriaLabel="Decrease Pro seats"
							features={PRO_FEATURES}
							headerClassName="space-y-3 border-b p-4"
							increaseAriaLabel="Increase Pro seats"
							loading={loading}
							maxSeats={maxSeats}
							onDecreaseSeat={() => {
								setProSeatCount(Math.max(requiredSeats, proSeatCount - 1));
							}}
							onIncreaseSeat={() => {
								setProSeatCount(Math.min(maxSeats, proSeatCount + 1));
							}}
							onSeatInputCommit={setProSeatCount}
							onUpgrade={() => {
								handleUpgrade("pro");
							}}
							planDescription={proPlan.description}
							planLabel={proPlan.label}
							priceMonthlyCents={proPriceMonthlyCents}
							pricesLoading={pricesLoading}
							requiredSeats={requiredSeats}
							seatCount={proSeatCount}
							totalPriceCents={proTotalPriceCents}
						/>
					)}

					{(targetPlan === "enterprise" ||
						(!targetPlan && currentPlan !== "enterprise")) && (
						<PlanCard
							badgeClassName="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
							badgeLabel="Scale"
							buttonLabel={
								currentPlan === "enterprise"
									? "Update Enterprise"
									: "Switch to Enterprise"
							}
							containerClassName="flex min-h-full flex-col rounded-2xl border border-primary/20 bg-card shadow-sm ring-1 ring-primary/30"
							decreaseAriaLabel="Decrease Enterprise seats"
							features={ENTERPRISE_FEATURES}
							headerClassName="space-y-3 border-b bg-primary/5 p-4"
							increaseAriaLabel="Increase Enterprise seats"
							loading={loading}
							maxSeats={maxSeats}
							onDecreaseSeat={() => {
								setEnterpriseSeatCount(
									Math.max(requiredSeats, enterpriseSeatCount - 1)
								);
							}}
							onIncreaseSeat={() => {
								setEnterpriseSeatCount(
									Math.min(maxSeats, enterpriseSeatCount + 1)
								);
							}}
							onSeatInputCommit={setEnterpriseSeatCount}
							onUpgrade={() => {
								handleUpgrade("enterprise");
							}}
							planDescription={enterprisePlan.description}
							planLabel={enterprisePlan.label}
							priceMonthlyCents={enterprisePriceMonthlyCents}
							pricesLoading={pricesLoading}
							requiredSeats={requiredSeats}
							seatCount={enterpriseSeatCount}
							totalPriceCents={enterpriseTotalPriceCents}
						/>
					)}
				</div>

				{targetPlan && (
					<div className="mx-5 mb-5 rounded-xl border bg-muted/20 p-3 text-sm">
						<div className="flex items-center justify-between gap-4">
							<span className="font-medium">Fair billing today</span>
							<span className="text-muted-foreground">
								{previewLoading ? "Calculating..." : "Prorated for time used"}
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
									<p className="font-semibold text-success">
										{formatMoney(
											fairBillingPreview.refundAmount,
											fairBillingPreview.currency
										)}
									</p>
								</div>
							</div>
						) : hasActiveSubscription && previewLoading ? (
							<p className="mt-1 text-muted-foreground">
								Fetching your current usage...
							</p>
						) : hasActiveSubscription && previewError ? (
							<div className="mt-1 flex items-center justify-between gap-3">
								<p className="text-muted-foreground">
									Couldn't load your billing preview.
								</p>
								<Button
									className="h-7 px-2 text-xs"
									onClick={() => {
										setPreviewRetryToken((token) => token + 1);
									}}
									size="sm"
									variant="outline"
								>
									Retry
								</Button>
							</div>
						) : (
							<p className="mt-1 text-muted-foreground">
								New subscriptions start with the selected monthly seat total.
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

function PlanFeatures({ features }: { features: string[] }) {
	return (
		<ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
			{features.map((feature) => (
				<li className="flex items-center gap-2 text-sm leading-5" key={feature}>
					<Check className="size-4 shrink-0 text-success" />
					<span>{feature}</span>
				</li>
			))}
		</ul>
	);
}

interface PlanCardProps {
	badgeClassName: string;
	badgeLabel: string;
	buttonLabel: string;
	containerClassName: string;
	decreaseAriaLabel: string;
	features: string[];
	headerClassName: string;
	increaseAriaLabel: string;
	loading: boolean;
	maxSeats: number;
	onDecreaseSeat: () => void;
	onIncreaseSeat: () => void;
	onSeatInputCommit: (seats: number) => void;
	onUpgrade: () => void;
	planDescription: string;
	planLabel: string;
	priceMonthlyCents: number;
	pricesLoading: boolean;
	requiredSeats: number;
	seatCount: number;
	totalPriceCents: number;
}

function PlanCard({
	badgeClassName,
	badgeLabel,
	buttonLabel,
	containerClassName,
	decreaseAriaLabel,
	features,
	headerClassName,
	increaseAriaLabel,
	loading,
	maxSeats,
	onDecreaseSeat,
	onIncreaseSeat,
	onSeatInputCommit,
	onUpgrade,
	planDescription,
	planLabel,
	priceMonthlyCents,
	pricesLoading,
	requiredSeats,
	seatCount,
	totalPriceCents,
}: PlanCardProps) {
	return (
		<div className={containerClassName}>
			<div className={headerClassName}>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-lg font-semibold">{planLabel}</h3>
						<p className="mt-1 text-sm leading-5 text-muted-foreground">
							{planDescription}
						</p>
					</div>
					<span className={badgeClassName}>{badgeLabel}</span>
				</div>
				<div className="flex items-end gap-2">
					<p className="text-3xl font-semibold tracking-normal">
						{pricesLoading ? (
							<Loader className="mb-1 size-6 animate-spin text-muted-foreground" />
						) : (
							formatMoney(priceMonthlyCents)
						)}
					</p>
					<span className="pb-1 text-sm text-muted-foreground">
						per user / month
					</span>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-4 p-4">
				<div className="rounded-xl border bg-muted/20 p-3">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<span className="flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
								<Users className="size-4" />
							</span>
							<div>
								<p className="text-sm font-medium">Seats</p>
								<p className="text-xs text-muted-foreground">
									Minimum {requiredSeats} required
								</p>
							</div>
						</div>
						<div className="flex items-center rounded-full border bg-card p-1 shadow-sm">
							<Button
								aria-label={decreaseAriaLabel}
								className="size-8 rounded-full border-0 shadow-none"
								disabled={seatCount <= requiredSeats}
								onClick={onDecreaseSeat}
								size="icon"
								variant="outline"
							>
								<Minus className="size-4" />
							</Button>
							<input
								aria-label={`${planLabel} seat count`}
								className="w-12 rounded-md border-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
								defaultValue={seatCount}
								inputMode="numeric"
								key={seatCount}
								onBlur={(event) => {
									const parsed = Number.parseInt(event.target.value, 10);
									const next = Number.isNaN(parsed)
										? seatCount
										: Math.min(maxSeats, Math.max(requiredSeats, parsed));
									event.target.value = String(next);
									onSeatInputCommit(next);
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
									}
								}}
								type="text"
							/>
							<Button
								aria-label={increaseAriaLabel}
								className="size-8 rounded-full border-0 shadow-none"
								disabled={seatCount >= maxSeats}
								onClick={onIncreaseSeat}
								size="icon"
								variant="outline"
							>
								<Plus className="size-4" />
							</Button>
						</div>
					</div>
					<div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
						<span className="text-muted-foreground">Monthly total</span>
						<span className="font-semibold text-foreground">
							{pricesLoading ? (
								<Loader className="mx-1 inline size-3 animate-spin" />
							) : (
								formatMoney(totalPriceCents)
							)}
							/month
						</span>
					</div>
				</div>

				<PlanFeatures features={features} />

				<Button
					className="mt-auto h-10 w-full"
					disabled={loading}
					onClick={onUpgrade}
					variant="primary"
				>
					{loading ? (
						<>
							<Loader className="mr-2 size-4 animate-spin" />
							Processing...
						</>
					) : (
						<>
							{buttonLabel}
							<ArrowRight className="ml-2 size-4" />
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
