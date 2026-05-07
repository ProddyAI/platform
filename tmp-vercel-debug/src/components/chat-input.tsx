"use client";

import { Loader } from "lucide-react";
import dynamic from "next/dynamic";
import type Quill from "quill";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { Id } from "@/../convex/_generated/dataModel";
import { useCreateCalendarEvent } from "@/features/calendar/api/use-create-calendar-event";
import { useCreateMessage } from "@/features/messages/api/use-create-message";
import { useTypingIndicator } from "@/features/presence/hooks/use-typing-indicator";
import { Suggestions } from "@/features/smart/components/suggestions";
import { useGenerateUploadUrl } from "@/features/upload/api/use-generate-upload-url";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const Editor = dynamic(() => import("@/components/editor"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center">
			<Loader className="size-6 animate-spin text-muted-foreground" />
		</div>
	),
});

interface ChatInputProps {
	placeholder?: string;
	channelId?: Id<"channels">;
	conversationId?: Id<"conversations">;
	channelName?: string;
	memberName?: string;
	memberImage?: string;
}

type CreateMessageValues = {
	workspaceId: Id<"workspaces">;
	body: string;
	image?: Id<"_storage">;
	calendarEvent?: {
		date: number;
		time?: string;
	};
	channelId?: Id<"channels">;
	conversationId?: Id<"conversations">;
};

export const ChatInput = ({
	placeholder,
	channelId,
	conversationId,
	channelName,
}: ChatInputProps) => {
	const [editorKey, setEditorKey] = useState(0);
	const [isPending, setIsPending] = useState(false);

	const innerRef = useRef<Quill | null>(null);

	const workspaceId = useWorkspaceId();

	const { mutate: createMessage } = useCreateMessage();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();
	const { mutate: createCalendarEvent } = useCreateCalendarEvent();

	// Typing indicator
	const { signalTyping, stopTyping } = useTypingIndicator({
		channelId,
		conversationId,
	});

	const extractPlainText = (rawBody: string) => {
		try {
			const parsed = JSON.parse(rawBody) as {
				ops?: Array<{ insert?: string | Record<string, unknown> }>;
			};

			if (!parsed.ops) return "";

			return parsed.ops
				.map((op) => (typeof op.insert === "string" ? op.insert : ""))
				.join("")
				.replace(/\n/g, " ")
				.trim();
		} catch {
			return "";
		}
	};

	const buildFileBodyPayload = (rawBody: string, file: File) => {
		const caption = extractPlainText(rawBody);

		return JSON.stringify({
			type: "file",
			fileName: file.name,
			fileType: file.type || "application/octet-stream",
			fileSize: file.size,
			caption,
		});
	};

	const handleSubmit = async ({
		body,
		image,
		calendarEvent,
	}: {
		body: string;
		image: File | null;
		calendarEvent?: {
			date: Date;
			time?: string;
		};
	}) => {
		try {
			setIsPending(true);
			innerRef.current?.enable(false);

			const values: CreateMessageValues = {
				workspaceId,
				body,
				image: undefined,
			};

			// Set either channelId or conversationId based on which is provided
			if (channelId) {
				values.channelId = channelId;
			} else if (conversationId) {
				values.conversationId = conversationId;
			} else {
				throw new Error("Either channelId or conversationId must be provided");
			}

			// Add calendar event if present
			if (calendarEvent) {
				values.calendarEvent = {
					date: calendarEvent.date.getTime(),
					time: calendarEvent.time,
				};
			}

			if (image) {
				const url = await generateUploadUrl(
					{},
					{
						throwError: true,
					}
				);

				if (!url) throw new Error("URL not found.");

				const result = await fetch(url, {
					method: "POST",
					headers: { "Content-type": image.type },
					body: image,
				});

				if (!result.ok) throw new Error("Failed to upload image.");

				const { storageId } = await result.json();

				values.image = storageId;

				if (!image.type.startsWith("image/")) {
					values.body = buildFileBodyPayload(body, image);
				}
			}

			const messageId = await createMessage(values, { throwError: true });

			// Create calendar event in the calendar events table if needed
			if (calendarEvent && messageId) {
				const calendarTitle = (() => {
					try {
						const parsedBody = JSON.parse(values.body) as {
							ops?: Array<{ insert?: string | Record<string, unknown> }>;
							caption?: string;
						};

						if (Array.isArray(parsedBody.ops)) {
							const text = parsedBody.ops
								.map((op) => (typeof op.insert === "string" ? op.insert : ""))
								.join("")
								.trim();

							if (text) return text.substring(0, 50);
						}

						if (parsedBody.caption) {
							return parsedBody.caption.substring(0, 50);
						}
					} catch {
						// Fall through to default title.
					}

					return "Calendar event";
				})();

				await createCalendarEvent({
					title: calendarTitle,
					date: calendarEvent.date.getTime(),
					time: calendarEvent.time,
					messageId,
					workspaceId,
				});
			}

			setEditorKey((prevKey) => prevKey + 1);

			// Stop typing indicator after sending message
			stopTyping();
		} catch (_error) {
			toast.error("Failed to send message.");
		} finally {
			setIsPending(false);
			innerRef?.current?.enable(true);
		}
	};

	const handleSuggestionSelect = (suggestion: string) => {
		if (innerRef.current) {
			// Insert the suggestion at the current cursor position
			const quill = innerRef.current;
			const range = quill.getSelection();
			const position = range ? range.index : 0;

			// Insert the suggestion text
			quill.insertText(position, suggestion);

			// Set focus back to the editor
			quill.focus();
		}
	};

	// Only show suggestions for channel messages, not for direct messages
	return (
		<div className="w-full px-1 md:px-5">
			{channelId && channelName && !conversationId ? (
				<Suggestions
					channelName={channelName}
					onSelectSuggestion={handleSuggestionSelect}
				/>
			) : null}
			<Editor
				channelId={channelId}
				conversationId={conversationId}
				disabled={isPending}
				disableMentions={Boolean(conversationId)}
				innerRef={innerRef}
				key={editorKey}
				onSubmit={handleSubmit}
				onTextChange={() => {
					// Signal typing when user types
					signalTyping();
				}}
				placeholder={placeholder}
			/>
		</div>
	);
};
