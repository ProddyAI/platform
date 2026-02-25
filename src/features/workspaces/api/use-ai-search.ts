"use client";

import { useCallback, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";

interface AISearchResponse {
	success: boolean;
	answer: string | null;
	sources: string[];
	error?: string;
	dataUsed?: {
		messagesCount: number;
		notesCount: number;
		tasksCount: number;
		cardsCount: number;
		eventsCount?: number;
	};
}

export const useAISearch = (workspaceId: Id<"workspaces">) => {
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<AISearchResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const reset = useCallback(() => {
		setResult(null);
		setError(null);
		setIsLoading(false);
	}, []);

	const search = useCallback(
		async (query: string): Promise<AISearchResponse | null> => {
			if (!query.trim()) {
				const emptyResult = {
					success: false,
					answer: null,
					sources: [],
					error: "Query cannot be empty",
				};
				setResult(emptyResult);
				setError(emptyResult.error);
				setIsLoading(false);
				return emptyResult;
			}

			setIsLoading(true);
			setError(null);
			setResult(null);

			try {
				const response = await fetch("/api/smart/ai-search", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						workspaceId,
						query: query.trim(),
					}),
				});

				if (!response.ok) {
					let parsedError: string | null = null;
					const errorText = await response.text();
					if (errorText) {
						try {
							const errorData = JSON.parse(errorText) as { error?: string };
							parsedError =
								typeof errorData.error === "string" ? errorData.error : null;
						} catch {
							parsedError = null;
						}
					}
					const failResult = {
						success: false,
						answer: null,
						sources: [],
						error: parsedError || errorText || "Failed to perform AI search",
					};
					setResult(failResult);
					setError(failResult.error);
					setIsLoading(false);
					return failResult;
				}

				const data: AISearchResponse = await response.json();
				setResult(data);
				return data;
			} catch (err) {
				const errorMsg =
					err instanceof Error ? err.message : "Unknown error occurred";
				setError(errorMsg);
				const errorResult: AISearchResponse = {
					success: false,
					answer: null,
					sources: [],
					error: errorMsg,
				};
				setResult(errorResult);
				setIsLoading(false);
				return errorResult;
			} finally {
				setIsLoading(false);
			}
		},
		[workspaceId]
	);

	return {
		search,
		reset,
		isLoading,
		result,
		error,
	};
};
