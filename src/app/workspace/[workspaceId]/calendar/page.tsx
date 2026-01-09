"use client";

import { addMonths, getMonth, getYear, subMonths } from "date-fns";
import { CalendarIcon, Loader } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import Renderer from "@/components/renderer";
import { Button } from "@/components/ui/button";
import { useGetCalendarEvents } from "@/features/calendar/api/use-get-calendar-events";
import type { CalendarFilterOptions } from "@/features/calendar/components/calendar-filter";
import { CalendarHeader } from "@/features/calendar/components/calendar-header";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

// Define types for calendar events
interface CalendarEventUser {
	_id: Id<"users">;
	name: string;
	image: string | null;
}

interface CalendarEventMessage {
	_id: Id<"messages">;
	body: string;
	_creationTime: number;
	channelId?: Id<"channels">;
	conversationId?: Id<"conversations">;
	calendarEvent?: {
		date: number;
		time?: string;
	};
}

interface BoardCard {
	_id: Id<"cards">;
	title: string;
	description?: string;
	priority?: "lowest" | "low" | "medium" | "high" | "highest";
	labels?: string[];
	listId: Id<"lists">;
	listTitle: string;
	channelId: Id<"channels">;
	channelName: string;
}

interface Task {
	_id: Id<"tasks">;
	title: string;
	description?: string;
	completed: boolean;
	status?:
		| "not_started"
		| "in_progress"
		| "completed"
		| "on_hold"
		| "cancelled";
	dueDate: number;
	priority?: "low" | "medium" | "high";
	categoryId?: Id<"categories">;
	categoryName?: string;
	categoryColor?: string;
	userId: Id<"users">;
}

interface CalendarEvent {
	_id: Id<"events">;
	_creationTime: number;
	date: number;
	title?: string;
	time?: string;
	type: string; // Using string instead of union type to accommodate all possible values
	boardCard?: BoardCard;
	message?: CalendarEventMessage | null; // Allow null values
	task?: Task | null; // Allow null values for task data
	user?: CalendarEventUser | null; // Allow null values
	memberId: Id<"members">;
	workspaceId: Id<"workspaces">;
	messageId?: Id<"messages">;
}

// Define type for calendar day objects
interface CalendarDay {
	day: number | null;
	isCurrentMonth: boolean;
	events?: CalendarEvent[];
}

const CalendarPage = () => {
	// Set document title
	useDocumentTitle("Calendar");

	const [currentDate, setCurrentDate] = useState(new Date());
	const workspaceId = useWorkspaceId();

	// Track user activity and time spent on calendar page
	useTrackActivity({
		workspaceId,
		activityType: "calendar_view",
	});

	const { data: events, isLoading } = useGetCalendarEvents({
		workspaceId,
		month: getMonth(currentDate),
		year: getYear(currentDate),
	});

	// Filter state
	const [filterOptions, setFilterOptions] = useState<CalendarFilterOptions>({
		eventTypes: ["message", "board-card", "task"], // Default to showing all event types
	});

	const handlePreviousMonth = () => {
		setCurrentDate((prev) => subMonths(prev, 1));
	};

	const handleNextMonth = () => {
		setCurrentDate((prev) => addMonths(prev, 1));
	};

	const handleFilterChange = (newOptions: Partial<CalendarFilterOptions>) => {
		setFilterOptions((prev) => ({ ...prev, ...newOptions }));
	};

	// Filter events based on filter options
	const filteredEvents = useMemo(() => {
		if (!events) return [];

		// If no event types are selected, show nothing
		if (filterOptions.eventTypes.length === 0) return [];

		return events.filter((event) => {
			// Filter by event type
			if (
				event.type === "calendar-event" &&
				filterOptions.eventTypes.includes("message")
			) {
				return true;
			}
			if (
				event.type === "board-card" &&
				filterOptions.eventTypes.includes("board-card")
			) {
				return true;
			}
			if (event.type === "task" && filterOptions.eventTypes.includes("task")) {
				return true;
			}
			return false;
		});
	}, [events, filterOptions]);

	// Count events by type for stats
	const eventCounts = useMemo(() => {
		if (!events) return { total: 0, message: 0, boardCard: 0, task: 0 };

		return {
			total: events.length,
			message: events.filter((event) => event.type === "calendar-event").length,
			boardCard: events.filter((event) => event.type === "board-card").length,
			task: events.filter((event) => event.type === "task").length,
		};
	}, [events]);

	// Group events by day
	const eventsByDay = filteredEvents.reduce<Record<number, CalendarEvent[]>>(
		(acc, event) => {
			const day = new Date(event.date).getDate();
			if (!acc[day]) {
				acc[day] = [];
			}
			// Type assertion to ensure event matches CalendarEvent interface
			acc[day].push(event as CalendarEvent);
			return acc;
		},
		{}
	);

	// Generate calendar days for the current month
	const generateCalendarDays = (): CalendarDay[][] => {
		if (!currentDate) return [];

		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();

		// Get the number of days in the month
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		// Get the day of the week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
		const firstDayOfMonth = new Date(year, month, 1).getDay();

		// Create an array of day objects
		const days: CalendarDay[] = [];

		// Add empty cells for days before the first day of the month
		for (let i = 0; i < firstDayOfMonth; i++) {
			days.push({ day: null, isCurrentMonth: false });
		}

		// Add days of the current month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push({
				day,
				isCurrentMonth: true,
				events: eventsByDay?.[day] || [],
			});
		}

		// Add empty cells to complete the last week if needed
		const remainingCells = 7 - (days.length % 7);
		if (remainingCells < 7) {
			for (let i = 0; i < remainingCells; i++) {
				days.push({ day: null, isCurrentMonth: false });
			}
		}

		// Group days into weeks
		const weeks: CalendarDay[][] = [];
		for (let i = 0; i < days.length; i += 7) {
			weeks.push(days.slice(i, i + 7));
		}
		return weeks;
	};

	const weeks = generateCalendarDays();
	const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	return (
		<>
			<WorkspaceToolbar>
				<Button
					variant="ghost"
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
				>
					<CalendarIcon className="mr-2 size-5" />
					<span className="truncate">Calendar</span>
				</Button>
			</WorkspaceToolbar>
			<div className="flex flex-1 flex-col bg-white overflow-hidden">
				<CalendarHeader
					currentDate={currentDate}
					onPreviousMonth={handlePreviousMonth}
					onNextMonth={handleNextMonth}
					filterOptions={filterOptions}
					onFilterChange={handleFilterChange}
					eventCounts={eventCounts}
				/>
				<div className="flex-1 overflow-auto p-4">
					{isLoading ? (
						<div className="flex h-full items-center justify-center">
							<Loader className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : (
						<div className="h-full rounded-md border">
							{/* Calendar header */}
							<div className="grid grid-cols-7 gap-px border-b bg-muted text-center">
								{weekdays.map((day) => (
									<div
										key={day}
										className="bg-background p-2 text-xs font-medium text-muted-foreground"
									>
										{day}
									</div>
								))}
							</div>
							{/* Calendar grid */}
							<div className="grid h-[calc(100%-1rem)] grid-cols-7 grid-rows-6 gap-px bg-muted">
								{weeks.flat().map((dayObj, index) => (
									<div
										key={index}
										className={`relative bg-background p-1 ${
											dayObj.isCurrentMonth
												? ""
												: "text-muted-foreground opacity-50"
										}`}
									>
										{dayObj.day && (
											<>
												<div
													className={`absolute right-1 top-1 text-xs ${
														dayObj.day &&
														new Date().getDate() === dayObj.day &&
														new Date().getMonth() === currentDate.getMonth() &&
														new Date().getFullYear() ===
															currentDate.getFullYear()
															? "h-5 w-5 flex items-center justify-center rounded-full bg-primary text-white -mt-0.5 -mr-0.5"
															: ""
													}`}
												>
													{dayObj.day}
												</div>
												{dayObj.events && dayObj.events.length > 0 && (
													<div className="mt-4 flex max-h-[80px] flex-col gap-1 overflow-y-auto">
														{dayObj.events.map((event) => (
															<Link
																href={
																	event.type === "board-card" && event.boardCard
																		? `/workspace/${workspaceId}/channel/${event.boardCard.channelId}/board`
																		: event.type === "task" && event.task
																			? `/workspace/${workspaceId}/tasks`
																			: event.message?.channelId
																				? `/workspace/${workspaceId}/channel/${event.message.channelId}`
																				: event.message?.conversationId
																					? `/workspace/${workspaceId}/member/${event.memberId}`
																					: "#"
																}
																key={event._id}
																className={`block rounded-sm p-1 text-[10px] leading-tight transition-colors ${
																	event.type === "board-card"
																		? "bg-purple-100 hover:bg-purple-200 border-l-2 border-purple-500 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 dark:border-purple-400 dark:text-purple-100"
																		: event.type === "task"
																			? "bg-green-100 hover:bg-green-200 border-l-2 border-green-500 dark:bg-green-900/40 dark:hover:bg-green-900/60 dark:border-green-400 dark:text-green-100"
																			: "bg-blue-100 hover:bg-blue-200 border-l-2 border-blue-500 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 dark:border-blue-400 dark:text-blue-100"
																}`}
																title={
																	event.type === "board-card" && event.boardCard
																		? `${event.boardCard.title} (${event.boardCard.listTitle})`
																		: event.type === "task" && event.task
																			? `${event.task.title}${event.task.categoryName ? ` (${event.task.categoryName})` : ""}`
																			: event?.message?.body
																				? JSON.parse(event.message.body).ops[0]
																						.insert
																				: ""
																}
															>
																{event.time && (
																	<span className="font-bold">
																		{event.time}
																	</span>
																)}
																<div className="truncate">
																	{event.type === "board-card" &&
																	event.boardCard ? (
																		<>
																			<div className="font-medium">
																				{event.boardCard.title}
																			</div>
																				{event.type === "board-card" &&
																					"boardCard" in event &&
																					event.boardCard &&
																					event.boardCard.description && (
																						<div className="text-[8px] text-gray-600 dark:text-gray-300 truncate">
																							{event.boardCard.description}
																						</div>
																					)}
																		</>
																	) : event.type === "task" && event.task ? (
																		<>
																			<div
																				className={`font-medium ${event.task.completed ? "line-through text-gray-500 dark:text-gray-400" : ""}`}
																			>
																				{event.task.title}
																			</div>
																			{event.task.description && (
																				<div className="text-[8px] text-gray-600 dark:text-gray-300 truncate">
																					{event.task.description}
																				</div>
																			)}
																		</>
																	) : event?.message?.body ? (
																		<Renderer
																			value={event.message.body}
																			calendarEvent={
																				event.message.calendarEvent
																			}
																		/>
																	) : (
																		"Event"
																	)}
																</div>
																<div className="text-[8px] text-gray-600 dark:text-gray-400 flex items-center justify-between">
																	<span>
																		{event.type === "board-card" ? (
																			<>
																				Board Card in{" "}
																				{event.boardCard?.listTitle}
																			</>
																		) : event.type === "task" ? (
																			<>
																				Task{" "}
																				{event.task?.categoryName
																					? `in ${event.task.categoryName}`
																					: ""}
																			</>
																		) : (
																			<>
																				Calendar Event by{" "}
																				{event?.user?.name || "Unknown"}
																			</>
																		)}
																	</span>
																	{event.type === "board-card" &&
																		event.boardCard?.priority && (
																			<span
																				className={`text-[8px] px-1 rounded ${
																					event.boardCard.priority === "high"
																						? "bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200"
																						: event.boardCard.priority ===
																								"medium"
																							? "bg-purple-100 text-purple-600 dark:bg-purple-700 dark:text-purple-200"
																							: "bg-purple-50 text-purple-500 dark:bg-purple-600 dark:text-purple-200"
																				}`}
																			>
																				{event.boardCard.priority}
																			</span>
																		)}
																	{event.type === "task" &&
																		event.task?.priority && (
																			<span
																				className={`text-[8px] px-1 rounded ${
																					event.task.priority === "high"
																						? "bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200"
																						: event.task.priority === "medium"
																							? "bg-green-100 text-green-600 dark:bg-green-700 dark:text-green-200"
																							: "bg-green-50 text-green-500 dark:bg-green-600 dark:text-green-200"
																				}`}
																			>
																				{event.task.priority}
																			</span>
																		)}
																	{event.type === "task" &&
																		event.task?.completed && (
																			<span className="text-[8px] px-1 rounded bg-green-200 text-green-700 font-medium dark:bg-green-800 dark:text-green-200">
																				Completed
																			</span>
																		)}
																</div>
															</Link>
														))}
													</div>
												)}
											</>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default CalendarPage;
