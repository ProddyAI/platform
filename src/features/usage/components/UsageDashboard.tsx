"use client";

import { useQuery } from "convex/react";
import {
	Activity,
	AlertTriangle,
	ArrowUpRight,
	Bot,
	CalendarDays,
	CheckCircle2,
	Crown,
	FileText,
	Gauge,
	Hash,
	LayoutGrid,
	ListChecks,
	MessageSquare,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	Zap,
} from "lucide-react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { isUnlimited } from "@/../convex/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type UsageTone = "good" | "warning" | "danger" | "neutral";

function usagePercent(used: number, limit: number) {
	if (isUnlimited(limit) || limit <= 0) return 0;
	return Math.min((used / limit) * 100, 100);
}

function usageState(used: number, limit: number) {
	const percent = usagePercent(used, limit);

	if (isUnlimited(limit)) {
		return {
			badge: "Unlimited",
			barClass: "bg-sky-500",
			badgeClass:
				"border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
			iconClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
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
		barClass:
			percent === 0 ? "bg-slate-300 dark:bg-slate-600" : "bg-emerald-500",
		badgeClass:
			"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
		iconClass:
			"bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
		text: `${Math.max(limit - used, 0).toLocaleString()} remaining`,
		tone: "good" as const,
	};
}

function getAverageUtilization(items: UsageItem[]) {
	const limitedItems = items.filter((item) => !isUnlimited(item.limit));
	if (limitedItems.length === 0) return 0;

	const total = limitedItems.reduce(
		(sum, item) => sum + usagePercent(item.used, item.limit),
		0
	);
	return Math.round(total / limitedItems.length);
}

function getHighestUsage(items: UsageItem[]) {
	const limitedItems = items.filter((item) => !isUnlimited(item.limit));
	if (limitedItems.length === 0) return null;

	return limitedItems.reduce((highest, item) =>
		usagePercent(item.used, item.limit) >
		usagePercent(highest.used, highest.limit)
			? item
			: highest
	);
}

function MetricRow({ item }: { item: UsageItem }) {
	const Icon = item.icon;
	const unlimited = isUnlimited(item.limit);
	const percent = usagePercent(item.used, item.limit);
	const state = usageState(item.used, item.limit);

	return (
		<div className="grid gap-4 rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
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
					<div className="h-2 rounded-full bg-sky-100 dark:bg-sky-950/50">
						<div className="h-full w-full rounded-full bg-sky-500/70" />
					</div>
				) : (
					<div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
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

function SummaryCard({
	icon: Icon,
	label,
	value,
	helper,
	tone = "neutral",
}: {
	icon: React.ElementType;
	label: string;
	value: string;
	helper: string;
	tone?: UsageTone;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-white/[0.03]">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase text-slate-500">
						{label}
					</p>
					<p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
						{value}
					</p>
				</div>
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10",
						tone === "neutral" &&
							"bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
						tone === "good" &&
							"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
						tone === "warning" &&
							"bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
						tone === "danger" &&
							"bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
					)}
				>
					<Icon className="size-4" />
				</div>
			</div>
			<p className="mt-3 text-xs leading-5 text-muted-foreground">{helper}</p>
		</div>
	);
}

function UsageSection({
	icon: Icon,
	title,
	description,
	items,
	tone,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
	items: UsageItem[];
	tone: "ai" | "collaboration";
}) {
	const average = getAverageUtilization(items);
	const nearLimit = items.filter(
		(item) =>
			!isUnlimited(item.limit) && usagePercent(item.used, item.limit) >= 80
	).length;
	const highestUsage = getHighestUsage(items);

	return (
		<section className="rounded-lg border border-slate-200 bg-[#fbfcfe] p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.02]">
			<div className="flex flex-col gap-4 px-2 pb-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					<div
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ring-black/5 dark:ring-white/10",
							tone === "ai"
								? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
								: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
						)}
					>
						<Icon className="size-5" />
					</div>
					<div className="min-w-0">
						<h3 className="text-base font-semibold text-slate-950 dark:text-white">
							{title}
						</h3>
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[210px]">
					<div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
						<p className="text-muted-foreground">Average</p>
						<p className="mt-1 font-semibold tabular-nums">{average}%</p>
					</div>
					<div className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
						<p className="text-muted-foreground">Watchlist</p>
						<p
							className={cn(
								"mt-1 font-semibold tabular-nums",
								nearLimit > 0
									? "text-amber-700 dark:text-amber-300"
									: "text-emerald-700 dark:text-emerald-300"
							)}
						>
							{nearLimit}
						</p>
					</div>
				</div>
			</div>
			{highestUsage && (
				<div className="mb-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
					Highest usage:{" "}
					<span className="font-medium text-foreground">
						{highestUsage.label}
					</span>{" "}
					at {Math.round(usagePercent(highestUsage.used, highestUsage.limit))}%
				</div>
			)}
			<div className="space-y-2">
				{items.map((item) => (
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
	const usage = useQuery(api.usageTracking.getWorkspaceUsage, { workspaceId });

	if (!usage?.plan || !usage.ai || !usage.collaboration) {
		return (
			<div className="flex min-h-[420px] items-center justify-center rounded-md border bg-card shadow-sm">
				<div className="flex items-center gap-3 rounded-md border bg-slate-50 px-4 py-3 text-sm text-muted-foreground dark:bg-white/[0.03]">
					<Activity className="size-5 animate-pulse text-primary" />
					<span>Loading usage data...</span>
				</div>
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
	const healthyLimits = allItems.length - attentionItems;
	const averageUtilization = getAverageUtilization(allItems);
	const highestUsage = getHighestUsage(allItems);
	const anyLimitReached = reachedLimits > 0;
	const showUpgrade = planName !== "enterprise" && onUpgradeClick;

	return (
		<div className="space-y-5">
			<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
				<div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-6">
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
						<h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
							Usage overview
						</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
							Track quota health across AI tools, channels, boards, notes, and
							tasks with one clear operational view.
						</p>
					</div>

					<div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase text-slate-500">
									Overall utilization
								</p>
								<p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
									{averageUtilization}%
								</p>
							</div>
							<div className="flex size-10 items-center justify-center rounded-md bg-white text-primary ring-1 ring-inset ring-black/5 dark:bg-white/[0.06] dark:ring-white/10">
								<Gauge className="size-5" />
							</div>
						</div>
						<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white dark:bg-slate-800">
							<div
								className={cn(
									"h-full rounded-full transition-all",
									averageUtilization >= 100
										? "bg-rose-500"
										: averageUtilization >= 80
											? "bg-amber-500"
											: "bg-emerald-500"
								)}
								style={{ width: `${averageUtilization}%` }}
							/>
						</div>
						<p className="mt-3 text-xs leading-5 text-muted-foreground">
							{highestUsage
								? `${highestUsage.label} is currently the busiest quota at ${Math.round(
										usagePercent(highestUsage.used, highestUsage.limit)
									)}%.`
								: "All tracked quotas are unlimited on this plan."}
						</p>
					</div>
				</div>

				<div className="grid gap-px border-t border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3">
					<div className="bg-white px-5 py-4 dark:bg-transparent lg:px-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
							<ShieldCheck className="size-3.5" />
							Healthy metrics
						</div>
						<p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
							{healthyLimits}
							<span className="text-sm font-normal text-muted-foreground">
								{" / "}
								{allItems.length}
							</span>
						</p>
					</div>
					<div className="bg-white px-5 py-4 dark:bg-transparent lg:px-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
							<AlertTriangle className="size-3.5" />
							Attention
						</div>
						<p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
							{attentionItems}
						</p>
					</div>
					<div className="bg-white px-5 py-4 dark:bg-transparent lg:px-6">
						<div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
							<Zap className="size-3.5" />
							Limits reached
						</div>
						<div className="mt-2 flex items-center justify-between gap-3">
							<p className="text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
								{reachedLimits}
							</p>
							{showUpgrade && anyLimitReached && (
								<Button className="h-8 px-3 text-xs" onClick={onUpgradeClick}>
									<TrendingUp className="mr-1.5 size-3.5" />
									Upgrade
								</Button>
							)}
						</div>
					</div>
				</div>
			</section>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<SummaryCard
					helper="Limits tracked for this workspace"
					icon={Gauge}
					label="Metrics"
					value={allItems.length.toString()}
				/>
				<SummaryCard
					helper="Usage below the attention threshold"
					icon={CheckCircle2}
					label="Healthy"
					tone="good"
					value={healthyLimits.toString()}
				/>
				<SummaryCard
					helper="At or above 80% of quota"
					icon={attentionItems > 0 ? AlertTriangle : Zap}
					label="Attention"
					tone={attentionItems > 0 ? "warning" : "good"}
					value={attentionItems.toString()}
				/>
				<SummaryCard
					helper="Quota fully consumed"
					icon={anyLimitReached ? AlertTriangle : ArrowUpRight}
					label="Reached"
					tone={anyLimitReached ? "danger" : "neutral"}
					value={reachedLimits.toString()}
				/>
			</div>

			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<UsageSection
					description="Monthly AI quota and generation limits"
					icon={Bot}
					items={aiItems}
					title="AI Usage"
					tone="ai"
				/>
				<UsageSection
					description="Workspace activity and collaboration limits"
					icon={MessageSquare}
					items={collaborationItems}
					title="Collaboration Usage"
					tone="collaboration"
				/>
			</div>
		</div>
	);
}
