import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetCalendarEventsProps {
	workspaceId: Id<"workspaces">;
	month: number; // 0-11
	year: number;
}

export const useGetCalendarEvents = ({
	workspaceId,
	month,
	year,
}: UseGetCalendarEventsProps) => {
	const data = useQuery(api.calendar.getCalendarEvents, {
		workspaceId,
		month,
		year,
	});

	const isLoading = data === undefined;

	return { data, isLoading };
};
