"use client";

import { format } from "date-fns";
import {
	CheckCircle2,
	MoreHorizontal,
	Play,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { toast } from "sonner";

import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useGetSprintStats } from "../api/use-get-sprint-details";
import { useRemoveSprint, useUpdateSprint } from "../api/use-sprint-mutations";

type SprintStatus = Doc<"sprints">["status"];

export const SPRINT_STATUS_CONFIG: Record<
	SprintStatus,
	{ label: string; className: string }
> = {
	planning: {
		label: "Planning",
		className: "bg-muted text-muted-foreground border-transparent",
	},
	active: {
		label: "Active",
		className:
			"bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
	},
	completed: {
		label: "Completed",
		className:
			"bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
	},
	cancelled: {
		label: "Cancelled",
		className: "bg-destructive/10 text-destructive border-destructive/20",
	},
};

const DAY_MS = 1000 * 60 * 60 * 24;

interface SprintCardProps {
	sprint: Doc<"sprints">;
	onClick?: () => void;
	onRollover?: (sprintId: Id<"sprints">) => void;
}

export const SprintCard = ({
	sprint,
	onClick,
	onRollover,
}: SprintCardProps) => {
	const { data: stats } = useGetSprintStats({ sprintId: sprint._id });
	const { mutate: updateSprint } = useUpdateSprint();
	const { mutate: removeSprint } = useRemoveSprint();

	const status = SPRINT_STATUS_CONFIG[sprint.status];
	const now = Date.now();
	const isOverdue = sprint.status === "active" && sprint.endDate < now;
	const daysLeft = Math.max(0, Math.ceil((sprint.endDate - now) / DAY_MS));

	const handleStatusChange = async (next: SprintStatus) => {
		try {
			await updateSprint({ sprintId: sprint._id, status: next });
			toast.success(`Sprint marked as ${SPRINT_STATUS_CONFIG[next].label}`);
		} catch {
			toast.error("Failed to update sprint");
		}
	};

	const handleDelete = async () => {
		try {
			await removeSprint({ sprintId: sprint._id });
			toast.success("Sprint deleted");
		} catch {
			toast.error("Failed to delete sprint");
		}
	};

	return (
		<button
			className={cn(
				"group w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md",
				sprint.status === "active" && "border-primary/40 ring-1 ring-primary/20"
			)}
			onClick={onClick}
			type="button"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex items-center gap-2">
						<Badge
							className={cn("text-xs", status.className)}
							variant="outline"
						>
							{status.label}
						</Badge>
						{isOverdue && (
							<Badge
								className="border-destructive/20 bg-destructive/10 text-xs text-destructive"
								variant="outline"
							>
								Overdue
							</Badge>
						)}
					</div>
					<h3 className="truncate font-semibold text-sm">{sprint.name}</h3>
					{sprint.goal && (
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{sprint.goal}
						</p>
					)}
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger
						asChild
						onClick={(event) => event.stopPropagation()}
					>
						<Button
							className="size-7 shrink-0 opacity-0 group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						onClick={(event) => event.stopPropagation()}
					>
						{sprint.status === "planning" && (
							<DropdownMenuItem onClick={() => handleStatusChange("active")}>
								<Play className="mr-2 size-4 text-emerald-500" />
								Start sprint
							</DropdownMenuItem>
						)}
						{sprint.status === "active" && (
							<>
								<DropdownMenuItem
									onClick={() => handleStatusChange("completed")}
								>
									<CheckCircle2 className="mr-2 size-4 text-blue-500" />
									Complete sprint
								</DropdownMenuItem>
								{onRollover && (
									<DropdownMenuItem onClick={() => onRollover(sprint._id)}>
										<RefreshCw className="mr-2 size-4" />
										Roll over incomplete
									</DropdownMenuItem>
								)}
							</>
						)}
						{sprint.status !== "cancelled" && sprint.status !== "completed" && (
							<DropdownMenuItem onClick={() => handleStatusChange("cancelled")}>
								<XCircle className="mr-2 size-4 text-destructive" />
								Cancel sprint
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={handleDelete}
						>
							Delete sprint
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="mt-2.5 flex items-center gap-1.5 text-muted-foreground text-xs">
				<span>{format(new Date(sprint.startDate), "MMM d")}</span>
				<span aria-hidden>→</span>
				<span>{format(new Date(sprint.endDate), "MMM d")}</span>
				{sprint.status === "active" && daysLeft > 0 && (
					<span className="ml-auto font-medium text-foreground">
						{daysLeft}d left
					</span>
				)}
			</div>

			{stats && stats.total > 0 ? (
				<div className="mt-3 space-y-1.5">
					<div className="flex items-center justify-between text-muted-foreground text-xs">
						<span>
							{stats.completed}/{stats.total} issues
						</span>
						<span className="font-medium text-foreground">
							{stats.completionRate}%
						</span>
					</div>
					<Progress className="h-1.5" value={stats.completionRate} />
					<div className="flex items-center gap-3 text-muted-foreground text-xs">
						<span className="flex items-center gap-1">
							<span className="inline-block size-1.5 rounded-full bg-emerald-400" />
							{stats.completed} done
						</span>
						<span className="flex items-center gap-1">
							<span className="inline-block size-1.5 rounded-full bg-blue-400" />
							{stats.inProgress} in progress
						</span>
						<span className="flex items-center gap-1">
							<span className="inline-block size-1.5 rounded-full bg-muted-foreground/30" />
							{stats.notStarted} to do
						</span>
					</div>
				</div>
			) : (
				<p className="mt-3 text-muted-foreground text-xs">
					No issues added yet
				</p>
			)}
		</button>
	);
};
