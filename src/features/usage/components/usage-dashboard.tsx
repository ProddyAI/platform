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
import { Badge } from "@/components/ui/badge";
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
			barClass: "bg-muted-foreground/40",
			badgeClass: "border-border bg-muted text-foreground",
			iconClass: "bg-muted text-foreground",
			text: "Unlimited quota",
			tone: "neutral" as const,
		};
	}

	if (percent >= 100 || used >= limit) {
		return {
			badge: "Limit reached",
			barClass: "bg-rose-500",
			badgeClass:
				"border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
			iconClass:
				"bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
			text: "No quota remaining",
			tone: "danger" as const,
		};
	}

	if (percent >= 80) {
		return {
			badge: "Near limit",
			barClass: "bg-amber-500",
			badgeClass:
				"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
			iconClass:
				"bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
			text: `${Math.max(limit - used, 0).toLocaleString()} remaining`,
			tone: "warning" as const,
		};
	}

	return {
		badge: "Healthy",
		barClass: percent === 0 ? "bg-muted-foreground/30" : "bg-emerald-500",
		badgeClass:
			"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
		iconClass: "bg-muted text-muted-foreground",
		text: `${Math.max(limit - used, 0).toLocaleString()} remaining`,
		tone: "good" as const,
	};
}

function MetricRow({ item }: { item: UsageItem }) {
	const Icon = item.icon;
	const unlimited = isUnlimited(item.limit);
	const percent = usagePercent(item.used, item.limit);
	const state = usageState(item.used, item.limit);

	return (
		<div className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
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
								"h-5 rounded-full border px-2 text-[11px] font-medium",
								state.badgeClass
							)}
							variant="outline"
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
						<div className="h-full w-full rounded-full bg-muted-foreground/30" />
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
		<section className="rounded-lg border bg-muted/20 p-3 shadow-sm">
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
			<Badge
				className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
				variant="outline"
			>
				<AlertTriangle className="mr-1.5 size-3.5" />
				Limit reached
			</Badge>
		);
	}

	if (attentionItems > 0) {
		return (
			<Badge
				className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
				variant="outline"
			>
				<AlertTriangle className="mr-1.5 size-3.5" />
				Needs attention
			</Badge>
		);
	}

	return (
		<Badge
			className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
			variant="outline"
		>
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
				<div className="rounded-lg border bg-card p-5 shadow-sm lg:p-6">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-6 w-24 rounded-full" />
						<Skeleton className="h-7 w-28 rounded-full" />
						<Skeleton className="h-7 w-24 rounded-full" />
					</div>
					<Skeleton className="mt-4 h-7 w-48" />
					<Skeleton className="mt-2 h-4 w-full max-w-md" />
				</div>
				<div className="grid gap-5 xl:grid-cols-2">
					<div className="space-y-2 rounded-lg border bg-muted/20 p-3 shadow-sm">
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
					</div>
					<div className="space-y-2 rounded-lg border bg-muted/20 p-3 shadow-sm">
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
						<Skeleton className="h-16 w-full rounded-lg" />
					</div>
				</div>
			</div>
		);
	}

	if (!usage?.plan || !usage.ai || !usage.collaboration) {
		return (
			<div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border bg-card p-6 text-center shadow-sm">
				<AlertTriangle className="size-6 text-muted-foreground" />
				<p className="text-sm font-medium text-foreground">
					Couldn't load usage data
				</p>
				<p className="max-w-sm text-sm text-muted-foreground">
					You may not have access to this workspace, or something went wrong.
					Try refreshing the page.
				</p>
			</div>
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
			<section className="rounded-lg border bg-card p-5 shadow-sm lg:p-6">
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
