"use client";

import { useQuery } from "convex/react";
import { ArrowRight, LayoutGrid, Loader } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const IssuesContent = ({ workspaceId }: { workspaceId: Id<"workspaces"> }) => {
	useSetWorkspaceTitle(<WorkspaceTitle icon={LayoutGrid} label="Issues" />);

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
			<div className="flex h-full flex-1 items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto bg-background px-4 py-6 md:px-8">
				<div className="mx-auto w-full max-w-4xl space-y-4">
					{issues.length === 0 ? (
						<div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/5 p-8 text-center">
							<p className="text-base font-medium text-foreground">
								No assigned issues yet
							</p>
							<p className="mt-2 text-sm text-muted-foreground">
								Assigned board issues for your account will appear here.
							</p>
						</div>
					) : (
						issues.map((issue) => {
							const projectId = projectByChannelId.get(issue.channelId);
							const href = projectId
								? `/workspace/${workspaceId}/project/${projectId}/board?focusIssue=${issue._id}`
								: `/workspace/${workspaceId}/issues`;

							return (
								<Link
									className="group block rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
									href={href}
									key={issue._id}
								>
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0 flex-1">
											<p className="truncate text-base font-semibold text-foreground">
												{issue.title}
											</p>
											<div className="mt-2 flex flex-wrap items-center gap-2">
												<Badge variant="outline"># {issue.channelName}</Badge>
												{issue.priority && (
													<Badge className="capitalize" variant="secondary">
														{issue.priority.replace("_", " ")}
													</Badge>
												)}
												{projectId ? (
													<Badge variant="secondary">Project board</Badge>
												) : (
													<Badge variant="outline">Project unavailable</Badge>
												)}
											</div>
										</div>

										<ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
									</div>
								</Link>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};

const IssuesPage = () => {
	useDocumentTitle("Issues");
	const workspaceId = useWorkspaceId();

	if (!workspaceId) {
		return null;
	}

	return <IssuesContent workspaceId={workspaceId as Id<"workspaces">} />;
};

export default IssuesPage;
