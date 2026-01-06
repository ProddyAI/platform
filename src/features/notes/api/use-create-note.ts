import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import type { CreateNoteRequest } from "../types/index";

type ResponseType = Id<"notes"> | null;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useCreateNote = () => {
	const [data, setData] = useState<ResponseType>(null);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"success" | "error" | "settled" | "pending" | null
	>(null);

	const isPending = useMemo(() => status === "pending", [status]);
	const isSuccess = useMemo(() => status === "success", [status]);
	const isError = useMemo(() => status === "error", [status]);
	const isSettled = useMemo(() => status === "settled", [status]);

	const mutation = useMutation(api.notes.create);

	const mutate = useCallback(
		async (request: CreateNoteRequest, options?: Options) => {
			try {
				setStatus("pending");

				const response = await mutation(request);

				setData(response);
				setStatus("success");

				options?.onSuccess?.(response);

				return response;
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
