"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseTypingIndicatorProps {
	channelId?: Id<"channels">;
	conversationId?: Id<"conversations">;
}

export const useTypingIndicator = ({
	channelId,
	conversationId,
}: UseTypingIndicatorProps) => {
	const setTyping = useMutation(api.typing.setTyping);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Get list of users currently typing
	const typingUsers = useQuery(api.typing.getTypingUsers, {
		channelId,
		conversationId,
	});

	// Function to signal that user is typing
	const signalTyping = useCallback(() => {
		// Clear any existing timeout
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// Send typing signal
		setTyping({
			channelId,
			conversationId,
			isTyping: true,
		}).catch(console.error);

		// Auto-stop typing signal after 3 seconds of inactivity
		typingTimeoutRef.current = setTimeout(() => {
			setTyping({
				channelId,
				conversationId,
				isTyping: false,
			}).catch(console.error);
		}, 3000);
	}, [channelId, conversationId, setTyping]);

	// Function to stop typing signal
	const stopTyping = useCallback(() => {
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		setTyping({
			channelId,
			conversationId,
			isTyping: false,
		}).catch(console.error);
	}, [channelId, conversationId, setTyping]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (typingTimeoutRef.current) {
				clearTimeout(typingTimeoutRef.current);
			}
			// Stop typing on unmount
			setTyping({
				channelId,
				conversationId,
				isTyping: false,
			}).catch(console.error);
		};
	}, [channelId, conversationId, setTyping]);

	// Format typing indicator text
	const getTypingText = (): string => {
		if (!typingUsers || typingUsers.length === 0) {
			return "";
		}

		if (typingUsers.length === 1) {
			return `${typingUsers[0].userName} is typing...`;
		}

		if (typingUsers.length === 2) {
			return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
		}

		if (typingUsers.length === 3) {
			return `${typingUsers[0].userName}, ${typingUsers[1].userName}, and ${typingUsers[2].userName} are typing...`;
		}

		// More than 3 users
		return `${typingUsers.length} people are typing...`;
	};

	return {
		typingUsers: typingUsers || [],
		typingText: getTypingText(),
		isAnyoneTyping: (typingUsers?.length || 0) > 0,
		signalTyping,
		stopTyping,
	};
};
