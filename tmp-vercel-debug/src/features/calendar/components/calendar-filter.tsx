"use client";

import { CheckSquare, Filter, LayoutGrid, MessageSquare } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type EventType = "message" | "board-card" | "task";

export type CalendarFilterOptions = {
	eventTypes: EventType[];
};

interface CalendarFilterProps {
	filterOptions: CalendarFilterOptions;
	onFilterChange: (options: Partial<CalendarFilterOptions>) => void;
}

export const CalendarFilter = ({
	filterOptions,
	onFilterChange,
}: CalendarFilterProps) => {
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);

	const toggleEventType = (type: EventType) => {
		const currentTypes = [...filterOptions.eventTypes];
		const index = currentTypes.indexOf(type);

		if (index === -1) {
			// Add the type if it's not already selected
			onFilterChange({ eventTypes: [...currentTypes, type] });
		} else {
			// Remove the type if it's already selected
			currentTypes.splice(index, 1);
			onFilterChange({ eventTypes: currentTypes });
		}
	};

	const isEventTypeSelected = (type: EventType) => {
		return filterOptions.eventTypes.includes(type);
	};

	const allTypesSelected = filterOptions.eventTypes.length === 3; // All 3 types selected
	const noTypesSelected = filterOptions.eventTypes.length === 0;

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						className={cn(
							"flex items-center gap-1.5 border rounded-md transition-all",
							filterOptions.eventTypes.length > 0 &&
								filterOptions.eventTypes.length < 3
								? "bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600"
								: "bg-white dark:bg-gray-900"
						)}
						variant="outline"
					>
						<Filter className="h-4 w-4 dark:text-gray-300" />
						<span className="dark:text-gray-200">Filter</span>
						{filterOptions.eventTypes.length > 0 &&
							filterOptions.eventTypes.length < 3 && (
								<div className="flex ml-1 gap-1">
									{filterOptions.eventTypes.includes("message") && (
										<div className="w-2 h-2 rounded-full bg-blue-500" />
									)}
									{filterOptions.eventTypes.includes("board-card") && (
										<div className="w-2 h-2 rounded-full bg-purple-500" />
									)}
									{filterOptions.eventTypes.includes("task") && (
										<div className="w-2 h-2 rounded-full bg-green-500" />
									)}
								</div>
							)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel className="flex items-center justify-between">
						<span className="dark:text-gray-200">Event Types</span>
						<Button
							className="h-7 text-xs px-2 dark:text-gray-300 dark:hover:bg-gray-700"
							onClick={() =>
								onFilterChange({
									eventTypes:
										allTypesSelected || noTypesSelected
											? []
											: ["message", "board-card", "task"],
								})
							}
							size="sm"
							variant="ghost"
						>
							{allTypesSelected || noTypesSelected ? "Clear All" : "Select All"}
						</Button>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					<div className="p-2 space-y-3">
						<div className="flex items-center justify-between space-x-2">
							<div className="flex items-center space-x-2">
								<MessageSquare className="h-4 w-4 text-blue-500 dark:text-blue-400" />
								<Label
									className="cursor-pointer text-blue-700 dark:text-blue-400"
									htmlFor="message-events"
								>
									Message Events
								</Label>
							</div>
							<Switch
								checked={isEventTypeSelected("message")}
								className="data-[state=checked]:bg-blue-500"
								id="message-events"
								onCheckedChange={() => toggleEventType("message")}
							/>
						</div>

						<div className="flex items-center justify-between space-x-2">
							<div className="flex items-center space-x-2">
								<LayoutGrid className="h-4 w-4 text-purple-500 dark:text-purple-400" />
								<Label
									className="cursor-pointer text-purple-700 dark:text-purple-400"
									htmlFor="board-card-events"
								>
									Board Assignments
								</Label>
							</div>
							<Switch
								checked={isEventTypeSelected("board-card")}
								className="data-[state=checked]:bg-purple-500"
								id="board-card-events"
								onCheckedChange={() => toggleEventType("board-card")}
							/>
						</div>

						<div className="flex items-center justify-between space-x-2">
							<div className="flex items-center space-x-2">
								<CheckSquare className="h-4 w-4 text-green-500 dark:text-green-400" />
								<Label
									className="cursor-pointer text-green-700 dark:text-green-400"
									htmlFor="task-events"
								>
									My Tasks
								</Label>
							</div>
							<Switch
								checked={isEventTypeSelected("task")}
								className="data-[state=checked]:bg-green-500"
								id="task-events"
								onCheckedChange={() => toggleEventType("task")}
							/>
						</div>
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
