"use client";

import { format } from "date-fns";
import { Archive, CheckCircle, Flag, MoreHorizontal, Play } from "lucide-react";
import { toast } from "sonner";

import type { Doc } from "@/../convex/_generated/dataModel";
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
import {
	useGetMilestoneStats,
	useRemoveMilestone,
	useUpdateMilestone,
} from "../api/use-milestones";

type MilestoneStatus = Doc<"milestones">["status"];

export const MILESTONE_STATUS_CONFIG: Record<
	MilestoneStatus,
	{ label: string; className: string }
> = {
	planned: {
		label: "Planned",
		className: "bg-muted text-muted-foreground border-transparent",
	},
	in_progress: {
		label: "In Progress",
		className:
			"bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
	},
	completed: {
		label: "Completed",
		className:
			"bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
	},
	archived: {
		label: "Archived",
		className: "bg-muted text-muted-foreground/70 border-transparent",
	},
};

const DEFAULT_COLOR = "#6366f1";
const DAY_MS = 1000 * 60 * 60 * 24;

interface MilestoneCardProps {
	milestone: Doc<"milestones">;
	onClick?: () => void;
}

export const MilestoneCard = ({ milestone, onClick }: MilestoneCardProps) => {
	const { data: stats } = useGetMilestoneStats({ milestoneId: milestone._id });
	const { mutate: updateMilestone } = useUpdateMilestone();
	const { mutate: removeMilestone } = useRemoveMilestone();

	const color = milestone.color ?? DEFAULT_COLOR;
	const status = MILESTONE_STATUS_CONFIG[milestone.status];
	const isClosed =
		milestone.status === "completed" || milestone.status === "archived";
	const daysUntil = milestone.targetDate
		? Math.ceil((milestone.targetDate - Date.now()) / DAY_MS)
		: null;
	const isOverdue =
		milestone.targetDate !== undefined &&
		milestone.targetDate < Date.now() &&
		!isClosed;

	const handleStatusChange = async (next: MilestoneStatus) => {
		try {
			await updateMilestone({ milestoneId: milestone._id, status: next });
			toast.success(
				`Milestone marked as ${MILESTONE_STATUS_CONFIG[next].label}`
			);
		} catch {
			toast.error("Failed to update milestone");
		}
	};

	const handleDelete = async () => {
		try {
			await removeMilestone({ milestoneId: milestone._id });
			toast.success("Milestone deleted");
		} catch {
			toast.error("Failed to delete milestone");
		}
	};

	return (
		<button
			className={cn(
				"group w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md",
				milestone.status === "archived" && "opacity-60"
			)}
			onClick={onClick}
			type="button"
		>
			<div className="h-1 w-full" style={{ backgroundColor: color }} />
			<div className="p-4">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<div className="mb-1 flex items-center gap-2">
							<Flag className="size-3.5 shrink-0" style={{ color }} />
							<Badge
								className={cn("text-xs", status.className)}
								variant="outline"
							>
								{status.label}
							</Badge>
							{isOverdue && (
								<Badge
									className="border-destructive/20 bg-destructive/10 text-destructive text-xs"
									variant="outline"
								>
									Overdue
								</Badge>
							)}
						</div>
						<h3 className="truncate font-semibold text-sm">{milestone.name}</h3>
						{milestone.description && (
							<p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">
								{milestone.description}
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
							{milestone.status === "planned" && (
								<DropdownMenuItem
									onClick={() => handleStatusChange("in_progress")}
								>
									<Play className="mr-2 size-4 text-blue-500" />
									Mark in progress
								</DropdownMenuItem>
							)}
							{!isClosed && (
								<DropdownMenuItem
									onClick={() => handleStatusChange("completed")}
								>
									<CheckCircle className="mr-2 size-4 text-emerald-500" />
									Mark completed
								</DropdownMenuItem>
							)}
							{milestone.status !== "archived" && (
								<DropdownMenuItem
									onClick={() => handleStatusChange("archived")}
								>
									<Archive className="mr-2 size-4" />
									Archive
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={handleDelete}
							>
								Delete milestone
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{milestone.targetDate && (
					<div className="mt-2.5 flex items-center justify-between text-muted-foreground text-xs">
						<span>
							Target: {format(new Date(milestone.targetDate), "MMM d, yyyy")}
						</span>
						{daysUntil !== null && !isClosed && (
							<span
								className={cn(
									"font-medium",
									daysUntil < 0
										? "text-destructive"
										: daysUntil < 7
											? "text-orange-500"
											: "text-muted-foreground"
								)}
							>
								{daysUntil < 0
									? `${Math.abs(daysUntil)}d overdue`
									: daysUntil === 0
										? "Due today"
										: `${daysUntil}d left`}
							</span>
						)}
					</div>
				)}

				{stats && stats.total > 0 ? (
					<div className="mt-3 space-y-1.5">
						<div className="flex justify-between text-muted-foreground text-xs">
							<span>
								{stats.completed}/{stats.total} issues
							</span>
							<span className="font-medium text-foreground">
								{stats.completionRate}%
							</span>
						</div>
						<Progress className="h-1.5" value={stats.completionRate} />
					</div>
				) : (
					<p className="mt-3 text-muted-foreground text-xs">No issues linked</p>
				)}
			</div>
		</button>
	);
};
