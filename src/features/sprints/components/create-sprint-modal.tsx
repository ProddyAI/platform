"use client";

import { useState } from "react";
import { Id } from "@/../convex/_generated/dataModel";
import { useCreateSprint } from "../api/use-sprint-mutations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreateSprintModalProps {
    open: boolean;
    onClose: () => void;
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
    sprintNumber?: number;
}

export const CreateSprintModal = ({ open, onClose, projectId, workspaceId, sprintNumber = 1 }: CreateSprintModalProps) => {
    const { mutate: createSprint, isPending } = useCreateSprint();
    const today = new Date();
    const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const [name, setName] = useState(`Sprint ${sprintNumber}`);
    const [goal, setGoal] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState(today.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(twoWeeks.toISOString().split("T")[0]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        if (end <= start) { toast.error("End date must be after start date"); return; }
        try {
            await createSprint({ projectId, workspaceId, name: name.trim(), goal: goal.trim() || undefined, description: description.trim() || undefined, startDate: start, endDate: end });
            toast.success("Sprint created");
            onClose();
        } catch { toast.error("Failed to create sprint"); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Sprint</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="sprint-name">Sprint name</Label>
                        <Input id="sprint-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 1" required />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="sprint-goal">Sprint goal</Label>
                        <Input id="sprint-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What will this sprint accomplish?" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="start-date">Start date</Label>
                            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="end-date">End date</Label>
                            <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="sprint-desc">Description (optional)</Label>
                        <Textarea id="sprint-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional context..." rows={2} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isPending || !name.trim()}>{isPending ? "Creating..." : "Create sprint"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
