"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { CheckCircle2, Circle, Clock, Edit, Trash } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useDeleteTask } from "../api/use-delete-task";
import { useGetTaskCategories } from "../api/use-get-task-categories";
import { useToggleTaskCompletion } from "../api/use-toggle-task-completion";
import { TaskEditForm } from "./task-edit-form";

interface TaskItemProps {
	id: Id<"tasks">;
	title: string;
	description?: string;
	completed: boolean;
	dueDate?: number;
	priority?: "low" | "medium" | "high";
	categoryId?: Id<"categories">;
	workspaceId: Id<"workspaces">;
}

// Same ramp as board-issue-row.tsx (urgent/high/medium/low): high→warning,
// medium→primary, low→muted-foreground. Tasks don't have an "urgent" tier.
const PRIORITY_CONFIG: Record<
	"low" | "medium" | "high",
	{ label: string; dotClassName: string; badgeClassName: string }
> = {
	high: {
		label: "High",
		dotClassName: "bg-warning",
		badgeClassName: "bg-warning/10 text-warning border-transparent",
	},
	medium: {
		label: "Medium",
		dotClassName: "bg-primary",
		badgeClassName: "bg-primary/10 text-primary border-transparent",
	},
	low: {
		label: "Low",
		dotClassName: "bg-muted-foreground/60",
		badgeClassName: "bg-muted text-muted-foreground border-transparent",
	},
};

export const TaskItem = ({
	id,
	title,
	description,
	completed,
	dueDate,
	priority,
	categoryId,
	workspaceId,
}: TaskItemProps) => {
	const [isEditing, setIsEditing] = useState(false);
	const toggleCompletion = useToggleTaskCompletion();
	const deleteTask = useDeleteTask();
	const [isDeleting, setIsDeleting] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const { data: categories } = useGetTaskCategories({ workspaceId });

	const category = categories?.find((cat) => cat._id === categoryId);

	const handleToggleCompletion = async () => {
		try {
			await toggleCompletion({ id });
		} catch (error) {
			console.error("Failed to toggle task completion:", error);
		}
	};

	const handleDelete = async () => {
		try {
			setIsDeleting(true);
			await deleteTask({ id });
		} catch (error) {
			console.error("Failed to delete task:", error);
			setIsDeleting(false);
		}
	};

	const getStatusIcon = (completed: boolean) => {
		return completed ? (
			<CheckCircle2 className="size-5 text-success" />
		) : (
			<Circle className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
		);
	};

	if (isEditing) {
		return (
			<TaskEditForm
				id={id}
				initialCategoryId={categoryId}
				initialDescription={description}
				initialDueDate={dueDate ? new Date(dueDate) : undefined}
				initialPriority={priority}
				initialTitle={title}
				onCancel={() => setIsEditing(false)}
				onSave={() => setIsEditing(false)}
				workspaceId={workspaceId}
			/>
		);
	}

	return (
		<div
			className={cn(
				"group rounded-2xl border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
				completed && "opacity-70"
			)}
		>
			<div className="flex items-start gap-4">
				<button
					aria-label={completed ? "Mark as incomplete" : "Mark as complete"}
					className="mt-0.5 flex-shrink-0 focus:outline-none group/checkbox"
					onClick={handleToggleCompletion}
					type="button"
				>
					{getStatusIcon(completed)}
				</button>
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<h3
							className={cn(
								"font-medium text-base flex-1 min-w-0 break-words",
								completed
									? "line-through text-muted-foreground"
									: "text-foreground"
							)}
						>
							{title}
						</h3>
						<div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											aria-label="Edit task"
											onClick={() => setIsEditing(true)}
											size="iconSm"
											variant="ghost"
										>
											<Edit className="size-3.5 text-muted-foreground" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Edit task</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											aria-label="Delete task"
											className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
											disabled={isDeleting}
											onClick={() => setShowDeleteConfirm(true)}
											size="iconSm"
											variant="ghost"
										>
											<Trash className="size-3.5" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Delete task</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>

					{/* Description */}
					{description && (
						<p
							className={cn(
								"text-sm text-muted-foreground mt-2 line-clamp-2 break-words",
								completed && "text-muted-foreground/70"
							)}
						>
							{description}
						</p>
					)}

					{/* Task metadata */}
					<div className="flex flex-wrap items-center gap-3 mt-3">
						{/* Category badge */}
						{category && (
							<Badge
								className="text-xs font-medium px-2 py-0.5 rounded-full border-2"
								style={{
									borderColor: category.color,
									color: category.color,
									backgroundColor: `${category.color}15`,
								}}
								variant="outline"
							>
								{category.name}
							</Badge>
						)}

						{/* Priority indicator */}
						{priority && (
							<Badge
								className={cn(
									"gap-1.5 font-medium",
									PRIORITY_CONFIG[priority].badgeClassName
								)}
								variant="outline"
							>
								<span
									className={cn(
										"size-2 rounded-full",
										PRIORITY_CONFIG[priority].dotClassName
									)}
								/>
								{PRIORITY_CONFIG[priority].label}
							</Badge>
						)}

						{/* Due date */}
						{dueDate && (
							<div
								className={cn(
									"flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full",
									isBefore(new Date(dueDate), startOfDay(new Date())) &&
										!completed
										? "text-destructive bg-destructive/10 font-medium"
										: "text-muted-foreground bg-muted"
								)}
							>
								<Clock className="size-3" />
								<span>{format(new Date(dueDate), "MMM d, yyyy")}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			<AlertDialog onOpenChange={setShowDeleteConfirm} open={showDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete task?</AlertDialogTitle>
						<AlertDialogDescription>
							"{title}" will be deleted. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
