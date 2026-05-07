"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@/../convex/_generated/api";
import { useOthers, useRoom, useSelf } from "@/../liveblocks.config";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { getUserImageUrl } from "@/lib/placeholder-image";

export const useNotesParticipants = () => {
	// Get workspace ID from the URL
	const workspaceId = useWorkspaceId();
	const _room = useRoom();

	// State to track actual participants count
	const [participantCount, setParticipantCount] = useState(0);

	// Fetch members from the database
	const members = useQuery(api.members.get, { workspaceId });

	// Get the current user's member info
	const currentMember = useQuery(api.members.current, { workspaceId });

	// Get Liveblocks participants (users currently in the note)
	const others = useOthers();
	const self = useSelf();

	// Check if data is still loading
	const isLoading = members === undefined || currentMember === undefined;

	// Update participant count whenever others or self changes
	useEffect(() => {
		// Count is others plus self (if present)
		const count = others.length + (self ? 1 : 0);
		setParticipantCount(count);
	}, [others, self]);

	if (isLoading) {
		return {
			participants: [],
			currentParticipant: null,
			participantCount: 0,
			isLoading: true,
		};
	}

	// Create a map of Convex users by their ID for quick lookup
	const userMap = new Map();
	if (members) {
		members.forEach((member) => {
			userMap.set(member.user._id, member);
		});
	}

	// Format participants with their user info - DIRECT DATABASE APPROACH
	const participants = others.map((other) => {
		const userId = other.id;
		let member = null;
		let userName = null;
		let userPicture = null;

		// DIRECT DATABASE APPROACH: Always try to get the actual user name from the database first
		if (userId && members) {
			// Try exact match first - this is the most reliable approach
			const exactMatch = members.find((m) => m.user._id === userId);
			if (exactMatch?.user) {
				member = exactMatch;
				userName = exactMatch.user.name;
				userPicture = exactMatch.user.image;
			} else if (typeof userId === "string") {
				// Try partial match if exact match fails
				const partialMatch = members.find(
					(m) => m.user._id.includes(userId) || userId.includes(m.user._id)
				);
				if (partialMatch?.user) {
					member = partialMatch;
					userName = partialMatch.user.name;
					userPicture = partialMatch.user.image;
				}
			}
		}

		// If we couldn't find the user in the database but have info from Liveblocks, use that
		if (!userName && other.info?.name) {
			userName = other.info.name;
			userPicture = other.info.picture;
		}

		// Final fallback
		if (!userName) {
			userName = `User ${other.connectionId}`;
		}

		// Generate avatar fallback
		const _avatarFallback = userName ? userName[0].toUpperCase() : "U";
		// Use null instead of external placeholder URL - let the Avatar component handle fallbacks
		const fallbackPicture = null;

		return {
			connectionId: other.connectionId,
			memberId: member?._id || null,
			userId: userId || null,
			info: {
				name: userName,
				picture: userPicture || fallbackPicture,
			},
		};
	});

	// Get current participant - DIRECT DATABASE APPROACH
	const currentParticipant =
		currentMember && self
			? {
					connectionId: self.connectionId,
					memberId: currentMember._id,
					userId: currentMember.userId,
					info: {
						// DIRECT DATABASE APPROACH: Always get the current user's name from the database
						name:
							members?.find((m) => m._id === currentMember._id)?.user?.name ||
							members?.find((m) => m.userId === currentMember.userId)?.user
								?.name ||
							"You",
						picture: getUserImageUrl(
							members?.find((m) => m._id === currentMember._id)?.user?.name ||
								members?.find((m) => m.userId === currentMember.userId)?.user
									?.name ||
								"You",
							members?.find((m) => m._id === currentMember._id)?.user?.image ||
								members?.find((m) => m.userId === currentMember.userId)?.user
									?.image,
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
