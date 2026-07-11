"use client";

import { format } from "date-fns";
import { Archive, CheckCircle, Flag, MoreHorizontal, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Doc } from "@/../convex/_generated/dataModel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
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
		className: "bg-primary/10 text-primary border-primary/20",
	},
	completed: {
		label: "Completed",
		className: "bg-success/10 text-success border-success/20",
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
	const { data: stats, isLoading: isLoadingStats } = useGetMilestoneStats({
		milestoneId: milestone._id,
	});
	const { mutate: updateMilestone } = useUpdateMilestone();
	const { mutate: removeMilestone } = useRemoveMilestone();
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
		<div
			className={cn(
				"group w-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-[transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
				milestone.status === "archived" && "opacity-60"
			)}
		>
			<div className="h-0.5 w-full" style={{ backgroundColor: color }} />
			<div className="p-4">
				<div className="flex items-start justify-between gap-2">
					<button
						aria-label={`Open milestone ${milestone.name}`}
						className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						onClick={onClick}
						type="button"
					>
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
					</button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								aria-label={`More actions for ${milestone.name}`}
								className="size-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
								size="icon"
								variant="ghost"
							>
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{milestone.status === "planned" && (
								<DropdownMenuItem
									onClick={() => handleStatusChange("in_progress")}
								>
									<Play className="mr-2 size-4 text-primary" />
									Mark in progress
								</DropdownMenuItem>
							)}
							{!isClosed && (
								<DropdownMenuItem
									onClick={() => handleStatusChange("completed")}
								>
									<CheckCircle className="mr-2 size-4 text-success" />
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
								onClick={() => setConfirmDeleteOpen(true)}
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
											? "text-warning"
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

				{isLoadingStats ? (
					<div className="mt-3 space-y-1.5">
						<Skeleton className="h-3.5 w-24" />
						<Skeleton className="h-1.5 w-full" />
					</div>
				) : stats && stats.total > 0 ? (
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

			<AlertDialog onOpenChange={setConfirmDeleteOpen} open={confirmDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete milestone?</AlertDialogTitle>
						<AlertDialogDescription>
							{stats && stats.total > 0
								? `"${milestone.name}" will be removed. Its ${stats.total} linked issue${stats.total === 1 ? "" : "s"} stay on the board.`
								: `"${milestone.name}" will be removed. This can't be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								handleDelete();
								setConfirmDeleteOpen(false);
							}}
						>
							Delete milestone
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
