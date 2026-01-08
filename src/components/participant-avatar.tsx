"use client";

import { Hint } from "@/components/hint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateUserColor } from "@/lib/placeholder-image";

type ParticipantAvatarProps = {
	name?: string | null;
	userId?: string | null;
	image?: string | null;
	hintLabel?: string;
	side?: "top" | "right" | "bottom" | "left";
	className?: string;
};

export const ParticipantAvatar = ({
	name,
	userId,
	image,
	hintLabel,
	side = "bottom",
	className = "h-7 w-7 border-2 border-muted",
}: ParticipantAvatarProps) => {
	const resolvedName = name || "User";
	const backgroundColor = generateUserColor(userId || resolvedName);

	const avatar = (
		<Avatar className={className}>
			<AvatarImage src={image || undefined} />
			<AvatarFallback
				className="text-xs font-semibold text-white"
				style={{ backgroundColor }}
			>
				{resolvedName?.[0] || "U"}
			</AvatarFallback>
		</Avatar>
	);

	if (!hintLabel) return avatar;

	return (
		<Hint label={hintLabel} side={side}>
			{avatar}
		</Hint>
	);
};
