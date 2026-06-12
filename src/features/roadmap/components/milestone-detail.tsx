"use client";

import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Circle, Clock, Flag, X } from "lucide-react";
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
	useGetLinkableMilestoneIssues,
	useGetMilestoneIssues,
	useGetMilestoneStats,
	useLinkMilestoneIssues,
	useUnlinkMilestoneIssue,
} from "../api/use-milestones";
import { MILESTONE_STATUS_CONFIG } from "./milestone-card";

const DONE_KEYWORDS = ["done", "completed", "complete", "closed", "resolved"];
const IN_PROGRESS_KEYWORDS = ["progress", "review", "doing", "started"];

const classify = (statusName?: string) => {
	const normalized = (statusName ?? "").trim().toLowerCase();
	if (DONE_KEYWORDS.some((keyword) => normalized === keyword)) return "done";
	if (IN_PROGRESS_KEYWORDS.some((keyword) => normalized.includes(keyword)))
		return "inProgress";
	return "notStarted";
};

interface MilestoneDetailProps {
	milestone: Doc<"milestones">;
	onBack: () => void;
}

export const MilestoneDetail = ({
	milestone,
	onBack,
}: MilestoneDetailProps) => {
	const { data: issues, isLoading } = useGetMilestoneIssues({
		milestoneId: milestone._id,
	});
	const { data: stats } = useGetMilestoneStats({ milestoneId: milestone._id });
	const { data: linkable, isLoading: linkableLoading } =
		useGetLinkableMilestoneIssues({ milestoneId: milestone._id });
	const { mutate: linkIssues, isPending: linking } = useLinkMilestoneIssues();
	const { mutate: unlinkIssue } = useUnlinkMilestoneIssue();

	const color = milestone.color ?? "#6366f1";
	const status = MILESTONE_STATUS_CONFIG[milestone.status];

	const handleLink = async (issueIds: Id<"issues">[]) => {
		try {
			const result = await linkIssues({
				milestoneId: milestone._id,
				issueIds,
			});
			toast.success(`Linked ${result?.linked ?? issueIds.length} issues`);
		} catch {
			toast.error("Failed to link issues");
		}
	};

	const handleUnlink = async (issueId: Id<"issues">) => {
		try {
			await unlinkIssue({ milestoneId: milestone._id, issueId });
			toast.success("Issue unlinked");
		} catch {
			toast.error("Failed to unlink issue");
		}
	};

	return (
		<div className="flex h-full flex-col">
			<div className="h-1 w-full" style={{ backgroundColor: color }} />
			<div className="flex items-center gap-2 border-b p-4">
				<Button className="size-7" onClick={onBack} size="icon" variant="ghost">
					<ArrowLeft className="size-4" />
				</Button>
				<Flag className="size-4 shrink-0" style={{ color }} />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate font-semibold">{milestone.name}</h2>
						<Badge
							className={cn("text-xs", status.className)}
							variant="outline"
						>
							{status.label}
						</Badge>
					</div>
					{milestone.targetDate && (
						<p className="text-muted-foreground text-xs">
							Target {format(new Date(milestone.targetDate), "MMM d, yyyy")}
						</p>
					)}
				</div>
			</div>

			{milestone.description && (
				<div className="border-b bg-muted/40 px-4 py-3">
					<p className="text-sm">{milestone.description}</p>
				</div>
			)}

			{stats && (
				<div className="space-y-2 border-b px-4 py-3">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-semibold">{stats.completionRate}%</span>
					</div>
					<Progress className="h-2" value={stats.completionRate} />
					<div className="flex justify-between text-muted-foreground text-xs">
						<span>{stats.notStarted} to do</span>
						<span>{stats.inProgress} in progress</span>
						<span>{stats.completed} done</span>
					</div>
				</div>
			)}

			<div className="flex items-center justify-between border-b px-4 py-2">
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Linked issues ({issues.length})
				</span>
				<IssuePickerPopover
					emptyHint="No more board issues to link."
					isLoading={linkableLoading}
					isPending={linking}
					issues={linkable}
					label="Link issues"
					onConfirm={handleLink}
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
							No issues linked yet
						</p>
						<p className="mt-1 text-muted-foreground/70 text-xs">
							Use “Link issues” to connect work to this milestone.
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
										onClick={() => handleUnlink(issue._id)}
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
