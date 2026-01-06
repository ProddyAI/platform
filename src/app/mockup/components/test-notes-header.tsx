"use client";

import { Plus, Share, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TestNotesHeaderProps {
	selectedNote?: {
		id: string;
		title: string;
		tags: string[];
		isShared: boolean;
		collaborators: string[];
		updatedAt: Date;
	} | null;
	onToggleSidebar: () => void;
	sidebarCollapsed: boolean;
	onCreateNote: () => void;
}

export const TestNotesHeader = ({
	selectedNote,
	onToggleSidebar,
	sidebarCollapsed,
	onCreateNote,
}: TestNotesHeaderProps) => {
	return (
		<div className="border-b bg-muted/30 p-3">
			<div className="flex items-center justify-between">
				{/* Left side - Note info */}
				{selectedNote && (
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-1">
							<span className="font-medium text-foreground">
								{selectedNote.title}
							</span>
						</div>

						{selectedNote.tags.length > 0 && (
							<div className="flex items-center gap-1">
								<Tag className="h-3 w-3 text-muted-foreground" />
								<div className="flex gap-1">
									{selectedNote.tags.slice(0, 2).map((tag) => (
										<Badge key={tag} variant="outline" className="text-xs">
											{tag}
										</Badge>
									))}
									{selectedNote.tags.length > 2 && (
										<Badge variant="outline" className="text-xs">
											+{selectedNote.tags.length - 2}
										</Badge>
									)}
								</div>
							</div>
						)}

						{selectedNote.isShared && (
							<div className="flex items-center gap-1">
								<Users className="h-3 w-3 text-muted-foreground" />
								<span className="text-xs text-muted-foreground">
									{selectedNote.collaborators.length} collaborator
									{selectedNote.collaborators.length !== 1 ? "s" : ""}
								</span>
							</div>
						)}

						<div className="text-xs text-muted-foreground">
							Updated {selectedNote.updatedAt.toLocaleDateString()}
						</div>
					</div>
				)}

				{/* Right side - Actions */}
				<div className="flex items-center gap-2">
					{selectedNote?.isShared && (
						<Button variant="ghost" size="sm">
							<Share className="h-4 w-4 mr-2" />
							Share
						</Button>
					)}

					<Button onClick={onCreateNote} size="sm">
						<Plus className="h-4 w-4 mr-2" />
						New Note
					</Button>
				</div>
			</div>
		</div>
	);
};
