import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

type RequestType = {
	title: string;
	date: number;
	time?: string;
	messageId: Id<"messages">;
	workspaceId: Id<"workspaces">;
};

type ResponseType = Id<"events"> | null;

type Options = {
	onSuccess?: (data: ResponseType) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
	throwError?: boolean;
};

export const useCreateCalendarEvent = () => {
	const [data, setData] = useState<ResponseType>(null);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<
		"idle" | "pending" | "success" | "error" | "settled"
	>("idle");

	const mutation = useMutation(api.calendar.createCalendarEvent);

	const isPending = status === "pending";
	const isError = status === "error";
	const isSuccess = status === "success";
	const isSettled = status === "settled";

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
				setError(error as Error);
				setStatus("error");
				options?.onError?.(error as Error);

				if (options?.throwError) throw error;
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
		isPending,
		isError,
		isSuccess,
		isSettled,
	};
};
