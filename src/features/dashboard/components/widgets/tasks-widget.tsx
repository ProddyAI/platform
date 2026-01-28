"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, CheckSquare, Clock, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetTaskCategories } from "@/features/tasks/api/use-get-task-categories";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { useUpdateTask } from "@/features/tasks/api/use-update-task";
import { WidgetCard } from "../shared/widget-card";

interface TasksWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const TasksWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: TasksWidgetProps) => {
	const router = useRouter();
	const [updatingTaskId, setUpdatingTaskId] = useState<Id<"tasks"> | null>(
		null
	);

	// Fetch your tasks
	const { data: tasks, isLoading } = useGetTasks({ workspaceId });
	const { data: categories } = useGetTaskCategories({ workspaceId });
	const updateTask = useUpdateTask();

	const sortedTasks = tasks
		? [...tasks]
				.sort((a, b) => {
					if (a.completed !== b.completed) {
						return a.completed ? 1 : -1;
					}

					if (a.dueDate && b.dueDate) {
						return a.dueDate - b.dueDate;
					}

					if (a.dueDate) return -1;
					if (b.dueDate) return 1;

					return b._creationTime - a._creationTime;
				})
				.slice(0, 10)
		: [];

	const handleViewTask = (taskId: Id<"tasks">) => {
		router.push(`/workspace/${workspaceId}/tasks?taskId=${taskId}`);
	};

	const handleToggleTaskCompletion = async (
		id: Id<"tasks">,
		completed: boolean
	) => {
		if (updatingTaskId) return;

		setUpdatingTaskId(id);

		try {
			const result = await updateTask({
				id,
				completed: !completed,
			});

			if (result !== undefined) {
				toast.success(
					!completed ? "Task completed" : "Task marked as incomplete",
					{
						description: !completed ? "Great job!" : "Task reopened",
					}
				);
			}
		} catch (error) {
			console.error("Failed to update task:", error);
			toast.error("Failed to update task", {
				description: "Please try again",
			});
		} finally {
			setUpdatingTaskId(null);
		}
	};

	// Get category name by ID
	const getCategoryName = (categoryId: Id<"categories"> | undefined) => {
		if (!categoryId || !categories) return "Uncategorized";
		const category = categories.find((cat) => cat._id === categoryId);
		return category ? category.name : "Uncategorized";
	};

	// Get priority badge
	const getPriorityBadge = (priority: string | undefined) => {
		if (!priority) return null;

		const priorityColors: Record<string, string> = {
			low: "bg-blue-100 text-blue-800",
			medium: "bg-yellow-100 text-yellow-800",
			high: "bg-red-100 text-red-800",
		};

		return (
			<Badge
				className={`${priorityColors[priority] || "bg-gray-100 text-gray-800"}`}
			>
				{priority.charAt(0).toUpperCase() + priority.slice(1)}
			</Badge>
		);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<CheckSquare className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-semibold text-base">Your Tasks</h3>
					{!isEditMode && sortedTasks.length > 0 && (
						<Badge
							variant="secondary"
							className="ml-1 h-5 px-2 text-xs font-medium"
						>
							{sortedTasks.length}
						</Badge>
					)}
				</div>
				{isEditMode ? (
					controls
				) : (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
						onClick={() => router.push(`/workspace/${workspaceId}/tasks`)}
					>
						View all
					</Button>
				)}
			</div>

			{sortedTasks.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedTasks.map((task) => (
							<WidgetCard
								key={task._id}
								className={task.completed ? "bg-muted/20" : ""}
								contentClassName="p-4"
							>
								<div className="flex items-start gap-3">
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5"
										onClick={() =>
											handleToggleTaskCompletion(task._id, task.completed)
										}
										disabled={updatingTaskId === task._id}
									>
										{updatingTaskId === task._id ? (
											<Loader className="h-4 w-4 animate-spin" />
										) : task.completed ? (
											<CheckCircle2 className="h-5 w-5 text-green-500" />
										) : (
											<div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
										)}
									</Button>
									<div className="flex-1 space-y-2 min-w-0">
										<p
											className={`font-medium break-words leading-tight ${task.completed ? "line-through text-muted-foreground" : ""}`}
										>
											{task.title}
										</p>
										{getPriorityBadge(task.priority)}
										{task.dueDate && (
											<div className="flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400 font-medium">
												<Clock className="h-2.5 w-2.5 flex-shrink-0" />
												<span>
													{formatDistanceToNow(new Date(task.dueDate), {
														addSuffix: true,
													}).replace("about ", "")}
												</span>
											</div>
										)}
										<Badge variant="outline" className="border-2 text-xs w-fit">
											{getCategoryName(task.categoryId)}
										</Badge>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950 flex-shrink-0"
										onClick={() => handleViewTask(task._id)}
									>
										View
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
					<CheckSquare className="mb-3 h-12 w-12 text-muted-foreground/40" />
					<h3 className="text-base font-semibold text-foreground">No tasks</h3>
					<p className="text-sm text-muted-foreground mt-1">
						You don't have any tasks created
					</p>
					<Button
						variant="default"
						size="sm"
						className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-purple-600 dark:hover:bg-purple-700"
						onClick={() =>
							router.push(`/workspace/${workspaceId}/tasks?action=create`)
						}
					>
						Create Task
					</Button>
				</div>
			)}
		</div>
	);
};
