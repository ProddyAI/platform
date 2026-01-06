"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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

	return (
		<div className="calendar-header border-b bg-white px-4 sm:px-6 py-4 shadow-sm">
			{/* Top row with navigation and search */}
			<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
				{/* Left side - Month navigation */}
				<div className="calendar-month-nav flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
					<Button
						variant="ghost"
						size="sm"
						onClick={onPreviousMonth}
						className="h-8 w-8 p-0 rounded-md hover:bg-gray-100 hover:text-gray-700"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<div className="calendar-month-pill min-w-[160px] text-center font-medium bg-white px-4 py-1.5 rounded-md border border-gray-200 shadow-sm">
						{format(currentDate, "MMMM yyyy")}
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={onNextMonth}
						className="h-8 w-8 p-0 rounded-md hover:bg-gray-100 hover:text-gray-700"
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
							onSubmit={handleSearch}
							className="relative w-full sm:w-64 md:w-72"
						>
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Search events..."
								className="pl-9 bg-white w-full border-gray-300 focus-visible:ring-gray-400 focus-visible:ring-opacity-30 rounded-md"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</form>
					)}
				</div>
			</div>

			{/* Bottom row with event counts */}
			<div className="calendar-filter-bar flex flex-wrap items-center gap-2 mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded-md border border-gray-200">
				<div className="calendar-filter-inner flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-gray-200">
					<span className="font-medium">
						{filterOptions.eventTypes.length === 0
							? "No filters applied"
							: filterOptions.eventTypes.length === 3
								? "Showing all events"
								: "Showing:"}
					</span>

					{filterOptions.eventTypes.length > 0 && (
						<span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
							{eventCounts.total} total
						</span>
					)}
				</div>

				{filterOptions.eventTypes.length > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						{filterOptions.eventTypes.includes("message") && (
							<div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md border border-blue-200">
								<span className="font-medium">{eventCounts.message}</span>
								<span>Messages</span>
							</div>
						)}

						{filterOptions.eventTypes.includes("board-card") && (
							<div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-md border border-purple-200">
								<span className="font-medium">{eventCounts.boardCard}</span>
								<span>Board Cards</span>
							</div>
						)}

						{filterOptions.eventTypes.includes("task") && (
							<div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-md border border-green-200">
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
