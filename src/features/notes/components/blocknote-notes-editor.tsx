"use client";

import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Note } from "../types";
import { AIActionsToolbar } from "./ai-actions-toolbar";
import { BlockNoteEditor } from "./blocknote-editor";

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

	useEffect(() => {
		const handleInsertNotes = async (e: Event) => {
			if (!editorRef.current) return;

			const customEvent = e as CustomEvent;
			const { content } = customEvent.detail || {};
			if (!content) return;

			try {
				const blocks =
					await editorRef.current.tryParseMarkdownToBlocks(content);
				if (blocks && blocks.length > 0) {
					const lastBlock =
						editorRef.current.document.length > 0
							? editorRef.current.document[
									editorRef.current.document.length - 1
								]
							: undefined;

					if (lastBlock) {
						editorRef.current.insertBlocks(blocks, lastBlock, "after");
					} else {
						editorRef.current.insertBlocks(
							blocks,
							editorRef.current.document[0],
							"before"
						);
					}
					toast.success("Inserted AI notes into document!");
				}
			} catch (error) {
				console.error("Failed to insert AI notes", error);
				toast.error("Failed to insert AI notes into editor");
			}
		};

		window.addEventListener("proddy:insert-ai-notes", handleInsertNotes);
		return () => {
			window.removeEventListener("proddy:insert-ai-notes", handleInsertNotes);
		};
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
			<div className="flex-1 min-h-0 overflow-hidden relative">
				<BlockNoteEditor
					className="h-full"
					noteId={note._id}
					onEditorReady={handleEditorReady}
				/>
			</div>
		</div>
	);
};
