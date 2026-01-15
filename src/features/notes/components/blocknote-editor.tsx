"use client";

import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { Loader } from "lucide-react";
import { useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useUpdateMyPresence } from "@/../liveblocks.config";

interface BlockNoteEditorProps {
	noteId: Id<"notes">;
	className?: string;
	onEditorReady?: (editor: BlockNoteEditorType) => void;
}

export const BlockNoteEditor = ({
	noteId,
	className,
	onEditorReady,
}: BlockNoteEditorProps) => {
	const updateMyPresence = useUpdateMyPresence();

	const sync = useBlockNoteSync(api.prosemirror, noteId, {
		snapshotDebounceMs: 1000,
	});

	// Update presence when editor changes
	useEffect(() => {
		if (sync.editor) {
			const editor = sync.editor;

			// Notify parent component that editor is ready
			if (onEditorReady) {
				onEditorReady(editor);
			}

			// Throttle presence updates to prevent excessive calls
			let presenceUpdateTimeout: NodeJS.Timeout | null = null;

			// Listen for editor changes to update presence
			const handleChange = () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				presenceUpdateTimeout = setTimeout(() => {
					updateMyPresence({
						isEditing: true,
						lastActivity: Date.now(),
					});
				}, 100); // Throttle to max 10 updates per second
			};

			// Listen for selection changes
			const handleSelectionChange = () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				presenceUpdateTimeout = setTimeout(() => {
					updateMyPresence({
						isEditing: false,
						lastActivity: Date.now(),
					});
				}, 100); // Throttle to max 10 updates per second
			};

			editor.onEditorContentChange(handleChange);
			editor.onEditorSelectionChange(handleSelectionChange);

			return () => {
				// Clear timeout on cleanup
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				// Cleanup listeners if needed
				updateMyPresence({
					isEditing: false,
					lastActivity: Date.now(),
				});
			};
		}
	}, [sync.editor, updateMyPresence, onEditorReady]);

	if (sync.isLoading) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader className="size-5 animate-spin" />
			</div>
		);
	}

	if (!sync.editor) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<button
					type="button"
					onClick={() => sync.create({ type: "doc", content: [] })}
					className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>
					Create document
				</button>
			</div>
		);
	}

	return (
		<div className={className} style={{ height: "100%", overflow: "hidden" }}>
			<BlockNoteView
				editor={sync.editor}
				theme="light"
				style={{ height: "100%" }}
			/>
		</div>
	);
};
