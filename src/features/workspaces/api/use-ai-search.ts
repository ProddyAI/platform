"use client";

import { useMutation } from "convex/react";
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
	};
}

export const useAISearch = (workspaceId: Id<"workspaces">) => {
	const [isLoading, setIsLoading] = useState(false);
	const [result, setResult] = useState<AISearchResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const search = useCallback(
		async (query: string): Promise<AISearchResponse | null> => {
			if (!query.trim()) {
				setError("Query cannot be empty");
				return null;
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
					const errorData = await response.json();
					throw new Error(
						errorData.error || "Failed to perform AI search"
					);
				}

				const data: AISearchResponse = await response.json();
				setResult(data);
				return data;
			} catch (err) {
				const errorMsg =
					err instanceof Error ? err.message : "Unknown error occurred";
				setError(errorMsg);
				return {
					success: false,
					answer: null,
					sources: [],
					error: errorMsg,
				};
			} finally {
				setIsLoading(false);
			}
		},
		[workspaceId]
	);

	return {
		search,
		isLoading,
		result,
		error,
	};
};
