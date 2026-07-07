"use client";

import { useQuery } from "convex/react";
import { KanbanSquare, Loader } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import BoardPageContent from "@/features/board/components/board-page-content";
import { ProjectNavTabs } from "@/features/projects/components/project-nav-tabs";
import { useProjectId } from "@/hooks/use-project-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../../../workspace-title-context";

const ProjectBoardPage = () => {
	const projectId = useProjectId();
	const project = useQuery(
		api.planning.projects.getById,
		projectId ? { id: projectId } : "skip"
	);

	useSetWorkspaceTitle(
		<WorkspaceTitle
			icon={KanbanSquare}
			label={project ? `${project.name} Board` : "Board"}
		/>
	);

	if (!projectId || project === undefined) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!project) {
		return (
			<div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
				Project not found.
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col w-full min-w-0 overflow-x-hidden">
			<ProjectNavTabs />

			<div className="flex-1 min-h-0 overflow-hidden">
				<BoardPageContent
					channelId={project.boardChannelId}
					isProjectChannelConnected={Boolean(project.connectedChannelId)}
					projectConnectedChannelName={project.connectedChannelName}
					projectId={projectId}
				/>
			</div>
		</div>
	);
};

export default ProjectBoardPage;
