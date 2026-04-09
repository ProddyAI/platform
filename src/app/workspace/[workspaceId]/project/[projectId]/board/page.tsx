"use client";

import { useQuery } from "convex/react";
import { Loader } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import BoardPageContent from "@/features/board/components/board-page-content";
import { useProjectId } from "@/hooks/use-project-id";

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

	return <BoardPageContent channelId={project.boardChannelId} />;
};

export default ProjectBoardPage;
