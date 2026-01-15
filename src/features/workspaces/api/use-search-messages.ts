import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseSearchMessagesProps {
	workspaceId: Id<"workspaces">;
	query: string;
	enabled?: boolean;
}

export const useSearchMessages = ({
	workspaceId,
	query,
	enabled = true,
}: UseSearchMessagesProps) => {
	const [debouncedQuery, setDebouncedQuery] = useState(query);
	const [fuzzyResults, setFuzzyResults] = useState<any[]>([]);
	const [isFuzzyLoading, setIsFuzzyLoading] = useState(false);
	const fuzzySearch = useAction(api.search.fuzzySearchMessages);

	// Debounce the search query by 300ms
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 300);

		return () => clearTimeout(timer);
	}, [query]);

	// Reset fuzzy cache when query/workspace changes
	useEffect(() => {
		setFuzzyResults([]);
	}, []);

	// Only run the query if enabled and we have a search query
	const shouldQuery = enabled && debouncedQuery.trim().length > 0;

	const results = useQuery(
		api.search.searchWorkspaceMessages,
		shouldQuery
			? {
					workspaceId,
					query: debouncedQuery,
					limit: 20,
				}
			: "skip"
	);

	// Trigger fuzzy (semantic) search when exact search returns no results
	useEffect(() => {
		if (!shouldQuery) return;
		if (results === undefined) return; // still loading
		if (results.length > 0) return; // we already have exact matches

		let cancelled = false;
		setIsFuzzyLoading(true);
		fuzzySearch({
			workspaceId,
			query: debouncedQuery,
			limit: 20,
		})
			.then((res) => {
				if (!cancelled) setFuzzyResults(res ?? []);
			})
			.catch(() => {
				if (!cancelled) setFuzzyResults([]);
			})
			.finally(() => {
				if (!cancelled) setIsFuzzyLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [shouldQuery, results, fuzzySearch, workspaceId, debouncedQuery]);

	return {
		results: results && results.length > 0 ? results : fuzzyResults,
		isLoading: (results === undefined && shouldQuery) || isFuzzyLoading,
		debouncedQuery,
	};
};
