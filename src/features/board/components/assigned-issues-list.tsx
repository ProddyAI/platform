"use client";

import { useQuery } from "convex/react";
import { ArrowRight, LayoutGrid, Loader } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetProjects } from "@/features/projects/api/use-get-projects";

// Mirrors priorityIcon in board-issue-row: urgent=destructive, high=warning,
// medium=primary, low/none=neutral.
const priorityVariant = (priority: string) => {
	if (priority === "urgent") return "destructiveSoft";
	if (priority === "high") return "warning";
	if (priority === "medium") return "primarySoft";
	return "secondary";
};

export const AssignedIssuesList = ({
	workspaceId,
}: {
	workspaceId: Id<"workspaces">;
}) => {
	const { data: currentMember, isLoading: isMemberLoading } = useCurrentMember({
		workspaceId,
	});
	const { data: projects, isLoading: isProjectsLoading } = useGetProjects({
		workspaceId,
	});

	const assignedIssues = useQuery(
		api.board.board.getAssignedIssues,
		currentMember
			? {
					workspaceId,
					memberId: currentMember._id,
				}
			: "skip"
	);

	const projectByChannelId = useMemo(() => {
		const mapping = new Map<string, string>();
		for (const project of projects || []) {
			mapping.set(project.boardChannelId, project._id);
		}
		return mapping;
	}, [projects]);

	const issues = useMemo(() => {
		if (!assignedIssues) return [];
		return [...assignedIssues].sort((a, b) => b.updatedAt - a.updatedAt);
	}, [assignedIssues]);

	if (isMemberLoading || isProjectsLoading || assignedIssues === undefined) {
		return (
			<div className="flex h-24 items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (issues.length === 0) {
		return (
			<EmptyState
				description="Board issues assigned to you will appear here."
				icon={LayoutGrid}
				title="No assigned issues"
			/>
		);
	}

	return (
		<div className="space-y-4">
			{issues.map((issue) => {
				const projectId = projectByChannelId.get(issue.channelId);
				const href = projectId
					? `/workspace/${workspaceId}/project/${projectId}/board?focusIssue=${issue._id}`
					: `/workspace/${workspaceId}/tasks`;

				return (
					<Link
						className="group block rounded-2xl border bg-card p-4 shadow-sm transition-[transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
						href={href}
						key={issue._id}
					>
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0 flex-1">
								<p className="truncate text-base font-semibold text-foreground">
									{issue.title}
								</p>
								<div className="mt-2 flex flex-wrap items-center gap-2">
									<Badge variant="outline">#{issue.channelName}</Badge>
									{issue.priority && (
										<Badge
											className="capitalize"
											variant={priorityVariant(issue.priority)}
										>
											{issue.priority.replace("_", " ")}
										</Badge>
									)}
									{projectId ? (
										<Badge variant="primarySoft">Project board</Badge>
									) : (
										<Badge variant="outline">Project unavailable</Badge>
									)}
								</div>
							</div>

							<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
						</div>
					</Link>
				);
			})}
		</div>
	);
};
