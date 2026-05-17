"use client";

import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { Loader } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useUpdateMyPresence } from "@/../liveblocks.config";
import { Button } from "@/components/ui/button";

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

			// Listen for AI note insertion events
			const handleAiInsertion = async (
				e: CustomEvent<{ content?: string }>
			) => {
				const content = e.detail?.content;
				if (content && editor) {
					try {
						// Parse markdown to blocks
						const blocks = await editor.tryParseMarkdownToBlocks(content);

						// Insert at the end of the document
						const topLevel = editor.document;
						const lastBlock = topLevel[topLevel.length - 1];

						if (lastBlock) {
							editor.insertBlocks(blocks, lastBlock, "after");
						} else {
							editor.replaceBlocks(topLevel, blocks);
						}
						toast.success("AI notes inserted into editor");
					} catch (err) {
						console.error("Failed to parse/insert AI notes:", err);
						// Fallback to simple text if parsing fails
						toast.error("Failed to parse AI notes, inserting as plain text");
						try {
							const topLevel = editor.document;
							const lastBlock = topLevel[topLevel.length - 1];
							const fallback = [{ type: "paragraph", content }] as any;

							if (lastBlock) {
								editor.insertBlocks(fallback, lastBlock, "after");
							} else {
								editor.replaceBlocks(topLevel, fallback);
							}
						} catch (fallbackErr) {
							console.error("Fallback insertion failed:", fallbackErr);
						}
					}
				}
			};

			window.addEventListener(
				"proddy:insert-ai-notes",
				handleAiInsertion as unknown as EventListener
			);

			return () => {
				window.removeEventListener(
					"proddy:insert-ai-notes",
					handleAiInsertion as unknown as EventListener
				);
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

	if (!sync.editor) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<div className="flex flex-col items-center gap-y-4">
					<Loader className="size-6 animate-spin text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						Initializing editor...
					</p>
					{sync.create && (
						<Button
							onClick={() => sync.create?.({ type: "doc", content: [] })}
							variant="outline"
						>
							Click to create if it takes too long
						</Button>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={className} style={{ height: "100%", overflow: "hidden" }}>
			<BlockNoteView
				editor={sync.editor}
				style={{ height: "100%" }}
				theme="light"
			/>
		</div>
	);
};
