"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { badgeVariants } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

	const renderTasks = (viewTasks: TaskData[], emptyMessage: string) => {
		if (viewTasks.length === 0) {
			return showEmpty ? (
				<div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 py-12 text-center">
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				</div>
			) : null;
		}

		return (
			<div className="grid gap-4">
				{viewTasks.map((task) => (
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
					<Circle className="h-4 w-4" />
					Active
					<span className={cn(badgeVariants({ variant: "outline" }), "ml-1")}>
						{activeTasks.length}
					</span>
				</TabsTrigger>
				<TabsTrigger className="flex-1 gap-2" value="completed">
					<CheckCircle2 className="h-4 w-4" />
					Completed
					<span className={cn(badgeVariants({ variant: "outline" }), "ml-1")}>
						{completedTasks.length}
					</span>
				</TabsTrigger>
			</TabsList>

			<TabsContent className="mt-6" value="active">
				{renderTasks(activeTasks, "Tasks you create will appear here.")}
			</TabsContent>
			<TabsContent className="mt-6" value="completed">
				{renderTasks(
					completedTasks,
					"Completed tasks appear here once you check something off."
				)}
			</TabsContent>
		</Tabs>
	);
};
