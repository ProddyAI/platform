"use client";

import { Doc, Id } from "@/../convex/_generated/dataModel";
import { useGetSprintStats } from "../api/use-get-sprint-details";
import { useUpdateSprint, useRemoveSprint } from "../api/use-sprint-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
    planning: { label: "Planning", className: "bg-slate-100 text-slate-700 border-slate-200" },
    active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    completed: { label: "Completed", className: "bg-blue-100 text-blue-700 border-blue-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
} as const;

interface SprintCardProps {
    sprint: Doc<"sprints">;
    onClick?: () => void;
    onRollover?: (sprintId: Id<"sprints">) => void;
}

export const SprintCard = ({ sprint, onClick, onRollover }: SprintCardProps) => {
    const { data: stats } = useGetSprintStats({ sprintId: sprint._id });
    const { mutate: updateSprint } = useUpdateSprint();
    const { mutate: removeSprint } = useRemoveSprint();
    const statusConfig = STATUS_CONFIG[sprint.status];
    const now = Date.now();
    const isOverdue = sprint.status === "active" && sprint.endDate < now;
    const daysLeft = Math.max(0, Math.ceil((sprint.endDate - now) / (1000 * 60 * 60 * 24)));
    const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const handleStatusChange = async (status: "planning" | "active" | "completed" | "cancelled") => {
        try { await updateSprint({ sprintId: sprint._id, status }); toast.success(`Sprint marked as ${STATUS_CONFIG[status].label}`); }
        catch { toast.error("Failed to update sprint"); }
    };

    const handleDelete = async () => {
        try { await removeSprint({ sprintId: sprint._id }); toast.success("Sprint deleted"); }
        catch { toast.error("Failed to delete sprint"); }
    };

    return (
        <div className={cn("group rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md cursor-pointer", sprint.status === "active" && "border-emerald-200 ring-1 ring-emerald-100")} onClick={onClick}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
                        {isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">Overdue</Badge>}
                    </div>
                    <h3 className="font-semibold text-sm truncate">{sprint.name}</h3>
                    {sprint.goal && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sprint.goal}</p>}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        {sprint.status === "planning" && <DropdownMenuItem onClick={() => handleStatusChange("active")}><Play className="mr-2 h-4 w-4 text-emerald-500" />Start sprint</DropdownMenuItem>}
                        {sprint.status === "active" && <>
                            <DropdownMenuItem onClick={() => handleStatusChange("completed")}><CheckCircle className="mr-2 h-4 w-4 text-blue-500" />Complete sprint</DropdownMenuItem>
                            {onRollover && <DropdownMenuItem onClick={() => onRollover(sprint._id)}><RefreshCw className="mr-2 h-4 w-4" />Rollover incomplete</DropdownMenuItem>}
                        </>}
                        {sprint.status !== "cancelled" && sprint.status !== "completed" && <DropdownMenuItem onClick={() => handleStatusChange("cancelled")}><XCircle className="mr-2 h-4 w-4 text-red-500" />Cancel sprint</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">Delete sprint</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2.5">
                <span>{formatDate(sprint.startDate)}</span><span>?</span><span>{formatDate(sprint.endDate)}</span>
                {sprint.status === "active" && daysLeft > 0 && <span className="ml-auto font-medium text-slate-600">{daysLeft}d left</span>}
            </div>
            {stats && stats.total > 0 && (
                <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{stats.completed}/{stats.total} issues</span>
                        <span className="font-medium">{stats.completionRate}%</span>
                    </div>
                    <Progress value={stats.completionRate} className="h-1.5" />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />{stats.completed} done</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />{stats.inProgress} in progress</span>
                        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-300 inline-block" />{stats.notStarted} todo</span>
                    </div>
                </div>
            )}
            {stats?.total === 0 && <p className="text-xs text-muted-foreground mt-3">No issues added yet</p>}
        </div>
    );
};
