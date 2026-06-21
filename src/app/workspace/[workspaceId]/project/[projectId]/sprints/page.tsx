"use client";

import { useQuery } from "convex/react";
import { Loader, Zap } from "lucide-react";

import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProjectNavTabs } from "@/features/projects/components/project-nav-tabs";
import { SprintsPanel } from "@/features/sprints/components/sprints-panel";
import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../../../toolbar";

const ProjectSprintsPage = () => {
	const projectId = useProjectId();
	const workspaceId = useWorkspaceId();
	const project = useQuery(
		api.projects.getById,
		projectId ? { id: projectId } : "skip"
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
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 font-semibold text-lg text-white transition-standard hover:bg-white/10"
					size="sm"
					variant="ghost"
				>
					<Zap className="mr-2 size-5" />
					<span className="truncate">{project.name} Sprints</span>
				</Button>
			</WorkspaceToolbar>

			<ProjectNavTabs />

			<div className="min-h-0 flex-1 overflow-hidden">
				<SprintsPanel projectId={projectId} workspaceId={workspaceId} />
			</div>
		</div>
	);
};

export default ProjectSprintsPage;
