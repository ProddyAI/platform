"use client";

import { Brain, FileText, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveHeader, LiveSidebar } from "@/features/live";
import {
	ExportNoteDialog,
	ShareNoteDialog,
	useLiveNoteSession,
} from "@/features/notes";
import type { Note } from "@/features/notes/types";
import { useNoteContent } from "@/hooks/use-note-content";

const BlockNoteNotesEditor = dynamic(
	() =>
		import("@/features/notes/components/blocknote-notes-editor").then(
			(m) => m.BlockNoteNotesEditor
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex size-full items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin text-primary" />
					<span className="text-sm">Loading note…</span>
				</div>
			</div>
		),
	}
);

const StreamAudioRoom = dynamic(
	() =>
		import("@/features/audio/components/stream-audio-room").then(
			(m) => m.StreamAudioRoom
		),
	{ ssr: false }
);

// Component that contains the notes content and live session logic
// This needs to be inside the LiveblocksRoom to access RoomProvider
interface NotesContentProps {
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
	activeNoteId: Id<"notes"> | null;
	activeNote: Note | null;
	notes: Note[];
	isFullScreen: boolean;
	setIsFullScreen: (value: boolean) => void;
	showExportDialog: boolean;
	setShowExportDialog: (value: boolean) => void;
	pageContainerRef: React.RefObject<HTMLDivElement>;
	onNoteSelect: (noteId: Id<"notes">) => void;
	onCreateNote: (isAI?: boolean) => Promise<void>;
	onDeleteNote: (noteId: Id<"notes">) => Promise<void>;
	onUpdateNote: (noteId: Id<"notes">, updates: Partial<Note>) => Promise<void>;
	noteLimitReached?: boolean;
}

export const NotesContent = ({
	workspaceId,
	channelId,
	activeNoteId,
	activeNote,
	notes,
	isFullScreen,
	setIsFullScreen,
	showExportDialog,
	setShowExportDialog,
	pageContainerRef,
	onNoteSelect,
	onCreateNote,
	onDeleteNote,
	onUpdateNote,
	noteLimitReached = false,
}: NotesContentProps) => {
	// Local state for sidebar
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	// Share dialog visibility (public / password-protected link)
	const [showShareDialog, setShowShareDialog] = useState(false);

	// Live note session hook — inside RoomProvider context
	const dummyNoteId = "kn7cvx952gp794j4vzvxxqqgk57k9yhh" as Id<"notes">;
	const _liveSession = useLiveNoteSession({
		noteId: activeNoteId || dummyNoteId,
		noteTitle: activeNote?.title || "Untitled",
		workspaceId,
		channelId,
		autoAnnounce: Boolean(activeNoteId),
	});

	// Wrapper matching the hook's expected signature
	const handleUpdate = useCallback(
		async (updates: Partial<Note>) => {
			if (!activeNoteId) return;
			await onUpdateNote(activeNoteId, updates);
		},
		[activeNoteId, onUpdateNote]
	);

	// Note content management with debounced auto-save
	const {
		localContent,
		localTitle,
		isTyping,
		handleTitleChange: handleNoteTitleChange,
		hasUnsavedChanges,
	} = useNoteContent({
		note: activeNote || undefined,
		onUpdate: handleUpdate,
		debounceMs: 2000,
	});

	// Handle manual save
	const handleSave = useCallback(async () => {
		if (!activeNoteId) return;
		try {
			await handleUpdate({ content: localContent, title: localTitle });
			toast.success("Note saved");
		} catch (error) {
			console.error("Failed to save note:", error);
			toast.error("Failed to save note");
		}
	}, [activeNoteId, localContent, localTitle, handleUpdate]);

	// Wrappers to match LiveSidebar expected signatures
	const handleItemSelect = useCallback(
		(itemId: string) => {
			onNoteSelect(itemId as Id<"notes">);
		},
		[onNoteSelect]
	);

	const handleDeleteItem = useCallback(
		async (itemId: string) => {
			try {
				await onDeleteNote(itemId as Id<"notes">);
			} catch (error) {
				console.error("Failed to delete note:", error);
				toast.error("Failed to delete note");
			}
		},
		[onDeleteNote]
	);

	const handleRenameItem = useCallback(
		async (itemId: string, newName: string) => {
			try {
				await onUpdateNote(itemId as Id<"notes">, { title: newName });
			} catch (error) {
				console.error("Failed to rename note:", error);
				toast.error("Failed to rename note");
			}
		},
		[onUpdateNote]
	);

	// Memoize note with local overrides while typing
	const memoizedNote = useMemo(() => {
		if (!activeNote) return null;
		return {
			...activeNote,
			title: isTyping ? localTitle : activeNote.title,
			content: isTyping ? localContent : activeNote.content,
		};
	}, [activeNote, isTyping, localTitle, localContent]);

	const memoizedToggleFullScreen = useCallback(() => {
		setIsFullScreen(!isFullScreen);
	}, [isFullScreen, setIsFullScreen]);

	const memoizedOnExport = useCallback(() => {
		setShowExportDialog(true);
	}, [setShowExportDialog]);

	const memoizedOnShare = useCallback(() => {
		setShowShareDialog(true);
	}, []);

	const memoizedOnTagsChange = useCallback(
		(tags: string[]) => {
			handleUpdate({ tags }).catch((error) => {
				console.error("Failed to update tags:", error);
				toast.error("Failed to update tags");
			});
		},
		[handleUpdate]
	);

	const memoizedItems = useMemo(() => {
		return notes.map((note) => ({
			_id: note._id,
			title: note.title,
			content: note.content,
			tags: note.tags,
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
		}));
	}, [notes]);

	const memoizedToggleCollapse = useCallback(() => {
		setSidebarCollapsed(!sidebarCollapsed);
	}, [sidebarCollapsed]);

	// Auto-save status derived from typing/unsaved state
	const autoSaveStatus = useMemo<"saving" | "saved" | null>(() => {
		if (isTyping) return "saving";
		if (!hasUnsavedChanges && activeNote) return "saved";
		return null;
	}, [isTyping, hasUnsavedChanges, activeNote]);

	return (
		<div
			className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-background" : "flex-col"}`}
			ref={pageContainerRef}
		>
			<div className="flex flex-1 min-h-0 overflow-hidden">
				{/* Sidebar — hidden in fullscreen */}
				{!isFullScreen && (
					<LiveSidebar
						channelId={channelId}
						collapsed={sidebarCollapsed}
						disableCreate={noteLimitReached}
						items={memoizedItems}
						onCreateItem={onCreateNote}
						onDeleteItem={handleDeleteItem}
						onItemSelect={handleItemSelect}
						onRenameItem={handleRenameItem}
						onToggleCollapse={memoizedToggleCollapse}
						selectedItemId={activeNoteId}
						type="notes"
						workspaceId={workspaceId}
					/>
				)}

				{/* Main Content Area */}
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Live Header — always visible, never scrolls away */}
					<div className="flex-none">
						<LiveHeader
							autoSaveStatus={autoSaveStatus}
							createdAt={activeNote?.createdAt}
							hasUnsavedChanges={hasUnsavedChanges}
							isFullScreen={isFullScreen}
							lastSaved={activeNote?.updatedAt}
							onExport={memoizedOnExport}
							onSave={handleSave}
							onShare={activeNote ? memoizedOnShare : undefined}
							onTagsChange={memoizedOnTagsChange}
							onTitleChange={handleNoteTitleChange}
							showFullScreenToggle
							showTags
							tags={activeNote?.tags || []}
							title={
								isTyping ? localTitle : activeNote?.title || "Untitled Note"
							}
							toggleFullScreen={memoizedToggleFullScreen}
							type="notes"
							updatedAt={activeNote?.updatedAt}
						/>
					</div>

					{/* Editor — fills remaining space */}
					<div className="flex-1 min-h-0 overflow-hidden">
						{memoizedNote && activeNoteId ? (
							<BlockNoteNotesEditor
								isFullScreen={isFullScreen}
								isLoading={false}
								note={memoizedNote}
							/>
						) : activeNoteId ? (
							// A note is selected but its content is still loading — show a
							// quiet loader rather than flashing the empty-state CTA.
							<div className="flex size-full items-center justify-center">
								<div className="flex flex-col items-center gap-3 text-muted-foreground">
									<Loader2 className="size-6 animate-spin text-primary" />
									<span className="text-sm">Loading note…</span>
								</div>
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								<div className="text-center space-y-4 max-w-sm px-4">
									<div className="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
										<FileText className="size-8 text-primary" />
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-1 text-foreground">
											No note selected
										</h3>
										<p className="text-sm text-muted-foreground">
											Choose a note from the sidebar, or start a new one below.
										</p>
									</div>
									<Button
										className="gap-2"
										onClick={() => {
											onCreateNote(true).catch((error) => {
												console.error("Failed to create note:", error);
												toast.error("Failed to create note");
											});
										}}
										variant="primary"
									>
										<Brain className="size-4" />
										Start AI Meeting Note
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Audio Room */}
			{activeNote && (
				<StreamAudioRoom
					canvasName={activeNote.title || "Notes Audio Room"}
					channelId={channelId}
					initialShowNotes={activeNote.tags?.includes("AI")}
					isFullScreen={isFullScreen}
					key={activeNote._id}
					roomId={activeNote._id}
					workspaceId={workspaceId}
				/>
			)}

			{/* Export Dialog */}
			{activeNote && (
				<ExportNoteDialog
					isOpen={showExportDialog}
					note={activeNote}
					onClose={() => setShowExportDialog(false)}
				/>
			)}

			{/* Share Dialog — public / password-protected link */}
			{activeNote && (
				<ShareNoteDialog
					isOpen={showShareDialog}
					noteId={activeNote._id}
					noteTitle={activeNote.title}
					onClose={() => setShowShareDialog(false)}
				/>
			)}
		</div>
	);
};
