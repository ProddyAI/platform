"use client";

import Quill from "quill";
import { useEffect, useRef, useState } from "react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { UnifiedMessage } from "@/features/messages/components/unified-message";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { addMentionClickHandlers } from "@/lib/mention-handler";

interface RendererProps {
	value: string;
	calendarEvent?: {
		date: number;
		time?: string;
	};
}

const Renderer = ({ value, calendarEvent }: RendererProps) => {
	const [isEmpty, setIsEmpty] = useState(false);
	const rendererRef = useRef<HTMLDivElement>(null);
	const workspaceId = useWorkspaceId();
	const { data: members } = useGetMembers({ workspaceId });

	// Check if this is a unified message (canvas or note type)
	const isUnifiedMessage = () => {
		try {
			const parsed = JSON.parse(value);
			return (
				typeof parsed === "object" &&
				[
					"canvas",
					"canvas-live",
					"canvas-export",
					"note",
					"note-live",
					"note-export",
				].includes(parsed.type)
			);
		} catch (_e) {
			return false;
		}
	};

	// Get parsed message data
	const getMessageData = () => {
		try {
			return JSON.parse(value);
		} catch (_e) {
			return null;
		}
	};

	useEffect(() => {
		// If this is a unified message (canvas or note type), don't process with Quill
		if (isUnifiedMessage()) {
			setIsEmpty(false);
			return;
		}

		if (!rendererRef.current) return;

		const container = rendererRef.current;

		// Check if we're in a browser environment
		if (typeof document === "undefined") {
			return;
		}

		const quill = new Quill(document.createElement("div"), {
			theme: "snow",
		});

		quill.enable(false);

		// Try to parse the value as JSON, but handle non-JSON content gracefully
		try {
			const contents = JSON.parse(value);
			quill.setContents(contents);
		} catch (error) {
			// If it's not valid JSON, it might be HTML or plain text
			console.log(
				"Renderer: Failed to parse value as JSON, treating as HTML/text",
				error
			);

			// Check if it looks like HTML
			if (value.trim().startsWith("<") && value.trim().endsWith(">")) {
				// It's likely HTML, set it directly
				quill.root.innerHTML = value;
			} else {
				// Treat as plain text
				quill.setText(value);
			}
		}

		const isEmpty =
			quill
				.getText()
				.replace(/<[^>]*>/g, "")
				.trim().length === 0;

		setIsEmpty(isEmpty);

		// If this message has a calendar event, remove date/time from the displayed content
		if (calendarEvent) {
			// First, get the text content
			const textContent = quill.getText();

			// Get the date in various formats to remove from text
			const dateObj = new Date(calendarEvent.date);
			const dateStr = dateObj.toLocaleDateString();
			const timeStr = calendarEvent.time || "";

			// Create different date format variations to match what might be in the text
			const dateFormats = [
				dateStr,
				dateObj.toLocaleDateString("en-US", {
					month: "long",
					day: "numeric",
					year: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					month: "numeric",
					day: "numeric",
					year: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					weekday: "long",
					month: "long",
					day: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					weekday: "long",
					month: "long",
					day: "numeric",
					year: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					weekday: "short",
					month: "long",
					day: "numeric",
				}),
				dateObj.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
				}),
				`${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`,
				`${dateObj.getMonth() + 1}-${dateObj.getDate()}-${dateObj.getFullYear()}`,
				"Today",
				"Tomorrow",
				"Next week",
				"Next week - Monday",
				"Next week - Tuesday",
				"Next week - Wednesday",
				"Next week - Thursday",
				"Next week - Friday",
				"Next week - Saturday",
				"Next week - Sunday",
			];

			// Create time variations
			const timeVariations = timeStr
				? [` at ${timeStr}`, ` ${timeStr}`, `, ${timeStr}`]
				: [""];

			let cleanedText = textContent;
			for (const dateFormat of dateFormats) {
				for (const timeVariation of timeVariations) {
					const pattern = dateFormat + timeVariation;
					cleanedText = cleanedText.replace(pattern, "");
				}
			}

			cleanedText = cleanedText.replace(/\s+/g, " ").trim();
			quill.setText(cleanedText);
		}

		const htmlContent = quill.root.innerHTML;
		container.innerHTML = htmlContent;

		// Add click handlers to mentions
		addMentionClickHandlers(container);

		return () => {
			if (container) container.innerHTML = "";
		};
	}, [value, calendarEvent, isUnifiedMessage]);

	// If this is a unified message (canvas or note type), render the UnifiedMessage component
	if (isUnifiedMessage()) {
		const messageData = getMessageData();
		if (messageData) {
			return <UnifiedMessage data={messageData} />;
		} else {
			console.error("Error parsing unified message data:", value);
			return <div>Error displaying message</div>;
		}
	}

	if (isEmpty) return null;

	return <div className="ql-editor ql-renderer" ref={rendererRef} />;
};

export default Renderer;
