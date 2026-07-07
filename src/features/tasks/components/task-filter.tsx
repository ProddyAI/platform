"use client";

import {
	CheckCircle2,
	Circle,
	Clock,
	Filter,
	Search,
	SortAsc,
	SortDesc,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
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
	status: "all" | "active" | "completed";
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
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			</div>
			<div className="flex gap-2">
				<DropdownMenu onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
					<DropdownMenuTrigger asChild>
						<Button className="flex items-center gap-1.5" variant="outline">
							<Filter className="h-4 w-4" />
							<span>Filter</span>
							{activeFiltersCount > 0 && (
								<Badge
									className="ml-1 flex h-5 w-5 items-center justify-center p-0 font-medium text-[10px]"
									variant="outline"
								>
									{activeFiltersCount}
								</Badge>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel>Filter tasks</DropdownMenuLabel>
						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Status
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({
										status: value as TaskFilterOptions["status"],
									})
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
									onFilterChange({
										priority: value as "all" | "low" | "medium" | "high",
									})
								}
								value={filterOptions.priority}
							>
								<DropdownMenuRadioItem className="cursor-pointer" value="all">
									All
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="high">
									<div className="mr-2 h-3 w-3 rounded-full bg-red-600" />
									High
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="medium"
								>
									<div className="mr-2 h-3 w-3 rounded-full bg-amber-500" />
									Medium
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="low">
									<div className="mr-2 h-3 w-3 rounded-full bg-blue-600" />
									Low
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuGroup>

						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Due date
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({
										dueDate: value as TaskFilterOptions["dueDate"],
									})
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
									<Clock className="mr-2 h-4 w-4 text-red-600" />
									Overdue
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem className="cursor-pointer" value="today">
									<Clock className="mr-2 h-4 w-4 text-amber-500" />
									Today
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="upcoming"
								>
									<Clock className="mr-2 h-4 w-4 text-blue-600" />
									Upcoming
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="no-date"
								>
									<Clock className="mr-2 h-4 w-4 text-muted-foreground" />
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
							Reset filters
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
						<DropdownMenuLabel>Sort tasks</DropdownMenuLabel>
						<DropdownMenuSeparator />

						<DropdownMenuGroup>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
								Sort by
							</DropdownMenuLabel>
							<DropdownMenuRadioGroup
								onValueChange={(value) =>
									onFilterChange({
										sortBy: value as TaskFilterOptions["sortBy"],
									})
								}
								value={filterOptions.sortBy}
							>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="created"
								>
									Date created
								</DropdownMenuRadioItem>
								<DropdownMenuRadioItem
									className="cursor-pointer"
									value="dueDate"
								>
									Due date
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
									onFilterChange({ sortDirection: value as "asc" | "desc" })
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
