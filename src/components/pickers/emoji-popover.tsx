import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { type PropsWithChildren, useState } from "react";

import { Hint } from "@/components/hint";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPopoverProps {
	hint?: string;
	onEmojiSelect: (emoji: string) => void;
}

export const EmojiPopover = ({
	children,
	hint = "Emoji",
	onEmojiSelect,
}: PropsWithChildren<EmojiPopoverProps>) => {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const { theme = "system" } = useTheme();

	const onSelect = (emojiData: EmojiClickData) => {
		onEmojiSelect(emojiData.emoji);

		setPopoverOpen(false);
	};

	return (
		<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
			<Hint label={hint}>
				<PopoverTrigger asChild>{children}</PopoverTrigger>
			</Hint>

			<PopoverContent className="w-full border-none p-0 shadow-none">
				<EmojiPicker
					onEmojiClick={onSelect}
					theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
				/>
			</PopoverContent>
		</Popover>
	);
};
