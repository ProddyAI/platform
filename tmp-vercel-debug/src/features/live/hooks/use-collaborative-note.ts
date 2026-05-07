import { LiveMap, LiveObject } from "@liveblocks/client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { useMutation, useStorage } from "@/../liveblocks.config";
import type { Note } from "@/features/notes/types";

interface CollaborativeNoteData {
	[key: string]: any; // Index signature for Liveblocks compatibility
	content: string;
	title: string;
	lastModified: number;
	lastModifiedBy: string;
}

interface UseCollaborativeNoteOptions {
	noteId: Id<"notes"> | string;
	initialNote?: Note;
	onDatabaseSave?: (updates: Partial<Note>) => Promise<void>;
	autoSaveInterval?: number;
}

interface UseCollaborativeNoteReturn {
	content: string;
	title: string;
	isLoading: boolean;
	updateContent: (content: string) => void;
	updateTitle: (title: string) => void;
	saveToDatabase: () => Promise<void>;
	hasUnsavedChanges: boolean;
	lastSaved: Date | null;
}

export const useCollaborativeNote = ({
	noteId,
	initialNote,
	onDatabaseSave,
	autoSaveInterval = 30000, // 30 seconds
}: UseCollaborativeNoteOptions): UseCollaborativeNoteReturn => {
	const [isLoading, setIsLoading] = useState(true);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastDatabaseSaveRef = useRef<string>("");

	// Get the collaborative note data from Liveblocks storage
	const noteData = useStorage((root) => {
		const noteKey = `note-${noteId}`;
		return root.collaborativeNotes?.get(noteKey);
	});

	// Mutation to update the collaborative note in Liveblocks
	const updateNoteData = useMutation(
		({ storage }, updates: Partial<CollaborativeNoteData>) => {
			let collaborativeNotes = storage.get("collaborativeNotes");
			if (!collaborativeNotes) {
				collaborativeNotes = new LiveMap();
				storage.set("collaborativeNotes", collaborativeNotes);
			}

			const noteKey = `note-${noteId}`;
			const currentData = collaborativeNotes.get(noteKey);

			if (currentData) {
				// Update existing note with type-safe approach
				if (updates.content !== undefined) {
					currentData.set("content", updates.content);
				}
				if (updates.title !== undefined) {
					currentData.set("title", updates.title);
				}
				if (updates.lastModified !== undefined) {
					currentData.set("lastModified", updates.lastModified);
				}
				if (updates.lastModifiedBy !== undefined) {
					currentData.set("lastModifiedBy", updates.lastModifiedBy);
				}
			} else {
				// Create new collaborative note
				const newNoteData = new LiveObject({
					content: initialNote?.content || "",
					title: initialNote?.title || "Untitled",
					lastModified: Date.now(),
					lastModifiedBy: "current-user", // This should be replaced with actual user ID
					...updates,
				});
				collaborativeNotes.set(noteKey, newNoteData);
			}
		},
		[noteId, initialNote]
	);

	// Initialize the collaborative note if it doesn't exist
	useEffect(() => {
		if (!noteData && initialNote) {
			updateNoteData({
				content: initialNote.content,
				title: initialNote.title,
				lastModified: Date.now(),
				lastModifiedBy: "current-user",
			});
		}
		setIsLoading(false);
	}, [noteData, initialNote, updateNoteData]);

	// Auto-save to database
	const saveToDatabase = useCallback(async () => {
		if (!noteData || !onDatabaseSave) return;

		const currentContent = JSON.stringify({
			content: noteData.content,
			title: noteData.title,
		});

		// Only save if content has changed since last database save
		if (currentContent === lastDatabaseSaveRef.current) {
			return;
		}

		try {
			await onDatabaseSave({
				content: noteData.content,
				title: noteData.title,
				updatedAt: Date.now(),
			});

			lastDatabaseSaveRef.current = currentContent;
			setLastSaved(new Date());
			setHasUnsavedChanges(false);
		} catch (error) {
			console.error("Failed to save to database:", error);
		}
	}, [noteData, onDatabaseSave]);

	// Set up auto-save
	useEffect(() => {
		if (!noteData) return;

		const currentContent = JSON.stringify({
			content: noteData.content,
			title: noteData.title,
		});

		// Check if content has changed
		if (currentContent !== lastDatabaseSaveRef.current) {
			setHasUnsavedChanges(true);

			// Clear existing timeout
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}

			// Set new timeout for auto-save
			autoSaveTimeoutRef.current = setTimeout(() => {
				saveToDatabase();
			}, autoSaveInterval);
		}

		return () => {
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, [
		noteData?.content,
		noteData?.title,
		saveToDatabase,
		autoSaveInterval,
		noteData,
	]);

	// Update content
	const updateContent = useCallback(
		(content: string) => {
			updateNoteData({
				content,
				lastModified: Date.now(),
				lastModifiedBy: "current-user",
			});
		},
		[updateNoteData]
	);

	// Update title
	const updateTitle = useCallback(
		(title: string) => {
			updateNoteData({
				title,
				lastModified: Date.now(),
				lastModifiedBy: "current-user",
			});
		},
		[updateNoteData]
	);

	return {
		content: noteData?.content || initialNote?.content || "",
		title: noteData?.title || initialNote?.title || "Untitled",
		isLoading,
		updateContent,
		updateTitle,
		saveToDatabase,
		hasUnsavedChanges,
		lastSaved,
	};
};
