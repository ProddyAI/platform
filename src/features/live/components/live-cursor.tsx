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
		const [userName, setUserName] = useState<string>("Someone");

		// Use the real Liveblocks useOther hook to get cursor position and user info
		const other = useOther(connectionId, (user) => ({
			cursor: user.presence.cursor,
			info: user.info,
			id: user.id,
			isEditing: user.presence.isEditing,
		}));

		// Fetch members from Convex database
		const members = useQuery(api.workspace.members.get, { workspaceId });

		// Update the user name whenever other or members changes
		useEffect(() => {
			// Skip if we don't have cursor data
			if (!other?.cursor) return;

			// Try to get user ID from Liveblocks info
			const userId = other?.id;

			// Determine the name to display
			let newUserName = "Someone"; // Default fallback

			// Try to find the user by their ID first — never guess by connection index
			if (members && userId) {
				const memberByUserId = members.find((m) => m.user._id === userId);
				if (memberByUserId?.user.name) {
					newUserName = memberByUserId.user.name;
				}
			}

			// If we still don't have a name, use Liveblocks info if available
			if (newUserName === "Someone" && other.info?.name) {
				newUserName = other.info.name;
			}

			// Only update the state if the name has changed
			if (newUserName !== userName) {
				setUserName(newUserName);
			}
		}, [members, other, userName]);

		// If no cursor position is available, don't render anything
		if (!other?.cursor) return null;

		const { cursor, isEditing } = other;
		const { x, y } = cursor;

		// Different styling for canvas vs notes
		const cursorColor = connectionIdToColor(connectionId);
		const isTyping = variant === "notes" && isEditing;

		return (
			<foreignObject
				className="relative drop-shadow-md"
				height={50}
				style={{
					transform: `translateX(${x}px) translateY(${y}px)`,
				}}
				width={240}
			>
				<MousePointer2
					className="size-5"
					style={{
						fill: cursorColor,
						color: cursorColor,
					}}
				/>

				<div
					className={`absolute left-5 max-w-[180px] truncate rounded-md px-2 py-0.5 font-semibold text-sm text-white ${
						isTyping ? "animate-pulse" : ""
					}`}
					style={{
						backgroundColor: cursorColor,
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
