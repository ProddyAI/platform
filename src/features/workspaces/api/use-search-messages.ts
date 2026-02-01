import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export interface SearchAllResult {
	messages: Array<{
		_id: Id<"messages">;
		channelId: Id<"channels"> | undefined;
		channelName: string;
		_creationTime: number;
		text: string;
	}>;
	notes: Array<{
		_id: Id<"notes">;
		title: string;
		channelId: Id<"channels">;
	}>;
	tasks: Array<{
		_id: Id<"tasks">;
		title: string;
		description?: string;
	}>;
	cards: Array<{
		_id: Id<"cards">;
		title: string;
		description?: string;
		listId: Id<"lists">;
		channelId: Id<"channels">;
	}>;
	events: Array<{
		_id: Id<"events">;
		title: string;
		date: number;
		time?: string;
	}>;
}

interface UseSearchMessagesProps {
	workspaceId: Id<"workspaces">;
	query: string;
	enabled?: boolean;
}

const emptyResults: SearchAllResult = {
	messages: [],
	notes: [],
	tasks: [],
	cards: [],
	events: [],
};

export const useSearchMessages = ({
	workspaceId,
	query,
	enabled = true,
}: UseSearchMessagesProps) => {
	const [debouncedQuery, setDebouncedQuery] = useState(query);
	const lastTextResultsRef = useRef<SearchAllResult | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, 300);
		return () => clearTimeout(timer);
	}, [query]);

	// Clear preserved results when user clears the search
	useEffect(() => {
		if (debouncedQuery.trim().length === 0) {
			lastTextResultsRef.current = null;
		}
	}, [debouncedQuery]);

	const shouldQuery = enabled && debouncedQuery.trim().length > 0;

	const textResults = useQuery(
		api.search.searchAll,
		shouldQuery
			? {
					workspaceId,
					query: debouncedQuery,
					limit: 20,
				}
			: "skip"
	) as SearchAllResult | undefined;

	const hasTextResults =
		textResults &&
		(textResults.messages.length > 0 ||
			textResults.notes.length > 0 ||
			textResults.tasks.length > 0 ||
			textResults.cards.length > 0 ||
			textResults.events.length > 0);

	// When Convex returns data, keep it for display; when query is skipped/loading, use last
	// results so the UI does not flash empty.
	if (textResults !== undefined) {
		lastTextResultsRef.current = textResults;
	}
	const results: SearchAllResult =
		textResults ?? lastTextResultsRef.current ?? emptyResults;

	const isLoading = shouldQuery && textResults === undefined;

	return {
		results,
		isLoading,
		debouncedQuery,
		hasTextResults: !!hasTextResults,
	};
};
