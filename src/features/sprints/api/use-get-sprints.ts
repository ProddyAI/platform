import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

export const useGetSprints = ({
    projectId,
    workspaceId,
}: {
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
}) => {
    const data = useQuery(api.sprints.getByProject, { projectId, workspaceId });
    const isLoading = data === undefined;
    return { data, isLoading };
};
