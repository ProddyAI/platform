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

	if (isLoading) {
		return {
			participants: [],
			currentParticipant: null,
			participantCount: 0,
			isLoading: true,
		};
	}

	const { participants, participantCount } = useMemo(() => {
		const online = (presenceState || []).filter((p) => p.online);
		const seen = new Set<string>();

		const list = online
			.map((p) => {
				const userId = p.userId as unknown as string;
				if (!userId) return null;
				if (seen.has(userId)) return null;
				seen.add(userId);

				const name = p.user?.name || "Anonymous";
				const picture = getUserImageUrl(name, p.user?.image, userId);

				return {
					userId,
					memberId: (p.memberId as any) || null,
					info: {
						name,
						picture,
					},
				};
			})
			.filter(Boolean) as Array<{
			userId: string;
			memberId: string | null;
			info: { name: string; picture: string | null };
		}>;

		// Exclude current user from the "others" list to prevent duplicates.
		const othersOnly = currentUserId
			? list.filter((u) => u.userId !== currentUserId)
			: list;

		return {
			participants: othersOnly,
			participantCount: online.length,
		};
	}, [presenceState, currentUserId]);

	// Current user info (useful for some callers)
	const currentParticipant = currentMember
		? {
				memberId: currentMember._id,
				userId: currentMember.userId,
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
		participantCount,
		isLoading: false,
	};
};
