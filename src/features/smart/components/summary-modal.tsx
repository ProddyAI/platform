"use client";

import { Check, Copy, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface SummaryModalProps {
	isOpen: boolean;
	onClose: () => void;
	summary: string;
	messageCount: number;
	isCached?: boolean;
}

export const SummaryModal = ({
	isOpen,
	onClose,
	summary,
	messageCount,
	isCached = false,
}: SummaryModalProps) => {
	const [isCopied, setIsCopied] = useState(false);

	// Handle ESC key press
	useEffect(() => {
		const handleEsc = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEsc);
		}

		return () => {
			document.removeEventListener("keydown", handleEsc);
		};
	}, [isOpen, onClose]);

	// Prevent scrolling when modal is open
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}

		return () => {
			document.body.style.overflow = "auto";
		};
	}, [isOpen]);

	const handleCopy = () => {
		navigator.clipboard.writeText(summary);
		setIsCopied(true);
		toast.success("Summary copied to clipboard");

		setTimeout(() => {
			setIsCopied(false);
		}, 2000);
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div
				className="relative w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="mb-4">
					<div className="flex items-center justify-between">
						<h2 className="flex items-center gap-2 text-xl font-semibold">
							<Sparkles className="h-5 w-5 text-blue-500" />
							<span>
								{isCached ? "Cached Summary" : "Message Summary"}
								<span className="ml-2 text-sm font-normal text-muted-foreground">
									({messageCount} {messageCount === 1 ? "message" : "messages"})
								</span>
							</span>
						</h2>
						<button
							className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
							onClick={onClose}
						>
							<X className="h-5 w-5" />
						</button>
					</div>
					<p className="mt-1 text-sm text-gray-500">
						{isCached
							? "This summary was retrieved from cache for faster results."
							: "AI-generated summary of the selected messages."}
					</p>
				</div>

				{/* Content */}
				<div className="mt-2 rounded-md border bg-muted/50 p-4 max-h-[60vh] overflow-y-auto">
					<div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:italic prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300">
						<ReactMarkdown>{summary}</ReactMarkdown>
					</div>
				</div>

				{/* Footer */}
				<div className="mt-4 flex justify-between">
					<Button onClick={handleCopy} variant="outline">
						{isCopied ? (
							<>
								<Check className="mr-2 h-4 w-4" />
								Copied
							</>
						) : (
							<>
								<Copy className="mr-2 h-4 w-4" />
								Copy to clipboard
							</>
						)}
					</Button>
					<Button onClick={onClose}>Close</Button>
				</div>
			</div>
		</div>
	);
};
