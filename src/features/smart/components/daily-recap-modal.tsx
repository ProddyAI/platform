"use client";

import { format } from "date-fns";
import type { Paragraph } from "docx";
import { Check, Copy, File, FileOutput, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface DailyRecapModalProps {
	isOpen: boolean;
	onClose: () => void;
	recap: string;
	date: string;
	messageCount: number;
	isCached?: boolean;
}

export const DailyRecapModal = ({
	isOpen,
	onClose,
	recap,
	date,
	messageCount,
	isCached = false,
}: DailyRecapModalProps) => {
	const [isCopied, setIsCopied] = useState(false);
	const formattedDate = date
		? format(new Date(date), "EEEE, MMMM d, yyyy")
		: "";

	const handleCopy = () => {
		navigator.clipboard.writeText(recap);
		setIsCopied(true);
		toast.success("Recap copied to clipboard");

		setTimeout(() => {
			setIsCopied(false);
		}, 2000);
	};

	const handleExportPDF = async () => {
		try {
			const { jsPDF } = await import("jspdf");
			// Create a new PDF document
			const doc = new jsPDF();

			// Set title
			const title = `Daily Recap - ${formattedDate}`;
			doc.setFontSize(16);
			doc.text(title, 20, 20);

			// Add message count info
			doc.setFontSize(10);
			doc.text(
				`(${messageCount} ${messageCount === 1 ? "message" : "messages"})`,
				20,
				30
			);

			// Convert markdown to plain text for PDF
			const plainText = recap
				.replace(/#{1,6}\s?([^\n]+)/g, "$1\n") // headers
				.replace(/\*\*([^*]+)\*\*/g, "$1") // bold
				.replace(/\*([^*]+)\*/g, "$1") // italic
				.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") // links
				.replace(/>\s?([^\n]+)/g, "  $1\n") // blockquotes
				.replace(/- ([^\n]+)/g, "• $1") // bullet points
				.replace(/\n\n/g, "\n"); // extra newlines

			// Add content with word wrapping
			doc.setFontSize(12);
			const splitText = doc.splitTextToSize(plainText, 170);
			doc.text(splitText, 20, 40);

			// Save the PDF
			doc.save(`daily-recap-${date}.pdf`);
			toast.success("Exported as PDF");
		} catch (error) {
			console.error("Error exporting to PDF:", error);
			toast.error("Failed to export as PDF");
		}
	};

	const handleExportWord = async () => {
		try {
			const { Document, HeadingLevel, Packer, Paragraph, TextRun } =
				await import("docx");
			// Process markdown content to create document sections
			const lines = recap.split("\n");
			const paragraphs: Paragraph[] = [];

			lines.forEach((line) => {
				// Check if it's a header
				const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
				if (headerMatch) {
					const level = headerMatch[1].length;
					const text = headerMatch[2];

					paragraphs.push(
						new Paragraph({
							text,
							heading:
								level <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
						})
					);
				}
				// Check if it's a bullet point
				else if (/^- (.+)$/.test(line)) {
					const text = line.replace(/^- /, "");
					paragraphs.push(
						new Paragraph({
							text: `• ${text}`,
							bullet: { level: 0 },
						})
					);
				}
				// Regular paragraph
				else if (line.trim() !== "") {
					// Process bold and italic formatting
					const processedLine = line
						.replace(/\*\*([^*]+)\*\*/g, "$1") // bold
						.replace(/\*([^*]+)\*/g, "$1"); // italic

					paragraphs.push(new Paragraph({ text: processedLine }));
				}
			});

			// Create a new Word document with all paragraphs
			const doc = new Document({
				sections: [
					{
						properties: {},
						children: [
							new Paragraph({
								text: `Daily Recap - ${formattedDate}`,
								heading: HeadingLevel.HEADING_1,
							}),
							new Paragraph({
								children: [
									new TextRun({
										text: `(${messageCount} ${messageCount === 1 ? "message" : "messages"})`,
										italics: true,
									}),
								],
							}),
							new Paragraph({ text: "" }), // Empty paragraph for spacing
							...paragraphs,
						],
					},
				],
			});

			// Generate the Word document
			const buffer = await Packer.toBuffer(doc);

			// Create a blob from the buffer
			const blob = new Blob([new Uint8Array(buffer)], {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			});

			// Create a download link
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `daily-recap-${date}.docx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast.success("Exported as Word Document");
		} catch (error) {
			console.error("Error exporting to Word:", error);
			toast.error("Failed to export as Word Document");
		}
	};

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles aria-hidden="true" className="size-5 text-secondary" />
						<span>
							{isCached ? "Cached Daily Recap" : "Daily Recap"}
							<span className="ml-2 text-sm font-normal text-muted-foreground">
								({messageCount} {messageCount === 1 ? "message" : "messages"})
							</span>
						</span>
					</DialogTitle>
					<DialogDescription>
						{isCached
							? "This recap was retrieved from cache for faster results."
							: `AI-generated recap of conversations from ${formattedDate}.`}
					</DialogDescription>
				</DialogHeader>

				{/* Content */}
				<div className="rounded-md border bg-muted/50 p-4 max-h-[60vh] overflow-y-auto">
					<div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:italic prose-blockquote:text-muted-foreground">
						<ReactMarkdown>{recap}</ReactMarkdown>
					</div>
				</div>

				{/* Footer with export options */}
				<DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 sm:justify-between sm:space-x-0">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							className="flex items-center gap-1 text-xs"
							onClick={handleCopy}
							size="sm"
							variant="outline"
						>
							{isCopied ? (
								<Check aria-hidden="true" className="size-3" />
							) : (
								<Copy aria-hidden="true" className="size-3" />
							)}
							{isCopied ? "Copied" : "Copy"}
						</Button>
						<Button
							className="flex items-center gap-1 text-xs"
							onClick={handleExportWord}
							size="sm"
							variant="outline"
						>
							<File aria-hidden="true" className="size-3" />
							Export Word
						</Button>
						<Button
							className="flex items-center gap-1 text-xs"
							onClick={handleExportPDF}
							size="sm"
							variant="outline"
						>
							<FileOutput aria-hidden="true" className="size-3" />
							Export PDF
						</Button>
					</div>
					<DialogClose asChild>
						<Button className="text-xs" size="sm" variant="ghost">
							Close
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
