"use client";

import { Brain, FileText } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { StreamAudioRoom } from "@/features/audio";
import { LiveHeader, LiveSidebar } from "@/features/live";
import {
	BlockNoteNotesEditor,
	ExportNoteDialog,
	useLiveNoteSession,
} from "@/features/notes";
import type { Note } from "@/features/notes/types";
import { useNoteContent } from "@/hooks/use-note-content";

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
						items={memoizedItems}
						onCreateItem={onCreateNote}
						onDeleteItem={handleDeleteItem}
						onItemSelect={handleItemSelect}
						onRenameItem={handleRenameItem}
						onToggleCollapse={memoizedToggleCollapse}
						selectedItemId={activeNoteId}
						type="notes"
						workspaceId={workspaceId}
						disableCreate={noteLimitReached}
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
							onTagsChange={memoizedOnTagsChange}
							onTitleChange={handleNoteTitleChange}
							showFullScreenToggle={true}
							showTags={true}
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
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								<div className="text-center space-y-4 max-w-sm px-4">
									<div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center">
										<FileText className="h-8 w-8 text-violet-500 dark:text-violet-400" />
									</div>
									<div>
										<h3 className="text-lg font-semibold mb-1">
											No note selected
										</h3>
										<p className="text-sm text-muted-foreground">
											Choose a note from the sidebar or create a new one to
											start writing.
										</p>
									</div>
									<Button
										className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg"
										onClick={() => {
											onCreateNote(true).catch((error) => {
												console.error("Failed to create note:", error);
												toast.error("Failed to create note");
											});
										}}
									>
										<Brain className="h-4 w-4" />
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
		</div>
	);
};
