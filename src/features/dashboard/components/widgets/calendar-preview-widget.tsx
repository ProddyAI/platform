"use client";

import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetCalendarEvents } from "@/features/calendar/api/use-get-calendar-events";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

// Define the CalendarEvent interface
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

interface CalendarEvent {
	_id: Id<"events">;
	_creationTime: number;
	date: number;
	title?: string;
	time?: string;
	type: string;
	message?: CalendarEventMessage | null;
	memberId: Id<"members">;
	workspaceId: Id<"workspaces">;
	messageId?: Id<"messages">;
}

interface CalendarPreviewWidgetProps {
	workspaceId: Id<"workspaces">;
	member: unknown;
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const CalendarPreviewWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: CalendarPreviewWidgetProps) => {
	const router = useRouter();
	const today = useMemo(() => new Date(), []);
	const currentMonth = today.getMonth();
	const currentYear = today.getFullYear();

	// Get calendar events
	const { data: events, isLoading } = useGetCalendarEvents({
		workspaceId,
		month: currentMonth,
		year: currentYear,
	});

	// Create array of next seven days
	const nextSevenDays = useMemo(() => {
		return Array.from({ length: 7 }, (_, i) => addDays(today, i));
	}, [today]);

	// Get upcoming events for the next 7 days
	const upcomingEvents = useMemo(() => {
		if (!events) return [];

		const startOfToday = startOfDay(today).getTime();
		const endOfNextWeek = endOfDay(addDays(today, 6)).getTime();

		return events
			.filter((event: CalendarEvent) => {
				// Use the date property instead of startTime
				const eventDate = event.date;
				return eventDate >= startOfToday && eventDate <= endOfNextWeek;
			})
			.sort((a: CalendarEvent, b: CalendarEvent) => a.date - b.date);
	}, [events, today]);

	const handleViewEvent = (eventId: Id<"events">) => {
		router.push(`/workspace/${workspaceId}/calendar?eventId=${eventId}`);
	};

	const handleViewCalendar = () => {
		router.push(`/workspace/${workspaceId}/calendar`);
	};

	const EventCard = ({ event }: { event: CalendarEvent }) => (
		<WidgetCard>
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm leading-tight flex-1">
					{event.title || "Untitled event"}
				</p>
				<Badge
					className="text-xs border-2"
					variant={!event.time ? "outline" : "primarySoft"}
				>
					{!event.time ? "All day" : event.time}
				</Badge>
			</div>
			<Button
				className="mt-1 w-full justify-start text-primary hover:bg-primary/10 hover:text-primary"
				onClick={() => handleViewEvent(event._id)}
				size="sm"
				variant="ghost"
			>
				View details
			</Button>
		</WidgetCard>
	);

	const EmptyState = () => (
		<WidgetEmptyState
			action={{ label: "View Calendar", onClick: handleViewCalendar }}
			description="Schedule events to see them here"
			icon={CalendarIcon}
			title="No upcoming events"
		/>
	);

	// Group events by day
	const eventsByDay = useMemo(() => {
		const grouped = new Map();

		nextSevenDays.forEach((day) => {
			const dateKey = format(day, "yyyy-MM-dd");
			const dayEvents = upcomingEvents.filter((event: CalendarEvent) =>
				isSameDay(new Date(event.date), day)
			);

			grouped.set(dateKey, {
				date: day,
				events: dayEvents,
			});
		});

		return Array.from(grouped.values());
	}, [upcomingEvents, nextSevenDays]);

	if (isLoading) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<WidgetHeader
				action={
					<Button
						className="h-8 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
						onClick={handleViewCalendar}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				}
				badge={upcomingEvents.length > 0 ? upcomingEvents.length : undefined}
				className="pr-2"
				controls={controls}
				icon={<CalendarIcon className="h-5 w-5 text-primary" />}
				isEditMode={isEditMode}
				title="Upcoming Events"
			/>

			{upcomingEvents.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-4 p-4">
						{eventsByDay
							.filter((dayData) => dayData.events.length > 0)
							.map((dayData) => (
								<div
									className="space-y-2"
									key={format(dayData.date, "yyyy-MM-dd")}
								>
									<div className="sticky top-0 z-10 bg-card py-1">
										<h4 className="text-sm font-medium">
											{isSameDay(dayData.date, today)
												? "Today"
												: isSameDay(dayData.date, addDays(today, 1))
													? "Tomorrow"
													: format(dayData.date, "EEEE, MMMM d")}
										</h4>
									</div>

									{dayData.events.map((event: CalendarEvent) => (
										<EventCard event={event} key={event._id} />
									))}
								</div>
							))}

						{eventsByDay.some((dayData) => dayData.events.length === 0) && (
							<p className="text-center text-sm text-muted-foreground">
								Nothing else this week
							</p>
						)}
					</div>
				</ScrollArea>
			) : (
				<EmptyState />
			)}
		</div>
	);
};
