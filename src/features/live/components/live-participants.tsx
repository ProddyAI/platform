"use client";

import { Hint } from "@/components/hint";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChannelParticipants } from "@/hooks/use-channel-participants";

// Constants
const MAX_SHOWN_OTHER_USERS = 3;

interface LiveParticipantsProps {
	variant?: "canvas" | "notes";
	isFullScreen?: boolean;
	className?: string;
}

export const LiveParticipants = ({
	variant = "canvas",
	isFullScreen = false,
	className,
}: LiveParticipantsProps) => {
	// Fetch real participants from the database
	const { participants, isLoading } = useChannelParticipants();

	// If still loading, show nothing
	if (isLoading) return null;

	const hasMoreUsers = participants.length > MAX_SHOWN_OTHER_USERS;

	// Use canvas-style display for both variants when inside LiveHeader
	// This ensures consistent appearance.
	return (
		<div
			className={`flex items-center gap-2 ${className}`}
			data-variant={variant}
			data-fullscreen={isFullScreen}
		>
			{participants.slice(0, MAX_SHOWN_OTHER_USERS).map((user) => {
				return (
					<div key={user.userId} className="relative">
						<ParticipantAvatar
							name={user.info.name}
							userId={user.userId}
							image={user.info.picture}
							hintLabel={user.info.name || "User"}
							side="bottom"
						/>
					</div>
				);
			})}

			{hasMoreUsers && (
				<Hint
					label={`${participants.length - MAX_SHOWN_OTHER_USERS} more`}
					side="bottom"
				>
					<div className="relative">
						<Avatar className="h-7 w-7 border-2 border-gray-300">
							<AvatarFallback className="text-xs font-semibold bg-gray-100">
								+{participants.length - MAX_SHOWN_OTHER_USERS}
							</AvatarFallback>
						</Avatar>
					</div>
				</Hint>
			)}
		</div>
	);
};
