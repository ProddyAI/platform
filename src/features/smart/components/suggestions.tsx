"use client";

import { Loader, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGetRecentChannelMessages } from "@/features/messages/api/use-get-recent-channel-messages";
import { useChannelId } from "@/hooks/use-channel-id";

interface SuggestionsProps {
	onSelectSuggestion: (suggestion: string) => void;
	// For channel context
	channelName?: string;
}

// Empty channel suggestions
const EMPTY_CHANNEL_SUGGESTIONS = [
	"Let's start a conversation!",
	"Hello team, how is everyone doing today?",
	"Any updates on our current projects?",
];

export const Suggestions = ({
	onSelectSuggestion,
	channelName,
}: SuggestionsProps) => {
	const channelId = useChannelId();
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [hasError, setHasError] = useState(false);
	const [lastMessageId, setLastMessageId] = useState<string | null>(null);

	// Get recent channel messages - always enabled since we only show this component for channels
	const { data: channelMessages, isLoading: channelMessagesLoading } =
		useGetRecentChannelMessages({
			channelId,
			limit: 20,
			enabled: true,
		});

	// Function to fetch suggestions from the API - wrapped in useCallback to avoid dependency issues
	const fetchSuggestions = useCallback(async () => {
		if (!channelMessages || channelMessages.length === 0) {
			setSuggestions(EMPTY_CHANNEL_SUGGESTIONS);
			setHasError(false);
			return;
		}

		setIsLoading(true);
		setHasError(false);

		// Validate message format before sending
		const validMessages = channelMessages.filter((msg) => {
			return msg?.id && msg.authorName;
		});

		if (validMessages.length === 0) {
			setSuggestions(EMPTY_CHANNEL_SUGGESTIONS);
			setIsLoading(false);
			return;
		}

		const payload = {
			messages: validMessages,
			channelName,
		};

		try {
			const response = await fetch("/api/smart/suggestions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				setSuggestions([]);
				setHasError(true);
				return;
			}

			const data = await response.json();

			if (data.suggestions && data.suggestions.length > 0) {
				setSuggestions(data.suggestions);
			} else {
				setSuggestions(EMPTY_CHANNEL_SUGGESTIONS);
			}
		} catch (_error) {
			setSuggestions([]);
			setHasError(true);
		} finally {
			setIsLoading(false);
		}
	}, [channelMessages, channelName]);

	// Track the most recent message ID to detect new messages
	useEffect(() => {
		if (channelMessages && channelMessages.length > 0) {
			const mostRecentMessageId =
				channelMessages[channelMessages.length - 1].id;

			// If we have a new message, refresh suggestions
			if (lastMessageId !== null && lastMessageId !== mostRecentMessageId) {
				fetchSuggestions();
			}

			setLastMessageId(mostRecentMessageId);
		}
	}, [channelMessages, lastMessageId, fetchSuggestions]);

	// Initial fetch of suggestions once messages have resolved
	useEffect(() => {
		if (!channelId || channelMessagesLoading) {
			return;
		}

		if (channelMessages && channelMessages.length > 0) {
			fetchSuggestions();
		} else {
			setSuggestions(EMPTY_CHANNEL_SUGGESTIONS);
		}
	}, [channelId, channelMessagesLoading, channelMessages, fetchSuggestions]);

	// Refresh suggestions manually
	const refreshSuggestions = () => {
		if (channelMessages && channelMessages.length > 0) {
			fetchSuggestions();
		} else {
			setSuggestions(EMPTY_CHANNEL_SUGGESTIONS);
		}
	};

	// Get context label for channel
	const getContextLabel = () => {
		if (channelName) {
			return `AI suggestions for #${channelName}`;
		} else {
			return "AI message suggestions";
		}
	};

	return (
		<div className="mb-2 flex flex-col space-y-2 rounded-md border border-border/30 bg-muted/20 p-2">
			<div className="flex items-center">
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<Sparkles className="size-3 text-primary" />
					<span>{getContextLabel()}</span>
				</div>
				<div className="ml-auto">
					<Button
						className="h-6 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
						disabled={isLoading}
						onClick={refreshSuggestions}
						size="sm"
						variant="ghost"
					>
						{isLoading ? (
							<>
								<Loader className="mr-2 size-3 animate-spin" />
								Loading...
							</>
						) : (
							"Refresh"
						)}
					</Button>
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{suggestions.length > 0 ? (
					suggestions.map((suggestion) => (
						<Button
							className="h-auto rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-foreground"
							key={suggestion}
							onClick={() => onSelectSuggestion(suggestion)}
							size="sm"
							variant="outline"
						>
							{suggestion}
						</Button>
					))
				) : hasError ? (
					<div className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
						<span>Suggestions unavailable</span>
						<Button
							className="h-auto p-0 text-xs text-primary"
							onClick={refreshSuggestions}
							size="sm"
							variant="link"
						>
							Retry
						</Button>
					</div>
				) : (
					<div className="w-full text-center text-xs text-muted-foreground">
						{isLoading
							? "Generating suggestions..."
							: "No suggestions available"}
					</div>
				)}
			</div>
		</div>
	);
};
