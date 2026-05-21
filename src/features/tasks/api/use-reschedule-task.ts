import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

type RequestType = {
	taskId: Id<"tasks">;
	daysToAdd?: number;
};

type ResponseType = { taskId: Id<"tasks">; newDueDate: number } | undefined;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useRescheduleTask = () => {
	const [data, setData] = useState<ResponseType>();
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"idle" | "pending" | "success" | "error"
	>("idle");

	const isPending = useMemo(() => status === "pending", [status]);

	const mutation = useMutation(api.stress.rescheduleTask);

	const mutate = useCallback(
		async (values: RequestType, options?: Options) => {
			try {
				setStatus("pending");
				setData(undefined);
				setError(null);

				const result = await mutation(values);
				setData(result);
				setStatus("success");
				options?.onSuccess?.(result);
				return result;
			} catch (err) {
				const mutationError =
					err instanceof Error ? err : new Error("Failed to reschedule task");
				setError(mutationError);
				setStatus("error");
				options?.onError?.(mutationError);
				if (options?.throwError) {
					throw mutationError;
				}
				return undefined;
			} finally {
				options?.onSettled?.();
			}
		},
		[mutation]
	);

	return { mutate, data, error, isPending };
};
