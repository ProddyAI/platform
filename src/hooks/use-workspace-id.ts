"use client";

import { useParams } from "next/navigation";

import type { Id } from "../../convex/_generated/dataModel";

type WorkspaceIdParams = {
	workspaceId: Id<"workspaces">;
};

export const useWorkspaceId = () => {
	const params = useParams<WorkspaceIdParams>();
	const workspaceId = params.workspaceId;

	// Treat "create" as an invalid workspace ID to prevent Convex validation errors
	if (workspaceId === "create" as any) {
		return undefined;
	}

	return workspaceId;
};
