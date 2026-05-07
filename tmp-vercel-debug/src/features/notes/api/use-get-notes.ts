import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import type { Note } from "../types";

export const useGetNotes = (
	workspaceId?: Id<"workspaces">,
	channelId?: Id<"channels">
) => {
	const notes = useQuery(
		api.notes.getByChannel,
		workspaceId && channelId ? { workspaceId, channelId } : "skip"
	);

	const data = useMemo(() => notes as Note[] | undefined, [notes]);
	const isLoading = useMemo(() => notes === undefined, [notes]);

	return {
		data,
		isLoading,
	};
};
