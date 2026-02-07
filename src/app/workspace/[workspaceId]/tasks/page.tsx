"use client";

import { isAfter, isBefore, isToday, startOfDay } from "date-fns";
import { CheckSquare, Loader, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useGetTaskCategories } from "@/features/tasks/api/use-get-task-categories";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import type { TaskFilterOptions } from "@/features/tasks/components/task-filter";
import { TaskSidebar } from "@/features/tasks/components/task-sidebar";
import { TaskToggleView } from "@/features/tasks/components/task-toggle-view";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

const TasksPage = () => {
	useDocumentTitle("Tasks");

	const workspaceId = useWorkspaceId();

	useTrackActivity({
		workspaceId,
		activityType: "tasks_view",
	});
	const { data: tasks, isLoading } = useGetTasks({ workspaceId });
	const { data: categories, isLoading: categoriesLoading } =
		useGetTaskCategories({ workspaceId });

	const [searchQuery, setSearchQuery] = useState("");
	const [filterOptions, setFilterOptions] = useState<TaskFilterOptions>({
		status: "all",
		priority: "all",
		dueDate: "all",
		categoryId: null,
		tags: [] as string[],
		sortBy: "created",
		sortDirection: "desc",
		view: "list",
	});

	const handleFilterChange = useCallback(
		(options: Partial<TaskFilterOptions>) => {
			setFilterOptions((prev) => ({ ...prev, ...options }));
		},
		[]
	);

	const filteredTasks = useMemo(() => {
		if (!tasks) return [];

		let filtered = [...tasks];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(task) =>
					task.title.toLowerCase().includes(query) ||
					task.description?.toLowerCase().includes(query) ||
					task.tags?.some((tag: string) => tag.toLowerCase().includes(query))
			);
		}

		if (filterOptions.status !== "all") {
			if (
				[
					"not_started",
					"in_progress",
					"completed",
					"on_hold",
					"cancelled",
				].includes(filterOptions.status)
			) {
				filtered = filtered.filter(
					(task) => task.status === filterOptions.status
				);
			} else if (filterOptions.status === "active") {
				filtered = filtered.filter((task) => !task.completed);
			} else if (filterOptions.status === "completed") {
				filtered = filtered.filter((task) => task.completed);
			}
		}

		if (filterOptions.priority !== "all") {
			filtered = filtered.filter(
				(task) => task.priority === filterOptions.priority
			);
		}

		if (filterOptions.categoryId) {
			filtered = filtered.filter(
				(task) => task.categoryId === filterOptions.categoryId
			);
		}

		if (filterOptions.tags && filterOptions.tags.length > 0) {
			filtered = filtered.filter(
				(task) =>
					task.tags &&
					filterOptions.tags.some((tag) => task.tags?.includes(tag))
			);
		}

		if (filterOptions.dueDate !== "all") {
			const today = startOfDay(new Date());

			switch (filterOptions.dueDate) {
				case "overdue":
					filtered = filtered.filter(
						(task) =>
							task.dueDate &&
							isBefore(new Date(task.dueDate), today) &&
							!task.completed
					);
					break;
				case "today":
					filtered = filtered.filter(
						(task) => task.dueDate && isToday(new Date(task.dueDate))
					);
					break;
				case "upcoming":
					filtered = filtered.filter(
						(task) => task.dueDate && isAfter(new Date(task.dueDate), today)
					);
					break;
				case "no-date":
					filtered = filtered.filter((task) => !task.dueDate);
					break;
			}
		}

		filtered.sort((a, b) => {
			let comparison = 0;

			switch (filterOptions.sortBy) {
				case "created":
					comparison = a.createdAt - b.createdAt;
					break;
				case "dueDate":
					if (!a.dueDate && !b.dueDate) return 0;
					if (!a.dueDate) return 1;
					if (!b.dueDate) return -1;
					comparison = a.dueDate - b.dueDate;
					break;
				case "priority": {
					const priorityValues = { high: 3, medium: 2, low: 1, undefined: 0 };
					const aPriority = priorityValues[a.priority || "undefined"];
					const bPriority = priorityValues[b.priority || "undefined"];
					comparison = bPriority - aPriority;
					break;
				}
			}

			return filterOptions.sortDirection === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [tasks, searchQuery, filterOptions]);

	const handleTaskCreated = useCallback(() => {
		toast.success("Task created successfully", {
			description: "Your new task has been added to the list",
		});
	}, []);

	return (
		<div className="flex h-full flex-col">
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
				>
					<CheckSquare className="mr-2 size-5" />
					<span className="truncate">Tasks</span>
				</Button>
			</WorkspaceToolbar>
			<div className="flex h-[calc(100%-4rem)] bg-white">
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
						<div className="mb-6 md:mb-8 space-y-4">
							<div className="relative">
								<Input
									className="pl-10 w-full bg-gray-50 border-gray-200 focus:bg-white transition-colors dark:bg-[hsl(var(--card-accent))] dark:border-[hsl(var(--border))] dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-[hsl(var(--card-accent))] dark:focus-visible:ring-pink-400 dark:focus-visible:border-pink-400 dark:focus-visible:ring-offset-0"
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search tasks..."
									value={searchQuery}
								/>
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
							</div>
						</div>

						{isLoading ? (
							<div className="flex h-40 items-center justify-center">
								<Loader className="h-6 w-6 animate-spin text-secondary" />
							</div>
						) : (
							<div className="space-y-6 pb-8">
								<div className="pt-4 mt-8 border-t border-gray-100 dark:border-gray-700">
									<h2 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
										Create a new task
									</h2>
									<TaskCreateForm
										onSuccess={handleTaskCreated}
										workspaceId={workspaceId}
									/>
								</div>
								<div className="space-y-4">
									{filteredTasks.length === 0 ? (
										<div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
											<div className="rounded-full bg-gray-100 dark:bg-gray-700 p-4">
												<CheckSquare className="h-8 w-8 text-gray-400 dark:text-gray-500" />
											</div>
											<h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
												No tasks found
											</h3>
											<p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
												{searchQuery ||
												filterOptions.status !== "all" ||
												filterOptions.priority !== "all" ||
												filterOptions.dueDate !== "all" ||
												filterOptions.categoryId !== null
													? "Try adjusting your filters or search query"
													: "Create your first task to get started"}
											</p>
										</div>
									) : (
										<TaskToggleView
											tasks={filteredTasks}
											workspaceId={workspaceId}
										/>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				<div className="hidden lg:block">
					<TaskSidebar
						categories={categories}
						categoriesLoading={categoriesLoading}
						filterOptions={filterOptions}
						onFilterChange={handleFilterChange}
					/>
				</div>
			</div>
		</div>
	);
};

export default TasksPage;
