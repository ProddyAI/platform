"use client";

import { useMutation, useQuery } from "convex/react";
import { FileText, Plus, Brain, Loader, TriangleAlert } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
	const searchParams = useSearchParams();
	const workspaceId = (params?.workspaceId as Id<"workspaces">) || (params as any)?.workspaceId;
	const channelId = (params?.channelId as Id<"channels">) || (params as any)?.channelId;

	// Get noteId from URL if present
	const urlNoteId = searchParams.get("noteId") as Id<"notes"> | null;

	// State
	const [activeNoteId, setActiveNoteId] = useState<Id<"notes"> | null>(urlNoteId);
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
	const notes = useQuery(
		api.notes.getByChannel,
		workspaceId && channelId ? { workspaceId, channelId } : "skip"
	);

	// Get active note
	const activeNote = useQuery(
		api.notes.get,
		activeNoteId ? { id: activeNoteId } : "skip"
	);

	const finalNotes = notes || [];

	useEffect(() => {
		// If we have a noteId in the URL but it's not the active one, sync it
		if (urlNoteId && urlNoteId !== activeNoteId) {
			setActiveNoteId(urlNoteId);
			return;
		}

		// If no active note is selected yet and notes are loaded, select the first one
		if (!activeNoteId && finalNotes.length > 0) {
			setActiveNoteId(finalNotes[0]._id);
			return;
		}

		// If the active note was deleted, select the first available note
		if (activeNoteId && finalNotes.length > 0) {
			const stillExists = finalNotes.some((note) => note._id === activeNoteId);
			if (!stillExists) {
				setActiveNoteId(finalNotes[0]._id);
			}
		}
	}, [activeNoteId, finalNotes, urlNoteId]);

	// Convex mutations
	const createNote = useMutation(api.notes.create);
	const updateNote = useMutation(api.notes.update);
	const deleteNote = useMutation(api.notes.remove);

	// Loading check
	if (notes === undefined && workspaceId && channelId) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex flex-col items-center gap-y-4">
					<Loader className="size-6 animate-spin text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Loading notes...</p>
				</div>
			</div>
		);
	}

	// Handle missing IDs case
	if (!workspaceId || !channelId) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground p-4">
				<div className="text-center max-w-md">
					<TriangleAlert className="h-10 w-10 mx-auto mb-4 text-amber-500" />
					<h3 className="text-lg font-medium mb-2">Workspace context missing</h3>
					<p className="text-sm mb-6">
						We couldn't determine which workspace or channel you're in. 
						This can happen after a session timeout or direct link mismatch.
					</p>
					<Button onClick={() => window.location.href = "/workspace"} variant="outline" className="w-full">
						Go to Workspaces
					</Button>
				</div>
			</div>
		);
	}

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
	const handleCreateNote = async (isAI = false) => {
		try {
			const defaultTitle = isAI ? "AI Meeting Note" : "Untitled Note";
			const defaultContent = ""; // Empty content for BlockNote

			// Create the note in Convex
			const noteId = await createNote({
				title: defaultTitle,
				content: defaultContent,
				workspaceId,
				channelId,
				tags: isAI ? ["Meeting", "AI"] : [], // Initialize with empty tags
				icon: isAI ? "🤖" : "📝",
			});

			if (noteId) {
				setActiveNoteId(noteId);
				toast.success("Note created");
			}
		} catch (error: any) {
			console.error("Failed to create note:", error);
			toast.error(`Failed to create note: ${error?.message || "Unknown error"}`);
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
	if (finalNotes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<div className="text-center">
					<FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
					<h3 className="text-lg font-medium mb-2">No notes yet</h3>
					<p className="text-sm mb-4">Create your first note to get started</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Button onClick={() => handleCreateNote()} variant="outline">
							<Plus className="h-4 w-4 mr-2" />
							Standard Note
						</Button>
						<Button 
							onClick={() => handleCreateNote(true)} 
							className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg"
						>
							<Brain className="h-4 w-4 mr-2" />
							AI Meeting Note
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Wrap the entire notes UI in LiveblocksRoom for Liveblocks presence
	return (
		<LiveblocksRoom
			roomId={channelId}
			roomType="note"
		>
			<div className="flex h-full w-full overflow-hidden" ref={pageContainerRef}>
				<NotesContent
					activeNote={activeNote || null}
					activeNoteId={activeNoteId}
					channelId={channelId}
					isFullScreen={isFullScreen}
					notes={finalNotes}
					onCreateNote={handleCreateNote}
					onDeleteNote={handleDeleteNote}
					onNoteSelect={handleNoteSelect}
					onUpdateNote={handleNoteUpdate}
					pageContainerRef={pageContainerRef}
					setIsFullScreen={setIsFullScreen}
					setShowExportDialog={setShowExportDialog}
					showExportDialog={showExportDialog}
					workspaceId={workspaceId}
				/>
			</div>
		</LiveblocksRoom>
	);
};

export default NotesPage;
