import { Hint } from "@/components/hint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateUserColor } from "@/lib/placeholder-image";

type UserAvatarProps = {
	src?: string;
	name?: string;
	fallback?: string;
	borderColor?: string;
	userId?: string;
};

export const UserAvatar = ({
	src,
	name,
	fallback,
	borderColor,
	userId,
}: UserAvatarProps) => {
	// Generate background color for fallback based on user identifier
	const backgroundColor =
		userId || name ? generateUserColor(userId || name || "User") : undefined;

	return (
		<Hint label={name || "Teammate"} side="bottom">
			<Avatar className="h-8 w-8 border-2" style={{ borderColor }}>
				<AvatarImage src={src} />
				<AvatarFallback
					className="text-xs font-semibold text-white"
					style={{ backgroundColor }}
				>
					{fallback}
				</AvatarFallback>
			</Avatar>
		</Hint>
	);
};
