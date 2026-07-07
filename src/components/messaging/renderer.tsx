"use client";

import Quill from "quill";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { UnifiedMessage } from "@/features/messages/components/unified-message";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { addMentionClickHandlers } from "@/lib/client/mention-handler";

interface RendererProps {
	value: string;
	image?: string | null;
	calendarEvent?: {
		date: number;
		time?: string;
	};
}

type UnifiedMessagePayload = React.ComponentProps<
	typeof UnifiedMessage
>["data"];

const Renderer = ({ value, image }: RendererProps) => {
	const [isEmpty, setIsEmpty] = useState(false);
	const rendererRef = useRef<HTMLDivElement>(null);
	const workspaceId = useWorkspaceId();
	useGetMembers({ workspaceId });

	const isUnifiedMessage = useMemo(() => {
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
					"file",
					"meeting",
				].includes(parsed.type)
			);
		} catch (_e) {
			return false;
		}
	}, [value]);

	// Get parsed message data
	const getMessageData = () => {
		try {
			const parsed = JSON.parse(value) as {
				type?: unknown;
				[key: string]: unknown;
			};

			const validTypes: UnifiedMessagePayload["type"][] = [
				"canvas",
				"canvas-live",
				"canvas-export",
				"note",
				"note-live",
				"note-export",
				"file",
				"meeting",
			];

			if (
				typeof parsed.type !== "string" ||
				!validTypes.includes(parsed.type as UnifiedMessagePayload["type"])
			) {
				return null;
			}

			const unifiedPayload = parsed as unknown as UnifiedMessagePayload;

			if (unifiedPayload.type === "file" && image) {
				return {
					...unifiedPayload,
					fileUrl: image,
				};
			}

			return unifiedPayload;
		} catch (_e) {
			return null;
		}
	};

	useEffect(() => {
		// If this is a unified message (canvas or note type), don't process with Quill
		if (isUnifiedMessage) {
			setIsEmpty(false);
			return undefined;
		}

		if (!rendererRef.current) return undefined;

		const container = rendererRef.current;

		// Check if we're in a browser environment
		if (typeof document === "undefined") {
			return undefined;
		}

		const quill = new Quill(document.createElement("div"), {
			theme: "snow",
		});

		quill.enable(false);

		// Try to parse the value as JSON, but handle non-JSON content gracefully
		try {
			const contents = JSON.parse(value);
			quill.setContents(contents);
		} catch (_error) {
			// Not valid JSON — it might be HTML or plain text, both expected
			// for regular chat messages, so this isn't logged as an error.

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

		const htmlContent = quill.root.innerHTML;
		container.innerHTML = htmlContent;

		// Add click handlers to mentions
		addMentionClickHandlers(container);

		return () => {
			if (container) container.innerHTML = "";
		};
	}, [value, isUnifiedMessage]);

	// If this is a unified message (canvas or note type), render the UnifiedMessage component
	if (isUnifiedMessage) {
		const messageData = getMessageData();
		if (messageData) {
			return <UnifiedMessage data={messageData} />;
		} else {
			console.error("Error parsing unified message data:", value);
			return (
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span>This message couldn&apos;t be displayed.</span>
					<button
						className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
						onClick={() => window.location.reload()}
						type="button"
					>
						Retry
					</button>
				</div>
			);
		}
	}

	if (isEmpty) return null;

	return <div className="ql-editor ql-renderer" ref={rendererRef} />;
};

export default Renderer;
