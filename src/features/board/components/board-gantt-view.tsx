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
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "./board-issue-row";
import { priorityLabel } from "./board-issue-row";

type BoardStatusItem = {
	_id: Id<"statuses">;
	name: string;
	color: string;
};

type BoardGanttIssue = {
	_id: Id<"issues">;
	statusId: Id<"statuses">;
	title: string;
	priority?: IssuePriority;
	description?: string;
	labels?: string[];
	dueDate?: number;
	parentIssueId?: Id<"issues">;
	order?: number;
};

type BoardGanttIssueWithDueDate = BoardGanttIssue & {
	dueDate: number;
};

const hasDueDate = (
	issue: BoardGanttIssue
): issue is BoardGanttIssueWithDueDate => typeof issue.dueDate === "number";

interface BoardGanttViewProps {
	statuses: BoardStatusItem[];
	issues: BoardGanttIssue[];
	members?: unknown[];
	readOnly?: boolean;
}

type GanttTask = {
	id: Id<"issues">;
	title: string;
	startDate: Date;
	endDate: Date;
	priority?: IssuePriority;
	statusId: Id<"statuses"> | string;
	statusTitle: string;
	statusColor: string;
	description?: string;
	labels?: string[];
	parentIssueId?: Id<"issues">;
	isSubtask: boolean;
	order?: number;
	parentTitle?: string;
	originalIssue: BoardGanttIssue;
};

const BoardGanttView: React.FC<BoardGanttViewProps> = ({
	statuses,
	issues,
}) => {
	const initialStartDate = useMemo(() => {
		const earliestDueDate = issues.filter(hasDueDate).reduce(
			(earliest, issue) => {
				const dueDate = new Date(issue.dueDate);
				return earliest === null || dueDate < earliest ? dueDate : earliest;
			},
			null as Date | null
		);

		return earliestDueDate
			? startOfWeek(earliestDueDate)
			: startOfWeek(new Date());
	}, [issues]);

	const [currentStartDate, setCurrentStartDate] =
		useState<Date>(initialStartDate);
	const [zoomLevel, setZoomLevel] = useState<number>(14);
	const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
	const previousInitialStartRef = useRef<number>(initialStartDate.getTime());

	useEffect(() => {
		const nextInitialTime = initialStartDate.getTime();
		setCurrentStartDate((prev) => {
			if (prev.getTime() !== previousInitialStartRef.current) {
				previousInitialStartRef.current = nextInitialTime;
				return prev;
			}

			previousInitialStartRef.current = nextInitialTime;
			return prev.getTime() === nextInitialTime ? prev : initialStartDate;
		});
	}, [initialStartDate]);

	const timelineContainerRef = useRef<HTMLDivElement>(null);

	const tasks = useMemo(() => {
		const issueById = new Map<Id<"issues">, BoardGanttIssue>();
		issues.forEach((issue) => {
			issueById.set(issue._id, issue);
		});

		return issues.filter(hasDueDate).map((issue) => {
			const status = statuses.find((s) => s._id === issue.statusId);
			const dueDate = new Date(issue.dueDate);

			const startDate = new Date(dueDate);
			startDate.setDate(startDate.getDate() - 3);

			const parentTitle = issue.parentIssueId
				? issueById.get(issue.parentIssueId)?.title
				: undefined;

			return {
				id: issue._id,
				title: issue.title,
				startDate,
				endDate: dueDate,
				priority: issue.priority,
				statusId: issue.statusId,
				statusTitle: status ? status.name : "Unknown Status",
				statusColor: status ? status.color : "#9ca3af",
				description: issue.description,
				labels: issue.labels,
				parentIssueId: issue.parentIssueId,
				isSubtask: Boolean(issue.parentIssueId),
				order: issue.order,
				parentTitle,
				originalIssue: issue,
			} as GanttTask;
		});
	}, [issues, statuses]);

	const timelineDates = useMemo(() => {
		const endDate = addDays(currentStartDate, zoomLevel - 1);
		return eachDayOfInterval({ start: currentStartDate, end: endDate });
	}, [currentStartDate, zoomLevel]);

	const issuesByStatus = useMemo(() => {
		const map: Record<string, BoardGanttIssue[]> = {};
		statuses.forEach((status) => {
			map[status._id] = [];
		});
		issues.forEach((issue) => {
			if (!map[issue.statusId]) {
				map[issue.statusId] = [];
			}
			map[issue.statusId].push(issue);
		});
		Object.values(map).forEach((statusIssues) => {
			statusIssues.sort((a, b) => (a.order || 0) - (b.order || 0));
		});
		return map;
	}, [issues, statuses]);

	const tasksById = useMemo(() => {
		const map = new Map<Id<"issues">, GanttTask>();
		tasks.forEach((task) => map.set(task.id, task));
		return map;
	}, [tasks]);

	const groupedTasksByStatus = useMemo(() => {
		const grouped: Record<
			string,
			{
				rows: {
					issue: BoardGanttIssue;
					task?: GanttTask;
					level: "parent" | "subtask";
				}[];
			}
		> = {};

		statuses.forEach((status) => {
			const statusIssues = issuesByStatus[status._id] || [];
			const rows: {
				issue: BoardGanttIssue;
				task?: GanttTask;
				level: "parent" | "subtask";
			}[] = [];

			const parentIssues = statusIssues.filter((issue) => !issue.parentIssueId);
			parentIssues.forEach((parent) => {
				const parentTask = tasksById.get(parent._id);
				const subtaskIssues = statusIssues.filter(
					(issue) => issue.parentIssueId === parent._id
				);
				subtaskIssues.sort((a, b) => (a.order || 0) - (b.order || 0));
				const subtaskTasks = subtaskIssues
					.map((issue) => tasksById.get(issue._id))
					.filter(Boolean) as GanttTask[];

				const hasVisibleSubtasks = subtaskTasks.length > 0;
				if (!parentTask && !hasVisibleSubtasks) {
					return;
				}

				rows.push({ issue: parent, task: parentTask, level: "parent" });
				subtaskTasks.forEach((task) => {
					rows.push({
						issue: task.originalIssue,
						task,
						level: "subtask",
					});
				});
			});

			grouped[status._id] = { rows };
		});

		return grouped;
	}, [statuses, issuesByStatus, tasksById]);

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

	const getPriorityColor = (priority: IssuePriority | undefined) => {
		switch (priority) {
			case "urgent":
				return "bg-red-500";
			case "high":
				return "bg-orange-500";
			case "medium":
				return "bg-yellow-500";
			case "low":
				return "bg-blue-400";
			default:
				return "bg-muted-foreground/40";
		}
	};

	const getPriorityBadgeBg = (priority: IssuePriority | undefined) => {
		switch (priority) {
			case "urgent":
				return "bg-red-500/10";
			case "high":
				return "bg-orange-500/10";
			case "medium":
				return "bg-yellow-500/10";
			case "low":
				return "bg-blue-400/10";
			default:
				return "bg-muted-foreground/10";
		}
	};

	const getSolidPriorityColor = (priority: IssuePriority | undefined) => {
		switch (priority) {
			case "urgent":
				return "#ef4444";
			case "high":
				return "#f97316";
			case "medium":
				return "#eab308";
			case "low":
				return "#60a5fa";
			default:
				return "#9ca3af";
		}
	};

	const getPriorityTextColor = (priority: IssuePriority | undefined) => {
		switch (priority) {
			case "urgent":
				return "text-red-500";
			case "high":
				return "text-orange-500";
			case "medium":
				return "text-yellow-500";
			case "low":
				return "text-blue-400";
			default:
				return "text-muted-foreground";
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

	const rowHeight = 34;

	return (
		<div className="h-full flex flex-col bg-card">
			{/* Gantt Chart Controls */}
			<div className="p-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-secondary/5 to-secondary/5">
				<div className="text-sm font-medium text-muted-foreground">
					Showing {tasks.length} tasks with due dates across {statuses.length}{" "}
					statuses
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center border border-border rounded-md overflow-hidden">
						<Button
							className="h-8 w-8 p-0 rounded-none"
							onClick={goToPreviousWeek}
							size="sm"
							variant="ghost"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r border-border">
							{format(currentStartDate, "MMM d")} -{" "}
							{format(addDays(currentStartDate, zoomLevel - 1), "MMM d, yyyy")}
						</div>
						<Button
							className="h-8 w-8 p-0 rounded-none"
							onClick={goToNextWeek}
							size="sm"
							variant="ghost"
						>
							<ArrowRight className="h-4 w-4" />
						</Button>
					</div>

					<div className="flex items-center border border-border rounded-md overflow-hidden ml-2">
						<Button
							className="h-8 w-8 p-0 rounded-none"
							disabled={zoomLevel >= 28}
							onClick={zoomOut}
							size="sm"
							variant="ghost"
						>
							<ZoomOut className="h-4 w-4" />
						</Button>
						<div className="px-2 text-xs font-medium border-l border-r border-border">
							{zoomLevel} days
						</div>
						<Button
							className="h-8 w-8 p-0 rounded-none"
							disabled={zoomLevel <= 7}
							onClick={zoomIn}
							size="sm"
							variant="ghost"
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</div>

					<Button
						className="h-8 px-2 flex items-center gap-1"
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
				<div className="sticky top-0 z-10 bg-card border-b border-border">
					<div className="flex pl-[250px]">
						{timelineDates.map((date) => (
							<div
								className="flex-1 text-center py-2 text-xs font-medium border-r border-border last:border-r-0"
								key={date.getTime()}
								style={{ minWidth: "60px" }}
							>
								<div className="text-muted-foreground">
									{format(date, "EEE")}
								</div>
								<div
									className={cn(
										isSameDay(date, new Date())
											? "bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-secondary-foreground rounded-full px-2 py-0.5 inline-block"
											: "text-foreground"
									)}
								>
									{format(date, "d")}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Gantt Chart Body */}
				<div className="relative">
					{statuses.map((status) => {
						const rows = groupedTasksByStatus[status._id]?.rows || [];
						const statusHeight = Math.max(1, rows.length) * rowHeight;
						const taskCount = rows.filter((row) => row.task).length;

						return (
							<div
								className="border-b border-border last:border-b-0"
								key={status._id}
							>
								<div className="flex">
									<div className="w-[250px] sticky left-0 bg-card z-10 border-r border-border">
										<div className="p-3 border-b border-border">
											<div className="font-medium truncate flex items-center gap-2">
												<span
													className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-black/10 dark:ring-white/10"
													style={{ backgroundColor: status.color }}
												/>
												<span className="truncate">{status.name}</span>
											</div>
											<div className="text-xs text-muted-foreground">
												{taskCount} tasks
											</div>
										</div>
										<div style={{ height: statusHeight }}>
											{rows.map((row) => (
												<div
													className={cn(
														"flex items-center px-3 text-xs border-b border-border",
														row.level === "subtask"
															? "pl-7 text-muted-foreground"
															: "text-foreground"
													)}
													key={row.issue._id}
													style={{ height: rowHeight }}
												>
													<span className="truncate">{row.issue.title}</span>
												</div>
											))}
										</div>
									</div>

									<div
										className="flex-1 relative"
										style={{ minHeight: statusHeight }}
									>
										<div
											className="absolute inset-0 flex"
											style={{ height: statusHeight }}
										>
											{timelineDates.map((date, index) => (
												<div
													className={cn(
														"flex-1 border-r border-border last:border-r-0",
														isSameDay(date, new Date())
															? "bg-secondary/5 dark:bg-secondary/10"
															: index % 2 === 0 && "bg-muted/30"
													)}
													key={date.getTime()}
													style={{ minWidth: "60px" }}
												/>
											))}
										</div>

										<div className="relative" style={{ height: statusHeight }}>
											{rows.map((row) => {
												if (!row.task) {
													return (
														<div
															key={`${row.issue._id}-empty`}
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
														<button
															aria-label={`Open task ${row.task.title}`}
															className="absolute h-[24px] top-[5px] rounded-md border-2 shadow-sm cursor-default"
															onClick={() => setSelectedTask(row.task || null)}
															onKeyDown={(e) => {
																if (e.key === "Enter" || e.key === " ") {
																	e.preventDefault();
																	setSelectedTask(row.task || null);
																}
															}}
															style={{
																...style,
																backgroundColor: getSolidPriorityColor(
																	row.task.priority
																),
																borderColor: getSolidPriorityColor(
																	row.task.priority
																),
															}}
															type="button"
														>
															<div className="absolute inset-0 flex items-center px-2 overflow-hidden">
																<span className="text-xs font-semibold truncate text-white drop-shadow-sm">
																	{row.task.title}
																</span>
															</div>
														</button>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</div>
						);
					})}

					{/* Dragging task overlay removed for read-only mode */}
				</div>
			</div>

			{/* Task Details Sidebar */}
			{selectedTask && (
				<div className="fixed right-0 top-[60px] bottom-0 w-[300px] bg-card border-l border-border shadow-lg overflow-hidden z-20 flex flex-col">
					<div className="flex-shrink-0 p-4 border-b border-border bg-card">
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs text-muted-foreground uppercase tracking-wide">
								Task Details
							</span>
							<Button
								aria-label="Close task details"
								className="h-7 w-7 p-0 flex-shrink-0 hover:bg-muted"
								onClick={() => setSelectedTask(null)}
								size="sm"
								variant="ghost"
							>
								<X className="h-4 w-4 text-muted-foreground" />
							</Button>
						</div>
						<h3 className="text-lg font-semibold text-foreground">
							{selectedTask.title}
						</h3>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						<div className="space-y-4">
							<div>
								<div className="text-xs text-muted-foreground mb-1">Status</div>
								<div className="flex items-center gap-2 text-sm font-medium">
									<span
										className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-inset ring-black/10 dark:ring-white/10"
										style={{ backgroundColor: selectedTask.statusColor }}
									/>
									{selectedTask.statusTitle}
								</div>
							</div>

							<div>
								<div className="text-xs text-muted-foreground mb-1">
									Timeline
								</div>
								<div className="text-sm">
									{format(selectedTask.startDate, "MMM d")} -{" "}
									{format(selectedTask.endDate, "MMM d, yyyy")}
								</div>
							</div>

							{selectedTask.priority && (
								<div>
									<div className="text-xs text-muted-foreground mb-1">
										Priority
									</div>
									<div
										className={cn(
											"inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
											getPriorityTextColor(selectedTask.priority),
											getPriorityBadgeBg(selectedTask.priority)
										)}
									>
										<div
											className={cn(
												"w-2 h-2 rounded-full mr-1",
												getPriorityColor(selectedTask.priority)
											)}
										/>
										{priorityLabel(selectedTask.priority)}
									</div>
								</div>
							)}

							{selectedTask.description && (
								<div>
									<div className="text-xs text-muted-foreground mb-1">
										Description
									</div>
									<div className="text-sm">{selectedTask.description}</div>
								</div>
							)}

							{selectedTask.labels && selectedTask.labels.length > 0 && (
								<div>
									<div className="text-xs text-muted-foreground mb-1">
										Labels
									</div>
									<div className="flex flex-wrap gap-1">
										{selectedTask.labels.map((label) => (
											<span
												className="px-2 py-0.5 bg-muted text-xs rounded-full"
												key={`${selectedTask.id}-${label}`}
											>
												{label}
											</span>
										))}
									</div>
								</div>
							)}

							<div className="pt-2">
								<div className="text-xs text-muted-foreground mb-1">
									View Mode
								</div>
								<p className="text-sm text-muted-foreground">
									Gantt view is read-only. Switch to Board view to edit tasks.
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Empty state */}
			{tasks.length === 0 && (
				<div className="flex-1 flex items-center justify-center flex-col p-8">
					<div className="bg-muted rounded-full p-3 mb-3">
						<Calendar className="h-6 w-6 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium mb-1">No tasks with due dates</h3>
					<p className="text-sm text-muted-foreground text-center max-w-md">
						Add due dates to your issues to see them in the Gantt chart view.
					</p>
				</div>
			)}
		</div>
	);
};

export default BoardGanttView;
