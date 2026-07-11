"use client";

import { isAfter, isBefore, isToday, startOfDay } from "date-fns";
import { CheckSquare, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignedIssuesList } from "@/features/board/components/assigned-issues-list";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useGetTaskCategories } from "@/features/tasks/api/use-get-task-categories";
import { useGetTasks } from "@/features/tasks/api/use-get-tasks";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import type { TaskFilterOptions } from "@/features/tasks/components/task-filter";
import { TaskSidebar } from "@/features/tasks/components/task-sidebar";
import { TaskToggleView } from "@/features/tasks/components/task-toggle-view";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const TasksContent = ({ workspaceId }: { workspaceId: Id<"workspaces"> }) => {
	useSetWorkspaceTitle(<WorkspaceTitle icon={CheckSquare} label="Tasks" />);

	useTrackActivity({
		workspaceId,
		activityType: "tasks_view",
	});
	const { data: tasks, isLoading } = useGetTasks({
		workspaceId,
	});
	const { data: categories, isLoading: categoriesLoading } =
		useGetTaskCategories({ workspaceId });

	const [searchQuery, setSearchQuery] = useState("");
	const [filtersOpen, setFiltersOpen] = useState(false);
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
				default:
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
					const aPriority =
						priorityValues[
							a.priority || ("undefined" as keyof typeof priorityValues)
						];
					const bPriority =
						priorityValues[
							b.priority || ("undefined" as keyof typeof priorityValues)
						];
					comparison = bPriority - aPriority;
					break;
				}
				default:
					break;
			}

			return filterOptions.sortDirection === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [tasks, searchQuery, filterOptions]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-1 overflow-hidden">
				<PageShell className="max-w-3xl" maxWidth="full">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Input
								aria-label="Search tasks"
								className="rounded-full bg-muted/50 pl-10 focus:bg-card"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search tasks..."
								value={searchQuery}
							/>
							<Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						</div>
						<Button
							aria-label="Open task filters"
							className="lg:hidden"
							onClick={() => setFiltersOpen(true)}
							size="icon"
							variant="outline"
						>
							<SlidersHorizontal className="size-4" />
						</Button>
					</div>

					{isLoading ? (
						<div aria-busy="true" className="space-y-6">
							<Skeleton className="h-10 w-full rounded-full" />
							<div className="grid gap-4">
								<Skeleton className="h-28 w-full rounded-2xl" />
								<Skeleton className="h-28 w-full rounded-2xl" />
								<Skeleton className="h-28 w-full rounded-2xl" />
							</div>
						</div>
					) : (
						<div className="space-y-6">
							<div className="space-y-4">
								{filteredTasks.length === 0 ? (
									<EmptyState
										description={
											searchQuery ||
											filterOptions.status !== "all" ||
											filterOptions.priority !== "all" ||
											filterOptions.dueDate !== "all" ||
											filterOptions.categoryId !== null
												? "Try adjusting your filters or search query"
												: "Create your first task to get started"
										}
										icon={CheckSquare}
										title="No tasks found"
									/>
								) : (
									<TaskToggleView
										tasks={filteredTasks}
										workspaceId={workspaceId}
									/>
								)}
							</div>
							<div className="border-t pt-4">
								<h2 className="mb-4 text-lg font-semibold text-foreground">
									Create a task
								</h2>
								<TaskCreateForm workspaceId={workspaceId} />
							</div>
							<div className="border-t pt-4">
								<h2 className="mb-4 text-lg font-semibold text-foreground">
									Assigned issues
								</h2>
								<AssignedIssuesList workspaceId={workspaceId} />
							</div>
						</div>
					)}
				</PageShell>

				<Sheet onOpenChange={setFiltersOpen} open={filtersOpen}>
					<SheetContent className="w-[300px] p-0" side="right">
						<TaskSidebar
							categories={categories}
							categoriesLoading={categoriesLoading}
							filterOptions={filterOptions}
							onFilterChange={handleFilterChange}
						/>
					</SheetContent>
				</Sheet>
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

const TasksPage = () => {
	useDocumentTitle("Tasks");

	const workspaceId = useWorkspaceId();
	if (!workspaceId) return null;

	return <TasksContent workspaceId={workspaceId as Id<"workspaces">} />;
};

export default TasksPage;
