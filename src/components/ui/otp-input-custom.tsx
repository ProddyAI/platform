"use client";

import { cn } from "@/lib/utils";
import {
	type KeyboardEvent,
	type ClipboardEvent,
	useRef,
	type ChangeEvent,
} from "react";

interface OTPInputCustomProps {
	length?: number;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
}

export function OTPInputCustom({
	length = 6,
	value,
	onChange,
	disabled = false,
	className,
}: OTPInputCustomProps) {
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	const handleChange = (index: number, newValue: string) => {
		// Only allow digits
		const digit = newValue.replace(/\D/g, "");

		// Take only the last character if multiple (this is for regular typing)
		const singleDigit = digit.slice(-1);

		const newOtp = value.split("");
		newOtp[index] = singleDigit;
		onChange(newOtp.join("").slice(0, length));

		// DO NOT auto-advance - user stays on the same box
	};

	const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Backspace") {
			e.preventDefault();
			const newOtp = value.split("");

			if (newOtp[index]) {
				// Delete current digit
				newOtp[index] = "";
				onChange(newOtp.join("").slice(0, length));
			} else if (index > 0) {
				// Move to previous field and delete
				newOtp[index - 1] = "";
				onChange(newOtp.join("").slice(0, length));
				inputRefs.current[index - 1]?.focus();
			}
		} else if (e.key === "ArrowLeft" && index > 0) {
			e.preventDefault();
			inputRefs.current[index - 1]?.focus();
		} else if (e.key === "ArrowRight" && index < length - 1) {
			e.preventDefault();
			inputRefs.current[index + 1]?.focus();
		} else if (e.key === "Delete") {
			e.preventDefault();
			const newOtp = value.split("");
			newOtp[index] = "";
			onChange(newOtp.join("").slice(0, length));
		}
	};

	const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault();
		const pastedData = e.clipboardData.getData("text");
		const digits = pastedData.replace(/\D/g, "").slice(0, length);

		if (digits) {
			onChange(digits.padEnd(length, "").slice(0, length));
			// Focus the last filled digit or the last input
			const nextIndex = Math.min(digits.length, length - 1);
			inputRefs.current[nextIndex]?.focus();
		}
	};

	const handleFocus = (index: number) => {
		// Select the content when focused
		inputRefs.current[index]?.select();
	};

	const handleClick = (index: number) => {
		// When clicking, select the content
		inputRefs.current[index]?.select();
	};

	return (
		<div className={cn("flex items-center gap-2", className)}>
			{Array.from({ length }).map((_, index) => (
				<input
					key={index}
					ref={(el) => {
						inputRefs.current[index] = el;
					}}
					type="text"
					inputMode="numeric"
					maxLength={1}
					value={value[index] || ""}
					onChange={(e: ChangeEvent<HTMLInputElement>) =>
						handleChange(index, e.target.value)
					}
					onKeyDown={(e) => handleKeyDown(index, e)}
					onPaste={handlePaste}
					onFocus={() => handleFocus(index)}
					onClick={() => handleClick(index)}
					disabled={disabled}
					className={cn(
						"w-12 h-12 text-lg text-center border-2 rounded-xl transition-all",
						"focus:border-pink-500 focus:outline-none focus:ring-0",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						"bg-background",
					)}
				/>
			))}
		</div>
	);
}
