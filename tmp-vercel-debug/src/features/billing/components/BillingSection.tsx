"use client";

import { useAction, useQuery } from "convex/react";
import { CreditCard, ExternalLink, Loader, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
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
import { UpgradeModal } from "./UpgradeModal";

interface BillingSectionProps {
	workspaceId: Id<"workspaces">;
}

export function BillingSection({ workspaceId }: BillingSectionProps) {
	const subscription = useQuery(api.payments.getSubscriptionStatus, {
		workspaceId,
	});
	const createPortal = useAction(api.payments.getCustomerPortal);
	const [portalLoading, setPortalLoading] = useState(false);
	const [upgradeOpen, setUpgradeOpen] = useState(false);

	if (!subscription) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const currentPlan = PLANS[(subscription.plan as PlanName) ?? "free"];
	const isPaid =
		subscription.plan !== "free" && (subscription as any).dodoSubscriptionId;

	const handleManageBilling = async () => {
		setPortalLoading(true);
		try {
			const url = await createPortal({ send_email: false });
			window.open(url, "_blank");
		} catch (err) {
			console.error("Failed to open billing portal:", err);
		} finally {
			setPortalLoading(false);
		}
	};

	return (
		<>
			<div className="space-y-6">
				{/* Current Plan */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="size-5" />
							Current Plan
						</CardTitle>
						<CardDescription>
							Your workspace is on the{" "}
							<span className="font-semibold">{currentPlan.label}</span> plan
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
								{isPaid && (
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
								{subscription.plan !== "enterprise" && (
									<Button onClick={() => setUpgradeOpen(true)}>
										<Sparkles className="size-4 mr-2" />
										{subscription.plan === "free"
											? "Upgrade"
											: "Upgrade to Enterprise"}
									</Button>
								)}
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Plan Comparison */}
				<Card>
					<CardHeader>
						<CardTitle>Available Plans</CardTitle>
						<CardDescription>
							Compare plans and choose the best fit for your team
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{(["free", "pro", "enterprise"] as const).map((planName) => {
								const plan = PLANS[planName];
								const isCurrent = subscription.plan === planName;
								return (
									<div
										className={`rounded-lg border p-4 ${
											isCurrent
												? "border-primary bg-primary/5"
												: "border-border"
										}`}
										key={planName}
									>
										<div className="mb-3">
											<h4 className="font-semibold">{plan.label}</h4>
											<p className="text-2xl font-bold mt-1">
												{plan.priceDisplayLabel
													? plan.priceDisplayLabel
													: plan.pricePerSeatMonthly === 0
														? "Free"
														: `$${plan.pricePerSeatMonthly}`}
												{!plan.priceDisplayLabel &&
													plan.pricePerSeatMonthly > 0 && (
														<span className="text-sm font-normal text-muted-foreground">
															/user/mo
														</span>
													)}
											</p>
										</div>
										<p className="text-sm text-muted-foreground mb-3">
											{plan.description}
										</p>
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
												disabled={
													planName === "free" && subscription.plan !== "free"
												}
												onClick={() => {
													if (planName === "enterprise") {
														window.open(
															"mailto:sales@proddy.app?subject=Enterprise Plan Inquiry",
															"_blank"
														);
													} else if (planName !== "free") {
														setUpgradeOpen(true);
													}
												}}
												size="sm"
												variant={planName === "pro" ? "default" : "outline"}
											>
												{planName === "free"
													? "Downgrade"
													: planName === "enterprise"
														? "Contact Sales"
														: `Upgrade to ${plan.label}`}
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
				currentPlan={(subscription.plan as PlanName) ?? "free"}
				onOpenChange={setUpgradeOpen}
				open={upgradeOpen}
				workspaceId={workspaceId}
			/>
		</>
	);
}
