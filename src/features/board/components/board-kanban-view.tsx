"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	rectIntersection,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import React, { useCallback, useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import BoardHeader from "./board-header";
import type { IssuePriority } from "./board-issue-row";
import BoardIssueRow from "./board-issue-row";
import BoardStatusColumn from "./board-status-column";

interface Status {
	_id: Id<"statuses">;
	name: string;
	color: string;
	order: number;
	channelId: Id<"channels">;
}

interface Issue {
	_id: Id<"issues">;
	channelId: Id<"channels">;
	statusId: Id<"statuses">;
	title: string;
	description?: string;
	priority?: IssuePriority;
	assignees?: Id<"members">[];
	labels?: string[];
	dueDate?: number;
	createdAt: number;
	updatedAt: number;
	order: number;
}

interface BoardKanbanViewProps {
	statuses: Status[];
	issues: Issue[];
	members?: Member[];
	onClickIssue: (issue: Issue) => void;
	onCreateIssue: (statusId: Id<"statuses">, title: string) => Promise<void>;
	onEditStatus: (status: Status) => void;
	onDeleteStatus: (status: Status) => void;
	onReorderStatuses: (newOrder: Status[]) => void;
	onMoveIssueStatus?: (
		issueId: Id<"issues">,
		toStatusId: Id<"statuses">,
		order: number
	) => Promise<void>;
	onReorderStatusesPersist?: (
		statusOrders: { statusId: Id<"statuses">; order: number }[]
	) => Promise<void>;
	showHeader?: boolean;
	statusCount?: number;
	totalIssues?: number;
	view?: "kanban" | "gantt";
	setView?: (view: "kanban" | "gantt") => void;
	onAddStatus?: () => void;
	onSearch?: (query: string) => void;
}

interface Member {
	_id: Id<"members">;
	user?: {
		name?: string;
		image?: string;
	};
}

type ActiveItem =
	| { type: "status"; item: Status }
	| { type: "issue"; item: Issue };

const BoardKanbanView: React.FC<BoardKanbanViewProps> = ({
	statuses,
	issues,
	members = [],
	onClickIssue,
	onCreateIssue,
	onEditStatus,
	onDeleteStatus,
	onReorderStatuses,
	onMoveIssueStatus,
	onReorderStatusesPersist,
	showHeader = false,
	statusCount = 0,
	totalIssues = 0,
	view = "kanban",
	setView,
	onAddStatus,
	onSearch,
}) => {
	const [activeItem, setActiveItem] = React.useState<ActiveItem | null>(null);

	const memberDataMap = useMemo(() => {
		const map: Record<Id<"members">, { name: string; image?: string }> = {};
		members.forEach((member) => {
			if (member._id) {
				map[member._id as Id<"members">] = {
					name: member.user?.name || "Unknown",
					image: member.user?.image,
				};
			}
		});
		return map;
	}, [members]);

	const issuesByStatus = useMemo<Record<string, Issue[]>>(() => {
		const grouped: Record<string, Issue[]> = {};
		for (const s of statuses) {
			grouped[s._id] = [];
		}
		for (const issue of issues) {
			if (!grouped[issue.statusId]) grouped[issue.statusId] = [];
			grouped[issue.statusId].push(issue);
		}
		for (const key of Object.keys(grouped)) {
			grouped[key].sort((a, b) => a.order - b.order);
		}
		return grouped;
	}, [statuses, issues]);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const collisionDetection = useCallback(
		(args: Parameters<typeof closestCenter>[0]) => {
			const rects = rectIntersection(args);
			if (rects.length > 0) return rects;
			const pointer = pointerWithin(args);
			if (pointer.length > 0) return pointer;
			return closestCenter(args);
		},
		[]
	);

	const handleDragStart = (event: DragStartEvent) => {
		const { active } = event;
		const current = active.data.current;
		if (!current) return;
		const type = current.type;
		if (type === "status") {
			setActiveItem({ type: "status", item: current.status });
		} else if (type === "issue") {
			setActiveItem({ type: "issue", item: current.issue });
		}
	};

	// Required by DndContext but no custom drag-over behavior needed
	const handleDragOver = (_event: DragOverEvent) => {};

	const handleDragEnd = async (event: DragEndEvent) => {
		setActiveItem(null);
		const { active, over } = event;
		if (!active || !over || active.id === over.id) return;

		const activeType = active.data.current?.type;

		if (activeType === "status") {
			// Normalize over.id so that if we're hovering over an inner droppable
			// like "droppable-${statusId}", we map it back to the owning status id.
			const overIdStr = over.id.toString();
			const overStatusId = overIdStr.startsWith("droppable-")
				? (overIdStr.replace("droppable-", "") as Id<"statuses">)
				: (over.id as Id<"statuses">);
			const oldIdx = statuses.findIndex((s) => s._id === active.id);
			const newIdx = statuses.findIndex((s) => s._id === overStatusId);
			if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

			// Capture previous state for rollback
			const previousStatuses = [...statuses];
			const reordered = arrayMove([...statuses], oldIdx, newIdx);
			onReorderStatuses(reordered);

			try {
				await onReorderStatusesPersist?.(
					reordered.map((s, idx) => ({
						statusId: s._id,
						order: idx,
					}))
				);
			} catch (error) {
				console.error("Error reordering statuses:", error);
				// Rollback to previous state
				onReorderStatuses(previousStatuses);
			}
			return;
		}

		if (activeType === "issue") {
			const issueId = active.id as Id<"issues">;
			const overId = over.id.toString();
			const overType = over.data.current?.type;

			let toStatusId: Id<"statuses"> | null = null;
			let newOrder = 0;

			if (overId.startsWith("droppable-")) {
				toStatusId = overId.replace("droppable-", "") as Id<"statuses">;
				newOrder = (issuesByStatus[toStatusId] || []).length;
			} else if (overType === "status") {
				toStatusId = over.id as Id<"statuses">;
				newOrder = (issuesByStatus[toStatusId] || []).length;
			} else if (overType === "issue") {
				const overIssue = issues.find((i) => i._id === over.id);
				if (overIssue) {
					toStatusId = overIssue.statusId;
					const statusIssues = issuesByStatus[toStatusId] || [];
					const overIdx = statusIssues.findIndex((i) => i._id === over.id);
					newOrder = overIdx !== -1 ? overIdx : statusIssues.length;
				}
			}

			if (!toStatusId) return;

			try {
				await onMoveIssueStatus?.(issueId, toStatusId, newOrder);
			} catch (error) {
				console.error("Error moving issue:", error);
			}
		}
	};

	const sortedStatuses = useMemo(
		() => [...statuses].sort((a, b) => a.order - b.order),
		[statuses]
	);

	const activeIssueStatus = useMemo(() => {
		if (!activeItem || activeItem.type !== "issue") return undefined;
		return statuses.find((s) => s._id === activeItem.item.statusId);
	}, [activeItem, statuses]);

	return (
		<div className="h-full w-full min-w-0 max-w-full flex flex-col overflow-hidden">
			{showHeader && setView && (
				<div className="flex-shrink-0 sticky top-0 z-10">
					<BoardHeader
						onAddStatus={onAddStatus}
						onSearch={onSearch}
						setView={setView}
						statusCount={statusCount}
						totalIssues={totalIssues}
						view={view}
					/>
				</div>
			)}
			<div className="flex-1 w-full min-w-0 overflow-x-auto overflow-y-hidden">
				<DndContext
					collisionDetection={collisionDetection}
					onDragEnd={handleDragEnd}
					onDragOver={handleDragOver}
					onDragStart={handleDragStart}
					sensors={sensors}
				>
					<SortableContext
						items={sortedStatuses.map((s) => s._id)}
						strategy={rectSortingStrategy}
					>
						{sortedStatuses.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground py-20">
								<p className="text-sm">No statuses yet.</p>
								<p className="text-xs">
									Add a status to start tracking issues.
								</p>
							</div>
						) : (
							<div className="flex w-max min-w-max gap-4 px-4">
								{sortedStatuses.map((status) => (
									<div
										className="w-[calc(25vw-1.5rem)] flex-shrink-0 h-full max-h-full"
										key={status._id}
									>
										<BoardStatusColumn
											assigneeData={memberDataMap}
											issues={issuesByStatus[status._id] || []}
											onClickIssue={onClickIssue}
											onCreateIssue={onCreateIssue}
											onDeleteStatus={() => onDeleteStatus(status)}
											onEditStatus={() => onEditStatus(status)}
											status={status}
										/>
									</div>
								))}
							</div>
						)}
					</SortableContext>

					<DragOverlay>
						{activeItem?.type === "issue" && (
							<BoardIssueRow
								assigneeData={memberDataMap}
								isDragOverlay
								issue={activeItem.item}
								onClick={() => {
									// No-op: drag overlay is not interactive
								}}
								statusColor={activeIssueStatus?.color || "#b4b4b4"}
							/>
						)}
						{activeItem?.type === "status" && (
							<div className="bg-background border border-primary/40 rounded-xl shadow-xl opacity-90 p-3">
								<div className="flex items-center gap-2">
									<span
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: activeItem.item.color }}
									/>
									<span className="text-sm font-semibold">
										{activeItem.item.name}
									</span>
								</div>
							</div>
						)}
					</DragOverlay>
				</DndContext>
			</div>
		</div>
	);
};

export default BoardKanbanView;
