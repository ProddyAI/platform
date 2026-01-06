import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { Note } from "../types";

export const useGetNote = (noteId?: Id<"notes">) => {
	// Check if the noteId is a temporary ID (starts with "temp-")
	const isTempId = noteId ? noteId.toString().startsWith("temp-") : false;
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const member = useQuery(
		api.members.current,
		workspaceId ? { workspaceId } : "skip"
	);

	// Only query Convex if we have a valid (non-temporary) ID
	const note = useQuery(
		api.notes.getById,
		noteId && !isTempId ? { noteId } : "skip"
	);

	// For temporary notes, we'll use local state
	const [tempNote, setTempNote] = useState<Note | undefined>(undefined);

	// When the noteId changes and it's a temporary ID, create a placeholder note
	useEffect(() => {
		if (noteId && isTempId && workspaceId && channelId && member) {
			// Create a placeholder note for the UI
			const now = Date.now();
			setTempNote({
				_id: noteId,
				_creationTime: now,
				title: "Untitled",
				content: JSON.stringify({ ops: [{ insert: "\n" }] }),
				memberId: member._id,
				workspaceId: workspaceId as Id<"workspaces">,
				channelId: channelId as Id<"channels">,
				coverImage: undefined,
				icon: undefined,
				createdAt: now,
				updatedAt: now,
			});
		} else if (!isTempId) {
			// Clear the temp note when we switch to a real note
			setTempNote(undefined);
		}
	}, [noteId, isTempId, workspaceId, channelId, member]);

	// Use either the real note from Convex or our temporary note
	const data = useMemo(() => {
		if (isTempId) {
			return tempNote;
		}
		return note as Note | undefined;
	}, [note, tempNote, isTempId]);

	// We're loading if we're waiting for a non-temp note and don't have it yet
	const isLoading = useMemo(
		() => !isTempId && noteId && note === undefined,
		[note, noteId, isTempId]
	);

	return {
		data,
		isLoading,
	};
};
