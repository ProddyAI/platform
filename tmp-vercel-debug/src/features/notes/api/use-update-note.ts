import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { UpdateNoteRequest } from "../types/index";

type ResponseType = boolean | null;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useUpdateNote = () => {
	const [data, setData] = useState<ResponseType>(null);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"success" | "error" | "settled" | "pending" | null
	>(null);

	const isPending = useMemo(() => status === "pending", [status]);
	const isSuccess = useMemo(() => status === "success", [status]);
	const isError = useMemo(() => status === "error", [status]);
	const isSettled = useMemo(() => status === "settled", [status]);

	const mutation = useMutation(api.notes.update);

	const mutate = useCallback(
		async (request: UpdateNoteRequest, options?: Options) => {
			try {
				setStatus("pending");

				await mutation(request);

				setData(true);
				setStatus("success");

				options?.onSuccess?.(true);

				return true;
			} catch (err) {
				const error = err as Error;

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
