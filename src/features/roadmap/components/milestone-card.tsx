"use client";

import { Doc } from "@/../convex/_generated/dataModel";
import { useGetMilestoneStats, useUpdateMilestone, useRemoveMilestone } from "../api/use-milestones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Flag, CheckCircle, Archive, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
    planned: { label: "Planned", className: "bg-slate-100 text-slate-600 border-slate-200" },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
    completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    archived: { label: "Archived", className: "bg-slate-100 text-slate-400 border-slate-200" },
} as const;

interface MilestoneCardProps {
    milestone: Doc<"milestones">;
    onClick?: () => void;
}

export const MilestoneCard = ({ milestone, onClick }: MilestoneCardProps) => {
    const { data: stats } = useGetMilestoneStats({ milestoneId: milestone._id });
    const { mutate: updateMilestone } = useUpdateMilestone();
    const { mutate: removeMilestone } = useRemoveMilestone();
    const color = milestone.color ?? "#6366f1";
    const statusConfig = STATUS_CONFIG[milestone.status];
    const isOverdue = milestone.targetDate && milestone.targetDate < Date.now() && milestone.status !== "completed" && milestone.status !== "archived";
    const daysUntil = milestone.targetDate ? Math.ceil((milestone.targetDate - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const formatDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

    const handleStatusChange = async (status: "planned" | "in_progress" | "completed" | "archived") => {
        try { await updateMilestone({ milestoneId: milestone._id, status }); toast.success(`Milestone marked as ${STATUS_CONFIG[status].label}`); }
        catch { toast.error("Failed to update milestone"); }
    };

    const handleDelete = async () => {
        try { await removeMilestone({ milestoneId: milestone._id }); toast.success("Milestone deleted"); }
        catch { toast.error("Failed to delete milestone"); }
    };

    return (
        <div className={cn("group rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden", milestone.status === "archived" && "opacity-60")} onClick={onClick}>
            <div className="h-1 w-full" style={{ backgroundColor: color }} />
            <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Flag className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                            <Badge variant="outline" className={cn("text-xs", statusConfig.className)}>{statusConfig.label}</Badge>
                            {isOverdue && <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">Overdue</Badge>}
                        </div>
                        <h3 className="font-semibold text-sm truncate">{milestone.name}</h3>
                        {milestone.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{milestone.description}</p>}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {milestone.status === "planned" && <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}><Play className="mr-2 h-4 w-4 text-blue-500" />Mark in progress</DropdownMenuItem>}
                            {milestone.status !== "completed" && milestone.status !== "archived" && <DropdownMenuItem onClick={() => handleStatusChange("completed")}><CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />Mark completed</DropdownMenuItem>}
                            {milestone.status !== "archived" && <DropdownMenuItem onClick={() => handleStatusChange("archived")}><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDelete}>Delete milestone</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                {milestone.targetDate && (
                    <div className="flex items-center justify-between mt-2.5 text-xs text-muted-foreground">
                        <span>Target: {formatDate(milestone.targetDate)}</span>
                        {daysUntil !== null && milestone.status !== "completed" && milestone.status !== "archived" && (
                            <span className={cn("font-medium", daysUntil < 0 ? "text-red-500" : daysUntil < 7 ? "text-orange-500" : "text-slate-500")}>
                                {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? "Due today" : `${daysUntil}d left`}
                            </span>
                        )}
                    </div>
                )}
                {stats && stats.total > 0 && (
                    <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{stats.completed}/{stats.total} issues</span>
                            <span className="font-medium">{stats.completionRate}%</span>
                        </div>
                        <Progress value={stats.completionRate} className="h-1.5" />
                    </div>
                )}
                {stats?.total === 0 && <p className="text-xs text-muted-foreground mt-3">No issues linked</p>}
            </div>
        </div>
    );
};
