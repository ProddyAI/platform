"use client";

import {
	addMonths,
	format,
	getDay,
	getDaysInMonth,
	isSameDay,
	isToday,
	startOfMonth,
	subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarProps {
	mode?: "single" | "range" | "multiple";
	selected?: Date | Date[];
	onSelect?: (date: Date) => void;
	className?: string;
	month?: Date;
	defaultMonth?: Date;
	disabled?: boolean | ((date: Date) => boolean);
	initialFocus?: boolean;
}

function Calendar({
	mode = "single",
	selected,
	onSelect,
	className,
	month: controlledMonth,
	defaultMonth = new Date(),
	disabled,
	initialFocus,
}: CalendarProps) {
	const [month, setMonth] = React.useState(controlledMonth || defaultMonth);

	// Update month when controlled month changes
	React.useEffect(() => {
		if (controlledMonth) {
			setMonth(controlledMonth);
		}
	}, [controlledMonth]);

	// Get days in month
	const daysInMonth = getDaysInMonth(month);
	const firstDayOfMonth = startOfMonth(month);
	const startingDayOfWeek = getDay(firstDayOfMonth); // 0 = Sunday, 1 = Monday, etc.

	// Create array of day numbers with empty slots for the start of the month
	const days: (number | null)[] = Array.from(
		{ length: startingDayOfWeek },
		() => null
	);
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(i);
	}

	// Split days into weeks
	const weeks: (number | null)[][] = [];
	for (let i = 0; i < days.length; i += 7) {
		weeks.push(days.slice(i, i + 7));
	}

	// If the last week is not complete, add null values to fill it
	const lastWeek = weeks[weeks.length - 1];
	if (lastWeek.length < 7) {
		for (let i = lastWeek.length; i < 7; i++) {
			lastWeek.push(null);
		}
	}

	// Day names
	const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

	// Handle month navigation
	const handlePrevMonth = () => setMonth(subMonths(month, 1));
	const handleNextMonth = () => setMonth(addMonths(month, 1));

	// Handle day selection
	const handleDayClick = (day: number) => {
		if (!onSelect) return;

		const date = new Date(month.getFullYear(), month.getMonth(), day);

		// Check if disabled
		if (typeof disabled === "function" && disabled(date)) return;
		if (disabled === true) return;

		onSelect(date);
	};

	// Check if a day is selected
	const isDaySelected = (day: number) => {
		if (!selected) return false;

		const date = new Date(month.getFullYear(), month.getMonth(), day);

		if (Array.isArray(selected)) {
			return selected.some((selectedDate) => isSameDay(selectedDate, date));
		}

		return isSameDay(selected, date);
	};

	// Check if a day is today
	const isDayToday = (day: number) => {
		const date = new Date(month.getFullYear(), month.getMonth(), day);
		return isToday(date);
	};

	return (
		<div className={cn("w-full p-3", className)}>
			{/* Month navigation */}
			<div className="flex items-center justify-between mb-4">
				<Button
					variant="outline"
					size="icon"
					onClick={handlePrevMonth}
					className="h-7 w-7 bg-transparent p-0"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<div className="font-medium text-sm">{format(month, "MMMM yyyy")}</div>
				<Button
					variant="outline"
					size="icon"
					onClick={handleNextMonth}
					className="h-7 w-7 bg-transparent p-0"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			{/* Calendar grid */}
			<table className="w-full border-collapse">
				<thead>
					<tr className="flex w-full justify-between">
						{dayNames.map((day) => (
							<th
								key={day}
								className="text-muted-foreground text-xs font-normal w-8 text-center"
							>
								{day}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week, weekIndex) => (
						<tr
							key={`${format(month, "yyyy-MM")}-week-${weekIndex}`}
							className="flex w-full justify-between mt-2"
						>
							{week.map((day, dayIndex) => (
								<td
									key={
										day !== null
											? `day-${day}`
											: `empty-${weekIndex}-${dayIndex}`
									}
									className="p-0 text-center"
								>
									{day !== null ? (
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDayClick(day)}
											className={cn(
												"h-8 w-8 p-0 font-normal text-sm",
												isDaySelected(day) &&
													"bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
												isDayToday(day) &&
													!isDaySelected(day) &&
													"bg-accent text-accent-foreground"
											)}
											disabled={
												typeof disabled === "function"
													? disabled(
															new Date(
																month.getFullYear(),
																month.getMonth(),
																day
															)
														)
													: disabled === true
											}
										>
											{day}
										</Button>
									) : (
										<div className="h-8 w-8" />
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

Calendar.displayName = "Calendar";

export { Calendar };
