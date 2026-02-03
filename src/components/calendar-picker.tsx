"use client";

import { addDays, format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CalendarPickerProps {
	open: boolean;
	onClose: () => void;
	onSelect: (date: Date, time?: string) => void;
}

// Generate time options in 24-hour format with 15-minute intervals from current time to next 24 hours
const generateTimeOptions = (startDate: Date) => {
	const options = [];
	const now = new Date(startDate);
	let end = new Date(startDate);
	end.setHours(end.getHours() + 24); // 24 hours from now

	// Round the start time to the nearest 15 minutes
	const minutes = now.getMinutes();
	const remainder = minutes % 15;
	if (remainder > 0) {
		now.setMinutes(minutes + (15 - remainder));
	}
	now.setSeconds(0);
	now.setMilliseconds(0);

	// Generate times in 15-minute intervals for the next 24 hours
	let current = new Date(now);
	while (current < end) {
		const hours = current.getHours().toString().padStart(2, "0");
		const minutes = current.getMinutes().toString().padStart(2, "0");
		options.push(`${hours}:${minutes}`);

		// Add 15 minutes
		current.setMinutes(current.getMinutes() + 15);
	}

	return options;
};

// Round a date to the nearest 15 minutes
const roundToNearest15Minutes = (date: Date) => {
	const minutes = date.getMinutes();
	const remainder = minutes % 15;
	const roundedDate = new Date(date);

	if (remainder < 8) {
		roundedDate.setMinutes(minutes - remainder);
	} else {
		roundedDate.setMinutes(minutes + (15 - remainder));
	}

	roundedDate.setSeconds(0);
	roundedDate.setMilliseconds(0);

	return roundedDate;
};

export const CalendarPicker = ({
	open,
	onClose,
	onSelect,
}: CalendarPickerProps) => {
	const [date, setDate] = useState<Date>(new Date());
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [selectedTime, setSelectedTime] = useState<string>("");
	const [dateType, setDateType] = useState<string>("today");
	const [timeOptions, setTimeOptions] = useState<string[]>([]);

	// Set initial values and generate time options when dialog opens
	useEffect(() => {
		if (open) {
			const now = new Date();
			const roundedNow = roundToNearest15Minutes(now);

			// Generate time options from current time
			const options = generateTimeOptions(now);
			setTimeOptions(options);

			// Set default time to current time rounded to nearest 15 minutes
			const hours = roundedNow.getHours().toString().padStart(2, "0");
			const minutes = roundedNow.getMinutes().toString().padStart(2, "0");
			setSelectedTime(`${hours}:${minutes}`);

			// Reset date type and date
			setDateType("custom");
			setDate(new Date());
		}
	}, [open]);

	// Get the start of next week (Monday)
	const getNextWeekDates = () => {
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

		// Calculate days until next Monday
		const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

		// Create array of dates for next week (Monday to Sunday)
		const nextWeekDates = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() + daysUntilNextMonday + i);
			nextWeekDates.push(date);
		}

		return nextWeekDates;
	};

	// State to store next week dates
	const [nextWeekDates, setNextWeekDates] = useState<Date[]>([]);
	const [showNextWeekOptions, setShowNextWeekOptions] = useState(false);

	const handleDateTypeChange = (type: string) => {
		setDateType(type);

		const today = new Date();
		let newDate: Date;

		switch (type) {
			case "today":
				newDate = today;
				setShowNextWeekOptions(false);
				break;
			case "tomorrow":
				newDate = addDays(today, 1);
				setShowNextWeekOptions(false);
				break;
			case "next-week": {
				// Generate next week dates
				const dates = getNextWeekDates();
				setNextWeekDates(dates);
				setShowNextWeekOptions(true);
				// Default to Monday of next week
				newDate = dates[0];
				break;
			}
			default:
				newDate = date; // Keep current date for custom
				setShowNextWeekOptions(false);
				break;
		}

		setDate(newDate);

		// Regenerate time options based on selected date
		if (type === "today") {
			const options = generateTimeOptions(today);
			setTimeOptions(options);

			// Set default time to current time rounded to nearest 15 minutes
			const roundedNow = roundToNearest15Minutes(today);
			const hours = roundedNow.getHours().toString().padStart(2, "0");
			const minutes = roundedNow.getMinutes().toString().padStart(2, "0");
			setSelectedTime(`${hours}:${minutes}`);
		} else {
			// For other dates, show all times starting from 00:00
			const options = [];
			for (let hour = 0; hour < 24; hour++) {
				for (let minute = 0; minute < 60; minute += 15) {
					options.push(
						`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
					);
				}
			}
			setTimeOptions(options);

			// Default to 09:00 for non-today dates
			setSelectedTime("09:00");
		}
	};

	const handleSubmit = () => {
		if (!date) {
			toast.error("Please select a date");
			return;
		}

		onSelect(date, selectedTime || undefined);
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add Calendar Event</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-4 max-w-[350px] mx-auto">
					<div className="grid gap-2">
						<Label htmlFor="date-option">Date</Label>
						<div className="flex flex-wrap gap-2">
							<Button
								variant={dateType === "today" ? "default" : "outline"}
								onClick={() => handleDateTypeChange("today")}
								size="sm"
							>
								Today
							</Button>
							<Button
								variant={dateType === "tomorrow" ? "default" : "outline"}
								onClick={() => handleDateTypeChange("tomorrow")}
								size="sm"
							>
								Tomorrow
							</Button>
							<Button
								variant={dateType === "next-week" ? "default" : "outline"}
								onClick={() => handleDateTypeChange("next-week")}
								size="sm"
							>
								Next week
							</Button>
							<Button
								variant={dateType === "custom" ? "default" : "outline"}
								onClick={() => handleDateTypeChange("custom")}
								size="sm"
							>
								Custom
							</Button>
						</div>

						{dateType === "next-week" &&
							showNextWeekOptions &&
							nextWeekDates.length > 0 && (
								<div className="mt-2 grid grid-cols-7 gap-1">
									{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
										(day, _index) => (
											<div
												key={day}
												className="text-center text-xs font-medium text-muted-foreground"
											>
												{day}
											</div>
										)
									)}
									{nextWeekDates.map((nextWeekDate, index) => (
										<Button
											key={index}
											variant={
												date &&
												date.toDateString() === nextWeekDate.toDateString()
													? "default"
													: "outline"
											}
											size="sm"
											className="h-8 w-full p-0 text-xs"
											onClick={() => setDate(nextWeekDate)}
										>
											{nextWeekDate.getDate()}
										</Button>
									))}
								</div>
							)}

						{dateType === "custom" && (
							<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className={cn(
											"w-full justify-start text-left font-normal mt-2",
											!date && "text-muted-foreground"
										)}
									>
										<CalendarIcon className="mr-2 h-4 w-4" />
										{date ? format(date, "PPP") : <span>Pick a date</span>}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-[280px] p-0" align="start">
									<Calendar
										mode="single"
										selected={date}
										onSelect={(newDate) => {
											if (newDate) {
												setDate(newDate);
												setCalendarOpen(false);
											}
										}}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						)}
					</div>

					<div className="grid gap-2">
						<Label htmlFor="time">Time (optional)</Label>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							{timeOptions.length > 0 ? (
								<select
									className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
									value={selectedTime}
									onChange={(e) => setSelectedTime(e.target.value)}
								>
									{timeOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							) : (
								<div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
									Loading time options...
								</div>
							)}
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit}>Add to Calendar</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
