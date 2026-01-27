"use client";

import { useMutation } from "convex/react";
import { Download, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
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
	const [exportFormat, setExportFormat] = useState<"pdf" | "word">("pdf"); 
	const [isExporting, setIsExporting] = useState(false);
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const createMessage = useMutation(api.messages.create);

	// Escape HTML entities to prevent XSS and HTML breakage
	const escapeHtml = (text: string): string => {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	};

	// Extract text from a block, optionally escaping for HTML
	const extractTextFromBlock = (block: any, escape = false): string => {
		if (!block?.content) return "";

		if (Array.isArray(block.content)) {
			return block.content
				.map((item: any) => {
					if (item.text) return escape ? escapeHtml(item.text) : item.text;
					if (item.content) return extractTextFromBlock(item, escape);
					return "";
				})
				.join("");
		}

		return "";
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
					let i = 0;

					while (i < content.length) {
						const block = content[i];

						if (block.type === "bulletListItem") {
							html += "<ul>";
							while (i < content.length && content[i].type === "bulletListItem") {
								html += convertBlockToHTML(content[i]);
								i++;
							}
							html += "</ul>";
							continue;
						}

						if (block.type === "numberedListItem") {
							html += "<ol>";
							while (i < content.length && content[i].type === "numberedListItem") {
								html += convertBlockToHTML(content[i]);
								i++;
							}
							html += "</ol>";
							continue;
						}

						html += convertBlockToHTML(block);
						i++;
					}
				} else {
					html += "<p>[Unsupported content format]</p>";
				}
			} catch {
				html += "<p>[Failed to parse note content]</p>";
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
			case "paragraph": {
				const text = extractTextFromBlock(block, true);
				return `<p>${text}</p>`;
			}

			case "heading": {
				const level = block.props?.level || 1;
				const text = extractTextFromBlock(block, true);
				return `<h${level}>${text}</h${level}>`;
			}

			case "bulletListItem": {
				const text = extractTextFromBlock(block, true);
				return `<li>${text}</li>`;
			}

			case "numberedListItem": {
				const text = extractTextFromBlock(block, true);
				return `<li>${text}</li>`;
			}

			default: {
				const text = extractTextFromBlock(block, true);
				return `<p>${text}</p>`;
			}
		}
	};



	const convertToPDF = async (note: Note): Promise<ArrayBuffer> => {
		const html = convertToHTML(note);

		const container = document.createElement("div");
		container.innerHTML = html;
		container.style.width = "800px";
		container.style.padding = "24px";
		container.style.fontFamily = "Inter, sans-serif";

		let pdf;
		try {
			document.body.appendChild(container);

			pdf = new jsPDF({
				orientation: "p",
				unit: "pt",
				format: "a4",
			});

			await pdf.html(container, {
				x: 40,
				y: 40,
				width: 515,
				windowWidth: 800,
			});
			return pdf.output("arraybuffer");
		} finally {
			if (container.parentNode) {
				container.parentNode.removeChild(container);
			}
		}
	};

	const convertToWord = async (note: Note): Promise<Blob> => {
		let blocks: any[] = [];

		try {
			const parsed = JSON.parse(note.content);
			if (Array.isArray(parsed)) {
			blocks = parsed;
			}
		} catch {
			throw new Error("Failed to parse note content");
		}

		const paragraphs: Paragraph[] = [];
		let numberedListCounter = 0;
		let inNumberedList = false;

		// Title
		paragraphs.push(
			new Paragraph({
			children: [
				new TextRun({
				text: note.title,
				bold: true,
				size: 32,
				}),
			],
			spacing: { after: 300 },
			})
		);

		// Meta
		paragraphs.push(
			new Paragraph({
			children: [
				new TextRun({
				text: `Created: ${new Date(note.createdAt).toLocaleDateString()}`,
				italics: true,
				}),
			],
			})
		);

		paragraphs.push(
			new Paragraph({
			children: [
				new TextRun({
				text: `Updated: ${new Date(note.updatedAt).toLocaleDateString()}`,
				italics: true,
				}),
			],
			spacing: { after: 400 },
			})
		);

		// Content
		for (const block of blocks) {
			const text = extractTextFromBlock(block, false);

			if (!text) continue;

			if (block.type === "heading") {
			const level = block.props?.level ?? 1;

			paragraphs.push(
				new Paragraph({
				children: [
					new TextRun({
					text,
					bold: true,
					size: 28 - level * 2,
					}),
				],
				spacing: { before: 300, after: 200 },
				})
			);

			continue;
			}

			if (block.type === "bulletListItem") {
			paragraphs.push(
				new Paragraph({
				text,
				bullet: { level: 0 },
				})
			);
			continue;
			}

			if (block.type === "numberedListItem") {
				paragraphs.push(
					new Paragraph({
						text,
						numbering: {
							reference: "numbered-list",
							level: 0,
						},
					})
				);
				continue;
			}

			// Paragraph / default
			paragraphs.push(
			new Paragraph({
				children: [
				new TextRun({
					text,
				}),
				],
				spacing: { before: 100, after: 200 },
			})
			);
		}

		const doc = new Document({
			numbering: {
			config: [
				{
				reference: "numbered-list",
				levels: [
					{
					level: 0,
					format: "decimal",
					text: "%1.",
					alignment: "left",
					},
				],
				},
			],
			},
			sections: [
			{
				properties: {},
				children: paragraphs,
			},
			],
		});

		const blob = await Packer.toBlob(doc);
		return blob;
	};

	// Export to chat (save as a message in the channel)
	const handleExportToChat = async () => {
		try {
			if (exportFormat !== "word") {
				toast.error("Only Word export can be shared in chat");
				return;
			}

			if (!note) {
				toast.error("No note to export");
				return;
			}

			// Convert note to Word
			const wordBlob = await convertToWord(note);

			// Convert blob → base64 for chat transport
			const arrayBuffer = await wordBlob.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);
			let binary = "";
			const chunkSize = 8192;
			for (let i = 0; i < uint8Array.length; i += chunkSize){
				binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize));
			}
			const base64 = btoa(binary);

			const messageData = {
				type: "note-export",
				noteId: note._id,
				noteTitle: note.title,
				exportFormat: "word",
				exportTime: new Date().toISOString(),
				exportData: base64,
				fileName: `${note.title}.docx`,
			};
			
			if (!workspaceId || !channelId) {
				toast.error("Cannot share: missing workspace or channel");
				return;
			}

			await createMessage({
				workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify(messageData),
			});

			toast.success("Note exported as Word and shared in chat");
			onClose();
		} catch (error) {
			console.error("Export to chat failed:", error);
			toast.error("Failed to share note in chat");
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
		let downloadUrl: string;

		switch (exportFormat) {
			case "word": {
				const wordBlob = await convertToWord(note);

				const fileName = `${note.title}.docx`;
				const downloadUrl = URL.createObjectURL(wordBlob);

				const a = document.createElement("a");
				a.href = downloadUrl;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);

				URL.revokeObjectURL(downloadUrl);

				toast.success("Note exported as Word");
				onClose();
				return;
			}


			case "pdf": {
				const pdfBytes = await convertToPDF(note);

				const blob = new Blob([pdfBytes], {
					type: "application/pdf",
				});

				const fileName = `${note.title}.pdf`;
				downloadUrl = URL.createObjectURL(blob);

				try {
					const a = document.createElement("a");
					a.href = downloadUrl;
					a.download = fileName;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				} finally {
					URL.revokeObjectURL(downloadUrl);
				}


				toast.success("Note exported as PDF");
				onClose();
				return;
			}

			default:
				throw new Error("Unsupported export format");
		}

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
								variant={exportFormat === "word" ? "default" : "outline"}
								onClick={() => setExportFormat("word")}
								className="h-20 flex flex-col items-center justify-center"
							>
								<span className="text-lg mb-1">🌐</span>
								<span className="text-xs">Word</span>
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
						disabled={isExporting || exportFormat !== "word"}
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
