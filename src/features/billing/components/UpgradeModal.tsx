"use client";

import { useAction } from "convex/react";
import { Check, Loader, Minus, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { PLANS, type PlanName, isUnlimited } from "@/../convex/plans";
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
}

const FEATURE_LABELS: { key: keyof typeof PLANS.free.limits; label: string }[] = [
	{ key: "aiRequestsPerMonth", label: "AI Requests" },
	{ key: "aiDiagramGenerationsPerMonth", label: "Diagram Generations" },
	{ key: "aiSummaryRequestsPerMonth", label: "Summaries" },
	{ key: "messagesPerMonth", label: "Messages" },
	{ key: "tasksPerMonth", label: "Tasks" },
	{ key: "channelsPerMonth", label: "Channels" },
	{ key: "boardsPerMonth", label: "Boards" },
	{ key: "notesPerMonth", label: "Notes" },
];

function formatLimit(value: number): string {
	if (isUnlimited(value)) return "Unlimited";
	return value.toLocaleString();
}

export function UpgradeModal({
	workspaceId,
	currentPlan,
	open,
	onOpenChange,
}: UpgradeModalProps) {
	const createCheckout = useAction(api.stripe.createCheckoutSession);
	const [loading, setLoading] = useState(false);
	const [seatCount, setSeatCount] = useState(1);

	const proPlan = PLANS.pro;
	const enterprisePlan = PLANS.enterprise;
	const totalPrice = proPlan.pricePerSeatMonthly * seatCount;

	const handleUpgrade = async () => {
		setLoading(true);
		try {
			const url = await createCheckout({
				workspaceId,
				planName: "pro",
				quantity: seatCount,
			});
			window.location.href = url;
		} catch (err) {
			console.error("Failed to create checkout session:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleContactSales = () => {
		window.open("mailto:sales@proddy.app?subject=Enterprise Plan Inquiry", "_blank");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="size-5" />
						Upgrade Your Plan
					</DialogTitle>
					<DialogDescription>
						Choose a plan that fits your team. Pricing is per user, per month.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
					{/* Pro Plan with seat selector */}
					{currentPlan !== "pro" && (
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

							{/* Seat selector */}
							<div className="rounded-md border p-3 space-y-2">
								<label className="text-sm font-medium">Number of users</label>
								<div className="flex items-center gap-3">
									<Button
										variant="outline"
										size="icon"
										className="h-8 w-8"
										onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
										disabled={seatCount <= 1}
									>
										<Minus className="size-4" />
									</Button>
									<span className="text-lg font-semibold tabular-nums w-8 text-center">
										{seatCount}
									</span>
									<Button
										variant="outline"
										size="icon"
										className="h-8 w-8"
										onClick={() => setSeatCount(Math.min(5, seatCount + 1))}
										disabled={seatCount >= 5}
									>
										<Plus className="size-4" />
									</Button>
								</div>
								<p className="text-sm text-muted-foreground">
									Total:{" "}
									<span className="font-semibold text-foreground">
										${totalPrice}/month
									</span>
								</p>
							</div>

							<ul className="space-y-2">
								{FEATURE_LABELS.map(({ key, label }) => (
									<li key={key} className="flex items-center gap-2 text-sm">
										<Check className="size-4 text-green-500 shrink-0" />
										<span>
											{formatLimit(proPlan.limits[key])} {label}
										</span>
									</li>
								))}
							</ul>

							<Button
								className="w-full"
								onClick={handleUpgrade}
								disabled={loading}
							>
								{loading ? (
									<>
										<Loader className="size-4 animate-spin mr-2" />
										Redirecting to checkout...
									</>
								) : (
									<>
										<Sparkles className="size-4 mr-2" />
										Upgrade to Pro
									</>
								)}
							</Button>
						</div>
					)}

					{/* Enterprise Plan - Contact Sales */}
					{currentPlan !== "enterprise" && (
						<div className="rounded-lg border border-border p-5 space-y-4">
							<div>
								<h3 className="text-lg font-semibold">
									{enterprisePlan.label}
								</h3>
								<p className="text-2xl font-bold mt-1">
									{enterprisePlan.priceDisplayLabel ?? "Custom"}
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{enterprisePlan.description}
								</p>
							</div>

							<ul className="space-y-2">
								{FEATURE_LABELS.map(({ key, label }) => (
									<li key={key} className="flex items-center gap-2 text-sm">
										<Check className="size-4 text-green-500 shrink-0" />
										<span>
											{formatLimit(enterprisePlan.limits[key])} {label}
										</span>
									</li>
								))}
							</ul>

							<Button
								variant="outline"
								className="w-full"
								onClick={handleContactSales}
							>
								Contact Sales
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
