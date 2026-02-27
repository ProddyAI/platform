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
import { cn } from "@/lib/utils";

interface BoardGanttViewProps {
	lists: any[];
	allCards: any[];
	onEditCard: (card: any) => void;
	onDeleteCard: (cardId: Id<"cards">) => void;
	members?: any[];
}

type GanttTask = {
	id: Id<"cards">;
	title: string;
	startDate: Date;
	endDate: Date;
	priority?: string;
	listId: Id<"lists"> | string;
	listTitle: string;
	description?: string;
	labels?: string[];
	parentCardId?: Id<"cards">;
	isSubtask: boolean;
	order?: number;
	parentTitle?: string;
	originalCard: any;
};

const BoardGanttView: React.FC<BoardGanttViewProps> = ({
	lists,
	allCards,
	onEditCard,
	onDeleteCard,
}) => {
	const initialStartDate = useMemo(() => {
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
	}, [allCards]);

	const [currentStartDate, setCurrentStartDate] =
		useState<Date>(initialStartDate);
	const [zoomLevel, setZoomLevel] = useState<number>(14);
	const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
	const [draggingTask, setDraggingTask] = useState<GanttTask | null>(null);
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStartDate, setDragStartDate] = useState<Date | null>(null);

	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const updateCardInGantt = useMutation(api.board.updateCardInGantt);
	const { toast } = useToast();

	const tasks = useMemo(() => {
		const cardById = new Map<Id<"cards">, any>();
		allCards.forEach((card) => cardById.set(card._id, card));

		return allCards
			.filter((card) => card.dueDate)
			.map((card) => {
				const list = lists.find((l) => l._id === card.listId);
				const dueDate = new Date(card.dueDate);

				const startDate = new Date(dueDate);
				startDate.setDate(startDate.getDate() - 3);

				const parentTitle = card.parentCardId
					? cardById.get(card.parentCardId)?.title
					: undefined;

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
					parentCardId: card.parentCardId,
					isSubtask: Boolean(card.parentCardId),
					order: card.order,
					parentTitle,
					originalCard: card,
				} as GanttTask;
			});
	}, [allCards, lists]);

	const timelineDates = useMemo(() => {
		const endDate = addDays(currentStartDate, zoomLevel - 1);
		return eachDayOfInterval({ start: currentStartDate, end: endDate });
	}, [currentStartDate, zoomLevel]);

	const cardsByList = useMemo(() => {
		const map: Record<string, any[]> = {};
		lists.forEach((list) => {
			map[list._id] = [];
		});
		allCards.forEach((card) => {
			if (!map[card.listId]) {
				map[card.listId] = [];
			}
			map[card.listId].push(card);
		});
		Object.values(map).forEach((cards) => {
			cards.sort((a, b) => (a.order || 0) - (b.order || 0));
		});
		return map;
	}, [allCards, lists]);

	const tasksById = useMemo(() => {
		const map = new Map<Id<"cards">, GanttTask>();
		tasks.forEach((task) => map.set(task.id, task));
		return map;
	}, [tasks]);

	const groupedTasksByList = useMemo(() => {
		const grouped: Record<
			string,
			{ rows: { card: any; task?: GanttTask; level: "parent" | "subtask" }[] }
		> = {};

		lists.forEach((list) => {
			const listCards = cardsByList[list._id] || [];
			const rows: {
				card: any;
				task?: GanttTask;
				level: "parent" | "subtask";
			}[] = [];

			const parentCards = listCards.filter((card) => !card.parentCardId);
			parentCards.forEach((parent) => {
				const parentTask = tasksById.get(parent._id);
				const subtaskCards = listCards.filter(
					(card) => card.parentCardId === parent._id
				);
				subtaskCards.sort((a, b) => (a.order || 0) - (b.order || 0));
				const subtaskTasks = subtaskCards
					.map((card) => tasksById.get(card._id))
					.filter(Boolean) as GanttTask[];

				const hasVisibleSubtasks = subtaskTasks.length > 0;
				if (!parentTask && !hasVisibleSubtasks) {
					return;
				}

				rows.push({ card: parent, task: parentTask, level: "parent" });
				subtaskTasks.forEach((task) => {
					rows.push({
						card: task.originalCard,
						task,
						level: "subtask",
					});
				});
			});

			grouped[list._id] = { rows };
		});

		return grouped;
	}, [lists, cardsByList, tasksById]);

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

	const getPriorityColor = (priority: string | undefined) => {
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
	};

	const getSolidPriorityColor = (priority: string | undefined) => {
		switch (priority) {
			case "highest":
				return "#ef4444";
			case "high":
				return "#f97316";
			case "medium":
				return "hsl(var(--secondary))";
			case "low":
				return "#60a5fa";
			case "lowest":
				return "#a78bfa";
			default:
				return "#9ca3af";
		}
	};

	const getPriorityTextColor = (priority: string | undefined) => {
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
	};

	const getTaskPosition = (task: GanttTask) => {
		const timelineStart = startOfDay(currentStartDate);
		const timelineEnd = endOfDay(addDays(currentStartDate, zoomLevel - 1));

		const taskStartsBeforeTimeline = task.startDate < timelineStart;
		const taskEndsAfterTimeline = task.endDate > timelineEnd;

		const startPosition = taskStartsBeforeTimeline
			? 0
			: (differenceInDays(task.startDate, timelineStart) / zoomLevel) * 100;

		let width;
		if (taskStartsBeforeTimeline && taskEndsAfterTimeline) {
			width = 100;
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

	const handleDragStart = (e: React.MouseEvent, task: GanttTask) => {
		e.stopPropagation();

		setDraggingTask(task);
		setDragStartDate(new Date(task.endDate));

		const taskElement = e.currentTarget as HTMLElement;
		const rect = taskElement.getBoundingClientRect();
		setDragOffset({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		});

		setDragPosition({
			x: e.clientX,
			y: e.clientY,
		});

		setIsDragging(true);

		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", handleDragEnd);
	};

	const handleDragMove = (e: MouseEvent) => {
		if (!isDragging || !draggingTask || !timelineContainerRef.current) return;

		setDragPosition({
			x: e.clientX,
			y: e.clientY,
		});
	};

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

		const timelineRect = timelineContainerRef.current.getBoundingClientRect();
		const timelineWidth = timelineRect.width - 250;
		const timelineLeft = timelineRect.left + 250;

		const relativePosition = Math.max(
			0,
			Math.min(1, (e.clientX - timelineLeft) / timelineWidth)
		);

		const dayOffset = Math.floor(relativePosition * zoomLevel);
		const newDueDate = addDays(currentStartDate, dayOffset);

		if (newDueDate.getTime() !== draggingTask.endDate.getTime()) {
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

	const cleanupDrag = () => {
		setIsDragging(false);
		setDraggingTask(null);
		setDragStartDate(null);

		document.removeEventListener("mousemove", handleDragMove);
		document.removeEventListener("mouseup", handleDragEnd);
	};

	const getDraggingTaskPosition = () => {
		if (!isDragging || !draggingTask || !timelineContainerRef.current) {
			return null;
		}

		const timelineRect = timelineContainerRef.current.getBoundingClientRect();
		const timelineWidth = timelineRect.width - 250;
		const timelineLeft = timelineRect.left + 250;

		const relativePosition = Math.max(
			0,
			Math.min(1, (dragPosition.x - timelineLeft) / timelineWidth)
		);

		const dayOffset = Math.floor(relativePosition * zoomLevel);
		const taskDuration = differenceInDays(
			draggingTask.endDate,
			draggingTask.startDate
		);

		const startPosition = ((dayOffset - taskDuration) / zoomLevel) * 100;
		const boundedStartPosition = Math.max(0, startPosition);

		return {
			left: `${boundedStartPosition}%`,
			width: `${Math.max(3, ((taskDuration + 1) / zoomLevel) * 100)}%`,
			position: "absolute" as const,
			top: `${dragPosition.y - dragOffset.y}px`,
			zIndex: 50,
			opacity: 0.7,
			pointerEvents: "none" as const,
		};
	};

	const rowHeight = 34;

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
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={goToPreviousWeek}
							size="sm"
							variant="ghost"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r dark:border-gray-700 dark:text-gray-300">
							{format(currentStartDate, "MMM d")} -{" "}
							{format(addDays(currentStartDate, zoomLevel - 1), "MMM d, yyyy")}
						</div>
						<Button
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							onClick={goToNextWeek}
							size="sm"
							variant="ghost"
						>
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center border dark:border-gray-700 rounded-md overflow-hidden ml-2">
						<Button
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							disabled={zoomLevel >= 28}
							onClick={zoomOut}
							size="sm"
							variant="ghost"
						>
							<ZoomOut className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r dark:border-gray-700 dark:text-gray-300">
							{zoomLevel} days
						</div>
						<Button
							className="h-8 w-8 p-0 rounded-none dark:hover:bg-gray-700"
							disabled={zoomLevel <= 7}
							onClick={zoomIn}
							size="sm"
							variant="ghost"
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</div>

					<Button
						className="h-8 px-2 flex items-center gap-1 dark:bg-gray-800 dark:border-gray-700"
						onClick={() => setCurrentStartDate(startOfWeek(new Date()))}
						size="sm"
						variant="outline"
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
						{timelineDates.map((date) => (
							<div
								className="flex-1 text-center py-2 text-xs font-medium border-r dark:border-gray-800 last:border-r-0"
								key={date.getTime()}
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
					{lists.map((list) => {
						const rows = groupedTasksByList[list._id]?.rows || [];
						const listHeight = Math.max(1, rows.length) * rowHeight;
						const taskCount = rows.filter((row) => row.task).length;

						return (
							<div
								className="border-b dark:border-gray-800 last:border-b-0"
								key={list._id}
							>
								<div className="flex">
									<div className="w-[250px] sticky left-0 bg-white dark:bg-gray-900 z-10 border-r dark:border-gray-800">
										<div className="p-3 border-b dark:border-gray-800">
											<div className="font-medium truncate dark:text-gray-100">
												{list.title}
											</div>
											<div className="text-xs text-muted-foreground dark:text-gray-400">
												{taskCount} tasks
											</div>
										</div>
										<div style={{ height: listHeight }}>
											{rows.map((row, rowIndex) => (
												<div
													className={cn(
														"flex items-center px-3 text-xs border-b dark:border-gray-800",
														row.level === "subtask"
															? "pl-7 text-muted-foreground"
															: "text-foreground"
													)}
													key={`${row.card._id}-${rowIndex}`}
													style={{ height: rowHeight }}
												>
													<span className="truncate">{row.card.title}</span>
												</div>
											))}
										</div>
									</div>

									<div
										className="flex-1 relative"
										style={{ minHeight: listHeight }}
									>
										<div
											className="absolute inset-0 flex"
											style={{ height: listHeight }}
										>
											{timelineDates.map((date, index) => (
												<div
													className={`flex-1 border-r dark:border-gray-800 last:border-r-0 ${isSameDay(date, new Date()) ? "bg-secondary/5 dark:bg-secondary/10" : index % 2 === 0 ? "bg-gray-50 dark:bg-gray-800/30" : "dark:bg-gray-900"}`}
													key={date.getTime()}
													style={{ minWidth: "60px" }}
												/>
											))}
										</div>

										<div className="relative" style={{ height: listHeight }}>
											{rows.map((row) => {
												if (!row.task) {
													return (
														<div
															key={`${row.card._id}-empty`}
															style={{ height: rowHeight }}
														/>
													);
												}

												const style = getTaskPosition(row.task);
												return (
													<div
														className="relative"
														key={row.task.id}
														style={{ height: rowHeight }}
													>
														<div
															className="absolute h-[24px] top-[5px] rounded-md border-2 shadow-sm cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
															onClick={() => setSelectedTask(row.task || null)}
															onMouseDown={(e) =>
																handleDragStart(e, row.task as GanttTask)
															}
															style={{
																...style,
																backgroundColor: getSolidPriorityColor(
																	row.task.priority
																),
																borderColor: getSolidPriorityColor(
																	row.task.priority
																),
															}}
														>
															<div className="absolute inset-0 flex items-center px-2 overflow-hidden">
																<span className="text-xs font-semibold truncate text-white drop-shadow-sm">
																	{row.task.title}
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
						);
					})}

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
					<div className="flex-shrink-0 p-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900">
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wide">
								Task Details
							</span>
							<Button
								aria-label="Close task details"
								className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
								onClick={() => setSelectedTask(null)}
								size="sm"
								variant="ghost"
							>
								<X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							</Button>
						</div>
						<h3 className="text-lg font-semibold dark:text-gray-100">
							{selectedTask.title}
						</h3>
					</div>

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
										/>
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
												className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 dark:text-gray-200 text-xs rounded-full"
												key={`${selectedTask.id}-${label}-${index}`}
											>
												{label}
											</span>
										))}
									</div>
								</div>
							)}

							<div className="pt-2 flex gap-2">
								<Button
									className="flex-1"
									onClick={() => onEditCard(selectedTask.originalCard)}
									size="sm"
									variant="outline"
								>
									<Pencil className="h-3.5 w-3.5 mr-1" />
									Edit
								</Button>
								<Button
									className="flex-1"
									onClick={() => {
										onDeleteCard(selectedTask.id);
										setSelectedTask(null);
									}}
									size="sm"
									variant="outline"
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
