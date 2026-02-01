"use client";

import { FileText, Plus } from "lucide-react";
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
	onCreateNote: () => Promise<void>;
	onDeleteNote: (noteId: Id<"notes">) => Promise<void>;
	onUpdateNote: (noteId: Id<"notes">, updates: Partial<Note>) => Promise<void>;
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
}: NotesContentProps) => {
	// Local state for sidebar
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	// Live note session hook - now inside RoomProvider context
	// Use a stable dummy ID that exists in the database to avoid server errors
	const dummyNoteId = "kn7cvx952gp794j4vzvxxqqgk57k9yhh" as Id<"notes">;
	const _liveSession = useLiveNoteSession({
		noteId: activeNoteId || dummyNoteId,
		noteTitle: activeNote?.title || "Untitled",
		workspaceId,
		channelId,
		autoAnnounce: !!activeNoteId, // Only auto-announce when there's an active note
	});

	// Create a wrapper function that matches the hook's expected signature
	const handleUpdate = useCallback(
		async (updates: Partial<Note>) => {
			if (!activeNoteId) return;
			await onUpdateNote(activeNoteId, updates);
		},
		[activeNoteId, onUpdateNote]
	);

	// Note content management
	const {
		localContent,
		localTitle,
		isTyping,
		handleContentChange: handleNoteContentChange,
		handleTitleChange: handleNoteTitleChange,
		hasUnsavedChanges,
	} = useNoteContent({
		note: activeNote || undefined,
		onUpdate: handleUpdate,
		debounceMs: 1000,
	});

	// Handle save
	const handleSave = useCallback(async () => {
		if (!activeNoteId) return;
		try {
			await handleUpdate({ content: localContent });
			toast.success("Note saved successfully");
		} catch (error) {
			console.error("Failed to save note:", error);
			toast.error("Failed to save note");
		}
	}, [activeNoteId, localContent, handleUpdate]);

	// Create wrapper for onItemSelect to match LiveSidebar's expected signature
	const handleItemSelect = useCallback(
		(itemId: string) => {
			onNoteSelect(itemId as Id<"notes">);
		},
		[onNoteSelect]
	);

	// Create wrapper for onDeleteItem to match LiveSidebar's expected signature
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

	// Create wrapper for onRenameItem to match LiveSidebar's expected signature
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

	// Memoize the note object to prevent unnecessary re-renders
	const memoizedNote = useMemo(() => {
		if (!activeNote) return null;
		return {
			...activeNote,
			title: isTyping ? localTitle : activeNote.title,
			content: isTyping ? localContent : activeNote.content,
		};
	}, [activeNote, isTyping, localTitle, localContent]);

	// Memoize the update callback to prevent re-renders
	const memoizedOnUpdate = useCallback(
		(updates: Partial<Note>) => {
			handleUpdate(updates).catch((error) => {
				console.error("Failed to update note:", error);
				toast.error("Failed to update note");
			});
		},
		[handleUpdate]
	);

	// Memoize the fullscreen toggle to prevent re-renders
	const memoizedToggleFullScreen = useCallback(() => {
		setIsFullScreen(!isFullScreen);
	}, [isFullScreen, setIsFullScreen]);

	// Memoize the export callback
	const memoizedOnExport = useCallback(() => {
		setShowExportDialog(true);
	}, [setShowExportDialog]);

	// Memoize the tags change callback
	const memoizedOnTagsChange = useCallback(
		(tags: string[]) => {
			handleUpdate({ tags }).catch((error) => {
				console.error("Failed to update tags:", error);
				toast.error("Failed to update tags");
			});
		},
		[handleUpdate]
	);

	// Memoize the items array to prevent unnecessary re-renders of LiveSidebar
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

	// Memoize the sidebar toggle callback
	const memoizedToggleCollapse = useCallback(() => {
		setSidebarCollapsed(!sidebarCollapsed);
	}, [sidebarCollapsed]);

	return (
		<div
			className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-white" : "flex-col"}`}
			ref={pageContainerRef}
		>
			<div className="flex flex-1 overflow-hidden">
				{/* Enhanced Sidebar with categories - hidden in fullscreen */}
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
					/>
				)}

				{/* Main Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden dark:bg-[hsl(var(--card-accent))]">
					{/* Live Header - always visible */}
					<LiveHeader
						createdAt={activeNote?.createdAt}
						hasUnsavedChanges={hasUnsavedChanges}
						isFullScreen={isFullScreen}
						onExport={memoizedOnExport}
						onSave={handleSave}
						onTagsChange={memoizedOnTagsChange}
						onTitleChange={handleNoteTitleChange}
						showFullScreenToggle={true}
						showTags={true}
						tags={activeNote?.tags || []}
						title={isTyping ? localTitle : activeNote?.title || "Untitled Note"}
						toggleFullScreen={memoizedToggleFullScreen}
						type="notes"
						updatedAt={activeNote?.updatedAt}
					/>

					{/* Notes Editor */}
					<div className="flex-1 overflow-hidden">
						{memoizedNote && activeNoteId ? (
							<BlockNoteNotesEditor
								channelId={channelId}
								isFullScreen={isFullScreen}
								isLoading={isTyping || hasUnsavedChanges}
								note={memoizedNote}
								onContentChange={handleNoteContentChange}
								onSaveNote={handleSave}
								onTitleChange={handleNoteTitleChange}
								onUpdate={memoizedOnUpdate}
								toggleFullScreen={memoizedToggleFullScreen}
								workspaceId={workspaceId}
							/>
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								<div className="text-center">
									<FileText className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
									<div className="text-lg font-medium mb-2">
										No note selected
									</div>
									<div className="text-sm mb-4">
										Select a note from the sidebar or create a new one
									</div>
									<Button
										className="gap-2"
										onClick={() => {
											onCreateNote().catch((error) => {
												console.error("Failed to create note:", error);
												toast.error("Failed to create note");
											});
										}}
									>
										<Plus className="h-4 w-4" />
										Create Note
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Audio Room Component */}
			{activeNote && (
				<StreamAudioRoom
					canvasName={activeNote.title || "Notes Audio Room"}
					channelId={channelId}
					isFullScreen={isFullScreen}
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
