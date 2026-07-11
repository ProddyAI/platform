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

export const TagInput = ({
	tags,
	onTagsChange,
	placeholder = "Add tags...",
	className,
	maxTags = 10,
}: TagInputProps) => {
	const [inputValue, setInputValue] = useState("");
	const [isInputVisible, setIsInputVisible] = useState(false);

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
		if (e.key === "Enter" || e.key === ",") {
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
					className="text-xs px-2 py-1 h-6 flex items-center gap-1"
					key={tag}
					variant="outline"
				>
					<span>{tag}</span>
					<button
						aria-label={`Remove ${tag}`}
						className="hover:bg-muted rounded-full p-0.5 transition-colors"
						onClick={() => removeTag(tag)}
						type="button"
					>
						<X className="size-2.5" />
					</button>
				</Badge>
			))}

			{/* Add tag input or button */}
			{isInputVisible ? (
				<Input
					className="h-6 text-xs px-2 py-1 w-24 min-w-0"
					onBlur={handleInputBlur}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					value={inputValue}
				/>
			) : (
				tags.length < maxTags && (
					<Button
						className="h-6 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
						onClick={() => setIsInputVisible(true)}
						size="sm"
						variant="ghost"
					>
						<Plus className="size-3 mr-1" />
						Add tag
					</Button>
				)
			)}
		</div>
	);
};
