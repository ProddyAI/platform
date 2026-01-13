"use client";

import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { Loader2, Wand2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import type { Note } from "../types";
import { BlockNoteEditor } from "./blocknote-editor";

interface BlockNoteNotesEditorProps {
	note: Note;
	onUpdate: (updates: Partial<Note>) => void;
	onTitleChange: (title: string) => void;
	onContentChange: (content: string) => void;
	onSaveNote: () => void;
	isLoading?: boolean;
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
	toggleFullScreen?: () => void;
	isFullScreen?: boolean;
	onEditorReady?: (editor: BlockNoteEditorType) => void;
}

export const BlockNoteNotesEditor = ({
	note,
	onUpdate,
	onTitleChange,
	onContentChange,
	onSaveNote,
	isLoading = false,
	workspaceId,
	channelId,
	toggleFullScreen,
	isFullScreen = false,
	onEditorReady,
}: BlockNoteNotesEditorProps) => {
	const [isFormatting, setIsFormatting] = useState(false);
	const editorRef = useRef<BlockNoteEditorType | null>(null);

	const handleEditorReady = useCallback(
  		(editor: BlockNoteEditorType) => {
    		editorRef.current = editor;
    		onEditorReady?.(editor);
  		},
  		[onEditorReady]
	);


	const handleFormatNote = async () => {
		if (!editorRef.current) {
			toast.error("Editor not ready");
			return;
		}

		setIsFormatting(true);

		try {
			// Get current content as markdown
			const currentContent = await editorRef.current.blocksToMarkdownLossy();

			if (!currentContent.trim()) {
				toast.error("No content to format");
				setIsFormatting(false);
				return;
			}

			// Call the formatter API
			const response = await fetch("/api/smart/formatter", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: currentContent,
					title: note.title,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Formatting failed");
			}

			const { formattedContent } = await response.json();

			if (formattedContent) {
				// Parse the formatted markdown to blocks
				const formattedBlocks =
					await editorRef.current.tryParseMarkdownToBlocks(formattedContent);

				if (formattedBlocks && formattedBlocks.length > 0) {
					// Get current blocks and replace them with formatted blocks
					const currentBlocks = editorRef.current.document;

					// Use transaction to replace all content
					editorRef.current.transact(() => {
						editorRef.current?.replaceBlocks(currentBlocks, formattedBlocks);
					});

					toast.success("Note formatted successfully!");
				} else {
					toast.error("Failed to parse formatted content");
				}
			}
		} catch (error) {
			console.error("Formatting error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to format note"
			);
		} finally {
			setIsFormatting(false);
		}
	};

	return (
		<div className="flex flex-col h-full relative dark:bg-[hsl(var(--card-accent))]">
			{/* Note Content */}
			<div className="flex-1 overflow-hidden dark:bg-[hsl(var(--card-accent))]">
				<BlockNoteEditor
					noteId={note._id}
					className="h-full dark:bg-[hsl(var(--card-accent))]"
					onEditorReady={handleEditorReady}
				/>
			</div>

			{/* Format Button - Top Right */}
			<div className="absolute top-4 right-4 z-10">
				<Button
					onClick={handleFormatNote}
					disabled={isFormatting || isLoading}
					size="sm"
					variant="secondary"
					className="shadow-lg hover:shadow-xl transition-shadow"
				>
					{isFormatting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Formatting...
						</>
					) : (
						<>
							<Wand2 className="h-4 w-4 mr-2" />
							Format
						</>
					)}
				</Button>
			</div>
		</div>
	);
};
