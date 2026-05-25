"use client";

import { useState } from "react";
import { Id } from "@/../convex/_generated/dataModel";
import { useGetSprints } from "../api/use-get-sprints";
import { useRolloverSprint } from "../api/use-sprint-mutations";
import { SprintCard } from "./sprint-card";
import { SprintDetail } from "./sprint-detail";
import { CreateSprintModal } from "./create-sprint-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, ListTodo, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type SprintFilter = "all" | "planning" | "active" | "completed" | "cancelled";

interface SprintsPanelProps {
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
}

export const SprintsPanel = ({ projectId, workspaceId }: SprintsPanelProps) => {
    const { data: sprints, isLoading } = useGetSprints({ projectId, workspaceId });
    const { mutate: rollover } = useRolloverSprint();
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedSprintId, setSelectedSprintId] = useState<Id<"sprints"> | null>(null);
    const [filter, setFilter] = useState<SprintFilter>("all");

    const selectedSprint = sprints?.find((s) => s._id === selectedSprintId);
    const filtered = sprints?.filter((s) => filter === "all" ? true : s.status === filter);
    const totalActive = sprints?.filter((s) => s.status === "active").length ?? 0;
    const totalCompleted = sprints?.filter((s) => s.status === "completed").length ?? 0;
    const totalPlanning = sprints?.filter((s) => s.status === "planning").length ?? 0;

    const handleRollover = async (fromSprintId: Id<"sprints">) => {
        const target = sprints?.find((s) => s._id !== fromSprintId && (s.status === "planning" || s.status === "active"));
        if (!target) { toast.error("No target sprint found. Create a new sprint first."); return; }
        try {
            const result = await rollover({ fromSprintId, toSprintId: target._id });
            toast.success(`Rolled over ${result?.rolledOver ?? 0} incomplete issues to ${target.name}`);
        } catch { toast.error("Rollover failed"); }
    };

    if (selectedSprint) {
        return <div className="h-full flex flex-col"><SprintDetail sprint={selectedSprint} onBack={() => setSelectedSprintId(null)} /></div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
                <div>
                    <h1 className="text-lg font-semibold">Sprints</h1>
                    <p className="text-xs text-muted-foreground">Plan and track time-boxed iterations</p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />New sprint</Button>
            </div>
            {!isLoading && sprints && sprints.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-slate-50 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><Zap className="h-3 w-3 text-emerald-500" /><span className="font-medium">{totalActive}</span><span className="text-muted-foreground">active</span></div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><ListTodo className="h-3 w-3 text-slate-400" /><span className="font-medium">{totalPlanning}</span><span className="text-muted-foreground">planning</span></div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><CheckCircle className="h-3 w-3 text-blue-400" /><span className="font-medium">{totalCompleted}</span><span className="text-muted-foreground">completed</span></div>
                </div>
            )}
            {!isLoading && sprints && sprints.length > 0 && (
                <div className="px-4 py-2 border-b">
                    <Select value={filter} onValueChange={(v) => setFilter(v as SprintFilter)}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sprints</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}</div>
                ) : !filtered || filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"><Clock className="h-6 w-6 text-slate-400" /></div>
                        <h3 className="font-medium text-sm">{filter === "all" ? "No sprints yet" : `No ${filter} sprints`}</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{filter === "all" ? "Create your first sprint to start planning." : `No sprints with status "${filter}" found.`}</p>
                        {filter === "all" && <Button size="sm" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Create sprint</Button>}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((sprint) => <SprintCard key={sprint._id} sprint={sprint} onClick={() => setSelectedSprintId(sprint._id)} onRollover={handleRollover} />)}
                    </div>
                )}
            </div>
            <CreateSprintModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={projectId} workspaceId={workspaceId} sprintNumber={(sprints?.length ?? 0) + 1} />
        </div>
    );
};
