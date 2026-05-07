import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/features/notes/types";

interface UseNoteContentOptions {
	note: Note | undefined;
	onUpdate: (updates: Partial<Note>) => Promise<void>;
	debounceMs?: number;
}

interface UseNoteContentReturn {
	localContent: string;
	localTitle: string;
	isTyping: boolean;
	handleContentChange: (content: string) => void;
	handleTitleChange: (title: string) => void;
	forceSync: () => void;
	hasUnsavedChanges: boolean;
}

export const useNoteContent = ({
	note,
	onUpdate,
	debounceMs = 1000,
}: UseNoteContentOptions): UseNoteContentReturn => {
	// Local state for immediate UI updates
	const [localContent, setLocalContent] = useState(note?.content || "");
	const [localTitle, setLocalTitle] = useState(note?.title || "");
	const [isTyping, setIsTyping] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// Refs for managing state
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedContentRef = useRef(note?.content || "");
	const lastSavedTitleRef = useRef(note?.title || "");
	const isLocalChangeRef = useRef(false);

	// Sync with remote note when it changes (but not during typing)
	useEffect(() => {
		if (!note) return;

		// Only sync if we're not currently typing and the change came from remote
		if (!isTyping && !isLocalChangeRef.current) {
			const contentChanged = note.content !== lastSavedContentRef.current;
			const titleChanged = note.title !== lastSavedTitleRef.current;

			if (contentChanged || titleChanged) {
				// Check if local content differs significantly from remote
				const localContentDiffers = localContent !== note.content;
				const localTitleDiffers = localTitle !== note.title;

				// Only update if there are no unsaved changes or if the remote change is newer
				if (
					!hasUnsavedChanges ||
					(!localContentDiffers && !localTitleDiffers)
				) {
					setLocalContent(note.content || "");
					setLocalTitle(note.title || "");
					lastSavedContentRef.current = note.content || "";
					lastSavedTitleRef.current = note.title || "";
					setHasUnsavedChanges(false);
				}
			}
		}

		// Reset the local change flag
		isLocalChangeRef.current = false;
	}, [
		note?.content,
		note?.title,
		note?._id,
		isTyping,
		hasUnsavedChanges,
		localTitle,
		localContent,
		note,
	]);

	// Debounced save function
	const debouncedSave = useCallback(
		async (updates: Partial<Note>) => {
			if (!note) return;

			try {
				isLocalChangeRef.current = true;
				await onUpdate(updates);

				// Update our tracking refs
				if (updates.content !== undefined) {
					lastSavedContentRef.current = updates.content;
				}
				if (updates.title !== undefined) {
					lastSavedTitleRef.current = updates.title;
				}

				setHasUnsavedChanges(false);
				setIsTyping(false);
			} catch (error) {
				console.error("Failed to save note:", error);
				setIsTyping(false);
			}
		},
		[note, onUpdate]
	);

	// Handle content changes
	const handleContentChange = useCallback(
		(content: string) => {
			setLocalContent(content);
			setIsTyping(true);
			setHasUnsavedChanges(true);

			// Clear existing timeout
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			// Set new timeout for debounced save
			saveTimeoutRef.current = setTimeout(() => {
				debouncedSave({ content });
			}, debounceMs);
		},
		[debouncedSave, debounceMs]
	);

	// Handle title changes
	const handleTitleChange = useCallback(
		(title: string) => {
			setLocalTitle(title);
			setIsTyping(true);
			setHasUnsavedChanges(true);

			// Clear existing timeout
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			// Set new timeout for debounced save
			saveTimeoutRef.current = setTimeout(() => {
				debouncedSave({ title });
			}, debounceMs);
		},
		[debouncedSave, debounceMs]
	);

	// Force sync with remote state
	const forceSync = useCallback(() => {
		if (!note) return;

		setLocalContent(note.content || "");
		setLocalTitle(note.title || "");
		lastSavedContentRef.current = note.content || "";
		lastSavedTitleRef.current = note.title || "";
		setHasUnsavedChanges(false);
		setIsTyping(false);

		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
	}, [note]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	return {
		localContent,
		localTitle,
		isTyping,
		handleContentChange,
		handleTitleChange,
		forceSync,
		hasUnsavedChanges,
	};
};
