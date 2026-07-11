"use client";

import { Hint } from "@/components/hint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChannelParticipants } from "@/hooks/use-channel-participants";
import { generateUserColor } from "@/lib/placeholder-image";

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

	// While loading, show skeleton avatars instead of nothing so the row doesn't pop in
	if (isLoading) {
		return (
			<div
				className={`flex items-center -space-x-2 ${className}`}
				data-fullscreen={isFullScreen}
				data-variant={variant}
			>
				{Array.from({ length: 2 }).map((_, index) => (
					<div
						className="size-7 animate-pulse rounded-full border-2 border-muted bg-muted"
						key={index}
					/>
				))}
			</div>
		);
	}

	const hasMoreUsers = participants.length > MAX_SHOWN_OTHER_USERS;

	// Use canvas-style display for both variants when inside LiveHeader
	// This ensures consistent appearance.
	return (
		<div
			className={`flex items-center -space-x-2 ${className}`}
			data-fullscreen={isFullScreen}
			data-variant={variant}
		>
			{participants.slice(0, MAX_SHOWN_OTHER_USERS).map((user) => {
				const backgroundColor = generateUserColor(
					user.userId || user.info.name || "User"
				);
				return (
					<Hint key={user.userId} label={user.info.name} side="bottom">
						<div className="relative">
							<Avatar className="size-7 border-2 border-muted">
								<AvatarImage src={user.info.picture ?? undefined} />
								<AvatarFallback
									className="text-xs font-semibold text-white"
									style={{ backgroundColor }}
								>
									{user.info.name?.[0] || "U"}
								</AvatarFallback>
							</Avatar>
						</div>
					</Hint>
				);
			})}

			{hasMoreUsers && (
				<Hint
					label={`${participants.length - MAX_SHOWN_OTHER_USERS} more`}
					side="bottom"
				>
					<div className="relative">
						<Avatar className="size-7 border-2 border-muted">
							<AvatarFallback className="text-xs font-semibold bg-muted">
								+{participants.length - MAX_SHOWN_OTHER_USERS}
							</AvatarFallback>
						</Avatar>
					</div>
				</Hint>
			)}
		</div>
	);
};
