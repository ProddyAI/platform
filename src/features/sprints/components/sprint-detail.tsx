"use client";

import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Circle, Clock, X } from "lucide-react";
import { toast } from "sonner";

import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { IssuePickerPopover } from "@/components/issue-picker-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	formatIssueId,
	priorityIcon,
} from "@/features/board/components/board-issue-row";
import { cn } from "@/lib/utils";
import {
	useGetAddableSprintIssues,
	useGetSprintIssues,
	useGetSprintStats,
} from "../api/use-get-sprint-details";
import {
	useAddSprintIssues,
	useRemoveSprintIssue,
} from "../api/use-sprint-mutations";
import { SPRINT_STATUS_CONFIG } from "./sprint-card";

const DONE_KEYWORDS = ["done", "completed", "complete", "closed", "resolved"];
const IN_PROGRESS_KEYWORDS = ["progress", "review", "doing", "started"];

const classify = (statusName?: string) => {
	const normalized = (statusName ?? "").trim().toLowerCase();
	if (DONE_KEYWORDS.some((keyword) => normalized === keyword)) return "done";
	if (IN_PROGRESS_KEYWORDS.some((keyword) => normalized.includes(keyword)))
		return "inProgress";
	return "notStarted";
};

interface SprintDetailProps {
	sprint: Doc<"sprints">;
	onBack: () => void;
}

export const SprintDetail = ({ sprint, onBack }: SprintDetailProps) => {
	const { data: issues, isLoading } = useGetSprintIssues({
		sprintId: sprint._id,
	});
	const { data: stats } = useGetSprintStats({ sprintId: sprint._id });
	const { data: addable, isLoading: addableLoading } =
		useGetAddableSprintIssues({ sprintId: sprint._id });
	const { mutate: addIssues, isPending: adding } = useAddSprintIssues();
	const { mutate: removeIssue } = useRemoveSprintIssue();

	const status = SPRINT_STATUS_CONFIG[sprint.status];

	const handleAdd = async (issueIds: Id<"issues">[]) => {
		try {
			const result = await addIssues({ sprintId: sprint._id, issueIds });
			toast.success(`Added ${result?.added ?? issueIds.length} issues`);
		} catch {
			toast.error("Failed to add issues");
		}
	};

	const handleRemove = async (issueId: Id<"issues">) => {
		try {
			await removeIssue({ sprintId: sprint._id, issueId });
			toast.success("Issue removed from sprint");
		} catch {
			toast.error("Failed to remove issue");
		}
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b p-4">
				<Button className="size-7" onClick={onBack} size="icon" variant="ghost">
					<ArrowLeft className="size-4" />
				</Button>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate font-semibold">{sprint.name}</h2>
						<Badge
							className={cn("text-xs", status.className)}
							variant="outline"
						>
							{status.label}
						</Badge>
					</div>
					<p className="text-muted-foreground text-xs">
						{format(new Date(sprint.startDate), "MMM d, yyyy")} →{" "}
						{format(new Date(sprint.endDate), "MMM d, yyyy")}
					</p>
				</div>
			</div>

			{sprint.goal && (
				<div className="border-b bg-muted/40 px-4 py-3">
					<p className="mb-0.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Sprint goal
					</p>
					<p className="text-sm">{sprint.goal}</p>
				</div>
			)}

			{stats && (
				<div className="space-y-2 border-b px-4 py-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-semibold">{stats.completionRate}%</span>
					</div>
					<Progress className="h-2" value={stats.completionRate} />
					<div className="grid grid-cols-3 gap-2 text-center text-xs">
						<div className="rounded-md bg-muted/50 p-2">
							<div className="font-semibold text-base">{stats.notStarted}</div>
							<div className="text-muted-foreground">To do</div>
						</div>
						<div className="rounded-md bg-blue-500/10 p-2">
							<div className="font-semibold text-base text-blue-600 dark:text-blue-400">
								{stats.inProgress}
							</div>
							<div className="text-muted-foreground">In progress</div>
						</div>
						<div className="rounded-md bg-emerald-500/10 p-2">
							<div className="font-semibold text-base text-emerald-600 dark:text-emerald-400">
								{stats.completed}
							</div>
							<div className="text-muted-foreground">Done</div>
						</div>
					</div>
					{sprint.status === "active" && (
						<div className="flex justify-between pt-1 text-muted-foreground text-xs">
							<span>{stats.daysElapsed}d elapsed</span>
							<span>{stats.daysRemaining}d remaining</span>
						</div>
					)}
				</div>
			)}

			<div className="flex items-center justify-between border-b px-4 py-2">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Issues ({issues.length})
				</span>
				<IssuePickerPopover
					emptyHint="No more board issues to add."
					isLoading={addableLoading}
					isPending={adding}
					issues={addable}
					onConfirm={handleAdd}
				/>
			</div>

			<ScrollArea className="flex-1">
				{isLoading ? (
					<div className="space-y-2 p-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<Skeleton className="h-12 w-full" key={index} />
						))}
					</div>
				) : issues.length === 0 ? (
					<div className="flex flex-col items-center justify-center px-4 py-16 text-center">
						<Circle className="mb-2 size-8 text-muted-foreground/40" />
						<p className="text-muted-foreground text-sm">
							No issues in this sprint yet
						</p>
						<p className="mt-1 text-muted-foreground/70 text-xs">
							Use “Add issues” to pull work from the board.
						</p>
					</div>
				) : (
					<div className="divide-y">
						{issues.map((issue) => {
							const bucket = classify(issue.status?.name);
							const isDone = bucket === "done";
							return (
								<div
									className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
									key={issue._id}
								>
									<div className="mt-0.5 shrink-0">
										{isDone ? (
											<CheckCircle2 className="size-4 text-emerald-500" />
										) : bucket === "inProgress" ? (
											<Clock className="size-4 text-blue-500" />
										) : (
											<Circle className="size-4 text-muted-foreground/40" />
										)}
									</div>
									<span className="mt-0.5 shrink-0">
										{priorityIcon(issue.priority)}
									</span>
									<div className="min-w-0 flex-1">
										<p
											className={cn(
												"truncate font-medium text-sm",
												isDone && "text-muted-foreground line-through"
											)}
										>
											{issue.title}
										</p>
										<div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
											<span className="font-mono text-[10px] text-muted-foreground/60">
												{formatIssueId(issue._id)}
											</span>
											{issue.status && (
												<span className="flex items-center gap-1">
													<span
														className="size-2 rounded-full ring-1 ring-inset ring-black/10"
														style={{ backgroundColor: issue.status.color }}
													/>
													{issue.status.name}
												</span>
											)}
										</div>
									</div>
									<Button
										className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
										onClick={() => handleRemove(issue._id)}
										size="icon"
										variant="ghost"
									>
										<X className="size-3.5" />
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</ScrollArea>
		</div>
	);
};
