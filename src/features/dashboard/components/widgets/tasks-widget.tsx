"use client";

import { CheckCircle2, CheckSquare, Loader } from "lucide-react";
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
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

// A due date only reads as overdue while the task is still open; matches the
// overdue rule in task-item.tsx.
function isOverdue(dueDate: number, completed: boolean): boolean {
	return !completed && new Date(dueDate) < new Date();
}

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
	const { data: tasks } = useGetTasks({ workspaceId });
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
				if (!completed) {
					toast.success("Task completed");
				} else {
					toast.success("Task marked as incomplete", {
						description: "Task reopened",
					});
				}
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

		const priorityVariant: Record<
			string,
			"outline" | "warning" | "destructiveSoft"
		> = {
			low: "outline",
			medium: "warning",
			high: "destructiveSoft",
		};

		return (
			<Badge variant={priorityVariant[priority] ?? "outline"}>
				{priority.charAt(0).toUpperCase() + priority.slice(1)}
			</Badge>
		);
	};

	return (
		<div className="space-y-3">
			<WidgetHeader
				action={
					<Button
						className="h-8 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
						onClick={() => router.push(`/workspace/${workspaceId}/tasks`)}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				}
				badge={sortedTasks.length > 0 ? sortedTasks.length : undefined}
				controls={controls}
				icon={<CheckSquare className="h-5 w-5 text-primary" />}
				isEditMode={isEditMode}
				title="Your Tasks"
			/>

			{sortedTasks.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedTasks.map((task) => (
							<WidgetCard
								className={task.completed ? "bg-muted/20" : ""}
								contentClassName="p-4"
								key={task._id}
							>
								<div className="flex items-start gap-3">
									<Button
										aria-label={
											task.completed ? "Mark as incomplete" : "Mark as complete"
										}
										className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5"
										disabled={updatingTaskId === task._id}
										onClick={() =>
											handleToggleTaskCompletion(task._id, task.completed)
										}
										size="icon"
										variant="ghost"
									>
										{updatingTaskId === task._id ? (
											<Loader className="h-4 w-4 animate-spin" />
										) : task.completed ? (
											<CheckCircle2 className="h-5 w-5 text-success" />
										) : (
											<div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
										)}
									</Button>
									<div className="flex-1 min-w-0 space-y-1.5">
										<p
											className={`font-medium break-words leading-tight ${task.completed ? "line-through text-muted-foreground" : ""}`}
										>
											{task.title}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											{getPriorityBadge(task.priority)}
											<Badge
												className="border-2 text-xs w-fit"
												variant="outline"
											>
												{getCategoryName(task.categoryId)}
											</Badge>
											{task.dueDate && (
												<RelativeTime
													className="text-[10px]"
													iconClassName="h-2.5 w-2.5 flex-shrink-0"
													overdue={isOverdue(task.dueDate, task.completed)}
													timestamp={task.dueDate}
												/>
											)}
										</div>
									</div>
									<Button
										className="h-7 px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary flex-shrink-0"
										onClick={() => handleViewTask(task._id)}
										size="sm"
										variant="ghost"
									>
										View
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<WidgetEmptyState
					action={{
						label: "Create Task",
						onClick: () =>
							router.push(`/workspace/${workspaceId}/tasks?action=create`),
					}}
					description="You don't have any tasks created"
					icon={CheckSquare}
					title="No tasks"
				/>
			)}
		</div>
	);
};
