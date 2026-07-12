"use client";

import type { FunctionReturnType } from "convex/server";
import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import type { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { badgeVariants } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useGetTaskCategories } from "../api/use-get-task-categories";
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

export type TaskCategory = FunctionReturnType<
	typeof api.planning.tasks.getTaskCategories
>[number];

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
	const { data: categories } = useGetTaskCategories({ workspaceId });

	const activeTasks = tasks.filter((task) => !task.completed);
	const completedTasks = tasks.filter((task) => task.completed);

	const renderTasks = (
		viewTasks: TaskData[],
		emptyTitle: string,
		emptyMessage: string,
		emptyIcon: typeof Circle
	) => {
		if (viewTasks.length === 0) {
			return showEmpty ? (
				<EmptyState
					description={emptyMessage}
					icon={emptyIcon}
					size="sm"
					title={emptyTitle}
				/>
			) : null;
		}

		return (
			<div className="grid gap-4">
				{viewTasks.map((task) => (
					<TaskItem
						category={categories?.find((cat) => cat._id === task.categoryId)}
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
				))}
			</div>
		);
	};

	return (
		<Tabs
			onValueChange={(value) => setActiveView(value as "active" | "completed")}
			value={activeView}
		>
			<TabsList className="flex w-full">
				<TabsTrigger className="flex-1 gap-2" value="active">
					<Circle className="size-4" />
					Active
					<span className={cn(badgeVariants({ variant: "outline" }), "ml-1")}>
						{activeTasks.length}
					</span>
				</TabsTrigger>
				<TabsTrigger className="flex-1 gap-2" value="completed">
					<CheckCircle2 className="size-4" />
					Completed
					<span className={cn(badgeVariants({ variant: "outline" }), "ml-1")}>
						{completedTasks.length}
					</span>
				</TabsTrigger>
			</TabsList>

			<TabsContent className="mt-6" value="active">
				{renderTasks(
					activeTasks,
					"No active tasks",
					"Tasks you create will appear here.",
					Circle
				)}
			</TabsContent>
			<TabsContent className="mt-6" value="completed">
				{renderTasks(
					completedTasks,
					"No completed tasks",
					"Completed tasks appear here once you check something off.",
					CheckCircle2
				)}
			</TabsContent>
		</Tabs>
	);
};
