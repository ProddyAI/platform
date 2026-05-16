"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Brain, CheckCircle2, Clock, Loader2, Sparkles, Target, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useGetDailyFocus } from "@/features/tasks/api/use-get-daily-focus";
import { useGetStressData } from "@/features/tasks/api/use-get-stress-data";
import { cn } from "@/lib/utils";
import { WidgetCard } from "../shared/widget-card";
import { buildDailyFocusPrompt, buildReschedulingPrompt, buildStressDetectionPrompt } from "@/lib/stress-prompts";

interface StressWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const StressWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: StressWidgetProps) => {
	const router = useRouter();
	const { data: metrics, isLoading: loadingMetrics } = useGetStressData({ workspaceId });
	const { data: focusTasks, isLoading: loadingFocus } = useGetDailyFocus({ workspaceId });

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
		low: { color: "bg-emerald-500", text: "text-emerald-500", label: "Healthy", icon: Zap },
		medium: { color: "bg-amber-500", text: "text-amber-500", label: "Elevated", icon: Brain },
		high: { color: "bg-rose-500", text: "text-rose-500", label: "High Stress", icon: AlertTriangle },
	} as const;

	const config = levelConfig[stressLevel as keyof typeof levelConfig] || levelConfig.low;

	return (
		<WidgetCard className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-background to-muted/30">
			<div className="p-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className={cn("p-2 rounded-lg bg-primary/10", config.text)}>
							<Brain className="h-5 w-5" />
						</div>
						<h3 className="font-bold text-lg tracking-tight">Stress & Focus</h3>
					</div>
					{isEditMode ? controls : (
						<Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
							Live Engine
						</Badge>
					)}
				</div>

				{/* Stress Meter Section */}
				<div className="space-y-4">
					<div className="flex items-end justify-between">
						<div className="space-y-1">
							<p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Current Load</p>
							<p className={cn("text-3xl font-black tracking-tighter", config.text)}>
								{stressScore}
								<span className="text-sm font-medium text-muted-foreground ml-1">/ 150</span>
							</p>
						</div>
						<div className="text-right">
							<Badge className={cn("mb-1", config.color, "text-white border-none shadow-sm")}>
								{config.label}
							</Badge>
							<p className="text-[10px] text-muted-foreground">Based on {metrics?.totalPending} pending tasks</p>
						</div>
					</div>
					
					<div className="relative h-3 w-full bg-muted rounded-full overflow-hidden shadow-inner">
						<div 
							className={cn("absolute h-full transition-all duration-1000 ease-out", config.color)} 
							style={{ width: `${Math.min((stressScore / 150) * 100, 100)}%` }}
						/>
					</div>

					{stressLevel === "high" && (
						<div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 animate-pulse">
							<div className="flex gap-2">
								<AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
								<p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
									High workload detected. Consider rescheduling non-urgent tasks or taking a short break.
								</p>
							</div>
						</div>
					)}
				</div>

				<Separator className="opacity-50" />

				{/* Focus Section */}
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Target className="h-4 w-4 text-primary" />
							<h4 className="text-sm font-bold uppercase tracking-tight">Daily Focus</h4>
						</div>
						<Button 
							variant="ghost" 
							size="sm" 
							className="h-7 text-[10px] uppercase font-bold text-primary hover:bg-primary/5"
							onClick={() => metrics && openAssistantWithPrompt(buildDailyFocusPrompt(focusTasks ?? []))}
						>
							<Sparkles className="h-3 w-3 mr-1" />
							AI Guide
						</Button>
					</div>

					<ScrollArea className="h-[180px] -mx-1 px-1">
						<div className="space-y-2">
							{focusTasks?.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
									<CheckCircle2 className="h-8 w-8 mb-2" />
									<p className="text-xs font-medium">All clear for today!</p>
								</div>
							) : focusTasks?.map((task: any) => (
								<div 
									key={task._id}
									className="group relative p-3 rounded-xl border bg-card hover:border-primary/30 transition-all duration-200"
								>
									<div className="flex items-start gap-3">
										<div className="space-y-1 min-w-0">
											<p className="text-sm font-semibold truncate leading-none">{task.title}</p>
											<div className="flex items-center gap-2">
												<Badge variant="secondary" className="text-[9px] h-4 px-1 capitalize">
													{task.priority || "medium"}
												</Badge>
												{task.dueDate && (() => {
													const due = new Date(task.dueDate);
													if (Number.isNaN(due.getTime())) return null;
													return (
														<span className={cn(
															"text-[9px] font-medium flex items-center gap-0.5",
															task.isOverdue ? "text-rose-500" : "text-muted-foreground"
														)}>
															<Clock className="h-2.5 w-2.5" />
															{formatDistanceToNow(due, { addSuffix: true })}
														</span>
													);
												})()}
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
				</div>

				{/* Quick AI Actions */}
				<div className="grid grid-cols-2 gap-2">
					<Button 
						variant="outline" 
						size="sm" 
						className="h-9 text-[10px] font-bold uppercase tracking-tight rounded-xl hover:border-primary hover:bg-primary/5 transition-all"
						onClick={() => metrics && openAssistantWithPrompt(buildStressDetectionPrompt(metrics))}
					>
						<Brain className="h-3.5 w-3.5 mr-1.5" />
						Analyze
					</Button>
					<Button 
						variant="outline" 
						size="sm" 
						className="h-9 text-[10px] font-bold uppercase tracking-tight rounded-xl hover:border-rose-500 hover:bg-rose-500/5 transition-all"
						onClick={() => focusTasks && openAssistantWithPrompt(buildReschedulingPrompt(focusTasks.filter((t: any) => t.isOverdue)))}
					>
						<Zap className="h-3.5 w-3.5 mr-1.5" />
						Reschedule
					</Button>
				</div>
			</div>
		</WidgetCard>
	);
};
