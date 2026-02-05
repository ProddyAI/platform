import { X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

interface LabelInputProps {
	value: string;
	onChange: (value: string) => void;
	suggestions: string[];
	placeholder?: string;
}

const LabelInput: React.FC<LabelInputProps> = ({
	value,
	onChange,
	suggestions,
	placeholder = "Labels (comma separated)",
}) => {
	const [inputValue, setInputValue] = useState(value);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
	const [selectedLabels, setSelectedLabels] = useState<string[]>(
		value
			.split(",")
			.map((l) => l.trim())
			.filter(Boolean)
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const suggestionsRef = useRef<HTMLDivElement>(null);

	// Update input value when external value changes
	useEffect(() => {
		setInputValue(value);
		setSelectedLabels(
			value
				.split(",")
				.map((l) => l.trim())
				.filter(Boolean)
		);
	}, [value]);

	// Handle input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setInputValue(newValue);

		// Filter suggestions based on current input
		const currentInput = newValue.split(",").pop()?.trim() || "";
		if (currentInput && currentInput.length > 0) {
			const filtered = suggestions.filter((suggestion) =>
				suggestion.toLowerCase().includes(currentInput.toLowerCase())
			);
			setFilteredSuggestions(filtered);
			setShowSuggestions(filtered.length > 0);
		} else {
			setShowSuggestions(false);
		}
	};

	// Handle suggestion click
	const handleSuggestionClick = (suggestion: string) => {
		const parts = inputValue.split(",");
		parts.pop(); // Remove the current input

		// Add the selected suggestion
		const newValue = `${[...parts, suggestion].join(", ")}, `;
		setInputValue(newValue);
		onChange(newValue);
		setShowSuggestions(false);

		// Focus the input after selection
		if (inputRef.current) {
			inputRef.current.focus();
		}
	};

	// Handle blur event
	const handleBlur = (e: React.FocusEvent) => {
		// Check if the blur is because we're clicking on a suggestion
		if (suggestionsRef.current?.contains(e.relatedTarget as Node)) {
			return;
		}

		// Otherwise, hide suggestions
		setTimeout(() => {
			setShowSuggestions(false);
			// Update the parent component with the current value
			onChange(inputValue);
		}, 200);
	};

	// Handle key down events
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			setShowSuggestions(false);
		} else if (
			e.key === "Enter" &&
			showSuggestions &&
			filteredSuggestions.length > 0
		) {
			e.preventDefault();
			handleSuggestionClick(filteredSuggestions[0]);
		} else if (
			e.key === "Tab" &&
			showSuggestions &&
			filteredSuggestions.length > 0
		) {
			e.preventDefault();
			handleSuggestionClick(filteredSuggestions[0]);
		}
	};

	// Remove a label
	const removeLabel = (label: string) => {
		const newLabels = selectedLabels.filter((l) => l !== label);
		setSelectedLabels(newLabels);
		const newValue = newLabels.join(", ");
		setInputValue(newValue);
		onChange(newValue);
	};

	return (
		<div className="relative w-full">
			{/* Selected labels */}
			{selectedLabels.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
				{Array.from(new Set(selectedLabels)).map((label) => (
					<Badge
						className="flex items-center gap-1 bg-secondary/20 text-secondary-foreground"
						key={label}
							variant="secondary"
						>
							{label}
							<X
								className="h-3 w-3 cursor-pointer hover:text-destructive"
								onClick={() => removeLabel(label)}
							/>
						</Badge>
					))}
				</div>
			)}

			{/* Input field */}
			<Input
				onBlur={handleBlur}
				onChange={handleInputChange}
				onFocus={() => {
					const currentInput = inputValue.split(",").pop()?.trim() || "";
					if (currentInput && currentInput.length > 0) {
						const filtered = suggestions.filter((suggestion) =>
							suggestion.toLowerCase().includes(currentInput.toLowerCase())
						);
						setFilteredSuggestions(filtered);
						setShowSuggestions(filtered.length > 0);
					}
				}}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				ref={inputRef}
				value={inputValue}
			/>

			{/* Suggestions dropdown */}
			{showSuggestions && (
				<div
					className="absolute z-10 mt-1 w-full max-h-40 overflow-auto bg-white border rounded-md shadow-lg"
					ref={suggestionsRef}
				>
					{filteredSuggestions.map((suggestion, index) => (
						<div
							className={cn(
								"px-3 py-1.5 cursor-pointer hover:bg-secondary/10",
								"text-sm text-foreground"
							)}
							key={`${suggestion}-${index}`}
							onClick={() => handleSuggestionClick(suggestion)}
						>
							{suggestion}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default LabelInput;
