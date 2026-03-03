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
	return !!dueDate && new Date(dueDate) < new Date();
}

const BoardIssueRow = React.memo(function BoardIssueRow({
	issue,
	statusColor,
	assigneeData = {},
	onClick,
	isDragOverlay = false,
}: IssueRowProps) {
	const {
		attributes,
		listeners,
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

	const overdue = isOverdue(issue.dueDate);

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={cn(
				"group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/60 dark:hover:bg-gray-800/60 cursor-pointer transition-colors duration-100 border border-transparent hover:border-border/40 select-none",
				isDragging && "opacity-40",
				isDragOverlay && "shadow-lg bg-background border-border opacity-100"
			)}
			onClick={(_e) => {
				if (!isDragging) onClick();
			}}
		>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex-shrink-0">
							{priorityIcon(issue.priority)}
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p>{priorityLabel(issue.priority)}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<span
				className="flex-shrink-0 w-2 h-2 rounded-full ring-1 ring-inset ring-black/10"
				style={{ backgroundColor: statusColor }}
			/>

			<span className="flex-shrink-0 text-[10px] font-mono text-muted-foreground/60 w-12 leading-none">
				{formatIssueId(issue._id)}
			</span>

			<span className="flex-1 text-sm text-foreground truncate leading-none">
				{issue.title}
			</span>

			{issue.labels && issue.labels.length > 0 && (
				<div className="hidden sm:flex items-center gap-1 flex-shrink-0">
					{issue.labels.slice(0, 2).map((label, i) => (
						<Badge
							className="text-[10px] px-1.5 py-0 h-4 font-normal"
							key={`${issue._id}-lbl-${i}`}
							variant="secondary"
						>
							{label}
						</Badge>
					))}
					{issue.labels.length > 2 && (
						<span className="text-[10px] text-muted-foreground">
							+{issue.labels.length - 2}
						</span>
					)}
				</div>
			)}

			{issue.dueDate && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span
								className={cn(
									"hidden sm:flex flex-shrink-0 items-center gap-1 text-[10px] leading-none",
									overdue ? "text-destructive" : "text-muted-foreground/70"
								)}
							>
								<Calendar className="w-3 h-3" />
								{format(new Date(issue.dueDate), "MMM d")}
							</span>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>
								{overdue ? "Overdue – " : "Due "}
								{format(new Date(issue.dueDate), "PPP")}
							</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}

			<div className="flex-shrink-0 flex -space-x-1.5">
				{issue.assignees && issue.assignees.length > 0 ? (
					<>
						{issue.assignees.slice(0, 3).map((memberId) => {
							const member = assigneeData[memberId];
							return (
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
						})}
						{issue.assignees.length > 3 && (
							<Avatar className="w-5 h-5 border-2 border-background bg-muted">
								<AvatarFallback className="text-[9px]">
									+{issue.assignees.length - 3}
								</AvatarFallback>
							</Avatar>
						)}
					</>
				) : (
					<div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20" />
				)}
			</div>
		</div>
	);
});

export default BoardIssueRow;
