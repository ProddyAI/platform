"use client";

import { addMonths, getMonth, getYear, subMonths } from "date-fns";
import { CalendarIcon, Loader } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import Renderer from "@/components/messaging/renderer";
import { useGetCalendarEvents } from "@/features/calendar/api/use-get-calendar-events";
import type { CalendarFilterOptions } from "@/features/calendar/components/calendar-filter";
import { CalendarHeader } from "@/features/calendar/components/calendar-header";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

// Quiet, token-based priority chips for the compact event cards in the month
// grid — high/highest align with the warning tier, medium with primary, and
// low/lowest fall back to muted (matches the ramp in board-issue-row.tsx).
const getBoardPriorityChipClass = (
	priority?: "lowest" | "low" | "medium" | "high" | "highest"
) => {
	if (priority === "highest" || priority === "high") {
		return "bg-warning/10 text-warning";
	}
	if (priority === "medium") {
		return "bg-primary/10 text-primary";
	}
	return "bg-muted text-muted-foreground";
};

const getTaskPriorityChipClass = (priority?: "low" | "medium" | "high") => {
	if (priority === "high") {
		return "bg-warning/10 text-warning";
	}
	if (priority === "medium") {
		return "bg-primary/10 text-primary";
	}
	return "bg-muted text-muted-foreground";
};

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

// Safely extract the first text run from a stored Quill Delta body; malformed
// or unexpected payloads fall back to an empty string instead of throwing.
const getMessageTitleText = (body: string): string => {
	try {
		return JSON.parse(body).ops[0].insert;
	} catch {
		return "";
	}
};

const CalendarContent = ({
	workspaceId,
}: {
	workspaceId: Id<"workspaces">;
}) => {
	useSetWorkspaceTitle(<WorkspaceTitle icon={CalendarIcon} label="Calendar" />);

	const [currentDate, setCurrentDate] = useState(new Date());

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
	const { data: projects } = useGetProjects({ workspaceId });

	const projectIdByBoardChannelId = useMemo(() => {
		const mapping = new Map<Id<"channels">, Id<"projects">>();

		for (const project of projects || []) {
			mapping.set(project.boardChannelId, project._id);
		}

		return mapping;
	}, [projects]);

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
			return event.type === "task" && filterOptions.eventTypes.includes("task");
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

	const getBoardCardHref = (boardChannelId: Id<"channels">) => {
		const projectId = projectIdByBoardChannelId.get(boardChannelId);

		if (!projectId) {
			return `/workspace/${workspaceId}/issues`;
		}

		return `/workspace/${workspaceId}/project/${projectId}/board`;
	};

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
		<div className="flex flex-1 flex-col bg-background overflow-hidden">
			<CalendarHeader
				currentDate={currentDate}
				eventCounts={eventCounts}
				filterOptions={filterOptions}
				onFilterChange={handleFilterChange}
				onNextMonth={handleNextMonth}
				onPreviousMonth={handlePreviousMonth}
			/>
			<div className="flex-1 overflow-auto p-4">
				{isLoading ? (
					<div className="flex h-full items-center justify-center">
						<Loader className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="h-full overflow-hidden rounded-2xl border bg-card">
						{/* Calendar header */}
						<div className="grid grid-cols-7 gap-px border-b bg-muted text-center">
							{weekdays.map((day) => (
								<div
									className="bg-card p-2 text-xs font-medium text-muted-foreground"
									key={day}
								>
									{day}
								</div>
							))}
						</div>
						{/* Calendar grid */}
						<div className="grid h-[calc(100%-1rem)] grid-cols-7 grid-rows-6 gap-px bg-muted">
							{weeks.flat().map((dayObj, index) => (
								<div
									className={`relative bg-card p-1 ${
										dayObj.isCurrentMonth
											? ""
											: "text-muted-foreground opacity-50"
									}`}
									key={
										dayObj.day !== null ? `day-${dayObj.day}` : `empty-${index}`
									}
								>
									{dayObj.day && (
										<>
											<div
												className={`absolute right-1 top-1 text-xs ${
													dayObj.day &&
													new Date().getDate() === dayObj.day &&
													new Date().getMonth() === currentDate.getMonth() &&
													new Date().getFullYear() === currentDate.getFullYear()
														? "size-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground -mt-0.5 -mr-0.5"
														: ""
												}`}
											>
												{dayObj.day}
											</div>
											{dayObj.events && dayObj.events.length > 0 && (
												<div className="mt-4 flex max-h-[80px] flex-col gap-1 overflow-y-auto">
													{dayObj.events.map((event) => (
														<Link
															className="block rounded-md border border-primary/20 bg-primary/10 p-1 text-[10px] leading-tight text-primary transition-standard hover:bg-primary/15"
															href={
																event.type === "board-card" && event.boardCard
																	? getBoardCardHref(event.boardCard.channelId)
																	: event.type === "task" && event.task
																		? `/workspace/${workspaceId}/tasks`
																		: event.message?.channelId
																			? `/workspace/${workspaceId}/channel/${event.message.channelId}`
																			: event.message?.conversationId
																				? `/workspace/${workspaceId}/member/${event.memberId}`
																				: "#"
															}
															key={event._id}
															title={
																event.type === "board-card" && event.boardCard
																	? `${event.boardCard.title} (${event.boardCard.listTitle})`
																	: event.type === "task" && event.task
																		? `${event.task.title}${event.task.categoryName ? ` (${event.task.categoryName})` : ""}`
																		: event?.message?.body
																			? getMessageTitleText(event.message.body)
																			: ""
															}
														>
															{event.time && (
																<span className="font-bold">{event.time}</span>
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
																			event.boardCard?.description && (
																				<div className="text-[10px] text-muted-foreground truncate">
																					{event.boardCard.description}
																				</div>
																			)}
																	</>
																) : event.type === "task" && event.task ? (
																	<>
																		<div
																			className={`font-medium ${event.task.completed ? "line-through text-muted-foreground" : ""}`}
																		>
																			{event.task.title}
																		</div>
																		{event.task.description && (
																			<div className="text-[10px] text-muted-foreground truncate">
																				{event.task.description}
																			</div>
																		)}
																	</>
																) : event?.message?.body ? (
																	<Renderer
																		calendarEvent={event.message.calendarEvent}
																		value={event.message.body}
																	/>
																) : (
																	"Event"
																)}
															</div>
															<div className="text-[10px] text-muted-foreground flex items-center justify-between">
																<span>
																	{event.type === "board-card" ? (
																		<>
																			Board Card in {event.boardCard?.listTitle}
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
																			className={cn(
																				"text-[10px] px-1 rounded",
																				getBoardPriorityChipClass(
																					event.boardCard.priority
																				)
																			)}
																		>
																			{event.boardCard.priority}
																		</span>
																	)}
																{event.type === "task" &&
																	event.task?.priority && (
																		<span
																			className={cn(
																				"text-[10px] px-1 rounded",
																				getTaskPriorityChipClass(
																					event.task.priority
																				)
																			)}
																		>
																			{event.task.priority}
																		</span>
																	)}
																{event.type === "task" &&
																	event.task?.completed && (
																		<span className="text-[10px] px-1 rounded bg-success/10 text-success font-medium">
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
	);
};

const CalendarPage = () => {
	// Set document title
	useDocumentTitle("Calendar");
	const workspaceId = useWorkspaceId();

	if (!workspaceId) {
		return null;
	}

	return <CalendarContent workspaceId={workspaceId as Id<"workspaces">} />;
};

export default CalendarPage;
