"use client";

import { useState } from "react";
import { Id } from "@/../convex/_generated/dataModel";
import { useCreateMilestone } from "../api/use-milestones";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PRESET_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#64748b"];

interface CreateMilestoneModalProps {
    open: boolean;
    onClose: () => void;
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
}

export const CreateMilestoneModal = ({ open, onClose, projectId, workspaceId }: CreateMilestoneModalProps) => {
    const { mutate: createMilestone, isPending } = useCreateMilestone();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [targetDate, setTargetDate] = useState("");
    const [color, setColor] = useState(PRESET_COLORS[0]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        try {
            await createMilestone({ projectId, workspaceId, name: name.trim(), description: description.trim() || undefined, targetDate: targetDate ? new Date(targetDate).getTime() : undefined, color });
            toast.success("Milestone created");
            setName(""); setDescription(""); setTargetDate(""); setColor(PRESET_COLORS[0]);
            onClose();
        } catch { toast.error("Failed to create milestone"); }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create Milestone</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="milestone-name">Milestone name</Label>
                        <Input id="milestone-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MVP Launch, v2.0, Beta Release" required />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="milestone-desc">Description (optional)</Label>
                        <Textarea id="milestone-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this milestone represent?" rows={2} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="target-date">Target date (optional)</Label>
                        <Input id="target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Color</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {PRESET_COLORS.map((c) => (
                                <button key={c} type="button" className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                    style={{ backgroundColor: c, borderColor: color === c ? "#000" : "transparent" }}
                                    onClick={() => setColor(c)} />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isPending || !name.trim()}>{isPending ? "Creating..." : "Create milestone"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
