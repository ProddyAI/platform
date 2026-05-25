import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

export const useGetActiveSprint = ({
    projectId,
    workspaceId,
}: {
    projectId: Id<"projects">;
    workspaceId: Id<"workspaces">;
}) => {
    const data = useQuery(api.sprints.getActiveSprint, { projectId, workspaceId });
    const isLoading = data === undefined;
    return { data, isLoading };
};

export const useGetSprintIssues = ({ sprintId }: { sprintId: Id<"sprints"> | null }) => {
    const data = useQuery(api.sprints.getSprintIssues, sprintId ? { sprintId } : "skip");
    const isLoading = data === undefined;
    return { data: data ?? [], isLoading };
};

export const useGetSprintStats = ({ sprintId }: { sprintId: Id<"sprints"> | null }) => {
    const data = useQuery(api.sprints.getSprintStats, sprintId ? { sprintId } : "skip");
    const isLoading = data === undefined;
    return { data, isLoading };
};
