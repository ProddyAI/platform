"use client";

import { useQuery } from "convex/react";
import { KanbanSquare, Loader } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import BoardPageContent from "@/features/board/components/board-page-content";
import { useProjectId } from "@/hooks/use-project-id";
import { WorkspaceToolbar } from "../../../toolbar";

const ProjectBoardPage = () => {
	const projectId = useProjectId();
	const project = useQuery(
		api.projects.getById,
		projectId ? { id: projectId } : "skip"
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
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
				>
					<KanbanSquare className="mr-2 size-5" />
					<span className="truncate">{project.name} Board</span>
				</Button>
			</WorkspaceToolbar>

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
