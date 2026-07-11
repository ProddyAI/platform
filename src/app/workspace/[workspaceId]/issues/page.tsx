"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

// Assigned issues now live on the Tasks page; keep old links/bookmarks working.
const IssuesPage = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();

	useEffect(() => {
		if (workspaceId) {
			router.replace(`/workspace/${workspaceId}/tasks`);
		}
	}, [router, workspaceId]);

	return null;
};

export default IssuesPage;
