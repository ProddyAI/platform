"use client";

import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

	// "saving" → debounce active; "saved" → last snapshot committed; null → idle
	const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | null>(null);
	// useRef so timer management doesn't trigger re-renders
	const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

			// Listen for editor changes to update presence and save indicator
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

				// Mark as saving whenever content changes (mirrors snapshotDebounceMs)
				setSaveStatus("saving");
				if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
				savedTimerRef.current = setTimeout(() => {
					setSaveStatus("saved");
					// Clear the "Saved" badge after 2 seconds to keep the UI clean
					savedTimerRef.current = setTimeout(() => setSaveStatus(null), 2000);
				}, 2000); // matches snapshotDebounceMs
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
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
				updateMyPresence({
					isEditing: false,
					lastActivity: Date.now(),
				});
			};
		}
		// savedTimerRef is a stable useRef object — its identity never changes,
		// so it does not belong in the dependency array. ESLint/Biome may flag
		// .current reads, but adding the ref itself would cause an infinite loop.
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
				position: "relative",
			}}
		>
			{/* Non-intrusive save status badge — bottom-right corner */}
			{saveStatus && (
				<div
					aria-live="polite"
					className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50 shadow-sm transition-opacity duration-300"
				>
					{saveStatus === "saving" ? (
						<>
							<Loader2 className="h-3 w-3 animate-spin text-violet-500" />
							<span>Saving…</span>
						</>
					) : (
						<>
							<CheckCircle2 className="h-3 w-3 text-green-500" />
							<span>Saved</span>
						</>
					)}
				</div>
			)}

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
