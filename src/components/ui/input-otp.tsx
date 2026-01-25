"use client";

import { OTPInput, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// Context to provide input ref to InputOTPSlot components
const InputOTPRefContext = React.createContext<
	React.RefObject<HTMLInputElement> | undefined
>(undefined);

const InputOTP = React.forwardRef<
	React.ElementRef<typeof OTPInput>,
	React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => {
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Merge refs if external ref is provided
	React.useImperativeHandle(ref, () => inputRef.current as any);

	return (
		<InputOTPRefContext.Provider value={inputRef}>
			<OTPInput
				ref={inputRef}
				containerClassName={cn(
					"flex items-center gap-2 has-[:disabled]:opacity-50",
					containerClassName
				)}
				className={cn("disabled:cursor-not-allowed", className)}
				{...props}
			/>
		</InputOTPRefContext.Provider>
	);
});
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
	const inputOTPContext = React.useContext(OTPInputContext);
	const inputRef = React.useContext(InputOTPRefContext);
	const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

	return (
		<div
			ref={ref}
			className={cn(
				"relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md cursor-pointer",
				isActive && "z-10 ring-2 ring-ring ring-offset-background",
				className
			)}
			onClick={() => {
				// Use ref to access the input element directly
				if (inputRef?.current) {
					inputRef.current.focus();
					// Set cursor position to this slot
					inputRef.current.setSelectionRange(index, index);
				}
			}}
			{...props}
		>
			{char}
			{hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
				</div>
			)}
		</div>
	);
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
	React.ElementRef<"div">,
	React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
	<div ref={ref} role="separator" {...props}>
		<Dot />
	</div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
