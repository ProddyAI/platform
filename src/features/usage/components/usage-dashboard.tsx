"use client";

import { useQuery } from "convex/react";
import {
	AlertTriangle,
	Bot,
	CalendarDays,
	CheckCircle2,
	Crown,
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
import { isUnlimited } from "@/../convex/billing/plans";
import { EmptyState } from "@/components/empty-state";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface UsageDashboardProps {
	workspaceId: Id<"workspaces">;
	onUpgradeClick?: () => void;
}

interface UsageItem {
	icon: React.ElementType;
	label: string;
	description: string;
	used: number;
	limit: number;
}

function usagePercent(used: number, limit: number) {
	if (isUnlimited(limit) || limit <= 0) return 0;
	return Math.min((used / limit) * 100, 100);
}

function usageState(used: number, limit: number) {
	const percent = usagePercent(used, limit);

	if (isUnlimited(limit)) {
		return {
			badge: "Unlimited",
			badgeVariant: "outline" as BadgeProps["variant"],
			badgeClass: "border-border bg-muted text-foreground",
			barClass: "bg-muted-foreground/40",
			iconClass: "bg-muted text-foreground",
			text: "Unlimited quota",
		};
	}

	if (percent >= 100 || used >= limit) {
		return {
			badge: "Limit reached",
			badgeVariant: "destructiveSoft" as BadgeProps["variant"],
			badgeClass: "",
			barClass: "bg-destructive",
			iconClass: "bg-destructive/10 text-destructive",
			text: "No quota remaining",
		};
	}

	if (percent >= 80) {
		return {
			badge: "Near limit",
			badgeVariant: "warning" as BadgeProps["variant"],
			badgeClass: "",
			barClass: "bg-warning",
			iconClass: "bg-warning/10 text-warning",
			text: `${Math.max(limit - used, 0).toLocaleString()} remaining`,
		};
	}

	return {
		badge: "Healthy",
		badgeVariant: "success" as BadgeProps["variant"],
		badgeClass: "",
		barClass: percent === 0 ? "bg-muted-foreground/30" : "bg-success",
		iconClass: "bg-success/10 text-success",
		text: `${Math.max(limit - used, 0).toLocaleString()} remaining`,
	};
}

function MetricRow({ item }: { item: UsageItem }) {
	const Icon = item.icon;
	const unlimited = isUnlimited(item.limit);
	const percent = usagePercent(item.used, item.limit);
	const state = usageState(item.used, item.limit);

	return (
		<div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
			<div className="flex min-w-0 items-start gap-3">
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10",
						state.iconClass
					)}
				>
					<Icon className="size-4" />
				</div>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-semibold text-foreground">
							{item.label}
						</p>
						<Badge
							className={cn(
								"h-5 px-2 text-[11px] font-medium",
								state.badgeClass
							)}
							variant={state.badgeVariant}
						>
							{state.badge}
						</Badge>
					</div>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						{item.description}
					</p>
				</div>
			</div>

			<div className="min-w-0">
				<div className="mb-2 flex items-baseline justify-between gap-3">
					<p className="text-sm font-semibold tabular-nums text-foreground">
						{item.used.toLocaleString()}
						<span className="font-normal text-muted-foreground">
							{" / "}
							{unlimited ? "Unlimited" : item.limit.toLocaleString()}
						</span>
					</p>
					<p className="text-xs font-medium tabular-nums text-muted-foreground">
						{unlimited ? "Open" : `${Math.round(percent)}%`}
					</p>
				</div>
				{unlimited ? (
					<div className="h-2 rounded-full bg-muted">
						<div className="size-full rounded-full bg-muted-foreground/30" />
					</div>
				) : (
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							aria-label={`${item.label} usage`}
							aria-valuemax={item.limit}
							aria-valuemin={0}
							aria-valuenow={item.used}
							className={cn(
								"h-full rounded-full transition-all",
								state.barClass
							)}
							role="progressbar"
							style={{ width: `${percent}%` }}
						/>
					</div>
				)}
				<p className="mt-1.5 text-xs text-muted-foreground">{state.text}</p>
			</div>
		</div>
	);
}

function UsageSection({
	icon: Icon,
	title,
	description,
	items,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
	items: UsageItem[];
}) {
	const sortedItems = [...items].sort(
		(a, b) => usagePercent(b.used, b.limit) - usagePercent(a.used, a.limit)
	);

	return (
		<section className="rounded-2xl border bg-muted/20 p-3 shadow-sm">
			<div className="flex min-w-0 items-start gap-3 px-2 pb-3 pt-1">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground ring-1 ring-inset ring-black/5 dark:ring-white/10">
					<Icon className="size-5" />
				</div>
				<div className="min-w-0">
					<h3 className="text-base font-semibold text-foreground">{title}</h3>
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				</div>
			</div>
			<div className="space-y-2">
				{sortedItems.map((item) => (
					<MetricRow item={item} key={item.label} />
				))}
			</div>
		</section>
	);
}

function StatusBadge({
	attentionItems,
	reachedLimits,
}: {
	attentionItems: number;
	reachedLimits: number;
}) {
	if (reachedLimits > 0) {
		return (
			<Badge className="h-7 px-3" variant="destructiveSoft">
				<AlertTriangle className="mr-1.5 size-3.5" />
				Limit reached
			</Badge>
		);
	}

	if (attentionItems > 0) {
		return (
			<Badge className="h-7 px-3" variant="warning">
				<AlertTriangle className="mr-1.5 size-3.5" />
				Needs attention
			</Badge>
		);
	}

	return (
		<Badge className="h-7 px-3" variant="success">
			<CheckCircle2 className="mr-1.5 size-3.5" />
			Healthy
		</Badge>
	);
}

export function UsageDashboard({
	workspaceId,
	onUpgradeClick,
}: UsageDashboardProps) {
	const usage = useQuery(api.billing.usageTracking.getWorkspaceUsage, {
		workspaceId,
	});

	if (usage === undefined) {
		return (
			<div className="space-y-5">
				<div className="rounded-2xl border bg-card p-5 shadow-sm lg:p-6">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-6 w-24 rounded-full" />
						<Skeleton className="h-7 w-28 rounded-full" />
						<Skeleton className="h-7 w-24 rounded-full" />
					</div>
					<Skeleton className="mt-4 h-7 w-48" />
					<Skeleton className="mt-2 h-4 w-full max-w-md" />
				</div>
				<div className="grid gap-5 xl:grid-cols-2">
					<div className="space-y-2 rounded-2xl border bg-muted/20 p-3 shadow-sm">
						<Skeleton className="h-16 w-full rounded-xl" />
						<Skeleton className="h-16 w-full rounded-xl" />
						<Skeleton className="h-16 w-full rounded-xl" />
					</div>
					<div className="space-y-2 rounded-2xl border bg-muted/20 p-3 shadow-sm">
						<Skeleton className="h-16 w-full rounded-xl" />
						<Skeleton className="h-16 w-full rounded-xl" />
						<Skeleton className="h-16 w-full rounded-xl" />
					</div>
				</div>
			</div>
		);
	}

	if (!usage?.plan || !usage.ai || !usage.collaboration) {
		return (
			<EmptyState
				description="You may not have access to this workspace, or something went wrong. Try refreshing the page."
				icon={AlertTriangle}
				title="Couldn't load usage data"
			/>
		);
	}

	const planLabel = usage.plan.label;
	const planName = usage.plan.name;
	const ai = usage.ai;
	const collab = usage.collaboration;

	const aiItems: UsageItem[] = [
		{
			description: "Assistant messages, tool calls, and AI replies",
			icon: Bot,
			label: "AI Requests",
			limit: ai.requests.limit,
			used: ai.requests.used,
		},
		{
			description: "Canvas diagrams and generated flowcharts",
			icon: Sparkles,
			label: "Diagram Generations",
			limit: ai.diagrams.limit,
			used: ai.diagrams.used,
		},
		{
			description: "Thread, message, and note summaries",
			icon: FileText,
			label: "Summaries",
			limit: ai.summaries.limit,
			used: ai.summaries.used,
		},
	];

	const collaborationItems: UsageItem[] = [
		{
			description: "Channel and direct messages sent",
			icon: MessageSquare,
			label: "Messages",
			limit: collab.messages.limit,
			used: collab.messages.used,
		},
		{
			description: "Workspace tasks created",
			icon: ListChecks,
			label: "Tasks",
			limit: collab.tasks.limit,
			used: collab.tasks.used,
		},
		{
			description: "Channels available in this workspace",
			icon: Hash,
			label: "Channels",
			limit: collab.channels.limit,
			used: collab.channels.used,
		},
		{
			description: "Cards across boards and project workflows",
			icon: LayoutGrid,
			label: "Board Cards",
			limit: collab.boards.limit,
			used: collab.boards.used,
		},
		{
			description: "Collaborative notes created",
			icon: FileText,
			label: "Notes",
			limit: collab.notes.limit,
			used: collab.notes.used,
		},
	];

	const allItems = [...aiItems, ...collaborationItems];
	const reachedLimits = allItems.filter(
		(item) => !isUnlimited(item.limit) && item.used >= item.limit
	).length;
	const attentionItems = allItems.filter(
		(item) =>
			!isUnlimited(item.limit) && usagePercent(item.used, item.limit) >= 80
	).length;
	const showUpgrade = planName !== "enterprise" && onUpgradeClick;

	return (
		<div className="space-y-5">
			<section className="rounded-2xl border bg-card p-5 shadow-sm lg:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<StatusBadge
								attentionItems={attentionItems}
								reachedLimits={reachedLimits}
							/>
							<Badge className="h-7 rounded-full px-3" variant="outline">
								<Crown className="mr-1.5 size-3.5" />
								{planLabel} Plan
							</Badge>
							<Badge className="h-7 rounded-full px-3" variant="outline">
								<CalendarDays className="mr-1.5 size-3.5" />
								{usage.month}
							</Badge>
						</div>
						<h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
							Usage overview
						</h2>
						<p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
							Track quota health across AI tools, channels, boards, notes, and
							tasks.
						</p>
					</div>
					{showUpgrade && (
						<Button className="shrink-0" onClick={onUpgradeClick}>
							<TrendingUp className="mr-1.5 size-3.5" />
							Upgrade plan
						</Button>
					)}
				</div>
			</section>

			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<UsageSection
					description="Monthly AI quota and generation limits"
					icon={Bot}
					items={aiItems}
					title="AI Usage"
				/>
				<UsageSection
					description="Workspace activity and collaboration limits"
					icon={MessageSquare}
					items={collaborationItems}
					title="Collaboration Usage"
				/>
			</div>
		</div>
	);
}
