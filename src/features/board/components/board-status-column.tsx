"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	GripVertical,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "./board-issue-row";
import BoardIssueRow from "./board-issue-row";

interface Status {
	_id: Id<"statuses">;
	name: string;
	color: string;
	order: number;
}

interface Issue {
	_id: Id<"issues">;
	channelId: Id<"channels">;
	title: string;
	statusId: Id<"statuses">;
	priority?: IssuePriority;
	assignees?: Id<"members">[];
	labels?: string[];
	dueDate?: number;
	createdAt: number;
	updatedAt: number;
	order: number;
}

interface BoardStatusColumnProps {
	status: Status;
	issues: Issue[];
	assigneeData?: Record<Id<"members">, { name: string; image?: string }>;
	onEditStatus: () => void;
	onDeleteStatus: () => void;
	onClickIssue: (issue: Issue) => void;
	onCreateIssue: (statusId: Id<"statuses">, title: string) => Promise<void>;
	disableColumnDrag?: boolean;
	subIssueStatsMap?: Record<string, { total: number; completed: number }>;
	disableIssueDrag?: boolean;
	isFocused?: boolean;
}

const BoardStatusColumn: React.FC<BoardStatusColumnProps> = ({
	status,
	issues,
	assigneeData = {},
	onEditStatus,
	onDeleteStatus,
	onClickIssue,
	onCreateIssue,
	disableColumnDrag = false,
	subIssueStatsMap,
	disableIssueDrag = false,
	isFocused = false,
}) => {
	const [creating, setCreating] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const {
		attributes,
		listeners,
		setNodeRef: setSortableRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: status._id,
		data: { type: "status", status },
		disabled: disableColumnDrag,
	});

	const { setNodeRef: setDropRef, isOver } = useDroppable({
		id: `droppable-${status._id}`,
		data: { type: "status", statusId: status._id },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const handleStartCreating = () => {
		setCreating(true);
		setNewTitle("");
		setTimeout(() => inputRef.current?.focus(), 50);
	};

	const handleCreateIssue = async () => {
		if (!newTitle.trim()) {
			setCreating(false);
			return;
		}

		try {
			await onCreateIssue(status._id, newTitle.trim());
			setNewTitle("");
		} catch (error) {
			console.error("Failed to create issue:", error);
		} finally {
			setCreating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleCreateIssue();
		if (e.key === "Escape") {
			setCreating(false);
			setNewTitle("");
		}
	};

	const isDockedEmpty = issues.length === 0 && !creating;
	const showDockedDropHint = isDockedEmpty && isOver;
	const isEmpty = issues.length === 0;

	return (
		<div
			ref={setSortableRef}
			style={style}
			{...attributes}
			className={cn(
				"flex flex-col bg-background dark:bg-gray-900 rounded-xl border border-border/70 dark:border-gray-800 shadow-sm w-full",
				isDragging && "opacity-50 shadow-xl border-dashed",
				isDockedEmpty ? "h-auto" : "h-full",
				isFocused &&
					"ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
			)}
		>
			<div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/70 dark:border-gray-800 rounded-t-xl bg-muted/50 dark:bg-gray-800/40 flex-shrink-0">
				<div
					className={cn(
						"cursor-grab hover:bg-muted rounded p-0.5 transition-colors",
						disableColumnDrag && "cursor-default opacity-0 pointer-events-none"
					)}
					{...listeners}
				>
					<GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
				</div>

				<span
					className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-black/10"
					style={{ backgroundColor: status.color }}
				/>

				<span className="text-sm font-semibold text-foreground flex-1 truncate">
					{status.name}
				</span>

				<Badge
					className="text-[11px] h-5 px-1.5 font-normal bg-muted/60 dark:bg-gray-700/60 text-muted-foreground"
					variant="secondary"
				>
					{issues.length}
				</Badge>

				<Button
					className="h-6 w-6 hover:bg-muted dark:hover:bg-gray-700"
					onClick={handleStartCreating}
					size="icon"
					title="Add issue"
					variant="ghost"
				>
					<Plus className="w-3.5 h-3.5" />
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-6 w-6 hover:bg-muted dark:hover:bg-gray-700"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="w-3.5 h-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						<DropdownMenuItem onClick={onEditStatus}>
							<Pencil className="w-3.5 h-3.5 mr-2" />
							Edit Status
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onDeleteStatus}
						>
							<Trash className="w-3.5 h-3.5 mr-2" />
							Delete Status
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				className={cn(
					"rounded-b-xl transition-colors duration-150",
					isDockedEmpty && !showDockedDropHint
						? "min-h-2 overflow-hidden"
						: "flex-1 flex flex-col min-h-0 overflow-y-auto",
					isOver && "bg-muted/40 dark:bg-gray-800/40"
				)}
				ref={setDropRef}
			>
				<SortableContext
					items={issues.map((i) => i._id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col gap-0.5 p-2">
						{isDockedEmpty && !showDockedDropHint && <div className="h-1" />}
						{issues.map((issue) => (
							<BoardIssueRow
								assigneeData={assigneeData}
								disableDrag={disableIssueDrag}
								issue={issue}
								key={issue._id}
								onClick={() => onClickIssue(issue)}
								statusColor={status.color}
								subIssueStats={subIssueStatsMap?.[issue._id]}
							/>
						))}

						{isOver && (
							<div
								className={cn(
									"rounded-md border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center text-xs text-primary/60",
									isEmpty ? "h-12" : "h-8",
									issues.length > 0 && "mt-1"
								)}
							>
								Drop here
							</div>
						)}
					</div>
				</SortableContext>

				{creating && (
					<div className="px-2 pb-2">
						<Input
							className="h-8 text-sm bg-background border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/40"
							onBlur={handleCreateIssue}
							onChange={(e) => setNewTitle(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Issue title..."
							ref={inputRef}
							value={newTitle}
						/>
						<p className="text-[10px] text-muted-foreground mt-1 pl-1">
							Enter to save · Esc to cancel
						</p>
					</div>
				)}

				{!creating && issues.length > 0 && (
					<button
						className="flex items-center gap-2 px-4 py-2 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 dark:hover:bg-gray-800/40 rounded-b-xl transition-colors border-t border-border/60 dark:border-gray-800/60"
						onClick={handleStartCreating}
						type="button"
					>
						<Plus className="w-3.5 h-3.5" />
						Add issue
					</button>
				)}
			</div>
		</div>
	);
};

export default BoardStatusColumn;
