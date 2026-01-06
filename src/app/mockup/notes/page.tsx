"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import {
	TestLiveCursors,
	TestNavigation,
	TestNotesEditor,
	TestNotesHeader,
	TestNotesSidebar,
	useTestLiveCursors,
} from "@/app/mockup/components";
import { TEST_NOTES } from "@/app/mockup/data/shared-test-data";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

const TestNotesPage = () => {
	useDocumentTitle("Notes");
	const { showCursors } = useTestLiveCursors(true);

	const [selectedNoteId, setSelectedNoteId] = useState<string | null>("note-1");
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [notes, setNotes] = useState(TEST_NOTES as any[]);

	const selectedNote = notes.find((note) => note.id === selectedNoteId);

	const handleNoteSelect = (noteId: string) => {
		setSelectedNoteId(noteId);
	};

	const handleNoteUpdate = (
		noteId: string,
		updates: Partial<typeof selectedNote>
	) => {
		setNotes((prev) =>
			prev.map((note) => (note.id === noteId ? { ...note, ...updates } : note))
		);
	};

	const handleCreateNote = () => {
		const newNote = {
			id: `note-${Date.now()}`,
			title: "Untitled Note",
			content: "",
			createdAt: new Date(),
			updatedAt: new Date(),
			tags: [],
			folder: "General",
			isShared: false,
			collaborators: [],
		};
		setNotes((prev) => [newNote, ...prev]);
		setSelectedNoteId(newNote.id);
	};

	return (
		<div className="flex h-full flex-col">
			{/* Generic Header */}
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
					>
						<FileText className="mr-2 size-5" />
						<span className="truncate">Notes</span>
					</Button>

					<TestNavigation />
				</div>
			</div>

			{/* Specific Notes Header */}
			<TestNotesHeader
				selectedNote={selectedNote}
				onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
				sidebarCollapsed={sidebarCollapsed}
				onCreateNote={handleCreateNote}
			/>

			<div className="flex flex-1 overflow-hidden">
				<TestNotesSidebar
					notes={notes}
					selectedNoteId={selectedNoteId}
					onNoteSelect={handleNoteSelect}
					collapsed={sidebarCollapsed}
					onCreateNote={handleCreateNote}
				/>

				<div className="flex-1 overflow-hidden">
					{selectedNote ? (
						<TestNotesEditor
							note={selectedNote}
							onUpdate={(updates: any) =>
								handleNoteUpdate(selectedNote.id, updates)
							}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<div className="text-center">
								<div className="text-lg font-medium mb-2">No note selected</div>
								<div className="text-sm">
									Select a note from the sidebar or create a new one
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />
		</div>
	);
};

export default TestNotesPage;
