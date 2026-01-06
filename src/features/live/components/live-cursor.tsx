"use client";

import { useQuery } from "convex/react";
import { MousePointer2 } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import { useOther } from "@/../liveblocks.config";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { connectionIdToColor } from "@/lib/utils";

type LiveCursorProps = {
	connectionId: number;
	variant?: "canvas" | "notes";
};

export const LiveCursor = memo(
	({ connectionId, variant = "canvas" }: LiveCursorProps) => {
		const workspaceId = useWorkspaceId();
		const [userName, setUserName] = useState<string>(`${connectionId}`);

		// Use the real Liveblocks useOther hook to get cursor position and user info
		const other = useOther(connectionId, (user) => ({
			cursor: user.presence.cursor,
			info: user.info,
			id: user.id,
			isEditing: user.presence.isEditing,
		}));

		// Fetch members from Convex database
		const members = useQuery(api.members.get, { workspaceId });

		// Fetch current user to get their ID
		const _currentUser = useQuery(api.users.current);

		// Update the user name whenever other or members changes
		useEffect(() => {
			// Skip if we don't have cursor data
			if (!other?.cursor) return;

			// Try to get user ID from Liveblocks info
			const userId = other?.id;

			// Determine the name to display
			let newUserName = `${connectionId}`; // Default fallback

			if (members) {
				// Try to find the user by their ID first
				if (userId) {
					const memberByUserId = members.find((m) => m.user._id === userId);
					if (memberByUserId?.user.name) {
						newUserName = memberByUserId.user.name;
					}
				} else if (members.length > 0) {
					// If no userId but we have members, try connection ID approach
					const memberByIndex = members[connectionId % members.length];
					if (memberByIndex?.user.name) {
						newUserName = memberByIndex.user.name;
					}
				}

				// If we still don't have a name, use Liveblocks info if available
				if (newUserName === `${connectionId}` && other.info?.name) {
					newUserName = other.info.name;
				}
			} else if (other.info?.name) {
				// No members but we have Liveblocks info
				newUserName = other.info.name;
			}

			// Only update the state if the name has changed
			if (newUserName !== userName) {
				setUserName(newUserName);
			}
		}, [members, connectionId, other, userName]);

		// If no cursor position is available, don't render anything
		if (!other?.cursor) return null;

		const { cursor, isEditing } = other;
		const { x, y } = cursor;

		// Calculate width based on name length
		const nameWidth = Math.max(userName.length * 12, 60);

		// Different styling for canvas vs notes
		const cursorColor = connectionIdToColor(connectionId);
		const isTyping = variant === "notes" && isEditing;

		return (
			<foreignObject
				style={{
					transform: `translateX(${x}px) translateY(${y}px)`,
				}}
				height={50}
				width={nameWidth * 1.5}
				className="relative drop-shadow-md"
			>
				<MousePointer2
					className="h-5 w-5"
					style={{
						fill: cursorColor,
						color: cursorColor,
					}}
				/>

				<div
					className={`absolute left-5 px-2 py-0.5 rounded-md text-sm text-white font-semibold whitespace-nowrap ${
						isTyping ? "animate-pulse" : ""
					}`}
					style={{
						backgroundColor: cursorColor,
						minWidth: `${nameWidth - 10}px`,
						maxWidth: `${nameWidth * 1.5}px`,
					}}
				>
					{userName}
					{isTyping && (
						<span className="ml-1 text-xs opacity-75">typing...</span>
					)}
				</div>
			</foreignObject>
		);
	}
);

LiveCursor.displayName = "LiveCursor";
