"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useOthers, useSelf } from "@/../liveblocks.config";

interface CanvasParticipantsTrackerProps {
	roomId: string;
	liveMessageId: Id<"messages"> | null;
	currentUserId?: string;
	onParticipantsChange?: (participantIds: string[]) => void;
}

export const CanvasParticipantsTracker = ({
	roomId,
	liveMessageId,
	currentUserId,
	onParticipantsChange,
}: CanvasParticipantsTrackerProps) => {
	// Get Liveblocks participants
	const others = useOthers();
	const self = useSelf();

	// Mutation for updating messages
	const updateMessage = useMutation(api.messages.update);

	// Effect to update the live message when participants change
	useEffect(() => {
		if (!roomId || !liveMessageId) return;

		// Get all participant IDs
		const participantIds: string[] = [];

		// Add other users
		others.forEach((other) => {
			if (other.id) {
				participantIds.push(other.id);
			}
		});

		// Add current user
		if (self?.id) {
			participantIds.push(self.id);
		} else if (currentUserId) {
			participantIds.push(currentUserId);
		}

		// Call the onParticipantsChange callback if provided
		if (onParticipantsChange) {
			onParticipantsChange(participantIds);
		}

		// Update the live message with the current participants
		updateMessage({
			id: liveMessageId,
			body: JSON.stringify({
				type: "canvas-live",
				roomId: roomId,
				participants: participantIds,
			}),
		}).catch((error) => {
			console.error("Error updating live message:", error);
		});
	}, [
		roomId,
		liveMessageId,
		currentUserId,
		others,
		self,
		updateMessage,
		onParticipantsChange,
	]);

	// This component doesn't render anything
	return null;
};
