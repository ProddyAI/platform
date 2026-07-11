"use client";

import {
	AlertTriangle,
	Brain,
	CheckCircle2,
	Loader2,
	Sparkles,
	Target,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useGetDailyFocus } from "@/features/tasks/api/use-get-daily-focus";
import { useGetStressData } from "@/features/tasks/api/use-get-stress-data";
import {
	buildDailyFocusPrompt,
	buildReschedulingPrompt,
	buildStressDetectionPrompt,
	type TaskSummary,
} from "@/lib/stress-prompts";
import { cn } from "@/lib/utils";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetHeader } from "../shared/widget-header";

interface StressWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

type StressLevelConfig = {
	color: string;
	text: string;
	fg: string;
	label: string;
	icon: typeof Zap;
};

function StressWidgetTitleRow({
	config,
	isEditMode,
	controls,
}: {
	config: StressLevelConfig;
	isEditMode?: boolean;
	controls?: React.ReactNode;
}) {
	return (
		<WidgetHeader
			controls={controls}
			icon={
				<div className={cn("p-2 rounded-lg bg-primary/10", config.text)}>
					<Brain className="h-5 w-5" />
				</div>
			}
			isEditMode={isEditMode}
			title="Stress & Focus"
		/>
	);
}

function StressHighAlert() {
	return (
		<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
			<div className="flex gap-2">
				<AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
				<p className="text-xs text-destructive font-medium leading-relaxed">
					High workload detected. Consider rescheduling non-urgent tasks or
					taking a short break.
				</p>
			</div>
		</div>
	);
}

function FocusTaskDueDate({
	dueDate,
	isOverdue,
}: {
	dueDate: number | string;
	isOverdue?: boolean;
}) {
	const due = new Date(dueDate);
	if (Number.isNaN(due.getTime())) return null;
	return (
		<RelativeTime
			className="text-[9px]"
			iconClassName="h-2.5 w-2.5"
			overdue={isOverdue}
			timestamp={due.getTime()}
		/>
	);
}

const FOCUS_PRIORITY_VARIANT: Record<
	string,
	"outline" | "warning" | "destructiveSoft"
> = {
	low: "outline",
	medium: "warning",
	high: "destructiveSoft",
};

function FocusTaskMeta({ task }: { task: TaskSummary }) {
	const priority = task.priority || "medium";

	return (
		<div className="flex items-center gap-2">
			<Badge
				className="h-4 px-1 text-[9px] capitalize"
				variant={FOCUS_PRIORITY_VARIANT[priority] ?? "outline"}
			>
				{priority}
			</Badge>
			{task.dueDate && (
				<FocusTaskDueDate dueDate={task.dueDate} isOverdue={task.isOverdue} />
			)}
		</div>
	);
}

function FocusTaskRow({ task }: { task: TaskSummary & { _id?: string } }) {
	return (
		<div className="group relative flex items-start gap-3 rounded-lg border bg-card p-3 transition-fast hover:border-primary/30">
			<div className="min-w-0 space-y-1">
				<p className="truncate text-sm font-semibold leading-none">
					{task.title}
				</p>
				<FocusTaskMeta task={task} />
			</div>
		</div>
	);
}

function StressMeterReadout({
	config,
	stressScore,
}: {
	config: StressLevelConfig;
	stressScore: number;
}) {
	return (
		<div className="space-y-1">
			<p className="text-xs font-medium text-muted-foreground">Current Load</p>
			<p className={cn("text-2xl font-bold", config.text)}>
				{stressScore}
				<span className="text-sm font-medium text-muted-foreground ml-1">
					/ 150
				</span>
			</p>
		</div>
	);
}

function StressMeterBadge({
	config,
	totalPending,
}: {
	config: StressLevelConfig;
	totalPending?: number;
}) {
	return (
		<div className="text-right">
			<Badge
				className={cn("mb-1 border-none shadow-sm", config.color, config.fg)}
			>
				{config.label}
			</Badge>
			<p className="text-[10px] text-muted-foreground">
				Based on {totalPending} pending tasks
			</p>
		</div>
	);
}

function StressMeterSection({
	config,
	stressLevel,
	stressScore,
	totalPending,
}: {
	config: StressLevelConfig;
	stressLevel: string;
	stressScore: number;
	totalPending?: number;
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between">
				<StressMeterReadout config={config} stressScore={stressScore} />
				<StressMeterBadge config={config} totalPending={totalPending} />
			</div>

			<div className="relative h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
				<div
					className={cn(
						"absolute h-full transition-all duration-slow ease-out",
						config.color
					)}
					style={{ width: `${Math.min((stressScore / 150) * 100, 100)}%` }}
				/>
			</div>

			{stressLevel === "high" && <StressHighAlert />}
		</div>
	);
}

function FocusSectionHeader({ onAIGuide }: { onAIGuide: () => void }) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-2">
				<Target className="h-4 w-4 text-primary" />
				<h4 className="text-sm font-semibold">Daily Focus</h4>
			</div>
			<Button
				className="h-7 text-xs font-medium text-primary hover:bg-primary/5"
				onClick={onAIGuide}
				size="sm"
				variant="ghost"
			>
				<Sparkles className="h-3 w-3 mr-1" />
				AI Guide
			</Button>
		</div>
	);
}

function FocusSectionEmpty() {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
			<CheckCircle2 className="h-8 w-8 mb-2" />
			<p className="text-xs font-medium">All clear for today!</p>
		</div>
	);
}

function FocusSection({
	focusTasks,
	onAIGuide,
}: {
	focusTasks?: Array<TaskSummary & { _id?: string }>;
	onAIGuide: () => void;
}) {
	return (
		<div className="space-y-4">
			<FocusSectionHeader onAIGuide={onAIGuide} />
			<ScrollArea className="h-[180px] -mx-1 px-1">
				<div className="space-y-2">
					{focusTasks?.length === 0 ? (
						<FocusSectionEmpty />
					) : (
						focusTasks?.map((task) => (
							<FocusTaskRow key={task._id} task={task} />
						))
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

export const StressWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: StressWidgetProps) => {
	const router = useRouter();
	const { data: metrics, isLoading: loadingMetrics } = useGetStressData({
		workspaceId,
	});
	const { data: focusTasks, isLoading: loadingFocus } = useGetDailyFocus({
		workspaceId,
	});

	const openAssistantWithPrompt = (prompt: string) => {
		// Encode prompt for URL
		const encodedPrompt = encodeURIComponent(prompt);
		router.push(`/workspace/${workspaceId}/assistant?prompt=${encodedPrompt}`);
	};

	if (loadingMetrics || loadingFocus) {
		return (
			<WidgetCard className="flex items-center justify-center h-[400px]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</WidgetCard>
		);
	}

	const stressScore = metrics?.finalScore ?? 0;
	const stressLevel = metrics?.stressLevel ?? "low";

	const levelConfig = {
		low: {
			color: "bg-success",
			text: "text-success",
			fg: "text-success-foreground",
			label: "Healthy",
			icon: Zap,
		},
		medium: {
			color: "bg-warning",
			text: "text-warning",
			fg: "text-warning-foreground",
			label: "Elevated",
			icon: Brain,
		},
		high: {
			color: "bg-destructive",
			text: "text-destructive",
			fg: "text-destructive-foreground",
			label: "High Stress",
			icon: AlertTriangle,
		},
	} as const;

	const config =
		levelConfig[stressLevel as keyof typeof levelConfig] || levelConfig.low;

	return (
		<WidgetCard>
			<div className="p-6 space-y-6">
				<StressWidgetTitleRow
					config={config}
					controls={controls}
					isEditMode={isEditMode}
				/>

				<StressMeterSection
					config={config}
					stressLevel={stressLevel}
					stressScore={stressScore}
					totalPending={metrics?.totalPending}
				/>

				<Separator className="opacity-50" />

				<FocusSection
					focusTasks={focusTasks}
					onAIGuide={() =>
						metrics &&
						openAssistantWithPrompt(buildDailyFocusPrompt(focusTasks ?? []))
					}
				/>

				{/* Quick AI Actions */}
				<div className="grid grid-cols-2 gap-2">
					<Button
						className="h-9 hover:border-primary hover:bg-primary/5"
						onClick={() =>
							metrics &&
							openAssistantWithPrompt(buildStressDetectionPrompt(metrics))
						}
						size="sm"
						variant="outline"
					>
						<Brain className="h-3.5 w-3.5 mr-1.5" />
						Analyze
					</Button>
					<Button
						className="h-9 hover:border-destructive hover:bg-destructive/5"
						onClick={() =>
							focusTasks &&
							openAssistantWithPrompt(
								buildReschedulingPrompt(
									focusTasks.filter((task) => task.isOverdue)
								)
							)
						}
						size="sm"
						variant="outline"
					>
						<Zap className="h-3.5 w-3.5 mr-1.5" />
						Reschedule
					</Button>
				</div>
			</div>
		</WidgetCard>
	);
};
