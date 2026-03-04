"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import {
	ArrowDown,
	ArrowRight,
	ArrowUp,
	Calendar,
	Circle,
	Flame,
} from "lucide-react";
import React from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type IssuePriority =
	| "urgent"
	| "high"
	| "medium"
	| "low"
	| "no_priority";

interface IssueRowProps {
	issue: {
		_id: Id<"issues">;
		title: string;
		priority?: IssuePriority;
		assignees?: Id<"members">[];
		labels?: string[];
		dueDate?: number;
		order: number;
	};
	statusColor: string;
	assigneeData?: Record<Id<"members">, { name: string; image?: string }>;
	onClick: () => void;
	isDragOverlay?: boolean;
}

export function priorityIcon(priority?: IssuePriority, size = "w-3.5 h-3.5") {
	switch (priority) {
		case "urgent":
			return <Flame className={cn(size, "text-red-500")} />;
		case "high":
			return <ArrowUp className={cn(size, "text-orange-500")} />;
		case "medium":
			return <ArrowRight className={cn(size, "text-yellow-500")} />;
		case "low":
			return <ArrowDown className={cn(size, "text-blue-400")} />;
		default:
			return <Circle className={cn(size, "text-muted-foreground/40")} />;
	}
}

export function priorityLabel(priority?: IssuePriority): string {
	switch (priority) {
		case "urgent":
			return "Urgent";
		case "high":
			return "High";
		case "medium":
			return "Medium";
		case "low":
			return "Low";
		case "no_priority":
			return "No Priority";
		default:
			return "No Priority";
	}
}

export function formatIssueId(id: string): string {
	return `#${id.slice(-5).toUpperCase()}`;
}

function isOverdue(dueDate?: number): boolean {
	if (dueDate === undefined) return false;
	const dueDateEndOfDay = new Date(dueDate);
	dueDateEndOfDay.setHours(23, 59, 59, 999);
	return dueDateEndOfDay < new Date();
}

interface PriorityIndicatorProps {
	priority?: IssuePriority;
}

const PriorityIndicator = ({ priority }: PriorityIndicatorProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="flex-shrink-0">{priorityIcon(priority)}</span>
			</TooltipTrigger>
			<TooltipContent side="top">
				<p>{priorityLabel(priority)}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

interface LabelsDisplayProps {
	labels?: string[];
	issueId: Id<"issues">;
}

const LabelsDisplay = ({ labels, issueId }: LabelsDisplayProps) => {
	if (!labels || labels.length === 0) return null;

	return (
		<div className="hidden sm:flex items-center gap-1 flex-shrink-0">
			{labels.slice(0, 2).map((label) => (
				<Badge
					className="text-[10px] px-1.5 py-0 h-4 font-normal"
					key={`${issueId}-lbl-${label}`}
					variant="secondary"
				>
					{label}
				</Badge>
			))}
			{labels.length > 2 && (
				<span className="text-[10px] text-muted-foreground">
					+{labels.length - 2}
				</span>
			)}
		</div>
	);
};

interface DueDateDisplayProps {
	dueDate?: number;
}

const DueDateDisplay = ({ dueDate }: DueDateDisplayProps) => {
	if (!dueDate) return null;

	const overdue = isOverdue(dueDate);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						className={cn(
							"hidden sm:flex flex-shrink-0 items-center gap-1 text-[10px] leading-tight",
							overdue ? "text-destructive" : "text-muted-foreground/70"
						)}
					>
						<Calendar className="w-3 h-3" />
						{format(new Date(dueDate), "MMM d")}
					</span>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p>
						{overdue ? "Overdue – " : "Due "}
						{format(new Date(dueDate), "PPP")}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};

interface AssigneesDisplayProps {
	assignees?: Id<"members">[];
	assigneeData?: Record<Id<"members">, { name: string; image?: string }>;
}

interface AssigneeAvatarProps {
	memberId: Id<"members">;
	member?: { name: string; image?: string };
}

const AssigneeAvatar = ({ memberId, member }: AssigneeAvatarProps) => (
	<TooltipProvider key={memberId}>
		<Tooltip>
			<TooltipTrigger asChild>
				<Avatar className="w-5 h-5 border-2 border-background">
					<AvatarImage alt={member?.name} src={member?.image} />
					<AvatarFallback className="text-[9px]">
						{member?.name?.charAt(0).toUpperCase() || "?"}
					</AvatarFallback>
				</Avatar>
			</TooltipTrigger>
			<TooltipContent side="top">
				<p>{member?.name || "Unknown"}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

const AssigneesDisplay = ({
	assignees,
	assigneeData = {},
}: AssigneesDisplayProps) => {
	if (!assignees || assignees.length === 0) {
		return (
			<div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20" />
		);
	}

	return (
		<div className="flex-shrink-0 flex -space-x-1.5">
			{assignees.slice(0, 3).map((memberId) => {
				const member = assigneeData[memberId];
				return (
					<AssigneeAvatar key={memberId} member={member} memberId={memberId} />
				);
			})}
			{assignees.length > 3 && (
				<Avatar className="w-5 h-5 border-2 border-background bg-muted">
					<AvatarFallback className="text-[9px]">
						+{assignees.length - 3}
					</AvatarFallback>
				</Avatar>
			)}
		</div>
	);
};

interface BoardIssueRowContentProps {
	issue: IssueRowProps["issue"];
	statusColor: string;
	assigneeData: NonNullable<IssueRowProps["assigneeData"]>;
}

const BoardIssueRowContent = ({
	issue,
	statusColor,
	assigneeData,
}: BoardIssueRowContentProps) => (
	<>
		<PriorityIndicator priority={issue.priority} />

		<span
			className="flex-shrink-0 w-2 h-2 rounded-full ring-1 ring-inset ring-black/10"
			style={{ backgroundColor: statusColor }}
		/>

		<span className="flex-shrink-0 text-[10px] font-mono text-muted-foreground/60 w-12 leading-tight">
			{formatIssueId(issue._id)}
		</span>

		<span className="flex-1 text-sm text-foreground truncate leading-tight">
			{issue.title}
		</span>

		<LabelsDisplay issueId={issue._id} labels={issue.labels} />

		<DueDateDisplay dueDate={issue.dueDate} />

		<AssigneesDisplay assigneeData={assigneeData} assignees={issue.assignees} />
	</>
);

const BoardIssueRow = React.memo(function BoardIssueRow({
	issue,
	statusColor,
	assigneeData = {},
	onClick,
	isDragOverlay = false,
}: IssueRowProps) {
	if (isDragOverlay) {
		return (
			<div
				className={cn(
					"group flex items-center gap-2 px-3 py-2 rounded-md border transition-colors duration-100 select-none",
					"shadow-lg bg-background border-border opacity-100"
				)}
			>
				<BoardIssueRowContent
					assigneeData={assigneeData}
					issue={issue}
					statusColor={statusColor}
				/>
			</div>
		);
	}

	const {
		attributes,
		listeners,
		setActivatorNodeRef,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: issue._id,
		data: { type: "issue", issue },
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<button
			ref={(node) => {
				setNodeRef(node);
				if (!isDragOverlay) {
					setActivatorNodeRef(node);
				}
			}}
			style={style}
			type="button"
			{...attributes}
			{...listeners}
			className={cn(
				"group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/60 dark:hover:bg-gray-800/60 cursor-pointer transition-colors duration-100 border border-transparent hover:border-border/40 select-none",
				isDragging && "opacity-40"
			)}
			onClick={() => {
				if (!isDragging) onClick();
			}}
		>
			<BoardIssueRowContent
				assigneeData={assigneeData}
				issue={issue}
				statusColor={statusColor}
			/>
		</button>
	);
});

export default BoardIssueRow;
