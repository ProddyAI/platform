"use client";

import {
	CheckCircle2,
	Circle,
	Clock,
	Filter,
	SortAsc,
	SortDesc,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export type TaskFilterOptions = {
	status:
		| "all"
		| "active"
		| "completed"
		| "not_started"
		| "in_progress"
		| "on_hold"
		| "cancelled";
	priority: "all" | "high" | "medium" | "low";
	dueDate: "all" | "overdue" | "today" | "upcoming" | "no-date";
	categoryId: string | null;
	tags: string[];
	sortBy: "created" | "dueDate" | "priority";
	sortDirection: "asc" | "desc";
	view: "list";
};

interface TaskFilterProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	filterOptions: TaskFilterOptions;
	onFilterChange: (options: Partial<TaskFilterOptions>) => void;
}

export const TaskFilter = ({
	searchQuery,
	onSearchChange,
	filterOptions,
	onFilterChange,
}: TaskFilterProps) => {
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);

	const getActiveFiltersCount = () => {
		let count = 0;
		if (filterOptions.status !== "all") count++;
		if (filterOptions.priority !== "all") count++;
		if (filterOptions.dueDate !== "all") count++;
		return count;
	};

	const activeFiltersCount = getActiveFiltersCount();

	return (
		<div className="flex flex-col sm:flex-row gap-3 w-full mt-3">
			<div className="relative flex-1">
				<Input
					className="pl-10"
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder="Search tasks..."
					value={searchQuery}
				/>
				<svg
					className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</div>
			<div className="flex gap-2">
				<DropdownMenu onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
					<DropdownMenuTrigger asChild>
						<Button className="flex items-center gap-1.5" variant="outline">
							<Filter className="h-4 w-4" />
							<span>Filter</span>
							{activeFiltersCount > 0 && (
								<span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
									{activeFiltersCount}
								</span>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel>Filter Tasks</DropdownMenuLabel>
						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Status
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({ status: value as any })
								}
								value={filterOptions.status}
							>
								<DropdownMenuRadioItem className="cursor-pointer" value="all">
									All
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="active"
								>
									<Circle className="mr-2 h-4 w-4" />
									Active
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="completed"
								>
									<CheckCircle2 className="mr-2 h-4 w-4" />
									Completed
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Priority
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({ priority: value as any })
								}
								value={filterOptions.priority}
							>
								<DropdownMenuRadioItem className="cursor-pointer" value="all">
									All
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="high">
									<div className="mr-2 h-3 w-3 rounded-full bg-red-500" />
									High
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="medium"
								>
									<div className="mr-2 h-3 w-3 rounded-full bg-yellow-500" />
									Medium
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="low">
									<div className="mr-2 h-3 w-3 rounded-full bg-blue-500" />
									Low
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Due Date
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({ dueDate: value as any })
								}
								value={filterOptions.dueDate}
							>
								<DropdownMenuRadioItem className="cursor-pointer" value="all">
									All
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="overdue"
								>
									<Clock className="mr-2 h-4 w-4 text-red-500" />
									Overdue
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="today">
									<Clock className="mr-2 h-4 w-4 text-yellow-500" />
									Today
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="upcoming"
								>
									<Clock className="mr-2 h-4 w-4 text-blue-500" />
									Upcoming
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="no-date"
								>
									<Clock className="mr-2 h-4 w-4 text-gray-400" />
									No due date
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<Button
							className="w-full justify-center text-xs"
							onClick={() =>
								onFilterChange({
									status: "all",
									priority: "all",
									dueDate: "all",
								})
							}
							size="sm"
							variant="ghost"
						>
							Reset Filters
						</Button>
					</DropdownMenuContent>
				</DropdownMenu>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button className="flex items-center gap-1.5" variant="outline">
							{filterOptions.sortDirection === "asc" ? (
								<SortAsc className="h-4 w-4" />
							) : (
								<SortDesc className="h-4 w-4" />
							)}
							<span>Sort</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel>Sort Tasks</DropdownMenuLabel>
						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Sort By
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({ sortBy: value as any })
								}
								value={filterOptions.sortBy}
							>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="created"
								>
									Date Created
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="dueDate"
								>
									Due Date
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="priority"
								>
									Priority
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Direction
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({ sortDirection: value as any })
								}
								value={filterOptions.sortDirection}
							>
								<DropdownMenuRadioItem className="cursor-pointer" value="asc">
									<SortAsc className="mr-2 h-4 w-4" />
									Ascending
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="desc">
									<SortDesc className="mr-2 h-4 w-4" />
									Descending
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
};
