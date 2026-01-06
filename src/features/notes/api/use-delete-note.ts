import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

type ResponseType = boolean | null;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useDeleteNote = () => {
	const [data, setData] = useState<ResponseType>(null);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"success" | "error" | "settled" | "pending" | null
	>(null);

	const isPending = useMemo(() => status === "pending", [status]);
	const isSuccess = useMemo(() => status === "success", [status]);
	const isError = useMemo(() => status === "error", [status]);
	const isSettled = useMemo(() => status === "settled", [status]);

	const mutation = useMutation(api.notes.remove);

	const mutate = useCallback(
		async (id: Id<"notes"> | string, options?: Options) => {
			try {
				setStatus("pending");

				// Make sure we're passing an object with an id property
				const idObj = typeof id === "object" ? id : { id: id as Id<"notes"> };
				await mutation(idObj);

				setData(true);
				setStatus("success");

				options?.onSuccess?.(true);

				return true;
			} catch (err) {
				const error = err as Error;
				console.error("Error deleting note:", error);

				setError(error);
				setStatus("error");

				options?.onError?.(error);

				if (options?.throwError) {
					throw error;
				}

				return null;
			} finally {
				setStatus("settled");
				options?.onSettled?.();
			}
		},
		[mutation]
	);

	return {
		mutate,
		data,
		error,
		status,
		isPending,
		isSuccess,
		isError,
		isSettled,
	};
};
