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
	// const fuzzySearch = useAction(api.search.fuzzySearchMessages); // Not implemented

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

	// const results = useQuery(
	//   api.search.searchWorkspaceMessages,
	//   shouldQuery
	//     ? {
	//         workspaceId,
	//         query: debouncedQuery,
	//         limit: 20,
	//       }
	//     : "skip"
	// );
	const results: any[] = [];

	// Trigger fuzzy (semantic) search when exact search returns no results

	// No fuzzy search or workspace search implemented. Always return empty results.
	useEffect(() => {
		if (shouldQuery) {
			// eslint-disable-next-line no-console
			console.warn('Search functionality is not implemented: fuzzySearchMessages and searchWorkspaceMessages are missing.');
		}
	}, [shouldQuery]);

	return {
		results: [],
		isLoading: false,
		debouncedQuery,
	};
};
