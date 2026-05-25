import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useCallback, useState } from "react";

export const useCreateSprint = () => {
    const mutation = useMutation(api.sprints.create);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useUpdateSprint = () => {
    const mutation = useMutation(api.sprints.update);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useRemoveSprint = () => {
    const mutation = useMutation(api.sprints.remove);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useAddSprintIssue = () => {
    const mutation = useMutation(api.sprints.addIssue);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useRemoveSprintIssue = () => {
    const mutation = useMutation(api.sprints.removeIssue);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};

export const useRolloverSprint = () => {
    const mutation = useMutation(api.sprints.rolloverIncomplete);
    const [isPending, setIsPending] = useState(false);
    const mutate = useCallback(async (args: Parameters<typeof mutation>[0]) => {
        setIsPending(true);
        try { return await mutation(args); } finally { setIsPending(false); }
    }, [mutation]);
    return { mutate, isPending };
};
