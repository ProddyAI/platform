"use client";

import { LiveList, LiveMap } from "@liveblocks/client";
import { ClientSideSuspense } from "@liveblocks/react";
import { useQuery } from "convex/react";
import { Loader } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { RoomProvider } from "@/../liveblocks.config";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface NotesRoomProps {
	children: ReactNode;
	noteId: Id<"notes"> | string;
	fallback?: ReactNode;
}

export const NotesRoom = ({ children, noteId, fallback }: NotesRoomProps) => {
	// Create a room ID based on the note ID
	const roomId = `note-${noteId}`;

	// Ensure roomId is a string and normalize it
	const normalizedRoomId = String(roomId).trim();

	// Add a key to force remount when roomId changes
	const key = `note-room-${normalizedRoomId}`;

	// Get the workspace ID from params
	const workspaceId = useWorkspaceId();

	// Get the current user from Convex
	const currentUser = useQuery(api.users.current);

	// Get current member info to pass to Liveblocks
	const currentMember = useQuery(
		api.members.current,
		workspaceId ? { workspaceId } : "skip"
	);

	// If user data is still loading, show a loading indicator
	if (!currentUser) {
		return (
			<div className="flex items-center justify-center h-full">
				Loading note...
			</div>
		);
	}

	// Verify we have a valid room ID
	if (!normalizedRoomId) {
		console.error("Invalid room ID provided to NotesRoom component");
		return (
			<div className="flex items-center justify-center h-full">
				Error: Invalid room ID
			</div>
		);
	}

	const authParams = new URLSearchParams();
	if (currentUser?._id) authParams.set("userId", currentUser._id);
	if (currentMember?._id) authParams.set("memberId", currentMember._id);
	if (currentUser?.name) authParams.set("userName", currentUser.name);
	if (currentUser?.image) authParams.set("userAvatar", currentUser.image);

	return (
		// Use the key to force remount when roomId changes
		<div key={key} className="h-full">
			<RoomProvider
				id={normalizedRoomId}
				initialPresence={{
					cursor: null,
					selection: [],
					pencilDraft: null,
					penColor: null,
					strokeWidth: 1,
					isEditing: false,
					lastActivity: Date.now(),
				}}
				initialStorage={{
					layers: new LiveMap(),
					layerIds: new LiveList([]),
					collaborativeNotes: new LiveMap(),
					lastUpdate: Date.now(),
				}}
			>
				<ClientSideSuspense
					fallback={
						fallback || (
							<div className="flex h-full w-full items-center justify-center">
								<Loader className="size-5 animate-spin" />
							</div>
						)
					}
				>
					{() => children}
				</ClientSideSuspense>
			</RoomProvider>
		</div>
	);
};
