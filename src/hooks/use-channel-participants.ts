"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useWorkspacePresence } from "@/features/presence/hooks/use-workspace-presence";
import { getUserImageUrl } from "@/lib/placeholder-image";
import { api } from "../../convex/_generated/api";
import { useWorkspaceId } from "./use-workspace-id";

export const useChannelParticipants = () => {
	// Get workspace ID from the URL
	const workspaceId = useWorkspaceId();

	// Fetch members from the database
	const members = useQuery(api.members.get, { workspaceId });

	// Get the current user's member info
	const currentMember = useQuery(api.members.current, { workspaceId });

	// Get presence data using the new presence system
	const { presenceState } = useWorkspacePresence({ workspaceId });

	// Check if data is still loading
	const isLoading = members === undefined || currentMember === undefined;

	const currentUserId = currentMember?.userId;

	const result = useMemo(() => {
		if (isLoading) {
			return {
				participants: [],
				currentParticipant: null,
				participantCount: 0,
				isLoading: true,
			};
		}

		const online = (presenceState || []).filter((p) => p.online);
		const seen = new Set<string>();

		const participants = online
			.map((p) => {
				const userId = p.userId as unknown as string;
				if (!userId) return null;
				if (seen.has(userId)) return null;
				// Exclude the current user from participants
				if (userId === currentMember?.userId || userId === currentUserId) return null;
				seen.add(userId);

				const member = members?.find((m) => m.userId === userId);
				if (!member) return null;

				return {
					userId,
					memberId: member._id,
					info: {
						name: member.user?.name || "Unknown User",
						picture: getUserImageUrl(
							member.user?.name || "Unknown User",
							member.user?.image,
							userId
						),
					},
				};
			})
			.filter(Boolean) as Array<{
				userId: string;
				memberId: string;
				info: { name: string; picture: string };
			}>;

		const currentParticipant = currentMember
			? {
					userId: currentMember.userId,
					memberId: currentMember._id,
					info: {
						name:
							members?.find((m) => m._id === currentMember._id)?.user?.name ||
							"You",
						picture: getUserImageUrl(
							members?.find((m) => m._id === currentMember._id)?.user?.name ||
								"You",
							members?.find((m) => m._id === currentMember._id)?.user?.image,
							currentMember.userId
						),
					},
			  }
			: null;

		return {
			participants,
			currentParticipant,
			participantCount: participants.length,
			isLoading: false,
		};
	}, [isLoading, presenceState, members, currentMember]);

	return result;
};