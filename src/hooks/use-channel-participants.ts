"use client";

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

	// Fetch members from the database
	const members = useQuery(api.members.get, { workspaceId });

	// Get the current user's member info
	const currentMember = useQuery(api.members.current, { workspaceId });

	// Get presence data using the new presence system
	const { presenceState } = useWorkspacePresence({ workspaceId });

	// Get Liveblocks participants (users currently in the canvas)
	const others = useOthers();
	const self = useSelf();

	// Check if data is still loading
	const isLoading = members === undefined || currentMember === undefined;

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

	if (isLoading) {
		return {
			participants: [],
			currentParticipant: null,
			participantCount: 0,
			isLoading: true,
		};
	}

	// Create a status map for quick lookup
	const statusMap: Record<string, string> = {};
	if (presenceState) {
		for (const presence of presenceState) {
			statusMap[presence.userId as string] = presence.online
				? "online"
				: "offline";
		}
	}

	// Create a map of users currently in the canvas room
	const canvasParticipantIds = new Set<string>();

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
		const userId = other.id;
		const member = members?.find((m) => m.userId === userId);

		return {
			connectionId: other.connectionId,
			memberId: member?._id || null,
			userId: userId || null,
			info: {
				name: member?.user?.name || `User ${other.connectionId}`,
				picture: member?.user?.image || null,
			},
		};
	});

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

	return {
		participants,
		currentParticipant,
		participantCount,
		isLoading: false,
	};
};
