import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ConversationHeroProps {
	name?: string;
	image?: string;
}

export const ConversationHero = ({
	name = "Member",
	image,
}: ConversationHeroProps) => {
	const avatarFallback = name.charAt(0).toUpperCase();

	return (
		<div className="mx-2 md:mx-5 mb-4 mt-[88px]">
			<div className="mb-2 flex items-center gap-x-3">
				<Avatar className="size-10 md:size-14">
					<AvatarImage src={image} />

					<AvatarFallback>{avatarFallback}</AvatarFallback>
				</Avatar>

				<p className="text-xl md:text-2xl font-semibold">{name}</p>
			</div>

			<p className="mb-4 text-sm md:text-base font-normal text-muted-foreground">
				This conversation is just between you and <strong>{name}</strong>
			</p>
		</div>
	);
};
