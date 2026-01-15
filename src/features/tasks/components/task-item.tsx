"use client";

import { format } from "date-fns";
import { CheckCircle2, Circle, Clock, Edit, Trash } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
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

	const getPriorityColor = (priority?: "low" | "medium" | "high") => {
		switch (priority) {
			case "high":
				return "bg-red-600";
			case "medium":
				return "bg-amber-500";
			case "low":
				return "bg-blue-600";
			default:
				return "bg-gray-400";
		}
	};

	const getPriorityTextColor = (priority?: "low" | "medium" | "high") => {
		switch (priority) {
			case "high":
				return "text-red-700 dark:text-red-400";
			case "medium":
				return "text-amber-700 dark:text-amber-400";
			case "low":
				return "text-blue-700 dark:text-blue-400";
			default:
				return "text-gray-700 dark:text-gray-400";
		}
	};

	const getPriorityBgColor = (priority?: "low" | "medium" | "high") => {
		switch (priority) {
			case "high":
				return "bg-red-100 dark:bg-red-900/30";
			case "medium":
				return "bg-amber-100 dark:bg-amber-900/30";
			case "low":
				return "bg-blue-100 dark:bg-blue-900/30";
			default:
				return "bg-gray-100 dark:bg-gray-800";
		}
	};

	const getPriorityLabel = (priority?: "low" | "medium" | "high") => {
		switch (priority) {
			case "high":
				return "High";
			case "medium":
				return "Medium";
			case "low":
				return "Low";
			default:
				return "None";
		}
	};

	const getStatusIcon = (completed: boolean) => {
		return completed ? (
			<CheckCircle2 className="h-5 w-5 text-green-500" />
		) : (
			<Circle className="h-5 w-5 text-gray-400 group-hover:text-secondary transition-colors" />
		);
	};

	if (isEditing) {
		return (
			<TaskEditForm
				id={id}
				workspaceId={workspaceId}
				initialTitle={title}
				initialDescription={description}
				initialDueDate={dueDate ? new Date(dueDate) : undefined}
				initialPriority={priority}
				initialCategoryId={categoryId}
				onCancel={() => setIsEditing(false)}
				onSave={() => setIsEditing(false)}
			/>
		);
	}

	return (
		<div
			className={cn(
				"group p-5 rounded-xl border transition-all hover:shadow-md",
				completed
					? "bg-gray-50 border-gray-200 opacity-80 dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))]"
					: "bg-white border-gray-200 hover:border-secondary/30 dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))] dark:hover:border-secondary/40",
				priority &&
					!completed &&
					`hover:border-${getPriorityTextColor(priority).replace("text-", "")}/30`
			)}
		>
			<div className="flex items-start gap-4">
				<button
					onClick={handleToggleCompletion}
					className="mt-0.5 flex-shrink-0 focus:outline-none group/checkbox"
					aria-label={completed ? "Mark as incomplete" : "Mark as complete"}
				>
					{getStatusIcon(completed)}
				</button>
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<h3
							className={cn(
								"font-medium text-base truncate",
								completed
									? "line-through text-gray-500 dark:text-gray-500"
									: "text-gray-900 dark:text-gray-100"
							)}
						>
							{title}
						</h3>
						<div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="iconSm"
											onClick={() => setIsEditing(true)}
											className="h-8 w-8 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
										>
											<Edit className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
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
											variant="ghost"
											size="iconSm"
											onClick={handleDelete}
											disabled={isDeleting}
											className="h-8 w-8 rounded-full bg-gray-50 hover:bg-red-100 text-gray-600 hover:text-red-600 dark:bg-gray-800 dark:hover:bg-red-900/30 dark:text-gray-400 dark:hover:text-red-400"
										>
											<Trash className="h-3.5 w-3.5" />
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
								"text-sm text-gray-600 mt-2 line-clamp-2 dark:text-gray-400",
								completed && "text-gray-400 dark:text-gray-500"
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
								variant="outline"
								className="text-xs font-medium px-2 py-0.5 rounded-full border-2"
								style={{
									borderColor: category.color,
									color: category.color,
									backgroundColor: `${category.color}15`,
								}}
							>
								{category.name}
							</Badge>
						)}

						{/* Priority indicator */}
						{priority && (
							<div
								className={cn(
									"flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
									getPriorityBgColor(priority),
									getPriorityTextColor(priority)
								)}
							>
								<div
									className={cn(
										"w-2 h-2 rounded-full",
										getPriorityColor(priority)
									)}
								/>
								{getPriorityLabel(priority)}
							</div>
						)}

						{/* Due date */}
						{dueDate && (
							<div
								className={cn(
									"flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full",
									new Date(dueDate) < new Date() && !completed
										? "text-red-700 bg-red-100 font-medium dark:text-red-400 dark:bg-red-900/30"
										: "text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-800"
								)}
							>
								<Clock className="h-3 w-3" />
								<span>{format(new Date(dueDate), "MMM d, yyyy")}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};
