"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useCurrentMember } from "@/features/members/api/use-current-member";

interface UseGetAssignedCardsProps {
	workspaceId: Id<"workspaces">;
}

export const useGetAssignedCards = ({
	workspaceId,
}: UseGetAssignedCardsProps) => {
	// Get the current member
	const { data: currentMember, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});

	// Get all channels in the workspace
	const channels = useQuery(
		api.channels.get,
		workspaceId ? { workspaceId } : "skip"
	);
	const channelsLoading = channels === undefined;

	// Get all cards assigned to the current member across all channels
	const assignedCardsResult = useQuery(
		api.board.getAssignedCards,
		workspaceId && currentMember
			? {
					workspaceId,
					memberId: currentMember._id,
				}
			: "skip"
	);

	const assignedCards = assignedCardsResult;
	const cardsLoading = assignedCardsResult === undefined;

	// Process and enhance the cards with channel information
	const processedCards = useMemo(() => {
		if (!assignedCards || !channels) return [];

		return assignedCards.map((card) => {
			// Find the channel that matches the card's channelId
			const channel = channels.find((c) => c._id === card.channelId);

			// Return the card with added channel information
			return {
				...card,
				channelName: channel?.name || "Unknown Channel",
			};
		});
	}, [assignedCards, channels]);

	// Sort cards by creation time (newest first)
	const sortedCards = useMemo(() => {
		if (!processedCards.length) return [];

		return [...processedCards].sort((a, b) => {
			// Sort by due date if available
			if (a.dueDate && b.dueDate) {
				return a.dueDate - b.dueDate;
			}

			// If only one has a due date, prioritize it
			if (a.dueDate) return -1;
			if (b.dueDate) return 1;

			// Finally sort by creation time
			return b._creationTime - a._creationTime;
		});
	}, [processedCards]);

	const isLoading = memberLoading || channelsLoading || cardsLoading;

	return { data: sortedCards, isLoading };
};
