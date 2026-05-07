"use client";

import { useParams } from "next/navigation";

import type { Id } from "../../convex/_generated/dataModel";

type ProjectIdParams = {
	projectId?: Id<"projects">;
};

export const useProjectId = () => {
	const params = useParams<ProjectIdParams>();
	return params.projectId;
};
