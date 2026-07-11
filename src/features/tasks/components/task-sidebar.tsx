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

export const TaskSidebar = ({
	filterOptions,
	onFilterChange,
	categories,
	categoriesLoading,
}: TaskSidebarProps) => {
	// State to track which sections are expanded
	const [expandedSections, setExpandedSections] = useState({
		priority: true,
		dueDate: false,
		categories: false,
		sort: false,
	});

	// Toggle section visibility
	const toggleSection = (section: keyof typeof expandedSections) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}));
	};

	// Helper to check if a filter is active
	const isFilterActive = () => {
		return (
			filterOptions.priority !== "all" ||
			filterOptions.dueDate !== "all" ||
			filterOptions.categoryId !== null
		);
	};

	// Reset all filters
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
					<Filter className="h-4 w-4 mr-2 text-muted-foreground" />
					Filters
				</h3>
				{isFilterActive() && (
					<Button
						className="h-8 text-xs px-3 py-1 text-muted-foreground rounded-full"
						onClick={resetAllFilters}
						size="sm"
						variant="ghost"
					>
						<X className="h-3.5 w-3.5 mr-1" /> Clear all
					</Button>
				)}
			</div>

			{/* Priority Filter */}
			<div className="mb-6">
				<Button
					aria-expanded={expandedSections.priority}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-foreground rounded-md"
					onClick={() => toggleSection("priority")}
					size="sm"
					variant="ghost"
				>
					<span>Priority</span>
					{expandedSections.priority ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</Button>

				{expandedSections.priority && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.priority === "all"
									? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ priority: "all" })}
							size="sm"
							variant={filterOptions.priority === "all" ? "secondary" : "ghost"}
						>
							All
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.priority === "high"
									? "bg-warning/10 text-warning font-medium hover:bg-warning/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ priority: "high" })}
							size="sm"
							variant={
								filterOptions.priority === "high" ? "secondary" : "ghost"
							}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-warning" />
							High
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.priority === "medium"
									? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ priority: "medium" })}
							size="sm"
							variant={
								filterOptions.priority === "medium" ? "secondary" : "ghost"
							}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-primary" />
							Medium
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.priority === "low"
									? "bg-muted text-foreground font-medium hover:bg-muted/80"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ priority: "low" })}
							size="sm"
							variant={filterOptions.priority === "low" ? "secondary" : "ghost"}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-muted-foreground/60" />
							Low
						</Button>
					</div>
				)}
			</div>

			{/* Due Date Filter */}
			<div className="mb-6">
				<Button
					aria-expanded={expandedSections.dueDate}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-foreground rounded-md"
					onClick={() => toggleSection("dueDate")}
					size="sm"
					variant="ghost"
				>
					<span>Due date</span>
					{expandedSections.dueDate ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</Button>

				{expandedSections.dueDate && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.dueDate === "all"
									? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ dueDate: "all" })}
							size="sm"
							variant={filterOptions.dueDate === "all" ? "secondary" : "ghost"}
						>
							All
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.dueDate === "overdue"
									? "bg-destructive/10 text-destructive font-medium hover:bg-destructive/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ dueDate: "overdue" })}
							size="sm"
							variant={
								filterOptions.dueDate === "overdue" ? "secondary" : "ghost"
							}
						>
							<Clock className="mr-2 h-4 w-4 text-destructive" />
							Overdue
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.dueDate === "today"
									? "bg-warning/10 text-warning font-medium hover:bg-warning/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ dueDate: "today" })}
							size="sm"
							variant={
								filterOptions.dueDate === "today" ? "secondary" : "ghost"
							}
						>
							<Clock className="mr-2 h-4 w-4 text-warning" />
							Today
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.dueDate === "upcoming"
									? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ dueDate: "upcoming" })}
							size="sm"
							variant={
								filterOptions.dueDate === "upcoming" ? "secondary" : "ghost"
							}
						>
							<Clock className="mr-2 h-4 w-4 text-primary" />
							Upcoming
						</Button>
						<Button
							className={cn(
								"w-full justify-start text-sm h-9 rounded-full",
								filterOptions.dueDate === "no-date"
									? "bg-muted text-foreground font-medium hover:bg-muted/80"
									: "text-foreground"
							)}
							onClick={() => onFilterChange({ dueDate: "no-date" })}
							size="sm"
							variant={
								filterOptions.dueDate === "no-date" ? "secondary" : "ghost"
							}
						>
							<Clock className="mr-2 h-4 w-4 text-muted-foreground" />
							No due date
						</Button>
					</div>
				)}
			</div>

			{/* Categories Filter */}
			<div className="mb-6">
				<Button
					aria-expanded={expandedSections.categories}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-foreground rounded-md"
					onClick={() => toggleSection("categories")}
					size="sm"
					variant="ghost"
				>
					<span>Categories</span>
					{expandedSections.categories ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</Button>

				{expandedSections.categories &&
					(categoriesLoading ? (
						<div className="mt-2 space-y-1.5 px-1">
							<Skeleton className="h-9 w-full rounded-full" />
							<Skeleton className="h-9 w-full rounded-full" />
							<Skeleton className="h-9 w-full rounded-full" />
						</div>
					) : categories && categories.length > 0 ? (
						<div className="space-y-1 mt-2 px-1">
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.categoryId === null
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ categoryId: null })}
								size="sm"
								variant={
									filterOptions.categoryId === null ? "secondary" : "ghost"
								}
							>
								All categories
							</Button>
							{categories.map((category) => (
								<Button
									className={cn(
										"w-full justify-start text-sm h-9 rounded-full",
										filterOptions.categoryId === category._id
											? "font-medium"
											: "text-foreground"
									)}
									key={category._id}
									onClick={() => onFilterChange({ categoryId: category._id })}
									size="sm"
									style={
										filterOptions.categoryId === category._id
											? {
													backgroundColor: `${category.color}30`,
													color: category.color,
													borderWidth: "2px",
													borderColor: category.color,
												}
											: {}
									}
									variant={
										filterOptions.categoryId === category._id
											? "secondary"
											: "ghost"
									}
								>
									<div
										className="mr-2 h-3 w-3 rounded-full border-2"
										style={{
											backgroundColor: category.color,
											borderColor: category.color,
										}}
									/>
									{category.name}
								</Button>
							))}
						</div>
					) : (
						<div className="text-sm text-muted-foreground mt-3 px-2">
							No categories available
						</div>
					))}
			</div>

			{/* Separator */}
			<Separator className="my-6" />

			{/* Sort Options */}
			<div>
				<Button
					aria-expanded={expandedSections.sort}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-foreground rounded-md"
					onClick={() => toggleSection("sort")}
					size="sm"
					variant="ghost"
				>
					<span>Sort</span>
					{expandedSections.sort ? (
						<ChevronDown className="h-4 w-4 text-muted-foreground" />
					) : (
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					)}
				</Button>

				{expandedSections.sort && (
					<div className="mt-2 px-1">
						<p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
							Sort by
						</p>
						<div className="space-y-1">
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.sortBy === "created"
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ sortBy: "created" })}
								size="sm"
								variant={
									filterOptions.sortBy === "created" ? "secondary" : "ghost"
								}
							>
								Date created
							</Button>
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.sortBy === "dueDate"
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ sortBy: "dueDate" })}
								size="sm"
								variant={
									filterOptions.sortBy === "dueDate" ? "secondary" : "ghost"
								}
							>
								Due date
							</Button>
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.sortBy === "priority"
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ sortBy: "priority" })}
								size="sm"
								variant={
									filterOptions.sortBy === "priority" ? "secondary" : "ghost"
								}
							>
								Priority
							</Button>
						</div>

						<p className="px-2 pb-1 pt-3 text-xs font-medium text-muted-foreground">
							Direction
						</p>
						<div className="space-y-1">
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.sortDirection === "asc"
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ sortDirection: "asc" })}
								size="sm"
								variant={
									filterOptions.sortDirection === "asc" ? "secondary" : "ghost"
								}
							>
								<SortAsc className="mr-2 h-4 w-4" />
								Ascending
							</Button>
							<Button
								className={cn(
									"w-full justify-start text-sm h-9 rounded-full",
									filterOptions.sortDirection === "desc"
										? "bg-primary/10 text-foreground font-medium hover:bg-primary/15"
										: "text-foreground"
								)}
								onClick={() => onFilterChange({ sortDirection: "desc" })}
								size="sm"
								variant={
									filterOptions.sortDirection === "desc" ? "secondary" : "ghost"
								}
							>
								<SortDesc className="mr-2 h-4 w-4" />
								Descending
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
