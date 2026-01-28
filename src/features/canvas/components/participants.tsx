"use client";

import { useChannelParticipants } from "../../../hooks/use-channel-participants";
import { connectionIdToColor } from "../../../lib/utils";
import { UserAvatar } from "./user-avatar";

// Define types for the Liveblocks user data

// Define types for the Liveblocks user data
interface UserInfo {
	name?: string;
	picture?: string;
}

interface User {
	memberId?: string;
	userId?: string;
	info?: UserInfo;
}

interface CurrentUser extends User {
	presence?: any;
}

// Constants
const MAX_SHOWN_OTHER_USERS = 2;

interface ParticipantsProps {
	isFullScreen?: boolean;
}

export const Participants = ({ isFullScreen }: ParticipantsProps = {}) => {
	// Fetch real participants from the database
	const { participants, currentParticipant, participantCount, isLoading } =
		useChannelParticipants();

	// If still loading, show nothing
	if (isLoading) return null;

	const hasMoreUsers = participants.length > MAX_SHOWN_OTHER_USERS;

	return (
		<div
			className={`absolute h-12 ${isFullScreen ? "top-8" : "top-32"} right-8 bg-white rounded-md p-3 flex items-center shadow-md z-50`}
		>
			<div className="flex items-center">
				{participantCount > 0 && (
					<span className="text-sm font-medium mr-2">
						{participantCount} active
					</span>
				)}
				<div className="flex gap-x-2">
					{participants.slice(0, MAX_SHOWN_OTHER_USERS).map((user, idx) => {
						const userKey =
							user.userId ||
							user.memberId ||
							user.info?.name ||
							(user.connectionId !== undefined
								? `conn-${user.connectionId}`
								: `user-${idx}`);
						return (
							<UserAvatar
								borderColor={connectionIdToColor(user.connectionId)}
								key={userKey}
								src={user.info?.picture ?? undefined}
								name={user.info?.name || ""}
								fallback={user.info?.name?.[0] || "U"}
								userId={user.userId || user.info?.name}
							/>
						);
					})}

					{currentParticipant && (
						<UserAvatar
							  borderColor={connectionIdToColor(currentParticipant.connectionId)}
							key={currentParticipant.userId || currentParticipant.info?.name || "you"}
							src={currentParticipant.info?.picture ?? undefined}
							name={`${currentParticipant.info?.name || "You"} (You)`}
							fallback={currentParticipant.info?.name?.[0] || "Y"}
							userId={
								currentParticipant.userId || currentParticipant.info?.name
							}
						/>
					)}

					{hasMoreUsers && (
						<UserAvatar
							name={`${participants.length - MAX_SHOWN_OTHER_USERS} more`}
							fallback={`+${participants.length - MAX_SHOWN_OTHER_USERS}`}
						/>
					)}
				</div>
			</div>
		</div>
	);
};

export const ParticipantsSkeleton = ({
	isFullScreen,
}: ParticipantsProps = {}) => {
	return (
		<div
			className={`w-[100px] absolute h-12 ${isFullScreen ? "top-8" : "top-32"} right-8 bg-white rounded-md p-3 flex items-center shadow-md z-50`}
			aria-hidden
		/>
	);
};
