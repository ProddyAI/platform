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
	selected?: Date | Date[];
	onSelect?: (date: Date) => void;
	className?: string;
	month?: Date;
	defaultMonth?: Date;
	disabled?: boolean | ((date: Date) => boolean);
	onMonthChange?: (month: Date) => void;
}

// Day-of-week labels: abbreviation for display, full word for screen readers.
const DAY_LABELS = [
	{ short: "Su", full: "Sunday" },
	{ short: "Mo", full: "Monday" },
	{ short: "Tu", full: "Tuesday" },
	{ short: "We", full: "Wednesday" },
	{ short: "Th", full: "Thursday" },
	{ short: "Fr", full: "Friday" },
	{ short: "Sa", full: "Saturday" },
] as const;

// The day (of the displayed month) that should hold the roving tabindex:
// the selected day if it falls in this month, else today if it falls in
// this month, else the 1st.
function getDefaultFocusDay(
	month: Date,
	selected: Date | Date[] | undefined
): number {
	const candidates = Array.isArray(selected)
		? selected
		: selected
			? [selected]
			: [];
	const selectedInMonth = candidates.find(
		(date) =>
			date.getFullYear() === month.getFullYear() &&
			date.getMonth() === month.getMonth()
	);
	if (selectedInMonth) return selectedInMonth.getDate();

	const today = new Date();
	if (
		today.getFullYear() === month.getFullYear() &&
		today.getMonth() === month.getMonth()
	) {
		return today.getDate();
	}

	return 1;
}

function Calendar({
	selected,
	onSelect,
	className,
	month: controlledMonth,
	defaultMonth = new Date(),
	disabled,
	onMonthChange,
}: CalendarProps) {
	const [month, setMonth] = React.useState(controlledMonth || defaultMonth);
	const [focusedDay, setFocusedDay] = React.useState(() =>
		getDefaultFocusDay(controlledMonth || defaultMonth, selected)
	);
	const dayRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map());

	// Update month when controlled month changes
	React.useEffect(() => {
		if (controlledMonth) {
			setMonth(controlledMonth);
			setFocusedDay(getDefaultFocusDay(controlledMonth, selected));
		}
	}, [controlledMonth, selected]);

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

	// Precompute per-day metadata once per render (date, selected, disabled)
	// instead of re-deriving it — and re-running `disabled()` — separately
	// for click handling, selection, and rendering of every cell.
	const dayMeta = new Map<
		number,
		{ date: Date; isSelected: boolean; isToday: boolean; isDisabled: boolean }
	>();
	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(month.getFullYear(), month.getMonth(), day);
		const isSelected = Array.isArray(selected)
			? selected.some((selectedDate) => isSameDay(selectedDate, date))
			: selected
				? isSameDay(selected, date)
				: false;
		const isDisabled =
			typeof disabled === "function" ? disabled(date) : disabled === true;
		dayMeta.set(day, { date, isSelected, isToday: isToday(date), isDisabled });
	}

	// Handle month navigation
	const handlePrevMonth = () => {
		const newMonth = subMonths(month, 1);
		setMonth(newMonth);
		setFocusedDay(getDefaultFocusDay(newMonth, selected));
		onMonthChange?.(newMonth);
	};
	const handleNextMonth = () => {
		const newMonth = addMonths(month, 1);
		setMonth(newMonth);
		setFocusedDay(getDefaultFocusDay(newMonth, selected));
		onMonthChange?.(newMonth);
	};

	// Handle day selection
	const handleDayClick = (day: number) => {
		if (!onSelect) return;

		const meta = dayMeta.get(day);
		if (!meta || meta.isDisabled) return;

		onSelect(meta.date);
	};

	// Roving-tabindex arrow-key navigation within the visible month grid
	const handleDayKeyDown = (
		event: React.KeyboardEvent<HTMLButtonElement>,
		day: number
	) => {
		let nextDay: number | null = null;
		switch (event.key) {
			case "ArrowLeft":
				nextDay = day - 1;
				break;
			case "ArrowRight":
				nextDay = day + 1;
				break;
			case "ArrowUp":
				nextDay = day - 7;
				break;
			case "ArrowDown":
				nextDay = day + 7;
				break;
			case "Home":
				nextDay = 1;
				break;
			case "End":
				nextDay = daysInMonth;
				break;
			default:
				return;
		}

		if (nextDay < 1 || nextDay > daysInMonth) return;

		event.preventDefault();
		setFocusedDay(nextDay);
		dayRefs.current.get(nextDay)?.focus();
	};

	return (
		<div className={cn("w-full p-3", className)}>
			{/* Month navigation */}
			<div className="flex items-center justify-between mb-4">
				<Button
					aria-label="Previous month"
					className="size-7 bg-transparent p-0"
					onClick={handlePrevMonth}
					size="icon"
					variant="outline"
				>
					<ChevronLeft className="size-4" />
				</Button>
				<div className="font-medium text-sm">{format(month, "MMMM yyyy")}</div>
				<Button
					aria-label="Next month"
					className="size-7 bg-transparent p-0"
					onClick={handleNextMonth}
					size="icon"
					variant="outline"
				>
					<ChevronRight className="size-4" />
				</Button>
			</div>

			{/* Calendar grid */}
			<div
				aria-label={format(month, "MMMM yyyy")}
				className="w-full"
				role="grid"
			>
				<div className="grid grid-cols-7 justify-items-center" role="row">
					{DAY_LABELS.map((day) => (
						<div
							aria-label={day.full}
							className="text-muted-foreground text-xs font-normal text-center"
							key={day.short}
							role="columnheader"
						>
							{day.short}
						</div>
					))}
				</div>
				<div role="rowgroup">
					{/* Deterministic date-math grid, never reordered (JS-0437 exemption) — index is a safe key here */}
					{weeks.map((week, weekIndex) => (
						<div
							className="grid grid-cols-7 justify-items-center mt-2"
							key={`week-${month.getFullYear()}-${month.getMonth()}-${weekIndex}`}
							role="row"
						>
							{week.map((day, dayIndex) => {
								const meta = day !== null ? dayMeta.get(day) : undefined;
								return (
									<div
										className="p-0"
										key={day !== null ? day : `empty-${weekIndex}-${dayIndex}`}
										role="gridcell"
									>
										{day !== null && meta ? (
											<Button
												aria-current={meta.isToday ? "date" : undefined}
												aria-selected={meta.isSelected}
												className={cn(
													"size-8 p-0 font-normal text-sm",
													meta.isSelected &&
														"bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
													meta.isToday &&
														!meta.isSelected &&
														"bg-accent text-accent-foreground"
												)}
												disabled={meta.isDisabled}
												onClick={() => handleDayClick(day)}
												onKeyDown={(event) => handleDayKeyDown(event, day)}
												ref={(el) => {
													if (el) {
														dayRefs.current.set(day, el);
													} else {
														dayRefs.current.delete(day);
													}
												}}
												size="icon"
												tabIndex={day === focusedDay ? 0 : -1}
												variant="ghost"
											>
												{day}
											</Button>
										) : (
											<div className="size-8" />
										)}
									</div>
								);
							})}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

Calendar.displayName = "Calendar";

export { Calendar };
