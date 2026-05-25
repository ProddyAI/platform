"use client";

import { Doc, Id } from "@/../convex/_generated/dataModel";
import { useGetSprintIssues, useGetSprintStats } from "../api/use-get-sprint-details";
import { useRemoveSprintIssue } from "../api/use-sprint-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { X, AlertCircle, Circle, CheckCircle2, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRIORITY_CONFIG = {
    urgent: { label: "Urgent", className: "text-red-600" },
    high: { label: "High", className: "text-orange-500" },
    medium: { label: "Medium", className: "text-yellow-500" },
    low: { label: "Low", className: "text-blue-400" },
    no_priority: { label: "No priority", className: "text-slate-400" },
} as const;

interface SprintDetailProps {
    sprint: Doc<"sprints">;
    onBack: () => void;
}

export const SprintDetail = ({ sprint, onBack }: SprintDetailProps) => {
    const { data: issues, isLoading } = useGetSprintIssues({ sprintId: sprint._id });
    const { data: stats } = useGetSprintStats({ sprintId: sprint._id });
    const { mutate: removeIssue } = useRemoveSprintIssue();

    const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    const handleRemove = async (issueId: Id<"issues">) => {
        try { await removeIssue({ sprintId: sprint._id, issueId }); toast.success("Issue removed from sprint"); }
        catch { toast.error("Failed to remove issue"); }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-4 border-b">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}><ChevronRight className="h-4 w-4 rotate-180" /></Button>
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">{sprint.name}</h2>
                    <p className="text-xs text-muted-foreground">{formatDate(sprint.startDate)} ? {formatDate(sprint.endDate)}</p>
                </div>
            </div>
            {sprint.goal && (
                <div className="px-4 py-3 bg-slate-50 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Sprint goal</p>
                    <p className="text-sm">{sprint.goal}</p>
                </div>
            )}
            {stats && (
                <div className="px-4 py-3 border-b space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold">{stats.completionRate}%</span>
                    </div>
                    <Progress value={stats.completionRate} className="h-2" />
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-slate-50 p-2"><div className="font-semibold text-base">{stats.notStarted}</div><div className="text-muted-foreground">Todo</div></div>
                        <div className="rounded-md bg-blue-50 p-2"><div className="font-semibold text-base text-blue-600">{stats.inProgress}</div><div className="text-muted-foreground">In progress</div></div>
                        <div className="rounded-md bg-emerald-50 p-2"><div className="font-semibold text-base text-emerald-600">{stats.completed}</div><div className="text-muted-foreground">Done</div></div>
                    </div>
                    {sprint.status === "active" && (
                        <div className="flex justify-between text-xs text-muted-foreground pt-1">
                            <span>{stats.daysElapsed}d elapsed</span>
                            <span>{stats.daysRemaining}d remaining</span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issues ({issues.length})</span>
            </div>
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                        <p className="text-sm text-muted-foreground">No issues in this sprint yet</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {issues.map((issue) => {
                            if (!issue) return null;
                            const statusName = issue.status?.name?.toLowerCase() ?? "";
                            const isDone = statusName.includes("done") || statusName.includes("completed") || statusName.includes("closed");
                            const isInProgress = statusName.includes("progress") || statusName.includes("review");
                            return (
                                <div key={issue._id} className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                                    <div className="shrink-0 mt-0.5">
                                        {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : isInProgress ? <Clock className="h-4 w-4 text-blue-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-sm font-medium truncate", isDone && "line-through text-muted-foreground")}>{issue.title}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {issue.status && <span className="text-xs text-muted-foreground">{issue.status.name}</span>}
                                            {issue.priority && issue.priority !== "no_priority" && (
                                                <span className={cn("text-xs font-medium", PRIORITY_CONFIG[issue.priority as keyof typeof PRIORITY_CONFIG]?.className)}>
                                                    {PRIORITY_CONFIG[issue.priority as keyof typeof PRIORITY_CONFIG]?.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => handleRemove(issue._id as Id<"issues">)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
