"use client";

import { useState } from "react";
import { Id } from "@/../convex/_generated/dataModel";
import { useGetMilestones } from "../api/use-milestones";
import { MilestoneCard } from "./milestone-card";
import { CreateMilestoneModal } from "./create-milestone-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Flag } from "lucide-react";

type StatusFilter = "all" | "planned" | "in_progress" | "completed" | "archived";

interface RoadmapPanelProps {
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
}

export const RoadmapPanel = ({ projectId, workspaceId }: RoadmapPanelProps) => {
    const { data: milestones, isLoading } = useGetMilestones({ projectId, workspaceId });
    const [createOpen, setCreateOpen] = useState(false);
    const [filter, setFilter] = useState<StatusFilter>("all");

    const filtered = milestones?.filter((m) => filter === "all" ? true : m.status === filter);
    const count = (s: string) => milestones?.filter((m) => m.status === s).length ?? 0;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
                <div>
                    <h1 className="text-lg font-semibold">Roadmap</h1>
                    <p className="text-xs text-muted-foreground">Strategic milestones and long-term goals</p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />New milestone</Button>
            </div>
            {!isLoading && milestones && milestones.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-slate-50 flex-wrap">
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-slate-400 inline-block" /><span className="font-medium">{count("planned")}</span><span className="text-muted-foreground">planned</span></div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" /><span className="font-medium">{count("in_progress")}</span><span className="text-muted-foreground">in progress</span></div>
                    <div className="flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" /><span className="font-medium">{count("completed")}</span><span className="text-muted-foreground">completed</span></div>
                </div>
            )}
            {!isLoading && milestones && milestones.length > 0 && (
                <div className="px-4 py-2 border-b">
                    <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All milestones</SelectItem>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="flex-1 overflow-auto p-4">
                {isLoading ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>
                ) : !filtered || filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3"><Flag className="h-6 w-6 text-slate-400" /></div>
                        <h3 className="font-medium text-sm">{filter === "all" ? "No milestones yet" : `No ${filter.replace("_", " ")} milestones`}</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{filter === "all" ? "Define milestones to map out your product roadmap." : "No milestones with this status found."}</p>
                        {filter === "all" && <Button size="sm" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Create milestone</Button>}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((milestone) => <MilestoneCard key={milestone._id} milestone={milestone} />)}
                    </div>
                )}
            </div>
            <CreateMilestoneModal open={createOpen} onClose={() => setCreateOpen(false)} projectId={projectId} workspaceId={workspaceId} />
        </div>
    );
};
