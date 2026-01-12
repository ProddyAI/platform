"use client";

import { useMutation } from "convex/react";
import {
	addDays,
	addWeeks,
	differenceInDays,
	eachDayOfInterval,
	endOfDay,
	format,
	isSameDay,
	isWithinInterval,
	startOfDay,
	startOfWeek,
	subWeeks,
} from "date-fns";
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	GripHorizontal,
	Pencil,
	Trash,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface BoardGanttViewProps {
	lists: any[];
	allCards: any[];
	onEditCard: (card: any) => void;
	onDeleteCard: (cardId: Id<"cards">) => void;
	members?: any[];
}

// Define a type for our task items
interface GanttTask {
	id: Id<"cards">;
	title: string;
	startDate: Date;
	endDate: Date;
	priority?: string;
	listId: Id<"lists">;
	listTitle: string;
	description?: string;
	labels?: string[];
	originalCard: any;
}

const BoardGanttView: React.FC<BoardGanttViewProps> = ({
	lists,
	allCards,
	onEditCard,
	onDeleteCard,
	members = [],
}) => {
	// State for timeline controls
	const [currentStartDate, setCurrentStartDate] = useState<Date>(() => {
		// Find the earliest due date or default to today
		const earliestDueDate = allCards
			.filter((card) => card.dueDate)
			.reduce(
				(earliest, card) => {
					const dueDate = new Date(card.dueDate);
					return earliest === null || dueDate < earliest ? dueDate : earliest;
				},
				null as Date | null
			);

		return earliestDueDate
			? startOfWeek(earliestDueDate)
			: startOfWeek(new Date());
	});

	const [zoomLevel, setZoomLevel] = useState<number>(14); // Number of days to show
	const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
	const [draggingTask, setDraggingTask] = useState<GanttTask | null>(null);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStartDate, setDragStartDate] = useState<Date | null>(null);

	// Ref for the timeline container to calculate positions
	const timelineContainerRef = useRef<HTMLDivElement>(null);

	// Mutation to update card due date
	const updateCardInGantt = useMutation(api.board.updateCardInGantt);
	const { toast } = useToast();

	// Process cards into Gantt tasks
	const tasks = useMemo(() => {
		return allCards
			.filter((card) => card.dueDate)
			.map((card) => {
				const list = lists.find((l) => l._id === card.listId);
				const dueDate = new Date(card.dueDate);

				// For simplicity, we'll set the start date to 3 days before the due date
				// In a real app, you might have actual start dates stored
				const startDate = new Date(dueDate);
				startDate.setDate(startDate.getDate() - 3);

				return {
					id: card._id,
					title: card.title,
					startDate,
					endDate: dueDate,
					priority: card.priority,
					listId: card.listId,
					listTitle: list ? list.title : "Unknown List",
					description: card.description,
					labels: card.labels,
					originalCard: card,
				} as GanttTask;
			});
	}, [allCards, lists]);

	// Generate the dates for our timeline
	const timelineDates = useMemo(() => {
		const endDate = addDays(currentStartDate, zoomLevel - 1);
		return eachDayOfInterval({ start: currentStartDate, end: endDate });
	}, [currentStartDate, zoomLevel]);

	// Get priority color
	function getPriorityColor(priority: string | undefined) {
		switch (priority) {
			case "highest":
				return "bg-red-500";
			case "high":
				return "bg-orange-500";
			case "medium":
				return "bg-secondary";
			case "low":
				return "bg-blue-400";
			case "lowest":
				return "bg-secondary/50";
			default:
				return "bg-gray-400";
		}
	}

	// Get solid background color for task bars
	function getSolidPriorityColor(priority: string | undefined) {
		switch (priority) {
			case "highest":
				return "#ef4444"; // red-500
			case "high":
				return "#f97316"; // orange-500
			case "medium":
				return "hsl(var(--secondary))"; // secondary color
			case "low":
				return "#60a5fa"; // blue-400
			case "lowest":
				return "#a78bfa"; // purple-400
			default:
				return "#9ca3af"; // gray-400
		}
	}

	function getPriorityTextColor(priority: string | undefined) {
		switch (priority) {
			case "highest":
				return "text-red-500";
			case "high":
				return "text-orange-500";
			case "medium":
				return "text-secondary";
			case "low":
				return "text-blue-400";
			case "lowest":
				return "text-secondary";
			default:
				return "text-gray-500";
		}
	}

	// Group tasks by list
	const tasksByList = lists.reduce(
		(acc, list) => {
			acc[list._id] = tasks.filter((task) => task.listId === list._id);
			return acc;
		},
		{} as Record<string, GanttTask[]>
	);

	// Navigation functions
	const goToPreviousWeek = () => {
		setCurrentStartDate((prev) => subWeeks(prev, 1));
	};

	const goToNextWeek = () => {
		setCurrentStartDate((prev) => addWeeks(prev, 1));
	};

	const zoomIn = () => {
		setZoomLevel((prev) => Math.max(7, prev - 7));
	};

	const zoomOut = () => {
		setZoomLevel((prev) => Math.min(28, prev + 7));
	};

	// Calculate task position and width on the timeline
	const getTaskPosition = (task: GanttTask) => {
		const timelineStart = startOfDay(currentStartDate);
		const timelineEnd = endOfDay(addDays(currentStartDate, zoomLevel - 1));

		// Check if task is within our visible timeline
		const taskStartsBeforeTimeline = task.startDate < timelineStart;
		const taskEndsAfterTimeline = task.endDate > timelineEnd;

		// Calculate start position
		const startPosition = taskStartsBeforeTimeline
			? 0
			: (differenceInDays(task.startDate, timelineStart) / zoomLevel) * 100;

		// Calculate width
		let width;
		if (taskStartsBeforeTimeline && taskEndsAfterTimeline) {
			width = 100; // Task spans the entire visible timeline
		} else if (taskStartsBeforeTimeline) {
			width =
				((differenceInDays(task.endDate, timelineStart) + 1) / zoomLevel) * 100;
		} else if (taskEndsAfterTimeline) {
			width =
				((differenceInDays(timelineEnd, task.startDate) + 1) / zoomLevel) * 100;
		} else {
			width =
				((differenceInDays(task.endDate, task.startDate) + 1) / zoomLevel) *
				100;
		}

		// Ensure minimum width for visibility
		width = Math.max(width, 3);

		return {
			left: `${startPosition}%`,
			width: `${width}%`,
			display:
				isWithinInterval(task.startDate, {
					start: timelineStart,
					end: timelineEnd,
				}) ||
				isWithinInterval(task.endDate, {
					start: timelineStart,
					end: timelineEnd,
				}) ||
				(task.startDate <= timelineStart && task.endDate >= timelineEnd)
					? "block"
					: "none",
		};
	};

	// Handle drag start
	const handleDragStart = (e: React.MouseEvent, task: GanttTask) => {
		// Prevent task selection when starting drag
		e.stopPropagation();

		// Store the task we're dragging
		setDraggingTask(task);
		setDragStartDate(new Date(task.endDate));

		// Calculate the offset from the left edge of the task
		const taskElement = e.currentTarget as HTMLElement;
		const rect = taskElement.getBoundingClientRect();
		setDragOffset({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		});

		// Set initial drag position
		setDragPosition({
			x: e.clientX,
			y: e.clientY,
		});

		setIsDragging(true);

		// Add event listeners for drag and drop
		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", handleDragEnd);
	};

	// Handle drag move
	const handleDragMove = (e: MouseEvent) => {
		if (!isDragging || !draggingTask || !timelineContainerRef.current) return;

		// Update drag position
		setDragPosition({
			x: e.clientX,
			y: e.clientY,
		});
	};

	// Handle drag end
	const handleDragEnd = (e: MouseEvent) => {
		if (
			!isDragging ||
			!draggingTask ||
			!timelineContainerRef.current ||
			!dragStartDate
		) {
			cleanupDrag();
			return;
		}

		// Calculate the new date based on drag position
		const timelineRect = timelineContainerRef.current.getBoundingClientRect();
		const timelineWidth = timelineRect.width - 250; // Subtract the width of the list name column
		const timelineLeft = timelineRect.left + 250; // Add the width of the list name column

		// Calculate the relative position within the timeline (0 to 1)
		const relativePosition = Math.max(
			0,
			Math.min(1, (e.clientX - timelineLeft) / timelineWidth)
		);

		// Calculate the day offset from the start of the timeline
		const dayOffset = Math.floor(relativePosition * zoomLevel);

		// Calculate the new due date
		const newDueDate = addDays(currentStartDate, dayOffset);

		// Only update if the date has changed
		if (newDueDate.getTime() !== draggingTask.endDate.getTime()) {
			// Update the card due date in the backend
			updateCardInGantt({
				cardId: draggingTask.id,
				dueDate: newDueDate.getTime(),
			})
				.then(() => {
					toast({
						title: "Due date updated",
						description: `"${draggingTask.title}" due date changed to ${format(newDueDate, "MMM d, yyyy")}`,
					});
				})
				.catch((error) => {
					toast({
						title: "Error updating due date",
						description: error.message,
						variant: "destructive",
					});
				});
		}

		cleanupDrag();
	};

	// Clean up drag state
	const cleanupDrag = () => {
		setIsDragging(false);
		setDraggingTask(null);
		setDragStartDate(null);

		// Remove event listeners
		document.removeEventListener("mousemove", handleDragMove);
		document.removeEventListener("mouseup", handleDragEnd);
	};

	// Calculate the position of the dragging task
	const getDraggingTaskPosition = () => {
		if (!isDragging || !draggingTask || !timelineContainerRef.current)
			return null;

		const timelineRect = timelineContainerRef.current.getBoundingClientRect();
		const timelineWidth = timelineRect.width - 250; // Subtract the width of the list name column
		const timelineLeft = timelineRect.left + 250; // Add the width of the list name column

		// Calculate the relative position within the timeline (0 to 1)
		const relativePosition = Math.max(
			0,
			Math.min(1, (dragPosition.x - timelineLeft) / timelineWidth)
		);

		// Calculate the day offset from the start of the timeline
		const dayOffset = Math.floor(relativePosition * zoomLevel);

		// Calculate the task width (keep the same duration)
		const taskDuration = differenceInDays(
			draggingTask.endDate,
			draggingTask.startDate
		);

		// Calculate the left position as a percentage
		const startPosition = ((dayOffset - taskDuration) / zoomLevel) * 100;

		// Ensure it's within bounds
		const boundedStartPosition = Math.max(0, startPosition);

		return {
			left: `${boundedStartPosition}%`,
			width: `${Math.max(3, ((taskDuration + 1) / zoomLevel) * 100)}%`,
			position: "absolute",
			top: `${dragPosition.y - dragOffset.y}px`,
			zIndex: 50,
			opacity: 0.7,
			pointerEvents: "none",
		};
	};

	return (
		<div className="h-full flex flex-col bg-white dark:bg-gray-900">
			{/* Gantt Chart Controls */}
			<div className="p-3 border-b dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-secondary/5 to-secondary/5 dark:from-gray-900 dark:to-gray-900">
				<div className="text-sm font-medium text-muted-foreground dark:text-gray-400">
					Showing {tasks.length} tasks with due dates across {lists.length}{" "}
					lists
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center border dark:border-gray-700 rounded-md overflow-hidden">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={goToPreviousWeek}
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r dark:border-gray-700 dark:text-gray-300">
							{format(currentStartDate, "MMM d")} -{" "}
							{format(addDays(currentStartDate, zoomLevel - 1), "MMM d, yyyy")}
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={goToNextWeek}
						>
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center border dark:border-gray-700 rounded-md overflow-hidden ml-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={zoomOut}
							disabled={zoomLevel >= 28}
						>
							<ZoomOut className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r dark:border-gray-700 dark:text-gray-300">
							{zoomLevel} days
						</div>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={zoomIn}
							disabled={zoomLevel <= 7}
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</div>

					<Button
						variant="outline"
						size="sm"
						className="h-8 px-2 flex items-center gap-1 dark:bg-gray-800 dark:border-gray-700"
						onClick={() => setCurrentStartDate(startOfWeek(new Date()))}
					>
						<Calendar className="h-3.5 w-3.5" />
						<span className="text-xs">Today</span>
					</Button>
				</div>
			</div>

			{/* Gantt Chart Content */}
			<div
				className="flex-1 overflow-auto overflow-x-auto"
				ref={timelineContainerRef}
				style={{ WebkitOverflowScrolling: "touch" }}
			>
				<style jsx>{`
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .dark ::-webkit-scrollbar-thumb {
            background: #4b5563;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .dark ::-webkit-scrollbar-thumb:hover {
            background: #6b7280;
          }
        `}</style>
				{/* Timeline Header */}
				<div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
					<div className="flex pl-[250px]">
						{timelineDates.map((date, index) => (
							<div
								key={index}
								className="flex-1 text-center py-2 text-xs font-medium border-r dark:border-gray-800 last:border-r-0"
								style={{ minWidth: "60px" }}
							>
								<div className="text-muted-foreground dark:text-gray-400">
									{format(date, "EEE")}
								</div>
								<div
									className={`${isSameDay(date, new Date()) ? "bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-secondary-foreground rounded-full px-2 py-0.5 inline-block" : "dark:text-gray-300"}`}
								>
									{format(date, "d")}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Gantt Chart Body */}
				<div className="relative">
					{/* List rows with tasks */}
					{lists.map((list) => (
						<div
							key={list._id}
							className="border-b dark:border-gray-800 last:border-b-0"
						>
							<div className="flex">
								{/* List name column */}
								<div className="w-[250px] sticky left-0 bg-white dark:bg-gray-900 z-10 border-r dark:border-gray-800 p-3 flex flex-col justify-center">
									<div className="font-medium truncate dark:text-gray-100">
										{list.title}
									</div>
									<div className="text-xs text-muted-foreground dark:text-gray-400">
										{tasksByList[list._id]?.length || 0} tasks
									</div>
								</div>

								{/* Timeline grid */}
								<div className="flex-1 relative min-h-[100px]">
									{/* Background grid lines */}
									<div className="absolute inset-0 flex">
										{timelineDates.map((date, index) => (
											<div
												key={index}
												className={`flex-1 border-r dark:border-gray-800 last:border-r-0 ${isSameDay(date, new Date()) ? "bg-secondary/5 dark:bg-secondary/10" : index % 2 === 0 ? "bg-gray-50 dark:bg-gray-800/30" : "dark:bg-gray-900"}`}
												style={{ minWidth: "60px" }}
											></div>
										))}
									</div>

									{/* Tasks for this list */}
									<div className="relative p-2">
										{tasksByList[list._id]?.map((task: GanttTask) => {
											const style = getTaskPosition(task);
											return (
												<div
													key={task.id}
													className="mb-2 relative"
													style={{ height: "30px" }}
												>
													<div
														className="absolute top-0 h-full rounded-md border-2 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
														style={{
															...style,
															backgroundColor: getSolidPriorityColor(
																task.priority
															),
															borderColor: getSolidPriorityColor(task.priority),
														}}
														onClick={() => setSelectedTask(task)}
														onMouseDown={(e) => handleDragStart(e, task)}
													>
														<div className="absolute inset-0 flex items-center px-2 overflow-hidden">
															<span className="text-xs font-semibold truncate text-white drop-shadow-sm">
																{task.title}
															</span>
															<GripHorizontal className="ml-auto h-3 w-3 text-white/70 opacity-70 hover:opacity-100" />
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					))}

					{/* Dragging task overlay */}
					{isDragging && draggingTask && (
						<div
							className="absolute rounded-md border-2 shadow-lg opacity-80"
							style={Object.assign(
								{
									backgroundColor: getSolidPriorityColor(draggingTask.priority),
									borderColor: getSolidPriorityColor(draggingTask.priority),
									height: "30px",
								},
								getDraggingTaskPosition() || {}
							)}
						>
							<div className="absolute inset-0 flex items-center px-2 overflow-hidden">
								<span className="text-xs font-semibold truncate text-white drop-shadow-sm">
									{draggingTask.title}
								</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Task Details Sidebar */}
			{selectedTask && (
				<div className="fixed right-0 top-[60px] bottom-0 w-[300px] bg-white dark:bg-gray-900 border-l dark:border-gray-800 shadow-lg overflow-hidden z-20 flex flex-col">
					{/* Fixed Header */}
					<div className="flex-shrink-0 p-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wide">
								Task Details
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
								onClick={() => setSelectedTask(null)}
								aria-label="Close task details"
							>
								<X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							</Button>
						</div>
						<h3 className="text-lg font-semibold dark:text-gray-100">
							{selectedTask.title}
						</h3>
					</div>

					{/* Scrollable Content */}
					<div className="flex-1 overflow-y-auto p-4">
						<div className="space-y-4">
							<div>
								<div className="text-xs text-muted-foreground dark:text-gray-400 mb-1">
									List
								</div>
								<div className="text-sm font-medium dark:text-gray-200">
									{selectedTask.listTitle}
								</div>
							</div>

							<div>
								<div className="text-xs text-muted-foreground dark:text-gray-400 mb-1">
									Timeline
								</div>
								<div className="text-sm dark:text-gray-200">
									{format(selectedTask.startDate, "MMM d")} -{" "}
									{format(selectedTask.endDate, "MMM d, yyyy")}
								</div>
							</div>

							{selectedTask.priority && (
								<div>
									<div className="text-xs text-muted-foreground dark:text-gray-400 mb-1">
										Priority
									</div>
									<div
										className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityTextColor(selectedTask.priority)} bg-opacity-10 ${getPriorityColor(selectedTask.priority).replace("bg-", "bg-")}`}
									>
										<div
											className={`w-2 h-2 rounded-full mr-1 ${getPriorityColor(selectedTask.priority)}`}
										></div>
										{selectedTask.priority.charAt(0).toUpperCase() +
											selectedTask.priority.slice(1)}
									</div>
								</div>
							)}

							{selectedTask.description && (
								<div>
									<div className="text-xs text-muted-foreground dark:text-gray-400 mb-1">
										Description
									</div>
									<div className="text-sm dark:text-gray-200">
										{selectedTask.description}
									</div>
								</div>
							)}

							{selectedTask.labels && selectedTask.labels.length > 0 && (
								<div>
									<div className="text-xs text-muted-foreground dark:text-gray-400 mb-1">
										Labels
									</div>
									<div className="flex flex-wrap gap-1">
										{selectedTask.labels.map((label, index) => (
											<span
												key={index}
												className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 dark:text-gray-200 text-xs rounded-full"
											>
												{label}
											</span>
										))}
									</div>
								</div>
							)}

							<div className="pt-2 flex gap-2">
								<Button
									size="sm"
									variant="outline"
									className="flex-1"
									onClick={() => onEditCard(selectedTask.originalCard)}
								>
									<Pencil className="h-3.5 w-3.5 mr-1" />
									Edit
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="flex-1"
									onClick={() => {
										onDeleteCard(selectedTask.id);
										setSelectedTask(null);
									}}
								>
									<Trash className="h-3.5 w-3.5 mr-1" />
									Delete
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Empty state */}
			{tasks.length === 0 && (
				<div className="flex-1 flex items-center justify-center flex-col p-8">
					<div className="bg-gray-50 dark:bg-gray-800 rounded-full p-3 mb-3">
						<Calendar className="h-6 w-6 text-gray-400 dark:text-gray-500" />
					</div>
					<h3 className="text-lg font-medium mb-1 dark:text-gray-100">
						No tasks with due dates
					</h3>
					<p className="text-sm text-muted-foreground dark:text-gray-400 text-center max-w-md">
						Add due dates to your cards to see them in the Gantt chart view.
					</p>
				</div>
			)}
		</div>
	);
};

export default BoardGanttView;
