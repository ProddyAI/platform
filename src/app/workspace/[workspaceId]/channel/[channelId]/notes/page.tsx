"use client";

import { useMutation, useQuery } from "convex/react";
import { FileText, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveblocksRoom } from "@/features/live";
import type { Note } from "@/features/notes/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { NotesContent } from "./notes-content";

const NotesPage = () => {
	const params = useParams();
	const workspaceId = params.workspaceId as Id<"workspaces">;
	const channelId = params.channelId as Id<"channels">;

	// State
	const [activeNoteId, setActiveNoteId] = useState<Id<"notes"> | null>(null);
	const [_sidebarCollapsed, _setSidebarCollapsed] = useState(false);
	const [_searchQuery, _setSearchQuery] = useState("");
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [showExportDialog, setShowExportDialog] = useState(false);

	// Ref for fullscreen container
	const pageContainerRef = useRef<HTMLDivElement>(null);

	// Get channel information for the title
	const channel = useQuery(api.channels.getById, { id: channelId });

	// Set document title based on channel name
	useDocumentTitle(channel ? `Notes - ${channel.name}` : "Notes");

	// Convex queries
	const notes = useQuery(api.notes.list, { workspaceId, channelId }) || [];

	// Get active note
	const activeNote = useQuery(
		api.notes.get,
		activeNoteId ? { id: activeNoteId } : "skip"
	);

	// Convex mutations
	const createNote = useMutation(api.notes.create);
	const updateNote = useMutation(api.notes.update);
	const deleteNote = useMutation(api.notes.remove);

	// Handle note updates
	const handleNoteUpdate = async (
		noteId: Id<"notes">,
		updates: Partial<Note>
	) => {
		try {
			await updateNote({
				id: noteId,
				...updates,
			});
			// Removed toast notification for better UX
		} catch (error) {
			console.error("Failed to update note:", error);
			toast.error("Failed to update note");
		}
	};

	// Handle note selection
	const handleNoteSelect = (noteId: Id<"notes">) => {
		setActiveNoteId(noteId);
	};

	// Handle note creation
	const handleCreateNote = async () => {
		try {
			const defaultTitle = "Untitled Note";
			const defaultContent = ""; // Empty content for BlockNote

			// Create the note in Convex
			const noteId = await createNote({
				title: defaultTitle,
				content: defaultContent,
				workspaceId,
				channelId,
				tags: [], // Initialize with empty tags
			});

			if (noteId) {
				setActiveNoteId(noteId);
				toast.success("Note created");
			}
		} catch (error) {
			console.error("Failed to create note:", error);
			toast.error("Failed to create note");
		}
	};

	// Handle note deletion
	const handleDeleteNote = async (noteId: Id<"notes">) => {
		if (window.confirm("Are you sure you want to delete this note?")) {
			try {
				await deleteNote({ id: noteId });
				toast.success("Note deleted successfully");
				// If the deleted note was active, clear the selection
				if (activeNoteId === noteId) {
					setActiveNoteId(null);
				}
			} catch (error) {
				toast.error("Failed to delete note");
				console.error("Error deleting note:", error);
			}
		}
	};

	// Show empty state if no notes and no folders
	if (notes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<div className="text-center">
					<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
					<h3 className="text-lg font-medium mb-2">No notes yet</h3>
					<p className="text-sm mb-4">Create your first note to get started</p>
					<Button onClick={() => handleCreateNote()}>
						<Plus className="h-4 w-4 mr-2" />
						Create Note
					</Button>
				</div>
			</div>
		);
	}

	// Wrap the entire notes UI in LiveblocksRoom for Liveblocks presence
	return (
		<>
			{activeNote?._id ? (
				<LiveblocksRoom
					roomId={`note-${activeNote._id}`}
					roomType="note"
				>
					<NotesContent
						workspaceId={workspaceId}
						channelId={channelId}
						activeNoteId={activeNoteId}
						activeNote={activeNote || null}
						notes={notes}
						isFullScreen={isFullScreen}
						setIsFullScreen={setIsFullScreen}
						showExportDialog={showExportDialog}
						setShowExportDialog={setShowExportDialog}
						pageContainerRef={pageContainerRef}
						onNoteSelect={handleNoteSelect}
						onCreateNote={handleCreateNote}
						onDeleteNote={handleDeleteNote}
						onUpdateNote={handleNoteUpdate}
					/>
				</LiveblocksRoom>
			) : (
				<NotesContent
					workspaceId={workspaceId}
					channelId={channelId}
					activeNoteId={activeNoteId}
					activeNote={activeNote || null}
					notes={notes}
					isFullScreen={isFullScreen}
					setIsFullScreen={setIsFullScreen}
					showExportDialog={showExportDialog}
					setShowExportDialog={setShowExportDialog}
					pageContainerRef={pageContainerRef}
					onNoteSelect={handleNoteSelect}
					onCreateNote={handleCreateNote}
					onDeleteNote={handleDeleteNote}
					onUpdateNote={handleNoteUpdate}
				/>
			)}
		</>
	);
};

export default NotesPage;
