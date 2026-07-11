import { SmilePlus } from "lucide-react";

import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Hint } from "../hint";
import { EmojiPopover } from "../pickers/emoji-popover";

interface ReactionsProps {
	data: Array<
		Omit<Doc<"reactions">, "memberId"> & {
			count: number;
			memberIds: Id<"members">[];
		}
	>;
	onChange: (value: string) => void;
}

export const Reactions = ({ data, onChange }: ReactionsProps) => {
	const workspaceId = useWorkspaceId();
	const { data: currentMember } = useCurrentMember({ workspaceId });

	const currentMemberId = currentMember?._id;

	if (data.length === 0 || !currentMemberId) return null;

	return (
		<div className="my-1 flex items-center gap-1">
			{data.map((reaction) => (
				<Hint
					key={reaction._id}
					label={`${reaction.count} ${reaction.count === 1 ? "person" : "people"} reacted with ${reaction.value}`}
				>
					<button
						className={cn(
							"flex h-7 items-center gap-x-1 rounded-full border border-transparent bg-muted px-2 text-foreground transition-standard hover:bg-muted/80",
							reaction.memberIds.includes(currentMemberId) &&
								"border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
						)}
						onClick={() => onChange(reaction.value)}
						type="button"
					>
						{reaction.value}{" "}
						<span
							className={cn(
								"text-xs font-semibold tabular-nums text-muted-foreground",
								reaction.memberIds.includes(currentMemberId) && "text-primary"
							)}
						>
							{reaction.count}
						</span>
					</button>
				</Hint>
			))}

			<EmojiPopover hint="Add a reaction" onEmojiSelect={onChange}>
				<button
					className="flex h-7 items-center gap-x-1 rounded-full border border-transparent bg-muted px-3 text-foreground transition-standard hover:border-primary/40 hover:bg-muted/80"
					type="button"
				>
					<SmilePlus className="size-4" />
				</button>
			</EmojiPopover>
		</div>
	);
};
