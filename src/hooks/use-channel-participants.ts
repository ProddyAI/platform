"use client";

<<<<<<< HEAD
import { useQuery } from 'convex/react';
import { useMemo } from 'react';

import { api } from '../../convex/_generated/api';
import { useWorkspaceId } from './use-workspace-id';
import { useWorkspacePresence } from '@/features/presence/hooks/use-workspace-presence';
import { getUserImageUrl } from '@/lib/placeholder-image';

export const useChannelParticipants = () => {
	// Get workspace ID from the URL
	const workspaceId = useWorkspaceId();
=======
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useWorkspacePresence } from "@/features/presence/hooks/use-workspace-presence";
import { getUserImageUrl } from "@/lib/placeholder-image";
import { api } from "../../convex/_generated/api";
import { useOthers, useRoom, useSelf } from "../../liveblocks.config";
import { useChannelId } from "./use-channel-id";
import { useWorkspaceId } from "./use-workspace-id";

export const useChannelParticipants = () => {
	// Get channel and workspace IDs from the URL
	const _channelId = useChannelId();
	const workspaceId = useWorkspaceId();
	const _room = useRoom();

	// State to track actual participants count
	const [participantCount, setParticipantCount] = useState(0);
>>>>>>> origin/main

	// Fetch members from the database
	const members = useQuery(api.members.get, { workspaceId });

	// Get the current user's member info
	const currentMember = useQuery(api.members.current, { workspaceId });

	// Get presence data using the new presence system
	const { presenceState } = useWorkspacePresence({ workspaceId });

	// Check if data is still loading
	const isLoading = members === undefined || currentMember === undefined;

<<<<<<< HEAD
	const currentUserId = currentMember?.userId;
=======
	// Create a map of Convex users by their ID for quick lookup
	const userMap = new Map();
	if (members) {
		members.forEach((member) => {
			userMap.set(member.user._id, member);
		});
	}

	// Update participant count whenever others or self changes
	useEffect(() => {
		// Count is others plus self (if present)
		const count = others.length + (self ? 1 : 0);

		// Ensure we have a valid number
		const validCount = Number.isNaN(count) ? 0 : count;
		setParticipantCount(validCount);
	}, [others, self]);
>>>>>>> origin/main

	if (isLoading) {
		return {
			participants: [],
			currentParticipant: null,
			participantCount: 0,
			isLoading: true,
		};
	}

<<<<<<< HEAD
	const { participants, participantCount } = useMemo(() => {
		const online = (presenceState || []).filter((p) => p.online);
		const seen = new Set<string>();
=======
	// Create a status map for quick lookup
	const statusMap: Record<string, string> = {};
	if (presenceState) {
		for (const presence of presenceState) {
			statusMap[presence.userId as string] = presence.online
				? "online"
				: "offline";
		}
	}
>>>>>>> origin/main

		const list = online
			.map((p) => {
				const userId = p.userId as unknown as string;
				if (!userId) return null;
				if (seen.has(userId)) return null;
				seen.add(userId);

<<<<<<< HEAD
				const name = p.user?.name || 'Anonymous';
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
=======
	// Add other users in the canvas - fixed type safety issues
	others.forEach((other) => {
		// Check if info exists and has an id property of type string
		if (
			other.info &&
			"id" in other.info &&
			typeof (other.info as any).id === "string"
		) {
			// Safe to access as we've verified it exists
			canvasParticipantIds.add((other.info as any).id);
		}
	});

	// Add current user if they're in the canvas - fixed type safety issues
	if (
		self?.info &&
		"id" in self.info &&
		typeof (self.info as any).id === "string"
	) {
		canvasParticipantIds.add((self.info as any).id);
	}

	// Map Liveblocks connection IDs to user IDs for accurate tracking
	const connectionToUserIdMap = new Map<number, string>();
	others.forEach((other) => {
		if (other.info && "id" in other.info && typeof other.info.id === "string") {
			connectionToUserIdMap.set(other.connectionId, other.info.id);
		}
	});

	// Filter for online members who are in the canvas
	const _canvasMembers =
		members?.filter(
			(member) =>
				statusMap[member.user._id] === "online" &&
				canvasParticipantIds.has(member.user._id)
		) || [];

	// Format participants with their user info
	const participants = others.map((other) => {
		const userId =
			"id" in (other.info || {}) ? (other.info as { id: string }).id : null;
		let member = userId ? userMap.get(userId) : null;

		// If no exact match by ID, try to find a partial match
		if (!member && userId && typeof userId === "string" && members) {
			const matchingMember = members.find(
				(m) => m.user._id.includes(userId) || userId.includes(m.user._id)
			);

			if (matchingMember) {
				member = matchingMember;
			}
		}

		// If still no match and we have members, try to assign a member based on connection ID
		if (!member && members && members.length > 0) {
			// Use modulo to cycle through available members
			const memberByIndex = members[other.connectionId % members.length];
			if (memberByIndex) {
				member = memberByIndex;
			}
		}
>>>>>>> origin/main

		return {
			participants: othersOnly,
			participantCount: online.length,
		};
	}, [presenceState, currentUserId]);

<<<<<<< HEAD
	// Current user info (useful for some callers)
	const currentParticipant = currentMember
		? {
				memberId: currentMember._id,
				userId: currentMember.userId,
				info: {
					name:
						members?.find((m) => m._id === currentMember._id)?.user?.name ||
						'You',
					picture: getUserImageUrl(
						members?.find((m) => m._id === currentMember._id)?.user?.name ||
							'You',
						members?.find((m) => m._id === currentMember._id)?.user?.image,
						currentMember.userId
					),
				},
		  }
		: null;
=======
	// Get current participant
	const currentParticipant =
		currentMember && self
			? {
					connectionId: self.connectionId,
					memberId: currentMember._id,
					userId: currentMember.userId,
					info: {
						// Find the current member in the members list to get their name
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
>>>>>>> origin/main

	return {
		participants,
		currentParticipant,
		participantCount,
		isLoading: false,
	};
};
