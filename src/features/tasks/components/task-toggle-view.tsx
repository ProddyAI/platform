"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskItem } from "./task-item";

export type TaskData = {
	_id: Id<"tasks">;
	title: string;
	description?: string;
	completed: boolean;
	dueDate?: number;
	priority?: "low" | "medium" | "high";
	categoryId?: Id<"categories">;
};

interface TaskToggleViewProps {
	tasks: TaskData[];
	workspaceId: Id<"workspaces">;
	showEmpty?: boolean;
}

export const TaskToggleView = ({
	tasks,
	workspaceId,
	showEmpty = true,
}: TaskToggleViewProps) => {
	const [activeView, setActiveView] = useState<"active" | "completed">(
		"active"
	);

	const activeTasks = tasks.filter((task) => !task.completed);
	const completedTasks = tasks.filter((task) => task.completed);

	const isEmpty =
		activeView === "active"
			? activeTasks.length === 0
			: completedTasks.length === 0;

	return (
		<div className="space-y-6">
			{/* Toggle Buttons */}
			<div className="flex rounded-lg border overflow-hidden dark:border-gray-700">
				<Button
					className={cn(
						"flex-1 rounded-none border-0 py-2 px-4 flex items-center justify-center gap-2",
						activeView === "active"
							? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
							: "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
					)}
					onClick={() => setActiveView("active")}
					variant="ghost"
				>
					<Circle className="h-4 w-4" />
					<span>Active</span>
					<span className="ml-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
						{activeTasks.length}
					</span>
				</Button>

				<Button
					className={cn(
						"flex-1 rounded-none border-0 py-2 px-4 flex items-center justify-center gap-2",
						activeView === "completed"
							? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
							: "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
					)}
					onClick={() => setActiveView("completed")}
					variant="ghost"
				>
					<CheckCircle2 className="h-4 w-4" />
					<span>Completed</span>
					<span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium dark:bg-gray-800 dark:text-gray-400">
						{completedTasks.length}
					</span>
				</Button>
			</div>

			{/* Tasks List */}
			<div className="space-y-4">
				{isEmpty && showEmpty ? (
					<div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 dark:bg-gray-800 dark:border-gray-700">
						<div className="text-gray-400 dark:text-gray-500">
							{activeView === "active"
								? "No active tasks"
								: "No completed tasks"}
						</div>
					</div>
				) : (
					<div className="grid gap-4">
						{(activeView === "active" ? activeTasks : completedTasks).map(
							(task) => (
								<TaskItem
									categoryId={task.categoryId}
									completed={task.completed}
									description={task.description}
									dueDate={task.dueDate}
									id={task._id}
									key={task._id}
									priority={task.priority}
									title={task.title}
									workspaceId={workspaceId}
								/>
							)
						)}
					</div>
				)}
			</div>
		</div>
	);
};
