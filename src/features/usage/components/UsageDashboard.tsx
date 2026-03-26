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
	const pct = unlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

	let statusColor = "bg-emerald-500";
	let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
	let badgeText = "";

	if (!unlimited) {
		if (pct >= 100) {
			statusColor = "bg-red-500";
			badgeVariant = "destructive";
			badgeText = "Limit reached";
		} else if (pct >= 80) {
			statusColor = "bg-yellow-500";
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
						<Badge variant={badgeVariant} className="text-xs">
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
					value={pct}
					className="h-2"
					// Override the indicator colour based on status
					style={
						{
							"--progress-indicator": `var(--color-${pct >= 100 ? "red" : pct >= 80 ? "yellow" : "emerald"}-500)`,
						} as React.CSSProperties
					}
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
						variant={
							planName === "enterprise"
								? "default"
								: planName === "pro"
									? "secondary"
									: "outline"
						}
						className="text-sm px-3 py-1"
					>
						{planLabel} Plan
					</Badge>
					<span className="text-sm text-muted-foreground">
						Usage for {usage.month}
					</span>
				</div>
				{anyLimitReached && planName !== "enterprise" && onUpgradeClick && (
					<Button size="sm" onClick={onUpgradeClick}>
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
						used={ai.requests.used}
						limit={ai.requests.limit}
					/>
					<UsageRow
						icon={Sparkles}
						label="Diagram Generations"
						used={ai.diagrams.used}
						limit={ai.diagrams.limit}
					/>
					<UsageRow
						icon={FileText}
						label="Summaries"
						used={ai.summaries.used}
						limit={ai.summaries.limit}
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
						used={collab.messages.used}
						limit={collab.messages.limit}
					/>
					<Separator />
					<UsageRow
						icon={ListChecks}
						label="Tasks"
						used={collab.tasks.used}
						limit={collab.tasks.limit}
					/>
					<Separator />
					<UsageRow
						icon={Hash}
						label="Channels"
						used={collab.channels.used}
						limit={collab.channels.limit}
					/>
					<UsageRow
						icon={LayoutGrid}
						label="Board Cards"
						used={collab.boards.used}
						limit={collab.boards.limit}
					/>
					<UsageRow
						icon={FileText}
						label="Notes"
						used={collab.notes.used}
						limit={collab.notes.limit}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
