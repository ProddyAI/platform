"use client";

import { useMutation } from "convex/react";
import { Download, MessageSquare } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { Note } from "../types";

interface ExportNoteDialogProps {
	isOpen: boolean;
	onClose: () => void;
	note: Note;
}

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
	const createMessage = useMutation(api.messages.create);

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
					content.forEach((block: any) => {
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

	const convertBlockToMarkdown = (block: any): string => {
		if (!block || !block.type) return "";

		switch (block.type) {
			case "paragraph":
				return `${block.content || ""}\n\n`;
			case "heading": {
				const level = block.props?.level || 1;
				const hashes = "#".repeat(level);
				return `${hashes} ${block.content || ""}\n\n`;
			}
			case "bulletListItem":
				return `- ${block.content || ""}\n`;
			case "numberedListItem":
				return `1. ${block.content || ""}\n`;
			default:
				return `${block.content || ""}\n\n`;
		}
	};

	const convertToHTML = (note: Note): string => {
		let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${note.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .tags { background: #f0f0f0; padding: 5px 10px; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <h1>${note.title}</h1>
  <div class="meta">`;

		if (note.tags && note.tags.length > 0) {
			html += `<div class="tags">Tags: ${note.tags.join(", ")}</div><br>`;
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
					content.forEach((block: any) => {
						html += convertBlockToHTML(block);
					});
				} else {
					html += `<p>${note.content}</p>`;
				}
			} catch {
				html += `<p>${note.content}</p>`;
			}
		}

		html += `</div>
</body>
</html>`;

		return html;
	};

	const convertBlockToHTML = (block: any): string => {
		if (!block || !block.type) return "";

		switch (block.type) {
			case "paragraph":
				return `<p>${block.content || ""}</p>`;
			case "heading": {
				const level = block.props?.level || 1;
				return `<h${level}>${block.content || ""}</h${level}>`;
			}
			case "bulletListItem":
				return `<li>${block.content || ""}</li>`;
			case "numberedListItem":
				return `<li>${block.content || ""}</li>`;
			default:
				return `<p>${block.content || ""}</p>`;
		}
	};

	const convertToPDF = (note: Note): string => {
		const htmlContent = convertToHTML(note);

		// This is a placeholder - in production you'd generate actual PDF
		return `data:text/html;base64,${btoa(htmlContent)}`;
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
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
				exportFormat: exportFormat,
				exportTime: new Date().toISOString(),
				exportData: exportData,
				fileSize: fileSizeFormatted,
				fileName: `${note.title}.${fileExtension}`,
			};

			// Create a message in the channel with the note export
			await createMessage({
				workspaceId: workspaceId,
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
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Export Note</DialogTitle>
					<DialogDescription>
						Export "{note?.title}" in your preferred format
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="format" className="w-full">
					<TabsList className="grid w-full grid-cols-1">
						<TabsTrigger value="format">Export Format</TabsTrigger>
					</TabsList>

					<TabsContent value="format" className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<Button
								variant={exportFormat === "markdown" ? "default" : "outline"}
								onClick={() => setExportFormat("markdown")}
								className="h-20 flex flex-col items-center justify-center"
							>
								<span className="text-lg mb-1">📝</span>
								<span className="text-xs">Markdown</span>
							</Button>

							<Button
								variant={exportFormat === "html" ? "default" : "outline"}
								onClick={() => setExportFormat("html")}
								className="h-20 flex flex-col items-center justify-center"
							>
								<span className="text-lg mb-1">🌐</span>
								<span className="text-xs">HTML</span>
							</Button>

							<Button
								variant={exportFormat === "json" ? "default" : "outline"}
								onClick={() => setExportFormat("json")}
								className="h-20 flex flex-col items-center justify-center"
							>
								<span className="text-lg mb-1">📋</span>
								<span className="text-xs">JSON</span>
							</Button>

							<Button
								variant={exportFormat === "pdf" ? "default" : "outline"}
								onClick={() => setExportFormat("pdf")}
								className="h-20 flex flex-col items-center justify-center"
							>
								<span className="text-lg mb-1">📄</span>
								<span className="text-xs">PDF</span>
							</Button>
						</div>
					</TabsContent>
				</Tabs>

				<DialogFooter className="flex justify-between">
					<Button
						variant="outline"
						onClick={handleExportToChat}
						disabled={isExporting}
						className="flex items-center"
					>
						<MessageSquare className="h-4 w-4 mr-2" />
						Share in Chat
					</Button>

					<Button
						onClick={handleExportToSystem}
						disabled={isExporting}
						className="flex items-center"
					>
						<Download className="h-4 w-4 mr-2" />
						{isExporting ? "Exporting..." : "Download"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
