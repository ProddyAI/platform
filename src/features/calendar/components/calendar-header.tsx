"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarFilter, type CalendarFilterOptions } from "./calendar-filter";

interface CalendarHeaderProps {
	currentDate: Date;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
	filterOptions: CalendarFilterOptions;
	onFilterChange: (options: Partial<CalendarFilterOptions>) => void;
	eventCounts: {
		total: number;
		message: number;
		boardCard: number;
		task: number;
	};
	onSearch?: (query: string) => void;
}

export const CalendarHeader = ({
	currentDate,
	onPreviousMonth,
	onNextMonth,
	filterOptions,
	onFilterChange,
	eventCounts,
	onSearch,
}: CalendarHeaderProps) => {
	const [searchQuery, setSearchQuery] = useState("");

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (onSearch) {
			onSearch(searchQuery);
		}
	};

	const noTypesSelected = filterOptions.eventTypes.length === 0;

	return (
		<div className="border-b bg-card px-4 sm:px-6 py-4 shadow-sm">
			{/* Top row with navigation and search */}
			<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
				{/* Left side - Month navigation */}
				<div className="flex items-center gap-2 bg-muted p-1 rounded-lg border border-border">
					<Button
						aria-label="Previous month"
						className="h-8 w-8 p-0 rounded-md"
						onClick={onPreviousMonth}
						size="sm"
						variant="ghost"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<h1 className="min-w-[160px] text-center text-sm font-medium bg-card px-4 py-1.5 rounded-md border border-border shadow-sm">
						{format(currentDate, "MMMM yyyy")}
					</h1>
					<Button
						aria-label="Next month"
						className="h-8 w-8 p-0 rounded-md"
						onClick={onNextMonth}
						size="sm"
						variant="ghost"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>

				{/* Right side - Filter and Search */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
					<CalendarFilter
						filterOptions={filterOptions}
						onFilterChange={onFilterChange}
					/>

					{onSearch && (
						<form
							className="relative w-full sm:w-64 md:w-72"
							onSubmit={handleSearch}
						>
							<Search
								aria-hidden="true"
								className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
							/>
							<Input
								aria-label="Search events"
								className="pl-9 pr-9 w-full rounded-md"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search events..."
								value={searchQuery}
							/>
							{searchQuery.length > 0 && (
								<Button
									aria-label="Clear search"
									className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
									onClick={() => {
										setSearchQuery("");
										onSearch?.("");
									}}
									size="sm"
									type="button"
									variant="ghost"
								>
									<X className="h-3.5 w-3.5" />
								</Button>
							)}
						</form>
					)}
				</div>
			</div>

			{/* Bottom row with event counts */}
			<div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-muted-foreground bg-muted p-2 rounded-md border border-border">
				<span className="font-medium">
					{noTypesSelected
						? "Nothing shown — all event types hidden"
						: filterOptions.eventTypes.length === 3
							? "Showing all events"
							: "Showing:"}
				</span>

				{noTypesSelected && (
					<Button
						className="h-6 text-xs px-2"
						onClick={() =>
							onFilterChange({
								eventTypes: ["message", "board-card", "task"],
							})
						}
						size="sm"
						variant="ghost"
					>
						Show all
					</Button>
				)}

				{filterOptions.eventTypes.length > 0 && (
					<span className="text-xs bg-card px-2 py-0.5 rounded-full border border-border">
						{eventCounts.total} total
					</span>
				)}

				{filterOptions.eventTypes.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						{filterOptions.eventTypes.includes("message") && (
							<div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
								<span className="font-medium">{eventCounts.message}</span>
								<span>Messages</span>
							</div>
						)}

						{filterOptions.eventTypes.includes("board-card") && (
							<div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-md border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900">
								<span className="font-medium">{eventCounts.boardCard}</span>
								<span>Board Cards</span>
							</div>
						)}

						{filterOptions.eventTypes.includes("task") && (
							<div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-md border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900">
								<span className="font-medium">{eventCounts.task}</span>
								<span>Tasks</span>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default CalendarHeader;
