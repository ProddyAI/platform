"use client";

import { formatDistanceToNow } from "date-fns";
import { Clock, FileText, Loader, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useGetNotes } from "@/features/notes/api/use-get-notes";
import { WidgetCard } from "../shared/widget-card";

interface NotesWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const NotesWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: NotesWidgetProps) => {
	const router = useRouter();
	const { data: channels } = useGetChannels({ workspaceId });

	// Get notes from the first channel (for simplicity)
	const firstChannelId =
		channels && channels.length > 0 ? channels[0]._id : undefined;
	const { data: channelNotes } = useGetNotes(workspaceId, firstChannelId);

	// Combine notes with channel info
	const allNotes = useMemo(() => {
		if (!channels || !channelNotes) return [];

		return channelNotes.map((note) => {
			const channel = channels.find((c) => c._id === note.channelId);
			return {
				...note,
				channelName: channel?.name || "Unknown Channel",
			};
		});
	}, [channels, channelNotes]);

	// Sort notes by last updated time
	const sortedNotes = useMemo(() => {
		if (!allNotes.length) return [];

		return [...allNotes]
			.sort((a, b) => {
				// First sort by pinned status (if exists)
				if ("isPinned" in a && "isPinned" in b && a.isPinned !== b.isPinned) {
					return a.isPinned ? -1 : 1;
				}

				// Then sort by last updated time
				return b.updatedAt - a.updatedAt;
			})
			.slice(0, 10); // Limit to 10 notes
	}, [allNotes]);

	const handleViewNote = (noteId: Id<"notes">, channelId: Id<"channels">) => {
		router.push(
			`/workspace/${workspaceId}/channel/${channelId}/notes?noteId=${noteId}`
		);
	};

	const handleCreateNote = () => {
		// Navigate to the first channel's notes section
		if (channels && channels.length > 0) {
			router.push(
				`/workspace/${workspaceId}/channel/${channels[0]._id}/notes?action=create`
			);
		}
	};

	// View all notes button handler
	const handleViewAll = () => {
		// Navigate to the first channel's notes section
		if (channels && channels.length > 0) {
			router.push(`/workspace/${workspaceId}/channel/${channels[0]._id}/notes`);
		}
	};

	if (!channels) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
					<h3 className="font-semibold text-base">Recent Notes</h3>
					{!isEditMode && sortedNotes.length > 0 && (
						<Badge variant="secondary" className="ml-1 h-5 px-2 text-xs font-medium">
							{sortedNotes.length}
						</Badge>
					)}
				</div>
				{isEditMode ? (
					controls
				) : (
					<Button 
						variant="ghost" 
						size="sm"
						className="h-8 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
						onClick={handleViewAll}
					>
						View All
					</Button>
				)}
			</div>

			{sortedNotes.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedNotes.map((note) => (
							<WidgetCard key={note._id}>
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<h5 className="font-medium text-sm leading-tight flex-1">{note.title}</h5>
										<span className="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap flex items-center gap-0.5">
											<Clock className="h-2.5 w-2.5" />
											{formatDistanceToNow(new Date(note.updatedAt), {
												addSuffix: true,
											}).replace('about ', '')}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="text-xs h-5 px-2 border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300">
											# {note.channelName}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-1">
										{(() => {
											try {
												// Define a type for Quill Delta operations
												interface DeltaOperation {
													insert?: string | object;
													delete?: number;
													retain?: number;
													attributes?: Record<string, any>;
												}

												// Handle different content formats
												if (!note.content) return "No content";

												// If content is already a string but not JSON
												if (
													typeof note.content === "string" &&
													!note.content.includes('{"ops":')
												) {
													return note.content.substring(0, 100);
												}

												// Parse JSON content
												const contentStr =
													typeof note.content === "string"
														? note.content
														: JSON.stringify(note.content);
												const parsed = JSON.parse(contentStr);

												if (parsed?.ops && Array.isArray(parsed.ops)) {
													// Extract text from all insert operations
													const plainText = parsed.ops
														.map((op: DeltaOperation) =>
															typeof op.insert === "string" ? op.insert : ""
														)
														.join("")
														.trim();

													// Get first line or first 100 chars
													const firstLine = plainText.split("\n")[0].trim();
													return firstLine || "No content";
												}

												return typeof note.content === "string"
													? note.content.substring(0, 100)
													: "Note content";
											} catch (_e) {
												// If parsing fails, return a fallback
												return typeof note.content === "string"
													? note.content.substring(0, 100)
													: "Note content";
											}
										})()}
									</p>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 w-full justify-center text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
										onClick={() => handleViewNote(note._id, note.channelId)}
									>
										View note
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
					<FileText className="mb-3 h-12 w-12 text-muted-foreground/40" />
					<h3 className="text-base font-semibold text-foreground">No notes found</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Create notes to see them here
					</p>
					<Button
						variant="default"
						size="sm"
						className="mt-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700"
						onClick={handleCreateNote}
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Note
					</Button>
				</div>
			)}
		</div>
	);
};
