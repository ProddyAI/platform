"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
	typingText?: string;
	isVisible: boolean;
	className?: string;
}

export const TypingIndicator = ({
	typingText = "",
	isVisible,
	className,
}: TypingIndicatorProps) => {
	const shouldReduceMotion = useReducedMotion();

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					animate={{ opacity: 1, y: 0 }}
					className={cn(
						"px-5 py-1 text-sm text-muted-foreground italic flex items-center gap-2",
						className
					)}
					exit={{ opacity: 0, y: 10 }}
					initial={{ opacity: 0, y: 10 }}
					transition={{ duration: 0.2 }}
				>
					<div className="flex gap-1">
						<motion.div
							animate={shouldReduceMotion ? { opacity: 1 } : { y: [0, -4, 0] }}
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							transition={{
								duration: 0.6,
								repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
								delay: 0,
							}}
						/>
						<motion.div
							animate={shouldReduceMotion ? { opacity: 1 } : { y: [0, -4, 0] }}
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							transition={{
								duration: 0.6,
								repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
								delay: 0.2,
							}}
						/>
						<motion.div
							animate={shouldReduceMotion ? { opacity: 1 } : { y: [0, -4, 0] }}
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							transition={{
								duration: 0.6,
								repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
								delay: 0.4,
							}}
						/>
					</div>
					<span>{typingText}</span>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
