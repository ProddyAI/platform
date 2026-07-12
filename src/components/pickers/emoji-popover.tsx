import type { EmojiClickData } from "emoji-picker-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { type PropsWithChildren, useState } from "react";

import { Hint } from "@/components/hint";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

const EmojiPicker = dynamic(
	() =>
		import("emoji-picker-react").then((mod) => {
			const { default: Picker, Theme } = mod;
			return function ThemedEmojiPicker({
				isDark,
				onEmojiClick,
			}: {
				isDark: boolean;
				onEmojiClick: (emojiData: EmojiClickData) => void;
			}) {
				return (
					<Picker
						onEmojiClick={onEmojiClick}
						theme={isDark ? Theme.DARK : Theme.LIGHT}
					/>
				);
			};
		}),
	{ ssr: false }
);

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
				{popoverOpen && (
					<EmojiPicker isDark={theme === "dark"} onEmojiClick={onSelect} />
				)}
			</PopoverContent>
		</Popover>
	);
};
