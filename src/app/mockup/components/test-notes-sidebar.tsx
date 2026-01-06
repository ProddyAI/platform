"use client";

import { FileText, Folder, Lock, Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	tags: string[];
	folder: string;
	isShared: boolean;
	collaborators: string[];
}

interface TestNotesSidebarProps {
	notes: Note[];
	selectedNoteId: string | null;
	onNoteSelect: (noteId: string) => void;
	collapsed: boolean;
	onCreateNote: () => void;
}

export const TestNotesSidebar = ({
	notes,
	selectedNoteId,
	onNoteSelect,
	collapsed,
	onCreateNote,
}: TestNotesSidebarProps) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

	// Group notes by folder
	const folders = Array.from(new Set(notes.map((note) => note.folder)));
	const filteredNotes = notes.filter((note) => {
		const matchesSearch =
			note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			note.content.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesFolder = !selectedFolder || note.folder === selectedFolder;
		return matchesSearch && matchesFolder;
	});

	const notesByFolder = folders.reduce(
		(acc, folder) => {
			acc[folder] = filteredNotes.filter((note) => note.folder === folder);
			return acc;
		},
		{} as Record<string, Note[]>
	);

	if (collapsed) {
		return (
			<div className="w-12 border-r bg-muted/30 flex flex-col items-center py-4 gap-2">
				<Button variant="ghost" size="sm" onClick={onCreateNote}>
					<Plus className="h-4 w-4" />
				</Button>
				<div className="text-xs text-muted-foreground transform -rotate-90 whitespace-nowrap mt-8">
					Notes
				</div>
			</div>
		);
	}

	return (
		<div className="w-80 border-r bg-muted/30 flex flex-col">
			{/* Search and Create */}
			<div className="p-4 border-b">
				<div className="flex gap-2 mb-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search notes..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Button onClick={onCreateNote} size="sm">
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{/* Folder Filter */}
				<div className="flex gap-1 flex-wrap">
					<Button
						variant={selectedFolder === null ? "default" : "ghost"}
						size="sm"
						onClick={() => setSelectedFolder(null)}
						className="text-xs h-7"
					>
						All
					</Button>
					{folders.map((folder) => (
						<Button
							key={folder}
							variant={selectedFolder === folder ? "default" : "ghost"}
							size="sm"
							onClick={() => setSelectedFolder(folder)}
							className="text-xs h-7"
						>
							<Folder className="h-3 w-3 mr-1" />
							{folder}
						</Button>
					))}
				</div>
			</div>

			{/* Notes List */}
			<ScrollArea className="flex-1">
				<div className="p-2">
					{Object.entries(notesByFolder).map(
						([folder, folderNotes]) =>
							folderNotes.length > 0 && (
								<div key={folder} className="mb-4">
									{!selectedFolder && (
										<div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground mb-2">
											<Folder className="h-3 w-3" />
											{folder}
										</div>
									)}

									<div className="space-y-1">
										{folderNotes.map((note) => (
											<button
												key={note.id}
												onClick={() => onNoteSelect(note.id)}
												className={cn(
													"w-full text-left p-3 rounded-lg border transition-colors",
													selectedNoteId === note.id
														? "bg-primary/10 border-primary/20"
														: "bg-background hover:bg-muted/50 border-transparent"
												)}
											>
												<div className="flex items-start justify-between gap-2 mb-2">
													<div className="flex items-center gap-2 min-w-0 flex-1">
														<FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
														<span className="font-medium text-sm truncate">
															{note.title}
														</span>
													</div>
													<div className="flex items-center gap-1 flex-shrink-0">
														{note.isShared ? (
															<Users className="h-3 w-3 text-muted-foreground" />
														) : (
															<Lock className="h-3 w-3 text-muted-foreground" />
														)}
													</div>
												</div>

												<div className="text-xs text-muted-foreground mb-2 line-clamp-2">
													{note.content
														.replace(/[#*\-[\]]/g, "")
														.substring(0, 100)}
													...
												</div>

												<div className="flex items-center justify-between">
													<div className="flex gap-1">
														{note.tags.slice(0, 2).map((tag) => (
															<Badge
																key={tag}
																variant="secondary"
																className="text-xs"
															>
																{tag}
															</Badge>
														))}
														{note.tags.length > 2 && (
															<Badge variant="secondary" className="text-xs">
																+{note.tags.length - 2}
															</Badge>
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														{note.updatedAt.toLocaleDateString()}
													</div>
												</div>
											</button>
										))}
									</div>
								</div>
							)
					)}

					{filteredNotes.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<div className="text-sm">No notes found</div>
							<div className="text-xs mt-1">
								{searchQuery
									? "Try a different search term"
									: "Create your first note"}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};
