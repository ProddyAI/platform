"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCreateMilestone } from "../api/use-milestones";

const PRESET_COLORS = [
	{ hex: "#6366f1", name: "Indigo" },
	{ hex: "#8b5cf6", name: "Violet" },
	{ hex: "#ec4899", name: "Pink" },
	{ hex: "#ef4444", name: "Red" },
	{ hex: "#f97316", name: "Orange" },
	{ hex: "#eab308", name: "Yellow" },
	{ hex: "#22c55e", name: "Green" },
	{ hex: "#06b6d4", name: "Cyan" },
	{ hex: "#3b82f6", name: "Blue" },
	{ hex: "#64748b", name: "Slate" },
];

interface CreateMilestoneModalProps {
	open: boolean;
	onClose: () => void;
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const CreateMilestoneModal = ({
	open,
	onClose,
	projectId,
	workspaceId,
}: CreateMilestoneModalProps) => {
	const { mutate: createMilestone, isPending } = useCreateMilestone();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [targetDate, setTargetDate] = useState("");
	const [color, setColor] = useState(PRESET_COLORS[0].hex);

	const resetForm = () => {
		setName("");
		setDescription("");
		setTargetDate("");
		setColor(PRESET_COLORS[0].hex);
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) return;

		try {
			await createMilestone({
				projectId,
				workspaceId,
				name: name.trim(),
				description: description.trim() || undefined,
				targetDate: targetDate ? new Date(targetDate).getTime() : undefined,
				color,
			});
			toast.success("Milestone created");
			resetForm();
			onClose();
		} catch {
			toast.error("Failed to create milestone");
		}
	};

	return (
		<Dialog onOpenChange={(value) => !value && onClose()} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create milestone</DialogTitle>
					<DialogDescription>
						Milestones group issues toward a longer-term goal on the roadmap.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4 pt-1" onSubmit={handleSubmit}>
					<div className="space-y-1.5">
						<Label htmlFor="milestone-name">Milestone name</Label>
						<Input
							id="milestone-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. MVP Launch, v2.0, Beta"
							required
							value={name}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="milestone-description">
							Description (optional)
						</Label>
						<Textarea
							id="milestone-description"
							onChange={(event) => setDescription(event.target.value)}
							placeholder="What does this milestone represent?"
							rows={2}
							value={description}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="milestone-target">Target date (optional)</Label>
						<Input
							id="milestone-target"
							min={new Date().toISOString().split("T")[0]}
							onChange={(event) => setTargetDate(event.target.value)}
							type="date"
							value={targetDate}
						/>
					</div>

					<div className="space-y-1.5">
						<Label>Color</Label>
						<div className="flex flex-wrap items-center gap-2">
							{PRESET_COLORS.map((preset) => (
								<button
									aria-label={`Select color ${preset.name}`}
									className={cn(
										"size-6 rounded-full ring-offset-2 ring-offset-background transition-colors hover:ring-2 hover:ring-muted-foreground",
										color === preset.hex && "ring-2 ring-foreground"
									)}
									key={preset.hex}
									onClick={() => setColor(preset.hex)}
									style={{ backgroundColor: preset.hex }}
									type="button"
								/>
							))}
						</div>
					</div>

					<div className="flex justify-end gap-2 pt-1">
						<Button onClick={onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={isPending || !name.trim()} type="submit">
							{isPending ? "Creating..." : "Create milestone"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};
