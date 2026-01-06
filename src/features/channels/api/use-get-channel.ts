import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetChannelProps {
	id: Id<"channels"> | undefined;
}

export const useGetChannel = ({ id }: UseGetChannelProps) => {
	// Skip the query if id is undefined
	const data = useQuery(api.channels.getById, id ? { id } : "skip");

	const isLoading = id !== undefined && data === undefined;

	return { data, isLoading };
};
