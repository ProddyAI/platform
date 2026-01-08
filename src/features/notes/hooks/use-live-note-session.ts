import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useOthers, useSelf } from "@/../liveblocks.config";

interface UseLiveNoteSessionOptions {
	noteId: Id<"notes">;
	noteTitle: string;
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
	autoAnnounce?: boolean;
}

interface UseLiveNoteSessionReturn {
	participants: string[];
	isLiveSession: boolean;
	startLiveSession: () => Promise<void>;
	endLiveSession: () => Promise<void>;
	announceLiveSession: () => Promise<void>;
}

export const useLiveNoteSession = ({
	noteId,
	noteTitle,
	workspaceId,
	channelId,
	autoAnnounce = true,
}: UseLiveNoteSessionOptions): UseLiveNoteSessionReturn => {
	const [isLiveSession, setIsLiveSession] = useState(false);
	const [hasAnnounced, setHasAnnounced] = useState(false);

	const others = useOthers();
	const self = useSelf();
	const createMessage = useMutation(api.messages.create);

	// Get all participants (including self) - memoized to prevent infinite loops
	const participants = useMemo(
		() => [
			...(self?.id ? [self.id] : []),
			...others
				.map((other) => other.id)
				.filter((id): id is string => typeof id === "string"),
		],
		[self, others]
	);

	const announceLiveSession = useCallback(async () => {
		try {
			if (!workspaceId || !channelId) {
				console.warn(
					"Cannot announce live session: missing workspace or channel ID"
				);
				return;
			}

			// Don't announce for dummy note IDs
			if (
				noteId.toString().includes("dummy") ||
				noteId === "kn7cvx952gp794j4vzvxxqqgk57k9yhh"
			) {
				console.log("Skipping announcement for dummy note ID");
				return;
			}

			// Create a message announcing the live session
			const messageData = {
				type: "note-live",
				noteId: noteId,
				noteTitle: noteTitle,
				participants: participants,
			};

			await createMessage({
				workspaceId: workspaceId,
				channelId: channelId,
				body: JSON.stringify(messageData),
			});

			toast.success("Live note session announced in chat");
		} catch (error) {
			console.error("Failed to announce live session:", error);
			toast.error("Failed to announce live session");
		}
	}, [noteId, noteTitle, participants, workspaceId, channelId, createMessage]);

	// Check if this is a live session (more than one participant actively editing)
	useEffect(() => {
		const activeParticipants = participants.filter((id) => {
			// Check if participant is actively editing (has recent activity)
			const participant = others.find((other) => other.id === id) || self;
			if (!participant) return false;

			const lastActivity = participant.presence?.lastActivity;
			if (!lastActivity) return false;

			// Consider active if last activity was within 30 seconds
			return Date.now() - lastActivity < 30000;
		});

		const wasLiveSession = isLiveSession;
		const nowLiveSession = activeParticipants.length > 1;

		// Only update state if the live session status actually changed
		if (wasLiveSession !== nowLiveSession) {
			setIsLiveSession(nowLiveSession);

			// Auto-announce when session becomes live
			if (!wasLiveSession && nowLiveSession && autoAnnounce && !hasAnnounced) {
				announceLiveSession();
				setHasAnnounced(true);
			}

			// Reset announcement flag when session ends
			if (wasLiveSession && !nowLiveSession) {
				setHasAnnounced(false);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		participants,
		others,
		self,
		isLiveSession,
		autoAnnounce,
		hasAnnounced,
		announceLiveSession,
	]);

	const startLiveSession = useCallback(async () => {
		try {
			// Update presence to indicate active editing
			if (self) {
				// This would be handled by the Liveblocks presence system
				// The presence is automatically updated when user interacts with the editor
			}

			setIsLiveSession(true);
			toast.success("Live note session started");
		} catch (error) {
			console.error("Failed to start live session:", error);
			toast.error("Failed to start live session");
		}
	}, [self]);

	const endLiveSession = useCallback(async () => {
		try {
			setIsLiveSession(false);
			setHasAnnounced(false);
			toast.success("Live note session ended");
		} catch (error) {
			console.error("Failed to end live session:", error);
			toast.error("Failed to end live session");
		}
	}, []);

	return {
		participants,
		isLiveSession,
		startLiveSession,
		endLiveSession,
		announceLiveSession,
	};
};
