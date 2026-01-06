"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface TaskTagInputProps {
	value: string[];
	onChange: (value: string[]) => void;
	suggestions?: string[];
}

export const TaskTagInput = ({
	value,
	onChange,
	suggestions = [],
}: TaskTagInputProps) => {
	const [inputValue, setInputValue] = useState("");
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// Filter suggestions based on input value
	const filteredSuggestions = suggestions.filter(
		(tag) =>
			tag.toLowerCase().includes(inputValue.toLowerCase()) &&
			!value.includes(tag)
	);

	const handleAddTag = (tag: string) => {
		const trimmedTag = tag.trim();
		if (trimmedTag && !value.includes(trimmedTag)) {
			onChange([...value, trimmedTag]);
		}
		setInputValue("");
		inputRef.current?.focus();
	};

	const handleRemoveTag = (tag: string) => {
		onChange(value.filter((t) => t !== tag));
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && inputValue) {
			e.preventDefault();
			handleAddTag(inputValue);
		} else if (e.key === "Backspace" && !inputValue && value.length > 0) {
			handleRemoveTag(value[value.length - 1]);
		}
	};

	useEffect(() => {
		if (inputValue === "") {
			setOpen(false);
		} else {
			setOpen(true);
		}
	}, [inputValue]);

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex flex-wrap gap-1.5 rounded-md border p-1.5">
				{value.map((tag) => (
					<Badge
						key={tag}
						variant="secondary"
						className="flex items-center gap-1"
					>
						{tag}
						<Button
							type="button"
							variant="ghost"
							size="iconSm"
							onClick={() => handleRemoveTag(tag)}
							className="h-3 w-3 rounded-full p-0 text-muted-foreground hover:text-foreground"
						>
							<X className="h-2 w-2" />
							<span className="sr-only">Remove {tag}</span>
						</Button>
					</Badge>
				))}
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Input
							ref={inputRef}
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							className="h-7 flex-1 min-w-[120px] border-0 p-0 shadow-none focus-visible:ring-0"
							placeholder={value.length > 0 ? "" : "Add tags..."}
						/>
					</PopoverTrigger>
					<PopoverContent className="w-60 p-0" align="start">
						<Command>
							<CommandList>
								<CommandGroup>
									{filteredSuggestions.length > 0 ? (
										filteredSuggestions.map((tag) => (
											<CommandItem
												key={tag}
												onSelect={() => {
													handleAddTag(tag);
													setOpen(false);
												}}
											>
												{tag}
											</CommandItem>
										))
									) : (
										<CommandItem
											onSelect={() => {
												handleAddTag(inputValue);
												setOpen(false);
											}}
										>
											Add "{inputValue}"
										</CommandItem>
									)}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>
			<p className="text-xs text-muted-foreground">Press enter to add a tag</p>
		</div>
	);
};
