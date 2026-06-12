"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Brain,
	FileText,
	Loader,
	Plus,
	Sparkles,
	TriangleAlert,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { LimitIndicator } from "@/components/limit-indicator";
import { Button } from "@/components/ui/button";
import { LiveblocksRoom } from "@/features/live";
import type { Note } from "@/features/notes/types";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceLimit } from "@/hooks/use-workspace-limit";
import { NotesContent } from "./notes-content";

// Stable empty reference so the notes effect doesn't re-run every render while
// the query is still loading (`notes` is undefined).
const EMPTY_NOTES: Note[] = [];

const NotesPage = () => {
	const params = useParams();
	const searchParams = useSearchParams();
	const workspaceId = params?.workspaceId as Id<"workspaces"> | undefined;
	const channelId = params?.channelId as Id<"channels"> | undefined;
	const { maxReached: noteLimitReached } = useWorkspaceLimit("note");

	// Get noteId from URL if present
	const urlNoteId = searchParams.get("noteId") as Id<"notes"> | null;

	// State
	const [activeNoteId, setActiveNoteId] = useState<Id<"notes"> | null>(
		urlNoteId
	);
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	// Ref for fullscreen container
	const pageContainerRef = useRef<HTMLDivElement>(null);

	// Channel info for the title
	const channel = useQuery(
		api.channels.getById,
		channelId ? { id: channelId } : "skip"
	);
	useDocumentTitle(channel ? `Notes — ${channel.name}` : "Notes");

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

	const finalNotes = notes ?? EMPTY_NOTES;

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
					<h3 className="text-lg font-medium mb-2">
						Workspace context missing
					</h3>
					<p className="text-sm mb-6">
						We couldn't determine which workspace or channel you're in. This can
						happen after a session timeout or direct link mismatch.
					</p>
					<Button
						className="w-full"
						onClick={() => (window.location.href = "/workspace")}
						variant="outline"
					>
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
		} catch (error) {
			console.error("Failed to update note:", error);
			toast.error("Failed to update note");
		}
	};

	const handleNoteSelect = (noteId: Id<"notes">) => {
		setActiveNoteId(noteId);
	};

	const handleCreateNote = async (isAI = false) => {
		if (isCreating) return;
		if (noteLimitReached) {
			toast.error(
				"Note limit reached. Upgrade your plan to create more notes."
			);
			return;
		}
		setIsCreating(true);
		try {
			const noteId = await createNote({
				title: isAI ? "AI Meeting Note" : "Untitled Note",
				content: "",
				workspaceId,
				channelId,
				tags: isAI ? ["Meeting", "AI"] : [],
				icon: isAI ? "🤖" : "📝",
			});

			if (noteId) {
				setActiveNoteId(noteId);
				toast.success("Note created");
			}
		} catch (error) {
			console.error("Failed to create note:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to create note: ${message}`);
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

	// Empty state — no notes at all
	if (finalNotes.length === 0) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center space-y-5 max-w-sm px-6">
					{noteLimitReached && (
						<div className="mb-4 flex items-center justify-between rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-500">
							<span>You have reached the note limit for your plan.</span>
							<LimitIndicator featureLabel="Notes" />
						</div>
					)}
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
						<div className="flex flex-col sm:flex-row gap-3 justify-center">
							<Button
								disabled={isCreating || noteLimitReached}
								onClick={() => handleCreateNote()}
								variant="outline"
							>
								<Plus className="h-4 w-4 mr-2" />
								{noteLimitReached ? "Limit Reached" : "Standard Note"}
							</Button>
							<Button
								className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-lg"
								disabled={isCreating || noteLimitReached}
								onClick={() => handleCreateNote(true)}
							>
								<Brain className="h-4 w-4" />
								AI Meeting Note
							</Button>
						</div>
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
		<LiveblocksRoom roomId={channelId} roomType="note">
			<div
				className="flex h-full w-full overflow-hidden"
				ref={pageContainerRef}
			>
				<NotesContent
					activeNote={activeNote || null}
					activeNoteId={activeNoteId}
					channelId={channelId}
					isFullScreen={isFullScreen}
					noteLimitReached={noteLimitReached}
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
