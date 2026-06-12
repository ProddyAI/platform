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
import { useCreateSprint } from "../api/use-sprint-mutations";

interface CreateSprintModalProps {
	open: boolean;
	onClose: () => void;
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
	sprintNumber?: number;
}

const toDateInput = (date: Date) => date.toISOString().split("T")[0];

export const CreateSprintModal = ({
	open,
	onClose,
	projectId,
	workspaceId,
	sprintNumber = 1,
}: CreateSprintModalProps) => {
	const { mutate: createSprint, isPending } = useCreateSprint();

	const today = new Date();
	const twoWeeksOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

	const [name, setName] = useState(`Sprint ${sprintNumber}`);
	const [goal, setGoal] = useState("");
	const [description, setDescription] = useState("");
	const [startDate, setStartDate] = useState(toDateInput(today));
	const [endDate, setEndDate] = useState(toDateInput(twoWeeksOut));

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!name.trim()) return;

		const start = new Date(startDate).getTime();
		const end = new Date(endDate).getTime();
		if (end <= start) {
			toast.error("End date must be after the start date");
			return;
		}

		try {
			await createSprint({
				projectId,
				workspaceId,
				name: name.trim(),
				goal: goal.trim() || undefined,
				description: description.trim() || undefined,
				startDate: start,
				endDate: end,
			});
			toast.success("Sprint created");
			onClose();
		} catch {
			toast.error("Failed to create sprint");
		}
	};

	return (
		<Dialog onOpenChange={(value) => !value && onClose()} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Create sprint</DialogTitle>
					<DialogDescription>
						Plan a time-boxed iteration, then pull issues from the board into
						it.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4 pt-1" onSubmit={handleSubmit}>
					<div className="space-y-1.5">
						<Label htmlFor="sprint-name">Sprint name</Label>
						<Input
							autoFocus
							id="sprint-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Sprint 1"
							required
							value={name}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="sprint-goal">Sprint goal</Label>
						<Input
							id="sprint-goal"
							onChange={(event) => setGoal(event.target.value)}
							placeholder="What should this sprint accomplish?"
							value={goal}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="sprint-start">Start date</Label>
							<Input
								id="sprint-start"
								onChange={(event) => setStartDate(event.target.value)}
								required
								type="date"
								value={startDate}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="sprint-end">End date</Label>
							<Input
								id="sprint-end"
								onChange={(event) => setEndDate(event.target.value)}
								required
								type="date"
								value={endDate}
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="sprint-description">Description (optional)</Label>
						<Textarea
							id="sprint-description"
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Additional context..."
							rows={2}
							value={description}
						/>
					</div>

					<div className="flex justify-end gap-2 pt-1">
						<Button onClick={onClose} type="button" variant="outline">
							Cancel
						</Button>
						<Button disabled={isPending || !name.trim()} type="submit">
							{isPending ? "Creating..." : "Create sprint"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
};
