"use client";

import { useQuery } from "convex/react";
import {
	Activity,
	Bot,
	FileText,
	Hash,
	LayoutGrid,
	ListChecks,
	MessageSquare,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { isUnlimited } from "@/../convex/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface UsageDashboardProps {
	workspaceId: Id<"workspaces">;
	onUpgradeClick?: () => void;
}

interface UsageRowProps {
	icon: React.ElementType;
	label: string;
	used: number;
	limit: number;
}

function UsageRow({ icon: Icon, label, used, limit }: UsageRowProps) {
	const unlimited = isUnlimited(limit);
	const pct = unlimited
		? 0
		: limit > 0
			? Math.min((used / limit) * 100, 100)
			: 0;

	let _statusColor = "bg-emerald-500";
	let badgeVariant: "default" | "secondary" | "destructive" | "outline" =
		"secondary";
	let badgeText = "";

	if (!unlimited) {
		if (pct >= 100) {
			_statusColor = "bg-red-500";
			badgeVariant = "destructive";
			badgeText = "Limit reached";
		} else if (pct >= 80) {
			_statusColor = "bg-yellow-500";
			badgeVariant = "outline";
			badgeText = "Approaching limit";
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
					<Icon className="size-4 shrink-0" />
					<span>{label}</span>
				</div>
				<div className="flex items-center gap-2">
					{badgeText && (
						<Badge className="text-xs" variant={badgeVariant}>
							{badgeText}
						</Badge>
					)}
					<span className="text-sm tabular-nums text-muted-foreground">
						{used.toLocaleString()}{" "}
						<span className="text-muted-foreground/60">
							/ {unlimited ? "Unlimited" : limit.toLocaleString()}
						</span>
					</span>
				</div>
			</div>
			{!unlimited && (
				<Progress
					className="h-2"
					style={
						{
							"--progress-indicator": `var(--color-${pct >= 100 ? "red" : pct >= 80 ? "yellow" : "emerald"}-500)`,
						} as React.CSSProperties
					}
					// Override the indicator colour based on status
					value={pct}
				/>
			)}
			{unlimited && (
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<Sparkles className="size-3" />
					<span>Unlimited on your plan</span>
				</div>
			)}
		</div>
	);
}

export function UsageDashboard({
	workspaceId,
	onUpgradeClick,
}: UsageDashboardProps) {
	const usage = useQuery(api.usageTracking.getWorkspaceUsage, { workspaceId });

	if (!usage || !usage.plan || !usage.ai || !usage.collaboration) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Activity className="size-5 animate-pulse" />
					<span>Loading usage data...</span>
				</div>
			</div>
		);
	}

	const planLabel = usage.plan.label;
	const planName = usage.plan.name;

	const ai = usage.ai;
	const collab = usage.collaboration;

	// Check if any limit is reached (for upgrade prompt)
	const anyLimitReached = [
		ai.requests,
		ai.diagrams,
		ai.summaries,
		collab.messages,
		collab.tasks,
		collab.channels,
		collab.boards,
		collab.notes,
	].some((item) => !isUnlimited(item.limit) && item.used >= item.limit);

	return (
		<div className="space-y-6">
			{/* Plan header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Badge
						className="text-sm px-3 py-1"
						variant={
							planName === "enterprise"
								? "default"
								: planName === "pro"
									? "secondary"
									: "outline"
						}
					>
						{planLabel} Plan
					</Badge>
					<span className="text-sm text-muted-foreground">
						Usage for {usage.month}
					</span>
				</div>
				{anyLimitReached && planName !== "enterprise" && onUpgradeClick && (
					<Button onClick={onUpgradeClick} size="sm">
						<TrendingUp className="size-4 mr-1" />
						Upgrade to {planName === "free" ? "Pro" : "Enterprise"}
					</Button>
				)}
			</div>

			{/* AI Usage */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<Bot className="size-5" />
						AI Usage
					</CardTitle>
					<CardDescription>
						AI-powered features usage this month
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<UsageRow
						icon={Bot}
						label="AI Requests"
						limit={ai.requests.limit}
						used={ai.requests.used}
					/>
					<UsageRow
						icon={Sparkles}
						label="Diagram Generations"
						limit={ai.diagrams.limit}
						used={ai.diagrams.used}
					/>
					<UsageRow
						icon={FileText}
						label="Summaries"
						limit={ai.summaries.limit}
						used={ai.summaries.used}
					/>
				</CardContent>
			</Card>

			{/* Collaboration Usage */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-base">
						<MessageSquare className="size-5" />
						Collaboration Usage
					</CardTitle>
					<CardDescription>
						Workspace collaboration features usage this month
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<UsageRow
						icon={MessageSquare}
						label="Messages"
						limit={collab.messages.limit}
						used={collab.messages.used}
					/>
					<Separator />
					<UsageRow
						icon={ListChecks}
						label="Tasks"
						limit={collab.tasks.limit}
						used={collab.tasks.used}
					/>
					<Separator />
					<UsageRow
						icon={Hash}
						label="Channels"
						limit={collab.channels.limit}
						used={collab.channels.used}
					/>
					<UsageRow
						icon={LayoutGrid}
						label="Board Cards"
						limit={collab.boards.limit}
						used={collab.boards.used}
					/>
					<UsageRow
						icon={FileText}
						label="Notes"
						limit={collab.notes.limit}
						used={collab.notes.used}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
