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
import { useOthers } from "@/../liveblocks.config";

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
	const others = useOthers();

	const sync = useBlockNoteSync(api.prosemirror, noteId, {
		snapshotDebounceMs: 1000,
	});

	// Update presence when editor changes
		useEffect(() => {
		if (sync.editor) {
			const editor = sync.editor;

			const getEditorDom = (): HTMLElement | null => {
				try {
					const tiptapEditor = (editor as any)?._tiptapEditor;
					return tiptapEditor?.view?.dom || null;
				} catch {
					return null;
				}
			};

			const getCursorCoords = (): { x: number; y: number } | null => {
				try {
					const tiptapEditor = (editor as any)?._tiptapEditor;
					const view = tiptapEditor?.view;
					const state = tiptapEditor?.state;

					if (!view || !state) return null;
					const { from } = state.selection;
					const coords = view.coordsAtPos(from);
					const editorRect = view.dom.getBoundingClientRect();

					return {
						x: coords.left - editorRect.left,
						y: coords.top - editorRect.top,
					};
				} catch {
					return null;
				}
			};

			const handleFocus = () => {
				const cursor = getCursorCoords();
				updateMyPresence({
					isEditing: true,
					lastActivity: Date.now(),
					cursor,
				});
			};

			const dom = getEditorDom();
			dom?.addEventListener("focus", handleFocus);
			dom?.addEventListener("click", handleFocus);

			if (onEditorReady) {
				onEditorReady(editor);
			}

			let presenceUpdateTimeout: NodeJS.Timeout | null = null;

			const handleChange = () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				const cursor = getCursorCoords();
				presenceUpdateTimeout = setTimeout(() => {
					updateMyPresence({
						isEditing: true,
						lastActivity: Date.now(),
						cursor,
					});
				}, 100);
			};

			const handleSelectionChange = () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				const cursor = getCursorCoords();

				presenceUpdateTimeout = setTimeout(() => {
					updateMyPresence({
						isEditing: false,
						lastActivity: Date.now(),
						cursor,
					});
				}, 100);
			};

			const interval = setInterval(() => {
			const cursor = getCursorCoords();
			if (!cursor) return;

			updateMyPresence({
				lastActivity: Date.now(),
				cursor,
			});
			}, 300);


			editor.onEditorContentChange(handleChange);
			editor.onEditorSelectionChange(handleSelectionChange);

			return () => {
				if (presenceUpdateTimeout) {
					clearTimeout(presenceUpdateTimeout);
				}
				  clearInterval(interval);

				const dom = getEditorDom();
				dom?.removeEventListener("focus", handleFocus);
				dom?.removeEventListener("click", handleFocus);

				updateMyPresence({
					isEditing: false,
					lastActivity: Date.now(),
					cursor: null,
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
					onClick={() => sync.create({ type: "doc", content: [] })}
					className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>
					Create document
				</button>
			</div>
		);
	}

	const remoteCursors = others
	.filter((user) => user.presence?.cursor)
	.map((user) => {
		const cursor = user.presence!.cursor!;
		return (
		<div
			key={user.connectionId}
			style={{
				position: "absolute",
				left: cursor.x,
				top: cursor.y,
				width: 8,
				height: 8,
				borderRadius: "50%",
				backgroundColor: `hsl(${(user.connectionId * 47) % 360} 70% 50%)`,
				zIndex: 50,
				pointerEvents: "none",
				}}
			/>
		);
  	});


	return (
	<div
		className={className}
		style={{
		height: "100%",
		overflow: "hidden",
		position: "relative",
		}}
	>
		{remoteCursors}

		<div
		id="blocknote-scroll-container"
		style={{
			height: "100%",
			overflow: "auto",
			position: "relative",
		}}
		>
		<BlockNoteView
			editor={sync.editor}
			theme="light"
			style={{ height: "100%" }}
		/>
		</div>
	</div>
	);

};
