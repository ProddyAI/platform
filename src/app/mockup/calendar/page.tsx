"use client";

import { addMonths, format, subMonths } from "date-fns";
import {
	AlertTriangle,
	CalendarIcon,
	Clock,
	Filter,
	MapPin,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TestCalendarHeader } from "@/app/mockup/components/test-calendar-header";
import {
	TestLiveCursors,
	useTestLiveCursors,
} from "@/app/mockup/components/test-live-cursors";
import { TestNavigation } from "@/app/mockup/components/test-navigation";
import {
	generateDemoEvents,
	TEST_EVENTS,
} from "@/app/mockup/data/shared-test-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { cn } from "@/lib/utils";

// Use shared test events for consistency
const HARDCODED_EVENTS = TEST_EVENTS;

interface CalendarDay {
	day: number | null;
	isCurrentMonth: boolean;
	events: typeof HARDCODED_EVENTS;
}

const TestCalendarPage = () => {
	useDocumentTitle("Calendar");
	const router = useRouter();
	const { showCursors } = useTestLiveCursors(true);
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedEvent, setSelectedEvent] = useState<
		(typeof HARDCODED_EVENTS)[0] | null
	>(null);
	const [filterOptions, setFilterOptions] = useState({
		meeting: true,
		deadline: true,
		task: true,
		incident: true,
		social: true,
	});

	const handlePreviousMonth = () => {
		setCurrentDate((prev) => subMonths(prev, 1));
	};

	const handleNextMonth = () => {
		setCurrentDate((prev) => addMonths(prev, 1));
	};

	const handleEventClick = (event: (typeof HARDCODED_EVENTS)[0]) => {
		// Show the event details modal
		setSelectedEvent(event);
	};

	const handleViewOnBoard = () => {
		// Navigate to test board
		router.push("/mockup/board");
	};

	// Get all events for current month (unfiltered) for statistics
	const allCurrentMonthEvents = useMemo(() => {
		const filtered = HARDCODED_EVENTS.filter(
			(event) =>
				event.date.getMonth() === currentDate.getMonth() &&
				event.date.getFullYear() === currentDate.getFullYear()
		);

		// If no events for current month, add some demo events for the current month
		if (filtered.length === 0) {
			const currentMonth = currentDate.getMonth();
			const currentYear = currentDate.getFullYear();

			return generateDemoEvents(currentYear, currentMonth);
		}

		return filtered;
	}, [currentDate]);

	// Filter events for current month and by selected filters (for statistics)
	const currentMonthEvents = useMemo(() => {
		return allCurrentMonthEvents.filter(
			(event) => filterOptions[event.type as keyof typeof filterOptions]
		);
	}, [allCurrentMonthEvents, filterOptions]);

	// Group events by day (use all events, filter at display level)
	const eventsByDay = useMemo(() => {
		const grouped: { [key: number]: typeof HARDCODED_EVENTS } = {};
		allCurrentMonthEvents.forEach((event) => {
			const day = event.date.getDate();
			if (!grouped[day]) {
				grouped[day] = [];
			}
			grouped[day].push(event);
		});
		return grouped;
	}, [allCurrentMonthEvents]);

	// Generate calendar days
	const generateCalendarDays = (): CalendarDay[][] => {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();

		const days: CalendarDay[] = [];

		// Add empty cells for days before the first day of the month
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push({ day: null, isCurrentMonth: false, events: [] });
		}

		// Add days of the current month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push({
				day,
				isCurrentMonth: true,
				events: eventsByDay[day] || [],
			});
		}

		// Add empty cells to complete the last week if needed
		const remainingCells = 7 - (days.length % 7);
		if (remainingCells < 7) {
			for (let i = 0; i < remainingCells; i++) {
				days.push({ day: null, isCurrentMonth: false, events: [] });
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

	const getEventTypeColor = (type: string) => {
		switch (type) {
			case "meeting":
				return "bg-blue-100 hover:bg-blue-200 border-l-2 border-blue-500";
			case "deadline":
				return "bg-red-100 hover:bg-red-200 border-l-2 border-red-500";
			case "task":
				return "bg-green-100 hover:bg-green-200 border-l-2 border-green-500";
			case "incident":
				return "bg-orange-100 hover:bg-orange-200 border-l-2 border-orange-500";
			case "social":
				return "bg-purple-100 hover:bg-purple-200 border-l-2 border-purple-500";
			default:
				return "bg-gray-100 hover:bg-gray-200 border-l-2 border-gray-500";
		}
	};

	const getPriorityIcon = (priority: string) => {
		switch (priority) {
			case "critical":
				return <AlertTriangle className="h-3 w-3 text-red-600" />;
			case "high":
				return <AlertTriangle className="h-3 w-3 text-orange-500" />;
			default:
				return null;
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Generic Header */}
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
						variant="ghost"
					>
						<CalendarIcon className="mr-2 size-5" />
						<span className="truncate">Calendar</span>
					</Button>

					<TestNavigation />
				</div>
			</div>

			<div className="flex h-full flex-col bg-white">
				{/* Specific Calendar Header */}
				<TestCalendarHeader
					currentDate={currentDate}
					eventCounts={{
						total: allCurrentMonthEvents.length,
						meeting: allCurrentMonthEvents.filter((e) => e.type === "meeting")
							.length,
						deadline: allCurrentMonthEvents.filter((e) => e.type === "deadline")
							.length,
						task: allCurrentMonthEvents.filter((e) => e.type === "task").length,
						incident: allCurrentMonthEvents.filter((e) => e.type === "incident")
							.length,
						social: allCurrentMonthEvents.filter((e) => e.type === "social")
							.length,
					}}
					filterOptions={filterOptions}
					onFilterChange={setFilterOptions}
					onNextMonth={handleNextMonth}
					onPreviousMonth={handlePreviousMonth}
				/>

				<div className="flex-1 overflow-auto p-4">
					{/* Filter Status Banner */}
					{Object.values(filterOptions).some((v) => !v) && (
						<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Filter className="h-4 w-4 text-blue-600" />
									<span className="text-sm font-medium text-blue-800">
										Filters Active: Showing {currentMonthEvents.length} of{" "}
										{allCurrentMonthEvents.length} events
									</span>
								</div>
								<Button
									className="text-blue-600 border-blue-300 hover:bg-blue-100"
									onClick={() =>
										setFilterOptions({
											meeting: true,
											deadline: true,
											task: true,
											incident: true,
											social: true,
										})
									}
									size="sm"
									variant="outline"
								>
									Clear Filters
								</Button>
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								{Object.entries(filterOptions).map(([type, enabled]) => (
									<Badge
										className={cn(
											"text-xs capitalize",
											!enabled && "opacity-50"
										)}
										key={type}
										variant={enabled ? "default" : "secondary"}
									>
										{type}: {enabled ? "On" : "Off"}
									</Badge>
								))}
							</div>
						</div>
					)}

					<div className="flex gap-4 h-full">
						{/* Main Calendar */}
						<div className="flex-1 rounded-md border">
							{/* Calendar header */}
							<div className="grid grid-cols-7 gap-px border-b bg-muted text-center">
								{weekdays.map((day) => (
									<div
										className="bg-background p-2 text-xs font-medium text-muted-foreground"
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
<<<<<<< HEAD
										key={
											dayObj.day !== null
												? `day-${dayObj.day}`
												: `empty-${index}`
										}
=======
>>>>>>> 7b9cc96a09880de15193206296b24a5439aa03c2
										className={`relative bg-background p-1 ${
											dayObj.isCurrentMonth
												? ""
												: "text-muted-foreground opacity-50"
										}`}
										key={index}
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
														{dayObj.events
															.filter(
																(event) =>
																	filterOptions[
																		event.type as keyof typeof filterOptions
																	]
															)
															.map((event) => (
																<button
																	className={`block rounded-sm p-1 text-[10px] leading-tight transition-colors text-left ${getEventTypeColor(event.type)} hover:opacity-80`}
																	key={event.id}
																	onClick={() => handleEventClick(event)}
																	title={`${event.title} - ${format(event.date, "h:mm a")} (Click to view related tasks)`}
																>
																	<div className="flex items-center gap-1">
																		{getPriorityIcon(event.priority)}
																		<span className="font-bold">
																			{format(event.date, "h:mm a")}
																		</span>
																	</div>
																	<div className="truncate">{event.title}</div>
																</button>
															))}
													</div>
												)}
											</>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Sidebar with upcoming events */}
						<div className="w-80 space-y-4">
							{/* Upcoming Events */}
							{/* <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {HARDCODED_EVENTS
                        .filter(event =>
                          event.date >= new Date() &&
                          filterOptions[event.type as keyof typeof filterOptions]
                        )
                        .sort((a, b) => a.date.getTime() - b.date.getTime())
                        .slice(0, 10)
                        .map((event) => (
                          <div
                            key={event.id}
                            className="p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handleEventClick(event)}
                            title="Click to view related tasks"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{event.title}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {format(event.date, 'MMM d, h:mm a')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {event.location}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant={event.priority === 'critical' ? 'destructive' : event.priority === 'high' ? 'default' : 'secondary'} className="text-xs">
                                  {event.priority}
                                </Badge>
                                {getPriorityIcon(event.priority)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card> */}

							{/* Event Statistics */}
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-lg">Event Statistics</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="grid grid-cols-2 gap-3">
										<div className="text-center p-3 bg-blue-50 rounded-lg">
											<div className="text-2xl font-bold text-blue-600">
												{
													currentMonthEvents.filter((e) => e.type === "meeting")
														.length
												}
											</div>
											<div className="text-xs text-blue-600">Meetings</div>
											<div className="text-xs text-muted-foreground">
												(
												{
													allCurrentMonthEvents.filter(
														(e) => e.type === "meeting"
													).length
												}{" "}
												total)
											</div>
										</div>
										<div className="text-center p-3 bg-red-50 rounded-lg">
											<div className="text-2xl font-bold text-red-600">
												{
													currentMonthEvents.filter(
														(e) => e.type === "deadline"
													).length
												}
											</div>
											<div className="text-xs text-red-600">Deadlines</div>
											<div className="text-xs text-muted-foreground">
												(
												{
													allCurrentMonthEvents.filter(
														(e) => e.type === "deadline"
													).length
												}{" "}
												total)
											</div>
										</div>
										<div className="text-center p-3 bg-green-50 rounded-lg">
											<div className="text-2xl font-bold text-green-600">
												{
													currentMonthEvents.filter((e) => e.type === "task")
														.length
												}
											</div>
											<div className="text-xs text-green-600">Tasks</div>
											<div className="text-xs text-muted-foreground">
												(
												{
													allCurrentMonthEvents.filter((e) => e.type === "task")
														.length
												}{" "}
												total)
											</div>
										</div>
										<div className="text-center p-3 bg-orange-50 rounded-lg">
											<div className="text-2xl font-bold text-orange-600">
												{
													currentMonthEvents.filter(
														(e) => e.type === "incident"
													).length
												}
											</div>
											<div className="text-xs text-orange-600">Incidents</div>
											<div className="text-xs text-muted-foreground">
												(
												{
													allCurrentMonthEvents.filter(
														(e) => e.type === "incident"
													).length
												}{" "}
												total)
											</div>
										</div>
									</div>

									<div className="pt-3 border-t">
										<div className="text-sm font-medium mb-2">
											Priority Breakdown (Filtered)
										</div>
										<div className="space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-red-600">Critical</span>
												<span>
													{
														currentMonthEvents.filter(
															(e) => e.priority === "critical"
														).length
													}{" "}
													/{" "}
													{
														allCurrentMonthEvents.filter(
															(e) => e.priority === "critical"
														).length
													}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-orange-600">High</span>
												<span>
													{
														currentMonthEvents.filter(
															(e) => e.priority === "high"
														).length
													}{" "}
													/{" "}
													{
														allCurrentMonthEvents.filter(
															(e) => e.priority === "high"
														).length
													}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-blue-600">Medium</span>
												<span>
													{
														currentMonthEvents.filter(
															(e) => e.priority === "medium"
														).length
													}{" "}
													/{" "}
													{
														allCurrentMonthEvents.filter(
															(e) => e.priority === "medium"
														).length
													}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-600">Low</span>
												<span>
													{
														currentMonthEvents.filter(
															(e) => e.priority === "low"
														).length
													}{" "}
													/{" "}
													{
														allCurrentMonthEvents.filter(
															(e) => e.priority === "low"
														).length
													}
												</span>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</div>

			{/* Event Details Modal/Sidebar would go here */}
			{selectedEvent && (
				<div
					className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
					onClick={() => setSelectedEvent(null)}
				>
					<Card
						className="w-full max-w-md mx-4"
						onClick={(e) => e.stopPropagation()}
					>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div>
									<CardTitle className="text-lg">
										{selectedEvent.title}
									</CardTitle>
									<div className="flex items-center gap-2 mt-2">
										<Badge
											variant={
												selectedEvent.priority === "critical"
													? "destructive"
													: selectedEvent.priority === "high"
														? "default"
														: "secondary"
											}
										>
											{selectedEvent.priority}
										</Badge>
										<Badge variant="outline">{selectedEvent.type}</Badge>
										<Badge
											variant={
												selectedEvent.status === "confirmed"
													? "default"
													: "secondary"
											}
										>
											{selectedEvent.status}
										</Badge>
									</div>
								</div>
								<Button
									onClick={() => setSelectedEvent(null)}
									size="sm"
									variant="ghost"
								>
									×
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-2 text-sm">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span>{format(selectedEvent.date, "EEEE, MMMM d, yyyy")}</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<Clock className="h-4 w-4 text-muted-foreground" />
								<span>
									{format(selectedEvent.date, "h:mm a")} -{" "}
									{format(selectedEvent.endDate, "h:mm a")}
								</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<MapPin className="h-4 w-4 text-muted-foreground" />
								<span>{selectedEvent.location}</span>
							</div>
							<div className="flex items-start gap-2 text-sm">
								<Users className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<div className="font-medium">Attendees:</div>
									<div className="text-muted-foreground">
										{selectedEvent.attendees.join(", ")}
									</div>
								</div>
							</div>
							<div className="text-sm">
								<div className="font-medium mb-1">Description:</div>
								<div className="text-muted-foreground">
									{selectedEvent.description}
								</div>
							</div>
							<div className="text-sm">
								<div className="font-medium">
									Organizer:{" "}
									<span className="font-normal text-muted-foreground">
										{selectedEvent.organizer}
									</span>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="flex gap-2 pt-2">
								<Button
									className="flex-1"
									onClick={() => setSelectedEvent(null)}
									variant="outline"
								>
									Close
								</Button>
								<Button className="flex-1" onClick={handleViewOnBoard}>
									View on Board
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />
		</div>
	);
};

export default TestCalendarPage;
