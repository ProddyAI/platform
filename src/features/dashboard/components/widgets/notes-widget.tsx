"use client";

import { FileText, Loader, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useGetNotes } from "@/features/notes/api/use-get-notes";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

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

// Quill Delta operation shape used by the note editor's stored content.
interface DeltaOperation {
	insert?: string | object;
	delete?: number;
	retain?: number;
	attributes?: Record<string, unknown>;
}

// Extracts a single-line plain-text preview from a note's content, which may
// be raw text or a JSON-encoded Quill Delta.
const getNotePreview = (content: string): string => {
	try {
		if (!content) return "No content";

		if (typeof content === "string" && !content.includes('{"ops":')) {
			return content.substring(0, 100);
		}

		const contentStr =
			typeof content === "string" ? content : JSON.stringify(content);
		const parsed = JSON.parse(contentStr);

		if (parsed?.ops && Array.isArray(parsed.ops)) {
			const plainText = parsed.ops
				.map((op: DeltaOperation) =>
					typeof op.insert === "string" ? op.insert : ""
				)
				.join("")
				.trim();

			const firstLine = plainText.split("\n")[0].trim();
			return firstLine || "No content";
		}

		return typeof content === "string"
			? content.substring(0, 100)
			: "Note content";
	} catch (_e) {
		return typeof content === "string"
			? content.substring(0, 100)
			: "Note content";
	}
};

export const NotesWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: NotesWidgetProps) => {
	const router = useRouter();
	const { data: channels } = useGetChannels({ workspaceId });

	// useGetNotes requires a channelId or it skips the query, but the
	// underlying query already returns every note in the workspace
	// regardless of which channel id is passed in — so this widget shows
	// workspace-wide notes, each tagged with its real channel below.
	const firstChannel =
		channels && channels.length > 0 ? channels[0] : undefined;
	const firstChannelId = firstChannel?._id;
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

	if (!channels) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<WidgetHeader
				badge={sortedNotes.length > 0 ? sortedNotes.length : undefined}
				controls={controls}
				icon={<FileText className="h-5 w-5 text-primary" />}
				isEditMode={isEditMode}
				title="Recent Notes"
			/>

			{sortedNotes.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedNotes.map((note) => (
							<WidgetCard key={note._id}>
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<h5 className="font-medium text-sm leading-tight flex-1">
											{note.title}
										</h5>
										<RelativeTime
											className="text-[10px]"
											iconClassName="h-2.5 w-2.5"
											timestamp={note.updatedAt}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Badge className="h-5 px-2 text-xs" variant="outline">
											# {note.channelName}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-1">
										{getNotePreview(note.content)}
									</p>
									<Button
										className="h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
										onClick={() => handleViewNote(note._id, note.channelId)}
										size="sm"
										variant="ghost"
									>
										View note
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<WidgetEmptyState
					action={{
						label: "Create Note",
						onClick: handleCreateNote,
						icon: Plus,
					}}
					description="Create notes to see them here"
					icon={FileText}
					title="No notes found"
				/>
			)}
		</div>
	);
};
