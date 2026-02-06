import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

type RequestType = { jobId: Id<"import_jobs"> };
type ResponseType = boolean | null;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useCancelImportJob = () => {
	const [data, setData] = useState<ResponseType>(null);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"success" | "error" | "pending" | null
	>(null);

	const isPending = status === "pending";
	const isSuccess = status === "success";
	const isError = status === "error";
	const isSettled = status === "success" || status === "error";

	const mutation = useMutation(api.importIntegrations.cancelImportJob);

	const mutate = useCallback(
		async (values: RequestType, options?: Options) => {
			try {
				setData(null);
				setError(null);
				setStatus("pending");

				const response = await mutation(values);
				setData(response);
				setStatus("success");
				options?.onSuccess?.(response);
				return response;
			} catch (error) {
				setStatus("error");
				const err = error as Error;
				setError(err);
				options?.onError?.(err);
				if (options?.throwError) {
					throw error;
				}
			} finally {
				options?.onSettled?.();
			}
		},
		[mutation]
	);

	return {
		mutate,
		data,
		error,
		isError,
		isPending,
		isSettled,
		isSuccess,
	};
};
