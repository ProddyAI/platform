"use client";

import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { useCallback, useRef } from "react";
import type { Note } from "../types";
import { AIActionsToolbar } from "./ai-actions-toolbar";
import { BlockNoteEditor } from "./blocknote-editor";
import { NoteEditorErrorBoundary } from "./note-editor-error-boundary";

interface BlockNoteNotesEditorProps {
	note: Note;
	isLoading?: boolean;
	isFullScreen?: boolean;
}

export const BlockNoteNotesEditor = ({
	note,
	isLoading = false,
	isFullScreen = false,
}: BlockNoteNotesEditorProps) => {
	const editorRef = useRef<BlockNoteEditorType | null>(null);

	const handleEditorReady = useCallback((editor: BlockNoteEditorType) => {
		editorRef.current = editor;
	}, []);

	return (
		<div
			className="flex flex-col h-full overflow-hidden"
			data-fullscreen={isFullScreen}
		>
			{/* AI Actions Toolbar — sticky at top */}
			<div className="flex-none">
				<AIActionsToolbar editorRef={editorRef} isLoading={isLoading} />
			</div>

			{/* Editor area — fills remaining height, scrollable inside */}
			{/* Wrapped in Error Boundary to catch ProseMirror/BlockNote crashes
			    (e.g. RangeError: Invalid array passed to renderSpec) for existing
			    notes that were stored with an invalid document structure. */}
			<div className="flex-1 min-h-0 overflow-hidden relative">
				<NoteEditorErrorBoundary noteId={note._id}>
					<BlockNoteEditor
						className="h-full"
						noteId={note._id}
						onEditorReady={handleEditorReady}
					/>
				</NoteEditorErrorBoundary>
			</div>
		</div>
	);
};
