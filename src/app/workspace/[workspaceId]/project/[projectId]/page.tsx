"use client";

import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const ProjectPage = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const projectId = useProjectId();

	useEffect(() => {
		router.replace(`/workspace/${workspaceId}/project/${projectId}/board`);
	}, [router, workspaceId, projectId]);

	return (
		<div className="flex h-full flex-1 items-center justify-center">
			<Loader className="size-5 animate-spin text-muted-foreground" />
		</div>
	);
};

export default ProjectPage;
