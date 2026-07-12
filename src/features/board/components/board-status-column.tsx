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
import React, { useRef, useState } from "react";
import { toast } from "sonner";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "./board-issue-row";
import BoardIssueRow from "./board-issue-row";

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
	onEditStatus: (status: Status) => void;
	onDeleteStatus: (status: Status) => void;
	onClickIssue: (issue: Issue) => void;
	onCreateIssue: (statusId: Id<"statuses">, title: string) => Promise<void>;
	disableColumnDrag?: boolean;
	subIssueStatsMap?: Record<string, { total: number; completed: number }>;
	dependencyStatsMap?: Record<
		string,
		{ blockedByCount: number; blockingCount: number }
	>;
	disableIssueDrag?: boolean;
	disableCreateIssue?: boolean;
	isFocused?: boolean;
}

const BoardStatusColumn = React.memo(function BoardStatusColumn({
	status,
	issues,
	assigneeData = {},
	onEditStatus,
	onDeleteStatus,
	onClickIssue,
	onCreateIssue,
	disableColumnDrag = false,
	subIssueStatsMap,
	dependencyStatsMap,
	disableIssueDrag = false,
	disableCreateIssue = false,
	isFocused = false,
}: BoardStatusColumnProps) {
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
			setCreating(false);
		} catch (error) {
			console.error("Failed to create issue:", error);
			toast.error("Failed to create issue");
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
			className={cn(
				"flex flex-col bg-muted/50 rounded-2xl border border-border/70 w-full",
				isDragging && "opacity-50 shadow-xl border-dashed",
				isDockedEmpty ? "h-auto" : "h-full",
				isFocused &&
					"ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
			)}
			ref={setSortableRef}
			style={style}
		>
			<div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/70 rounded-t-2xl flex-shrink-0">
				<button
					aria-label="Drag to reorder column"
					className={cn(
						"cursor-grab hover:bg-muted rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
						disableColumnDrag && "cursor-default opacity-0 pointer-events-none"
					)}
					disabled={disableColumnDrag}
					type="button"
					{...attributes}
					{...listeners}
				>
					<GripVertical className="size-3.5 text-muted-foreground" />
				</button>

				<span
					className="size-2.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-black/10 dark:ring-white/10"
					style={{ backgroundColor: status.color }}
				/>

				<span className="text-sm font-semibold text-foreground flex-1 truncate">
					{status.name}
				</span>

				<Badge
					className="text-[11px] h-5 px-1.5 font-normal bg-muted/60 text-muted-foreground"
					variant="secondary"
				>
					{issues.length}
				</Badge>

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									aria-label="Add issue"
									className="size-6 hover:bg-muted"
									disabled={disableCreateIssue}
									onClick={handleStartCreating}
									size="icon"
									variant="ghost"
								>
									<Plus className="size-3.5" />
								</Button>
							</span>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>
								{disableCreateIssue
									? "Issue limit reached. Upgrade plan to create issues."
									: "Add issue"}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							aria-label="Status options"
							className="size-6 hover:bg-muted"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						<DropdownMenuItem onClick={() => onEditStatus(status)}>
							<Pencil className="size-3.5 mr-2" />
							Edit status
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => onDeleteStatus(status)}
						>
							<Trash className="size-3.5 mr-2" />
							Delete status
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				className={cn(
					"rounded-b-2xl transition-colors duration-150",
					isDockedEmpty && !showDockedDropHint
						? "min-h-2 overflow-hidden"
						: "flex-1 flex flex-col min-h-0 overflow-y-auto",
					isOver && "bg-muted/40"
				)}
				ref={setDropRef}
			>
				<SortableContext
					items={issues.map((i) => i._id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col gap-2 p-2">
						{isDockedEmpty && !showDockedDropHint && <div className="h-1" />}
						{issues.map((issue) => (
							<BoardIssueRow
								assigneeData={assigneeData}
								dependencyIndicators={dependencyStatsMap?.[issue._id]}
								disableDrag={disableIssueDrag}
								issue={issue}
								key={issue._id}
								onClickIssue={onClickIssue}
								statusColor={status.color}
								subIssueStats={subIssueStatsMap?.[issue._id]}
							/>
						))}

						{isOver && (
							<div
								className={cn(
									"rounded-md border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center text-xs text-primary",
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
							className="h-8 text-sm bg-card border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/40"
							onBlur={handleCreateIssue}
							onChange={(e) => setNewTitle(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Issue title…"
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
						className="flex items-center gap-2 px-4 py-2 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-b-2xl transition-colors border-t border-border/60 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={disableCreateIssue}
						onClick={handleStartCreating}
						type="button"
					>
						<Plus className="size-3.5" />
						{disableCreateIssue ? "Issue limit reached" : "Add issue"}
					</button>
				)}
			</div>
		</div>
	);
});

export default BoardStatusColumn;
