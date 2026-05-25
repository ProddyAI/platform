import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { useCallback, useState } from "react";

export const useGetMilestones = ({ projectId, workspaceId }: { projectId: Id<"projects">; workspaceId: Id<"workspaces"> }) => {
    const data = useQuery(api.milestones.getByProject, { projectId, workspaceId });
    return { data, isLoading: data === undefined };
};

export const useGetMilestoneStats = ({ milestoneId }: { milestoneId: Id<"milestones"> | null }) => {
    const data = useQuery(api.milestones.getMilestoneStats, milestoneId ? { milestoneId } : "skip");
    return { data, isLoading: data === undefined };
};

export const useCreateMilestone = () => {
    const mutation = useMutation(api.milestones.create);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useUpdateMilestone = () => {
    const mutation = useMutation(api.milestones.update);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useRemoveMilestone = () => {
    const mutation = useMutation(api.milestones.remove);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};
