"use client";

import {
	ChevronDown,
	ChevronRight,
	Clock,
	Filter,
	SortAsc,
	SortDesc,
	X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { TaskFilterOptions } from "./task-filter";

interface TaskSidebarProps {
	filterOptions: TaskFilterOptions;
	onFilterChange: (options: Partial<TaskFilterOptions>) => void;
	categories:
		| Array<{
				_id: Id<"categories">;
				name: string;
				color: string;
		  }>
		| undefined;
	categoriesLoading: boolean;
}

// Collapsible section header (label + chevron).
const SectionHeader = ({
	expanded,
	label,
	onToggle,
}: {
	expanded: boolean;
	label: string;
	onToggle: () => void;
}) => (
	<Button
		aria-expanded={expanded}
		className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-foreground rounded-md"
		onClick={onToggle}
		size="sm"
		variant="ghost"
	>
		<span>{label}</span>
		{expanded ? (
			<ChevronDown className="size-4 text-muted-foreground" />
		) : (
			<ChevronRight className="size-4 text-muted-foreground" />
		)}
	</Button>
);

// Single filter row. Inactive rows are quiet ghosts; the active row gets a
// soft tinted pill (primary by default, or a semantic tint per option).
const FilterOption = ({
	active,
	activeClassName = "bg-primary/10 text-foreground hover:bg-primary/15",
	children,
	onClick,
	style,
}: {
	active: boolean;
	activeClassName?: string;
	children: ReactNode;
	onClick: () => void;
	style?: CSSProperties;
}) => (
	<Button
		className={cn(
			"w-full justify-start text-sm h-9 rounded-full",
			active ? cn("font-medium", activeClassName) : "text-foreground"
		)}
		onClick={onClick}
		size="sm"
		style={active ? style : undefined}
		variant={active ? "secondary" : "ghost"}
	>
		{children}
	</Button>
);

export const TaskSidebar = ({
	filterOptions,
	onFilterChange,
	categories,
	categoriesLoading,
}: TaskSidebarProps) => {
	const [expandedSections, setExpandedSections] = useState({
		priority: true,
		dueDate: false,
		categories: false,
		sort: false,
	});

	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	const isFilterActive =
		filterOptions.priority !== "all" ||
		filterOptions.dueDate !== "all" ||
		filterOptions.categoryId !== null;

	const resetAllFilters = () => {
		onFilterChange({
			priority: "all",
			dueDate: "all",
			categoryId: null,
		});
	};

	return (
		<div className="w-[300px] h-full border-l bg-muted/70 p-6 overflow-y-auto flex-shrink-0">
			<div className="flex items-center justify-between mb-6">
				<h3 className="font-semibold text-base flex items-center text-foreground">
					<Filter className="size-4 mr-2 text-muted-foreground" />
					Filters
				</h3>
				{isFilterActive && (
					<Button
						className="h-8 text-xs px-3 py-1 text-muted-foreground rounded-full"
						onClick={resetAllFilters}
						size="sm"
						variant="ghost"
					>
						<X className="size-3.5 mr-1" /> Clear all
					</Button>
				)}
			</div>

			{/* Priority */}
			<div className="mb-6">
				<SectionHeader
					expanded={expandedSections.priority}
					label="Priority"
					onToggle={() => toggleSection("priority")}
				/>

				{expandedSections.priority && (
					<div className="space-y-1 mt-2 px-1">
						<FilterOption
							active={filterOptions.priority === "all"}
							onClick={() => onFilterChange({ priority: "all" })}
						>
							All
						</FilterOption>
						<FilterOption
							active={filterOptions.priority === "high"}
							activeClassName="bg-warning/10 text-warning hover:bg-warning/15"
							onClick={() => onFilterChange({ priority: "high" })}
						>
							<div className="mr-2 size-3 rounded-full bg-warning" />
							High
						</FilterOption>
						<FilterOption
							active={filterOptions.priority === "medium"}
							activeClassName="bg-primary/10 text-primary hover:bg-primary/15"
							onClick={() => onFilterChange({ priority: "medium" })}
						>
							<div className="mr-2 size-3 rounded-full bg-primary" />
							Medium
						</FilterOption>
						<FilterOption
							active={filterOptions.priority === "low"}
							activeClassName="bg-muted text-foreground hover:bg-muted/80"
							onClick={() => onFilterChange({ priority: "low" })}
						>
							<div className="mr-2 size-3 rounded-full bg-muted-foreground/60" />
							Low
						</FilterOption>
					</div>
				)}
			</div>

			{/* Due date */}
			<div className="mb-6">
				<SectionHeader
					expanded={expandedSections.dueDate}
					label="Due date"
					onToggle={() => toggleSection("dueDate")}
				/>

				{expandedSections.dueDate && (
					<div className="space-y-1 mt-2 px-1">
						<FilterOption
							active={filterOptions.dueDate === "all"}
							onClick={() => onFilterChange({ dueDate: "all" })}
						>
							All
						</FilterOption>
						<FilterOption
							active={filterOptions.dueDate === "overdue"}
							activeClassName="bg-destructive/10 text-destructive hover:bg-destructive/15"
							onClick={() => onFilterChange({ dueDate: "overdue" })}
						>
							<Clock className="mr-2 size-4 text-destructive" />
							Overdue
						</FilterOption>
						<FilterOption
							active={filterOptions.dueDate === "today"}
							activeClassName="bg-warning/10 text-warning hover:bg-warning/15"
							onClick={() => onFilterChange({ dueDate: "today" })}
						>
							<Clock className="mr-2 size-4 text-warning" />
							Today
						</FilterOption>
						<FilterOption
							active={filterOptions.dueDate === "upcoming"}
							activeClassName="bg-primary/10 text-primary hover:bg-primary/15"
							onClick={() => onFilterChange({ dueDate: "upcoming" })}
						>
							<Clock className="mr-2 size-4 text-primary" />
							Upcoming
						</FilterOption>
						<FilterOption
							active={filterOptions.dueDate === "no-date"}
							activeClassName="bg-muted text-foreground hover:bg-muted/80"
							onClick={() => onFilterChange({ dueDate: "no-date" })}
						>
							<Clock className="mr-2 size-4 text-muted-foreground" />
							No due date
						</FilterOption>
					</div>
				)}
			</div>

			{/* Categories */}
			<div className="mb-6">
				<SectionHeader
					expanded={expandedSections.categories}
					label="Categories"
					onToggle={() => toggleSection("categories")}
				/>

				{expandedSections.categories &&
					(categoriesLoading ? (
						<div className="mt-2 space-y-1.5 px-1">
							<Skeleton className="h-9 w-full rounded-full" />
							<Skeleton className="h-9 w-full rounded-full" />
							<Skeleton className="h-9 w-full rounded-full" />
						</div>
					) : categories && categories.length > 0 ? (
						<div className="space-y-1 mt-2 px-1">
							<FilterOption
								active={filterOptions.categoryId === null}
								onClick={() => onFilterChange({ categoryId: null })}
							>
								All categories
							</FilterOption>
							{categories.map((category) => (
								<FilterOption
									active={filterOptions.categoryId === category._id}
									activeClassName=""
									key={category._id}
									onClick={() => onFilterChange({ categoryId: category._id })}
									style={{
										backgroundColor: `${category.color}30`,
										color: category.color,
									}}
								>
									<div
										className="mr-2 size-3 rounded-full"
										style={{ backgroundColor: category.color }}
									/>
									{category.name}
								</FilterOption>
							))}
						</div>
					) : (
						<div className="text-sm text-muted-foreground mt-3 px-2">
							No categories yet
						</div>
					))}
			</div>

			<Separator className="my-6" />

			{/* Sort */}
			<div>
				<SectionHeader
					expanded={expandedSections.sort}
					label="Sort"
					onToggle={() => toggleSection("sort")}
				/>

				{expandedSections.sort && (
					<div className="mt-2 px-1">
						<p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
							Sort by
						</p>
						<div className="space-y-1">
							<FilterOption
								active={filterOptions.sortBy === "created"}
								onClick={() => onFilterChange({ sortBy: "created" })}
							>
								Date created
							</FilterOption>
							<FilterOption
								active={filterOptions.sortBy === "dueDate"}
								onClick={() => onFilterChange({ sortBy: "dueDate" })}
							>
								Due date
							</FilterOption>
							<FilterOption
								active={filterOptions.sortBy === "priority"}
								onClick={() => onFilterChange({ sortBy: "priority" })}
							>
								Priority
							</FilterOption>
						</div>

						<p className="px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground">
							Direction
						</p>
						<div className="space-y-1">
							<FilterOption
								active={filterOptions.sortDirection === "asc"}
								onClick={() => onFilterChange({ sortDirection: "asc" })}
							>
								<SortAsc className="mr-2 size-4" />
								Ascending
							</FilterOption>
							<FilterOption
								active={filterOptions.sortDirection === "desc"}
								onClick={() => onFilterChange({ sortDirection: "desc" })}
							>
								<SortDesc className="mr-2 size-4" />
								Descending
							</FilterOption>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
