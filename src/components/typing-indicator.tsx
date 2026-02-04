"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
	typingText: string;
	isVisible: boolean;
	className?: string;
}

export const TypingIndicator = ({
	typingText,
	isVisible,
	className,
}: TypingIndicatorProps) => {
	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 10 }}
					transition={{ duration: 0.2 }}
					className={cn(
						"px-5 py-1 text-sm text-muted-foreground italic flex items-center gap-2",
						className
					)}
				>
					<div className="flex gap-1">
						<motion.div
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							animate={{ y: [0, -4, 0] }}
							transition={{
								duration: 0.6,
								repeat: Number.POSITIVE_INFINITY,
								delay: 0,
							}}
						/>
						<motion.div
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							animate={{ y: [0, -4, 0] }}
							transition={{
								duration: 0.6,
								repeat: Number.POSITIVE_INFINITY,
								delay: 0.2,
							}}
						/>
						<motion.div
							className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
							animate={{ y: [0, -4, 0] }}
							transition={{
								duration: 0.6,
								repeat: Number.POSITIVE_INFINITY,
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
