"use client";

import { useMutation } from "convex/react";
import { jsPDF } from "jspdf";
import {
	Download,
	FileJson,
	FileText,
	FileType,
	Globe,
	MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { formatFileSize } from "@/lib/utils";
import type { Note } from "../types";

interface ExportNoteDialogProps {
	isOpen: boolean;
	onClose: () => void;
	note: Note;
}

type ExportBlock = {
	type?: string;
	// BlockNote stores rich text here as InlineContent[] (styled text / links),
	// never a plain string — see extractPlainText below.
	content?: unknown;
	props?: { level?: number };
};

// BlockNote's block.content is an array of styled-text/link nodes (InlineContent[]),
// not a string — stringifying it directly renders "[object Object]". Walk it to
// pull out the readable text instead.
const extractPlainText = (content: unknown): string => {
	if (!content) return "";
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((item) => {
				if (typeof item === "string") return item;
				if (item && typeof item === "object") {
					if ("text" in item && typeof item.text === "string") {
						return item.text;
					}
					if ("content" in item) {
						return extractPlainText((item as { content?: unknown }).content);
					}
				}
				return "";
			})
			.join("");
	}
	return "";
};

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export const ExportNoteDialog = ({
	isOpen,
	onClose,
	note,
}: ExportNoteDialogProps) => {
	const [exportFormat, setExportFormat] = useState<
		"pdf" | "markdown" | "html" | "json"
	>("markdown");
	const [isExporting, setIsExporting] = useState(false);
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const createMessage = useMutation(api.messaging.messages.create);

	// Client-side conversion functions (moved from API route)
	const convertToMarkdown = (note: Note): string => {
		let markdown = `# ${note.title}\n\n`;

		if (note.tags && note.tags.length > 0) {
			markdown += `**Tags:** ${note.tags.join(", ")}\n\n`;
		}

		markdown += `**Created:** ${new Date(note.createdAt).toLocaleDateString()}\n`;
		markdown += `**Updated:** ${new Date(note.updatedAt).toLocaleDateString()}\n\n`;
		markdown += "---\n\n";

		// Convert BlockNote content to markdown
		if (note.content) {
			try {
				const content = JSON.parse(note.content);
				if (Array.isArray(content)) {
					content.forEach((block: ExportBlock) => {
						markdown += convertBlockToMarkdown(block);
					});
				} else {
					markdown += note.content;
				}
			} catch {
				markdown += note.content;
			}
		}

		return markdown;
	};

	const convertBlockToMarkdown = (block: ExportBlock): string => {
		if (!block?.type) return "";
		const text = extractPlainText(block.content);

		switch (block.type) {
			case "paragraph":
				return `${text}\n\n`;
			case "heading": {
				const level = block.props?.level || 1;
				const hashes = "#".repeat(level);
				return `${hashes} ${text}\n\n`;
			}
			case "bulletListItem":
				return `- ${text}\n`;
			case "numberedListItem":
				return `1. ${text}\n`;
			default:
				return `${text}\n\n`;
		}
	};

	const convertToHTML = (note: Note): string => {
		const title = escapeHtml(note.title);

		// Arial here is intentional: this markup ships as a standalone exported
		// file that must render consistently outside the app's own theming/fonts.
		let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .tags { background: #f0f0f0; padding: 5px 10px; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">`;

		if (note.tags && note.tags.length > 0) {
			html += `<div class="tags">Tags: ${escapeHtml(note.tags.join(", "))}</div><br>`;
		}

		html += `Created: ${new Date(note.createdAt).toLocaleDateString()}<br>
      Updated: ${new Date(note.updatedAt).toLocaleDateString()}
    </div>
    <hr>
    <div class="content">`;

		// Convert content to HTML
		if (note.content) {
			try {
				const content = JSON.parse(note.content);
				if (Array.isArray(content)) {
					content.forEach((block: ExportBlock) => {
						html += convertBlockToHTML(block);
					});
				} else {
					html += `<p>${escapeHtml(note.content)}</p>`;
				}
			} catch {
				html += `<p>${escapeHtml(note.content)}</p>`;
			}
		}

		html += `</div>
</body>
</html>`;

		return html;
	};

	const convertBlockToHTML = (block: ExportBlock): string => {
		if (!block?.type) return "";
		const text = escapeHtml(extractPlainText(block.content));

		switch (block.type) {
			case "paragraph":
				return `<p>${text}</p>`;
			case "heading": {
				const level = block.props?.level || 1;
				return `<h${level}>${text}</h${level}>`;
			}
			case "bulletListItem":
				return `<li>${text}</li>`;
			case "numberedListItem":
				return `<li>${text}</li>`;
			default:
				return `<p>${text}</p>`;
		}
	};

	const convertToPlainText = (note: Note): string => {
		if (!note.content) return "";
		try {
			const content = JSON.parse(note.content);
			if (Array.isArray(content)) {
				return content
					.map((block: ExportBlock) => extractPlainText(block?.content))
					.filter(Boolean)
					.join("\n");
			}
			return note.content;
		} catch {
			return note.content;
		}
	};

	const convertToPDF = (note: Note): string => {
		const doc = new jsPDF();

		doc.setFontSize(16);
		doc.text(note.title, 20, 20);

		doc.setFontSize(10);
		const metaLines = [
			...(note.tags && note.tags.length > 0
				? [`Tags: ${note.tags.join(", ")}`]
				: []),
			`Created: ${new Date(note.createdAt).toLocaleDateString()}`,
			`Updated: ${new Date(note.updatedAt).toLocaleDateString()}`,
		];
		doc.text(metaLines, 20, 30);

		doc.setFontSize(12);
		const bodyText = doc.splitTextToSize(convertToPlainText(note), 170);
		doc.text(bodyText, 20, 30 + metaLines.length * 6 + 6);

		return doc.output("datauristring");
	};

	// Export to chat (save as a message in the channel)
	const handleExportToChat = async () => {
		try {
			if (!channelId || !workspaceId || !note) {
				toast.error("Cannot export note: missing required data");
				return;
			}

			setIsExporting(true);

			// Generate export data client-side
			let exportData: string;
			let _contentType: string;
			let fileExtension: string;

			switch (exportFormat) {
				case "markdown":
					exportData = convertToMarkdown(note);
					_contentType = "text/markdown";
					fileExtension = "md";
					break;

				case "html":
					exportData = convertToHTML(note);
					_contentType = "text/html";
					fileExtension = "html";
					break;

				case "json":
					exportData = JSON.stringify(
						{
							id: note._id,
							title: note.title,
							content: note.content,
							tags: note.tags,
							createdAt: note.createdAt,
							updatedAt: note.updatedAt,
							exportedAt: new Date().toISOString(),
						},
						null,
						2
					);
					_contentType = "application/json";
					fileExtension = "json";
					break;

				case "pdf":
					exportData = convertToPDF(note);
					_contentType = "application/pdf";
					fileExtension = "pdf";
					break;

				default:
					throw new Error("Unsupported export format");
			}

			// Calculate file size
			const fileSize = new Blob([exportData]).size;
			const fileSizeFormatted = formatFileSize(fileSize);

			// Prepare the message data
			const messageData = {
				type: "note-export",
				noteId: note._id,
				noteTitle: note.title,
				exportFormat,
				exportTime: new Date().toISOString(),
				exportData,
				fileSize: fileSizeFormatted,
				fileName: `${note.title}.${fileExtension}`,
			};

			// Create a message in the channel with the note export
			await createMessage({
				workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify(messageData),
			});

			toast.success(
				`Note exported as ${exportFormat.toUpperCase()} and shared in chat`
			);
			onClose();
		} catch (error) {
			console.error("Export error:", error);
			toast.error("Failed to export note");
		} finally {
			setIsExporting(false);
		}
	};

	// Export to system (download file)
	const handleExportToSystem = async () => {
		try {
			if (!note) {
				toast.error("Cannot export note: missing note data");
				return;
			}

			setIsExporting(true);

			// Generate export data client-side
			let exportData: string;
			let contentType: string;
			let fileExtension: string;

			switch (exportFormat) {
				case "markdown":
					exportData = convertToMarkdown(note);
					contentType = "text/markdown";
					fileExtension = "md";
					break;

				case "html":
					exportData = convertToHTML(note);
					contentType = "text/html";
					fileExtension = "html";
					break;

				case "json":
					exportData = JSON.stringify(
						{
							id: note._id,
							title: note.title,
							content: note.content,
							tags: note.tags,
							createdAt: note.createdAt,
							updatedAt: note.updatedAt,
							exportedAt: new Date().toISOString(),
						},
						null,
						2
					);
					contentType = "application/json";
					fileExtension = "json";
					break;

				case "pdf":
					exportData = convertToPDF(note);
					contentType = "application/pdf";
					fileExtension = "pdf";
					break;

				default:
					throw new Error("Unsupported export format");
			}

			const fileName = `${note.title}.${fileExtension}`;

			// Create download link
			let downloadUrl: string;

			if (exportFormat === "pdf" && exportData.startsWith("data:")) {
				// Handle data URLs (like PDF)
				downloadUrl = exportData;
			} else {
				// Handle text-based exports
				const blob = new Blob([exportData], {
					type: contentType,
				});
				downloadUrl = URL.createObjectURL(blob);
			}

			// Create and trigger download
			const a = document.createElement("a");
			a.href = downloadUrl;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			// Clean up object URL if created
			if (!exportData.startsWith("data:")) {
				URL.revokeObjectURL(downloadUrl);
			}

			toast.success(`Note exported as ${exportFormat.toUpperCase()}`);
			onClose();
		} catch (error) {
			console.error("Export error:", error);
			toast.error("Failed to export note");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Export Note</DialogTitle>
					<DialogDescription>
						Export &quot;{note?.title}&quot; in your preferred format
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-2 gap-3">
					<Button
						className="h-20 flex flex-col items-center justify-center"
						onClick={() => setExportFormat("markdown")}
						variant={exportFormat === "markdown" ? "default" : "outline"}
					>
						<FileText aria-hidden="true" className="size-5 mb-1" />
						<span className="text-xs">Markdown</span>
					</Button>

					<Button
						className="h-20 flex flex-col items-center justify-center"
						onClick={() => setExportFormat("html")}
						variant={exportFormat === "html" ? "default" : "outline"}
					>
						<Globe aria-hidden="true" className="size-5 mb-1" />
						<span className="text-xs">HTML</span>
					</Button>

					<Button
						className="h-20 flex flex-col items-center justify-center"
						onClick={() => setExportFormat("json")}
						variant={exportFormat === "json" ? "default" : "outline"}
					>
						<FileJson aria-hidden="true" className="size-5 mb-1" />
						<span className="text-xs">JSON</span>
					</Button>

					<Button
						className="h-20 flex flex-col items-center justify-center"
						onClick={() => setExportFormat("pdf")}
						variant={exportFormat === "pdf" ? "default" : "outline"}
					>
						<FileType aria-hidden="true" className="size-5 mb-1" />
						<span className="text-xs">PDF</span>
					</Button>
				</div>

				<DialogFooter className="flex justify-between">
					<Button
						className="flex items-center"
						disabled={isExporting}
						onClick={handleExportToChat}
						variant="outline"
					>
						<MessageSquare className="size-4 mr-2" />
						Share in Chat
					</Button>

					<Button
						className="flex items-center"
						disabled={isExporting}
						onClick={handleExportToSystem}
					>
						<Download className="size-4 mr-2" />
						{isExporting ? "Exporting..." : "Download"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
