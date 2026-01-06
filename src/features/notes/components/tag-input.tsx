"use client";

import { Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
	tags: string[];
	onTagsChange: (tags: string[]) => void;
	placeholder?: string;
	className?: string;
	maxTags?: number;
}

const TAG_COLORS = [
	"bg-pink-100 text-pink-800 border-pink-200",
	"bg-purple-100 text-purple-800 border-purple-200",
	"bg-blue-100 text-blue-800 border-blue-200",
	"bg-green-100 text-green-800 border-green-200",
	"bg-yellow-100 text-yellow-800 border-yellow-200",
	"bg-orange-100 text-orange-800 border-orange-200",
];

export const TagInput = ({
	tags,
	onTagsChange,
	placeholder = "Add tags...",
	className,
	maxTags = 10,
}: TagInputProps) => {
	const [inputValue, setInputValue] = useState("");
	const [isInputVisible, setIsInputVisible] = useState(false);

	const getTagColor = (tag: string) => {
		// Generate consistent color based on tag name
		const hash = tag.split("").reduce((a, b) => {
			a = (a << 5) - a + b.charCodeAt(0);
			return a & a;
		}, 0);
		return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
	};

	const addTag = (tag: string) => {
		const trimmedTag = tag.trim().toLowerCase();
		if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
			onTagsChange([...tags, trimmedTag]);
		}
		setInputValue("");
		setIsInputVisible(false);
	};

	const removeTag = (tagToRemove: string) => {
		onTagsChange(tags.filter((tag) => tag !== tagToRemove));
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addTag(inputValue);
		} else if (e.key === "Escape") {
			setInputValue("");
			setIsInputVisible(false);
		} else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
			removeTag(tags[tags.length - 1]);
		}
	};

	const handleInputBlur = () => {
		if (inputValue.trim()) {
			addTag(inputValue);
		} else {
			setIsInputVisible(false);
		}
	};

	return (
		<div className={cn("flex flex-wrap items-center gap-1", className)}>
			{/* Existing tags */}
			{tags.map((tag) => (
				<Badge
					key={tag}
					variant="outline"
					className={cn(
						"text-xs px-2 py-1 h-6 flex items-center gap-1",
						getTagColor(tag)
					)}
				>
					<span>{tag}</span>
					<button
						onClick={() => removeTag(tag)}
						className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
					>
						<X className="h-2.5 w-2.5" />
					</button>
				</Badge>
			))}

			{/* Add tag input or button */}
			{isInputVisible ? (
				<Input
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleInputBlur}
					placeholder={placeholder}
					className="h-6 text-xs px-2 py-1 w-24 min-w-0"
					autoFocus
				/>
			) : (
				tags.length < maxTags && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsInputVisible(true)}
						className="h-6 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
					>
						<Plus className="h-3 w-3 mr-1" />
						Add tag
					</Button>
				)
			)}
		</div>
	);
};
