"use client";

import { LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import { ClientSideSuspense } from "@liveblocks/react";
import { useQuery } from "convex/react";
import { Loader } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import { RoomProvider } from "@/../liveblocks.config";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface LiveblocksRoomProps {
	children: ReactNode;
	roomId: string;
	roomType?: "canvas" | "note";
	fallback?: ReactNode;
}

export const LiveblocksRoom = ({
	children,
	roomId,
	roomType = "canvas",
	fallback,
}: LiveblocksRoomProps) => {
	// Ensure roomId is a string and normalize it
	const normalizedRoomId = String(roomId).trim();

	// Add a key to force remount when roomId changes
	const key = `${roomType}-room-${normalizedRoomId}`;

	// Get the workspace ID from params
	const workspaceId = useWorkspaceId();

	// Get the current user from Convex
	const currentUser = useQuery(api.users.current);

	// Get current member info to pass to Liveblocks
	const currentMember = useQuery(
		api.members.current,
		workspaceId ? { workspaceId } : "skip"
	);

	// Set up user info for Liveblocks authentication
	useEffect(() => {
		if (currentUser && currentMember) {
			window.__liveblocksUserInfo = {
				userId: currentUser._id,
				memberId: currentMember._id,
				userName: currentUser.name ?? "",
				userAvatar: currentUser.image ?? "",
			};
		}
		return () => {
			window.__liveblocksUserInfo = undefined;
		};
	}, [currentUser, currentMember]);

	// Show loading state while user data is being fetched
	if (!currentUser || !currentMember) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Loader className="size-5 animate-spin" />
			</div>
		);
	}

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
					excalidraw: new LiveObject({
						elements: [],
						appState: {},
						files: {},
						version: 1,
					}),
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
