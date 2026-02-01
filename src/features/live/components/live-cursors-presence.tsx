"use client";

import { shallow } from "@liveblocks/client";
import { useQuery } from "convex/react";
import { memo, useEffect } from "react";
import { api } from "@/../convex/_generated/api";
import {
	useOthers,
	useOthersConnectionIds,
	useOthersMapped,
} from "@/../liveblocks.config";
import { Path } from "@/features/canvas/components/path";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { colorToCSS } from "@/lib/utils";
import { LiveCursor } from "./live-cursor";

type LiveCursorsPresenceProps = {
	variant?: "canvas" | "notes";
	showDrawingPaths?: boolean;
};

const Cursors = ({ variant }: { variant: "canvas" | "notes" }) => {
	const ids = useOthersConnectionIds();

	return (
		<>
			{ids.map((connectionId) => (
				<LiveCursor
					connectionId={connectionId}
					key={connectionId}
					variant={variant}
				/>
			))}
		</>
	);
};

const DrawingPaths = () => {
	const workspaceId = useWorkspaceId();
	const members = useQuery(api.members.get, { workspaceId });

	// Create a map of Convex users by their ID for quick lookup
	const userMap = new Map();
	if (members) {
		members.forEach((member) => {
			userMap.set(member.user._id, member);
		});
	}

	const others = useOthersMapped(
		(other) => ({
			pencilDraft: other.presence.pencilDraft,
			penColor: other.presence.penColor,
			info: other.info,
			connectionId: other.connectionId,
			id: other.id,
		}),
		shallow
	);

	return (
		<>
			{others.map(([key, other]) => {
				if (other?.pencilDraft) {
					// Get real user name from Convex if available
					const defaultName = `${other.connectionId}`;
					const userId = other.id;

					// Determine the user name
					let _userName = other.info?.name || defaultName;

					if (members && userId) {
						const memberByUserId = members.find((m) => m.user._id === userId);
						if (memberByUserId?.user.name) {
							_userName = memberByUserId.user.name;
						}
					}

					return (
						<g key={key}>
							<Path
								fill={other.penColor ? colorToCSS(other.penColor) : "#000"}
								points={other.pencilDraft}
								x={0}
								y={0}
							/>
						</g>
					);
				}

				return null;
			})}
		</>
	);
};

export const LiveCursorsPresence = memo(
	({
		variant = "canvas",
		showDrawingPaths = true,
	}: LiveCursorsPresenceProps) => {
		// Log all other users for debugging
		const others = useOthers();
		const workspaceId = useWorkspaceId();

		// Get members from Convex database
		const members = useQuery(api.members.get, { workspaceId });

		useEffect(() => {
			// Create a map of Convex users by their ID for quick lookup
			const userMap = new Map();
			if (members) {
				members.forEach((member) => {
					userMap.set(member.user._id, member);
				});
			}

			others.forEach((other) => {
				// Try to find the real user name from Convex
				const defaultName = `${other.connectionId}`;
				let _realName = other.info?.name || defaultName;
				const userId = other.id;

				if (members && userId) {
					const memberByUserId = members.find((m) => m.user._id === userId);
					if (memberByUserId?.user.name) {
						_realName = memberByUserId.user.name;
					}
				}
			});
		}, [others, members]);

		return (
			<>
				{variant === "canvas" && showDrawingPaths && <DrawingPaths />}
				<Cursors variant={variant} />
			</>
		);
	}
);

LiveCursorsPresence.displayName = "LiveCursorsPresence";
