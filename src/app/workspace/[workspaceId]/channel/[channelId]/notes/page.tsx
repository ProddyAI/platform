"use client";

import { useMutation, useQuery } from "convex/react";
import { FileText, Loader2, Plus, Sparkles } from "lucide-react";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	// Ref for fullscreen container
	const pageContainerRef = useRef<HTMLDivElement>(null);

	// Channel info for the title
	const channel = useQuery(api.channels.getById, { id: channelId });
	useDocumentTitle(channel ? `Notes — ${channel.name}` : "Notes");

	// Convex queries — `undefined` means still loading; `null/[]` means no data
	const notesQuery = useQuery(api.notes.list, { workspaceId, channelId });
	const isLoadingNotes = notesQuery === undefined;
	const notes = notesQuery ?? [];

	// Get active note
	const activeNote = useQuery(
		api.notes.get,
		activeNoteId ? { id: activeNoteId } : "skip"
	);

	// Auto-select first note when list loads or active note is deleted
	useEffect(() => {
		if (notes.length > 0 && !activeNoteId) {
			setActiveNoteId(notes[0]._id);
		}
	}, [notes, activeNoteId]);

	// Clear active note if it no longer exists
	useEffect(() => {
		if (!activeNoteId) return;
		const stillExists = notes.some((note) => note._id === activeNoteId);
		if (!stillExists && notes.length > 0) {
			setActiveNoteId(notes[0]._id);
		} else if (!stillExists) {
			setActiveNoteId(null);
		}
	}, [activeNoteId, notes]);

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
		} catch (error) {
			console.error("Failed to update note:", error);
			toast.error("Failed to update note");
		}
	};

	const handleNoteSelect = (noteId: Id<"notes">) => {
		setActiveNoteId(noteId);
	};

	const handleCreateNote = async () => {
		if (isCreating) return;
		setIsCreating(true);
		try {
			const noteId = await createNote({
				title: "Untitled Note",
				content: "",
				workspaceId,
				channelId,
				tags: [],
			});

			if (noteId) {
				setActiveNoteId(noteId);
				toast.success("Note created");
			}
		} catch (error) {
			console.error("Failed to create note:", error);
			toast.error("Failed to create note");
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteNote = async (noteId: Id<"notes">) => {
		if (window.confirm("Are you sure you want to delete this note?")) {
			try {
				await deleteNote({ id: noteId });
				toast.success("Note deleted");
				if (activeNoteId === noteId) {
					setActiveNoteId(null);
				}
			} catch (error) {
				toast.error("Failed to delete note");
				console.error("Error deleting note:", error);
			}
		}
	};

	// Loading state — notes query hasn't resolved yet
	if (isLoadingNotes) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-violet-500" />
			</div>
		);
	}

	// Empty state — no notes at all
	if (notes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center space-y-5 max-w-sm px-6">
					<div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 flex items-center justify-center shadow-sm">
						<FileText className="h-10 w-10 text-violet-500 dark:text-violet-400" />
					</div>
					<div>
						<h3 className="text-xl font-semibold mb-2">No notes yet</h3>
						<p className="text-sm text-muted-foreground leading-relaxed">
							Create your first note and start writing. AI-powered actions will
							help you clean, summarize, and transform your content.
						</p>
					</div>
					<div className="flex flex-col items-center gap-3">
						<Button
							className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-0 px-6"
							disabled={isCreating}
							onClick={handleCreateNote}
						>
							<Plus className="h-4 w-4" />
							{isCreating ? "Creating..." : "Create First Note"}
						</Button>
						<p className="text-xs text-muted-foreground flex items-center gap-1.5">
							<Sparkles className="h-3 w-3 text-violet-500" />
							Powered by AI
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<LiveblocksRoom
			roomId={`note-${activeNote?._id || channelId}`}
			roomType="note"
		>
			<NotesContent
				activeNote={activeNote || null}
				activeNoteId={activeNoteId}
				channelId={channelId}
				isFullScreen={isFullScreen}
				notes={notes}
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
		</LiveblocksRoom>
	);
};

export default NotesPage;
