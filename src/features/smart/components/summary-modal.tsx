"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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

	const handleCopy = () => {
		navigator.clipboard.writeText(summary);
		setIsCopied(true);
		toast.success("Summary copied to clipboard");

		setTimeout(() => {
			setIsCopied(false);
		}, 2000);
	};

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			open={isOpen}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-secondary" />
						<span>
							Message Summary
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								({messageCount} {messageCount === 1 ? "message" : "messages"})
							</span>
						</span>
						{isCached && <Badge variant="outline">Cached</Badge>}
					</DialogTitle>
					<DialogDescription>
						AI-generated summary of the selected messages.
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/50 p-4">
					<div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mb-2 prose-headings:mt-2 prose-p:my-1 prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-muted-foreground">
						<ReactMarkdown>{summary}</ReactMarkdown>
					</div>
				</div>

				<DialogFooter className="sm:justify-between">
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
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
