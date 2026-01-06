import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetMessagesWithCalendarEventsProps {
	workspaceId: Id<"workspaces">;
}

export const useGetMessagesWithCalendarEvents = ({
	workspaceId,
}: UseGetMessagesWithCalendarEventsProps) => {
	const data = useQuery(api.calendar.getMessagesWithCalendarEvents, {
		workspaceId,
		paginationOpts: { numItems: 100, cursor: null },
	});

	const isLoading = data === undefined;

	return { data, isLoading };
};
