"use client";

import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { Loader2 } from "lucide-react";
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
		snapshotDebounceMs: 2000,
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
				}, 100);
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
				}, 100);
			};

			editor.onEditorContentChange(handleChange);
			editor.onEditorSelectionChange(handleSelectionChange);

			return () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
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
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin text-violet-500" />
					<span className="text-sm">Loading note...</span>
				</div>
			</div>
		);
	}

	if (!sync.editor) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="text-center space-y-3">
					<p className="text-sm text-muted-foreground">
						Editor could not be initialized.
					</p>
					<button
						className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
						onClick={() => sync.create({ type: "doc", content: [] })}
						type="button"
					>
						Initialize Editor
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			className={className}
			style={{
				height: "100%",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<BlockNoteView
				editor={sync.editor}
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: "auto",
					// Custom scrollbar styles applied via CSS
				}}
				theme="light"
			/>
		</div>
	);
};
