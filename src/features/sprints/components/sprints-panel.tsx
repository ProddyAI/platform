"use client";

import { CheckCircle, Clock, ListTodo, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetSprints } from "../api/use-get-sprints";
import { useRolloverSprint } from "../api/use-sprint-mutations";
import { CreateSprintModal } from "./create-sprint-modal";
import { SprintCard } from "./sprint-card";
import { SprintDetail } from "./sprint-detail";

type SprintFilter = "all" | Doc<"sprints">["status"];

interface SprintsPanelProps {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const SprintsPanel = ({ projectId, workspaceId }: SprintsPanelProps) => {
	const { data: sprints, isLoading } = useGetSprints({
		projectId,
		workspaceId,
	});
	const { mutate: rollover } = useRolloverSprint();

	const [createOpen, setCreateOpen] = useState(false);
	const [selectedSprintId, setSelectedSprintId] =
		useState<Id<"sprints"> | null>(null);
	const [filter, setFilter] = useState<SprintFilter>("all");

	const selectedSprint = sprints?.find(
		(sprint) => sprint._id === selectedSprintId
	);
	const filtered = sprints?.filter((sprint) =>
		filter === "all" ? true : sprint.status === filter
	);
	const countOf = (status: Doc<"sprints">["status"]) =>
		sprints?.filter((sprint) => sprint.status === status).length ?? 0;

	const handleRollover = async (fromSprintId: Id<"sprints">) => {
		const target = sprints?.find(
			(sprint) =>
				sprint._id !== fromSprintId &&
				(sprint.status === "planning" || sprint.status === "active")
		);
		if (!target) {
			toast.error("Create another planning sprint to roll issues into first.");
			return;
		}
		try {
			const result = await rollover({
				fromSprintId,
				toSprintId: target._id,
			});
			toast.success(
				`Rolled over ${result?.rolledOver ?? 0} incomplete issues to ${target.name}`
			);
		} catch {
			toast.error("Rollover failed");
		}
	};

	if (selectedSprint) {
		return (
			<SprintDetail
				onBack={() => setSelectedSprintId(null)}
				sprint={selectedSprint}
			/>
		);
	}

	const hasSprints = !isLoading && sprints && sprints.length > 0;

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b p-4">
				<div>
					<h1 className="font-semibold text-lg">Sprints</h1>
					<p className="text-muted-foreground text-xs">
						Plan and track time-boxed iterations
					</p>
				</div>
				<Button onClick={() => setCreateOpen(true)} size="sm">
					<Plus className="mr-1 size-4" />
					New sprint
				</Button>
			</div>

			{hasSprints && (
				<div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
					<div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
						<Zap className="size-3 text-emerald-500" />
						<span className="font-medium">{countOf("active")}</span>
						<span className="text-muted-foreground">active</span>
					</div>
					<div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
						<ListTodo className="size-3 text-muted-foreground" />
						<span className="font-medium">{countOf("planning")}</span>
						<span className="text-muted-foreground">planning</span>
					</div>
					<div className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
						<CheckCircle className="size-3 text-blue-400" />
						<span className="font-medium">{countOf("completed")}</span>
						<span className="text-muted-foreground">completed</span>
					</div>

					<Select
						onValueChange={(value) => setFilter(value as SprintFilter)}
						value={filter}
					>
						<SelectTrigger className="ml-auto h-8 w-36 text-xs">
							<SelectValue />
						</SelectTrigger>
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
					<div className="space-y-3">
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton className="h-36 w-full rounded-lg" key={index} />
						))}
					</div>
				) : !filtered || filtered.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center py-16 text-center">
						<div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
							<Clock className="size-6 text-muted-foreground" />
						</div>
						<h3 className="font-medium text-sm">
							{filter === "all" ? "No sprints yet" : `No ${filter} sprints`}
						</h3>
						<p className="mt-1 max-w-xs text-muted-foreground text-xs">
							{filter === "all"
								? "Create your first sprint to start planning."
								: `No sprints with status “${filter}” found.`}
						</p>
						{filter === "all" && (
							<Button
								className="mt-4"
								onClick={() => setCreateOpen(true)}
								size="sm"
								variant="outline"
							>
								<Plus className="mr-1 size-4" />
								Create sprint
							</Button>
						)}
					</div>
				) : (
					<div className="space-y-3">
						{filtered.map((sprint) => (
							<SprintCard
								key={sprint._id}
								onClick={() => setSelectedSprintId(sprint._id)}
								onRollover={handleRollover}
								sprint={sprint}
							/>
						))}
					</div>
				)}
			</div>

			<CreateSprintModal
				onClose={() => setCreateOpen(false)}
				open={createOpen}
				projectId={projectId}
				sprintNumber={(sprints?.length ?? 0) + 1}
				workspaceId={workspaceId}
			/>
		</div>
	);
};
