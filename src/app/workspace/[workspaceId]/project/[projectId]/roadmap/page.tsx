"use client";

import { useQuery } from "convex/react";
import { Flag, Loader } from "lucide-react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ProjectNavTabs } from "@/features/projects/components/project-nav-tabs";
import { RoadmapPanel } from "@/features/roadmap/components/roadmap-panel";
import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../../../toolbar";

const ProjectRoadmapPage = () => {
    const projectId = useProjectId();
    const workspaceId = useWorkspaceId();
    const project = useQuery(api.projects.getById, projectId ? { id: projectId } : "skip");

    if (!projectId || !workspaceId || project === undefined) {
        return <div className="flex h-full flex-1 items-center justify-center"><Loader className="size-5 animate-spin text-muted-foreground" /></div>;
    }
    if (!project) {
        return <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">Project not found.</div>;
    }

    return (
        <div className="flex h-full flex-col w-full min-w-0 overflow-x-hidden">
            <WorkspaceToolbar>
                <Button className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard" size="sm" variant="ghost">
                    <Flag className="mr-2 size-5" />
                    <span className="truncate">{project.name} Roadmap</span>
                </Button>
            </WorkspaceToolbar>
            <ProjectNavTabs />
            <div className="flex-1 min-h-0 overflow-hidden">
                <RoadmapPanel projectId={projectId} workspaceId={workspaceId} />
            </div>
        </div>
    );
};

export default ProjectRoadmapPage;
