"use client";

import { useQuery } from "convex/react";
import { Loader, Zap } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import { ProjectNavTabs } from "@/features/projects/components/project-nav-tabs";
import { SprintsPanel } from "@/features/sprints/components/sprints-panel";
import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../../../workspace-title-context";

const ProjectSprintsPage = () => {
	const projectId = useProjectId();
	const workspaceId = useWorkspaceId();
	const project = useQuery(
		api.planning.projects.getById,
		projectId ? { id: projectId } : "skip"
	);

	useSetWorkspaceTitle(
		<WorkspaceTitle
			icon={Zap}
			label={project ? `${project.name} Sprints` : "Sprints"}
		/>
	);

	if (!projectId || !workspaceId || project === undefined) {
		return (
			<div className="flex h-full flex-1 items-center justify-center">
				<Loader className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!project) {
		return (
			<div className="flex h-full flex-1 items-center justify-center text-muted-foreground text-sm">
				Project not found.
			</div>
		);
	}

	return (
		<div className="flex h-full w-full min-w-0 flex-col overflow-x-hidden">
			<ProjectNavTabs />

			<div className="min-h-0 flex-1 overflow-hidden">
				<SprintsPanel projectId={projectId} workspaceId={workspaceId} />
			</div>
		</div>
	);
};

export default ProjectSprintsPage;
