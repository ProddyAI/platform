// Filter/sort state shared by the Tasks page and TaskSidebar. The old
// dropdown-based <TaskFilter> component was removed once the sidebar became
// the only filter surface; only this type remains.
export type TaskFilterOptions = {
	status: "all" | "active" | "completed";
	priority: "all" | "high" | "medium" | "low";
	dueDate: "all" | "overdue" | "today" | "upcoming" | "no-date";
	categoryId: string | null;
	tags: string[];
	sortBy: "created" | "dueDate" | "priority";
	sortDirection: "asc" | "desc";
	view: "list";
};
