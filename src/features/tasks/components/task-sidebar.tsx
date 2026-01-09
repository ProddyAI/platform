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
		sortBy: false,
		sortDirection: false,
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
		<div className="w-[300px] h-full border-l bg-gray-50/70 p-6 overflow-y-auto flex-shrink-0 dark:bg-[hsl(var(--muted))] dark:border-[hsl(var(--border))]">
			<div className="flex items-center justify-between mb-6">
				<h3 className="font-semibold text-base flex items-center text-gray-800 dark:text-gray-200">
					<Filter className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
					Filters
				</h3>
				{isFilterActive() && (
					<Button
						variant="ghost"
						size="sm"
						onClick={resetAllFilters}
						className="h-8 text-xs px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 rounded-full"
					>
						<X className="h-3.5 w-3.5 mr-1" /> Clear all
					</Button>
				)}
			</div>

			{/* Priority Filter */}
			<div className="mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => toggleSection("priority")}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-gray-800 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 rounded-md"
				>
					<span>Priority</span>
					{expandedSections.priority ? (
						<ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					) : (
						<ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					)}
				</Button>

				{expandedSections.priority && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							variant={filterOptions.priority === "all" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.priority === "all"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ priority: "all" })}
						>
							All
						</Button>
						<Button
							variant={
								filterOptions.priority === "high" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.priority === "high"
									? "bg-red-100 text-red-700 font-medium hover:bg-red-150 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ priority: "high" })}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-red-600" />
							High
						</Button>
						<Button
							variant={
								filterOptions.priority === "medium" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.priority === "medium"
									? "bg-amber-100 text-amber-700 font-medium hover:bg-amber-150 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ priority: "medium" })}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-amber-500" />
							Medium
						</Button>
						<Button
							variant={filterOptions.priority === "low" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.priority === "low"
									? "bg-blue-100 text-blue-700 font-medium hover:bg-blue-150 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ priority: "low" })}
						>
							<div className="mr-2 h-3 w-3 rounded-full bg-blue-600" />
							Low
						</Button>
					</div>
				)}
			</div>

			{/* Due Date Filter */}
			<div className="mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => toggleSection("dueDate")}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-gray-800 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 rounded-md"
				>
					<span>Due Date</span>
					{expandedSections.dueDate ? (
						<ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					) : (
						<ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					)}
				</Button>

				{expandedSections.dueDate && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							variant={filterOptions.dueDate === "all" ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.dueDate === "all"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ dueDate: "all" })}
						>
							All
						</Button>
						<Button
							variant={
								filterOptions.dueDate === "overdue" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.dueDate === "overdue"
									? "bg-red-100 text-red-700 font-medium hover:bg-red-150 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ dueDate: "overdue" })}
						>
							<Clock className="mr-2 h-4 w-4 text-red-600" />
							Overdue
						</Button>
						<Button
							variant={
								filterOptions.dueDate === "today" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.dueDate === "today"
									? "bg-amber-100 text-amber-700 font-medium hover:bg-amber-150 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ dueDate: "today" })}
						>
							<Clock className="mr-2 h-4 w-4 text-amber-500" />
							Today
						</Button>
						<Button
							variant={
								filterOptions.dueDate === "upcoming" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.dueDate === "upcoming"
									? "bg-blue-100 text-blue-700 font-medium hover:bg-blue-150 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ dueDate: "upcoming" })}
						>
							<Clock className="mr-2 h-4 w-4 text-blue-600" />
							Upcoming
						</Button>
						<Button
							variant={
								filterOptions.dueDate === "no-date" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.dueDate === "no-date"
									? "bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ dueDate: "no-date" })}
						>
							<Clock className="mr-2 h-4 w-4 text-gray-400" />
							No due date
						</Button>
					</div>
				)}
			</div>

			{/* Categories Filter */}
			<div className="mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => toggleSection("categories")}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-gray-800 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 rounded-md"
				>
					<span>Categories</span>
					{expandedSections.categories ? (
						<ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					) : (
						<ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					)}
				</Button>

				{expandedSections.categories &&
					(categoriesLoading ? (
						<div className="text-sm text-gray-500 dark:text-gray-400 mt-3 px-2 flex items-center">
							<div className="h-3 w-3 mr-2 rounded-full border-2 border-t-transparent border-gray-500 dark:border-gray-400 animate-spin"></div>
							Loading categories...
						</div>
					) : categories && categories.length > 0 ? (
						<div className="space-y-1 mt-2 px-1">
							<Button
								variant={
									filterOptions.categoryId === null ? "secondary" : "ghost"
								}
								size="sm"
								className={cn(
									"w-full justify-start text-sm h-9 rounded-md",
									filterOptions.categoryId === null
										? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
										: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
								)}
								onClick={() => onFilterChange({ categoryId: null })}
							>
								All Categories
							</Button>
							{categories.map((category) => (
								<Button
									key={category._id}
									variant={
										filterOptions.categoryId === category._id
											? "secondary"
											: "ghost"
									}
									size="sm"
									className={cn(
										"w-full justify-start text-sm h-9 rounded-md",
										filterOptions.categoryId === category._id
											? `font-medium`
											: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
									)}
									style={
										filterOptions.categoryId === category._id
											? {
													backgroundColor: `${category.color}30`,
													color: category.color,
													borderWidth: '2px',
													borderColor: category.color,
												}
											: {}
									}
									onClick={() => onFilterChange({ categoryId: category._id })}
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
						<div className="text-sm text-gray-500 dark:text-gray-400 mt-3 px-2">
							No categories available
						</div>
					))}
			</div>

			{/* Separator */}
			<Separator className="my-6 bg-gray-200 dark:bg-gray-700" />

			{/* Sort Options */}
			<div className="mb-6">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => toggleSection("sortBy")}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-gray-800 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 rounded-md"
				>
					<span>Sort By</span>
					{expandedSections.sortBy ? (
						<ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					) : (
						<ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					)}
				</Button>

				{expandedSections.sortBy && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							variant={
								filterOptions.sortBy === "created" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.sortBy === "created"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ sortBy: "created" })}
						>
							Date Created
						</Button>
						<Button
							variant={
								filterOptions.sortBy === "dueDate" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.sortBy === "dueDate"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ sortBy: "dueDate" })}
						>
							Due Date
						</Button>
						<Button
							variant={
								filterOptions.sortBy === "priority" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.sortBy === "priority"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ sortBy: "priority" })}
						>
							Priority
						</Button>
					</div>
				)}
			</div>

			<div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => toggleSection("sortDirection")}
					className="w-full flex justify-between items-center px-2 h-8 font-medium text-sm text-gray-800 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50 rounded-md"
				>
					<span>Sort Direction</span>
					{expandedSections.sortDirection ? (
						<ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					) : (
						<ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
					)}
				</Button>

				{expandedSections.sortDirection && (
					<div className="space-y-1 mt-2 px-1">
						<Button
							variant={
								filterOptions.sortDirection === "asc" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.sortDirection === "asc"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ sortDirection: "asc" })}
						>
							<SortAsc className="mr-2 h-4 w-4" />
							Ascending
						</Button>
						<Button
							variant={
								filterOptions.sortDirection === "desc" ? "secondary" : "ghost"
							}
							size="sm"
							className={cn(
								"w-full justify-start text-sm h-9 rounded-md",
								filterOptions.sortDirection === "desc"
									? "bg-secondary/10 text-secondary font-medium hover:bg-secondary/15"
									: "text-gray-700 hover:bg-gray-200/50 dark:text-gray-300 dark:hover:bg-gray-700/50"
							)}
							onClick={() => onFilterChange({ sortDirection: "desc" })}
						>
							<SortDesc className="mr-2 h-4 w-4" />
							Descending
						</Button>
					</div>
				)}
			</div>
		</div>
	);
};
