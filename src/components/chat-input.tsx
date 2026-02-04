"use client";

import { Loader } from "lucide-react";
import dynamic from "next/dynamic";
import type Quill from "quill";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { Id } from "@/../convex/_generated/dataModel";
import { useCreateCalendarEvent } from "@/features/calendar/api/use-create-calendar-event";
import { useCreateMessage } from "@/features/messages/api/use-create-message";
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
	memberName,
}: ChatInputProps) => {
	const [editorKey, setEditorKey] = useState(0);
	const [isPending, setIsPending] = useState(false);

	const innerRef = useRef<Quill | null>(null);

	const workspaceId = useWorkspaceId();

	const { mutate: createMessage } = useCreateMessage();
	const { mutate: generateUploadUrl } = useGenerateUploadUrl();
	const { mutate: createCalendarEvent } = useCreateCalendarEvent();

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
			}

			const messageId = await createMessage(values, { throwError: true });

			// Create calendar event in the calendar events table if needed
			if (calendarEvent && messageId) {
				await createCalendarEvent({
					title: JSON.parse(body).ops[0].insert.substring(0, 50),
					date: calendarEvent.date.getTime(),
					time: calendarEvent.time,
					messageId,
					workspaceId,
				});
			}

			setEditorKey((prevKey) => prevKey + 1);
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
		<div className="w-full px-5">
			{channelId && channelName && !conversationId ? (
				<Suggestions
					channelName={channelName}
					onSelectSuggestion={handleSuggestionSelect}
				/>
			) : null}
			<Editor
				disabled={isPending}
				disableMentions={!!conversationId}
				innerRef={innerRef}
				key={editorKey}
				onSubmit={handleSubmit}
				placeholder={placeholder} // Disable mentions for direct messages (when conversationId is present)
			/>
		</div>
	);
};
