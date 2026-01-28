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
	const { participants, currentParticipant, participantCount, isLoading } =
		useChannelParticipants();

	// If still loading, show nothing
	if (isLoading) return null;

	const hasMoreUsers = participants.length > MAX_SHOWN_OTHER_USERS;

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{participants.slice(0, MAX_SHOWN_OTHER_USERS).map((user, idx) => {
				const userKey = user.userId || user.memberId || `user-${idx}`;
				const userColor = generateUserColor(userKey);

				return (
					<Hint key={userKey} label={user.info.name || "Unknown User"} side="bottom">
						<div className="relative">
							<Avatar
								className="h-7 w-7 border-2"
								style={{ borderColor: userColor }}
							>
								<AvatarImage src={user.info.picture || undefined} />
								<AvatarFallback
									className="text-xs font-semibold text-white"
									style={{ backgroundColor: userColor }}
								>
									{user.info.name?.[0] || "U"}
								</AvatarFallback>
							</Avatar>
						</div>
					</Hint>
				);
			})}

			{currentParticipant && (
				<Hint
					label={
						currentParticipant.info.name
							? `${currentParticipant.info.name} (You)`
							: "You"
					}
					side="bottom"
				>
					<div className="relative">
						<Avatar
							className="h-7 w-7 border-2"
							style={{
								borderColor: generateUserColor(
									currentParticipant.userId || "you"
								),
							}}
						>
							<AvatarImage src={currentParticipant.info.picture || undefined} />
							<AvatarFallback
								className="text-xs font-semibold text-white"
								style={{
									backgroundColor: generateUserColor(
										currentParticipant.userId || "you"
									),
								}}
							>
								{currentParticipant.info.name?.[0] || "Y"}
							</AvatarFallback>
						</Avatar>
					</div>
				</Hint>
			)}

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