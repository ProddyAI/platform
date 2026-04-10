"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useWorkspaceId } from "@/hooks/use-workspace-id";

export default function WorkspacePage() {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	useEffect(() => {
		// Redirect to dashboard page
		router.push(`/workspace/${workspaceId}/dashboard`);
	}, [router, workspaceId]);

	return null;
}
