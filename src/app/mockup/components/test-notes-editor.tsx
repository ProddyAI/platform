"use client";

import { Image, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	tags: string[];
	folder: string;
	isShared: boolean;
	collaborators: string[];
}

interface TestNotesEditorProps {
	note: Note;
	onUpdate: (updates: Partial<Note>) => void;
}

export const TestNotesEditor = ({ note, onUpdate }: TestNotesEditorProps) => {
	const [title, setTitle] = useState(note.title);
	const [content, setContent] = useState(note.content);
	const [isEditing, setIsEditing] = useState(false);
	const router = useRouter();

	useEffect(() => {
		setTitle(note.title);
		setContent(note.content);
		setIsEditing(false);
	}, [note.title, note.content]);

	const handleSave = () => {
		onUpdate({
			title,
			content,
			updatedAt: new Date(),
		});
		setIsEditing(false);
	};

	const handleTitleChange = (newTitle: string) => {
		setTitle(newTitle);
		setIsEditing(true);
	};

	const handleLinkClick = (href: string) => {
		if (href.startsWith("/mockup/")) {
			router.push(href);
		} else {
			window.open(href, "_blank");
		}
	};

	// Enhanced markdown rendering with proper formatting support
	const renderInlineFormatting = (text: string, lineIndex: number) => {
		const parts: (string | React.ReactElement)[] = [];
		let currentIndex = 0;

		// Combined regex for all inline formatting
		const combinedRegex = /(\*\*(.*?)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`)/g;
		let match: RegExpExecArray | null;

		while ((match = combinedRegex.exec(text)) !== null) {
			// Add text before the match
			if (match.index > currentIndex) {
				parts.push(text.substring(currentIndex, match.index));
			}

			if (match[0].startsWith("**")) {
				// Bold text
				parts.push(
					<strong
						key={`bold-${lineIndex}-${match.index}`}
						className="font-semibold"
					>
						{match[2]}
					</strong>
				);
			} else if (match[0].startsWith("[")) {
				// Links
				parts.push(
					<button
						key={`link-${lineIndex}-${match.index}`}
						onClick={() => match?.[4] && handleLinkClick(match[4])}
						className="text-blue-600 hover:text-blue-800 underline font-medium"
					>
						{match?.[3]}
					</button>
				);
			} else if (match[0].startsWith("`")) {
				// Inline code
				parts.push(
					<code
						key={`code-${lineIndex}-${match.index}`}
						className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono"
					>
						{match[5]}
					</code>
				);
			}

			currentIndex = match.index + match[0].length;
		}

		// Add remaining text
		if (currentIndex < text.length) {
			parts.push(text.substring(currentIndex));
		}

		return parts.length > 0 ? parts : [text];
	};

	const renderContent = (text: string) => {
		const lines = text.split("\n");
		const elements: React.ReactElement[] = [];
		let addedBrainstormButton = false;
		let inList = false;
		let listItems: React.ReactElement[] = [];

		const flushList = (currentIndex: number) => {
			if (listItems.length > 0) {
				elements.push(
					<ul key={`list-${currentIndex}`} className="list-none space-y-1 mb-4">
						{listItems}
					</ul>
				);
				listItems = [];
				inList = false;
			}
		};

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			const trimmedLine = line.trim();

			// Add "View Brainstorm Content" button after the first section
			if (!addedBrainstormButton && (trimmedLine === "---" || index === 8)) {
				flushList(index);
				elements.push(
					<div key={`brainstorm-${index}`} className="not-prose my-6">
						<div className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors">
							<div className="flex-shrink-0">
								<div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
									{/* eslint-disable-next-line jsx-a11y/alt-text */}
									<Image className="h-5 w-5 text-blue-600" />
								</div>
							</div>
							<div className="flex-1">
								<h4 className="font-medium text-blue-900 mb-1">
									Visual Brainstorming
								</h4>
								<p className="text-sm text-blue-700">
									Explore interactive diagrams, mockups, and visual planning
									materials related to this note.
								</p>
							</div>
							<Button
								onClick={() => handleLinkClick("/mockup/canvas")}
								variant="outline"
								size="sm"
								className="border-blue-300 text-blue-700 hover:bg-blue-100"
							>
								View Canvas
							</Button>
						</div>
					</div>
				);
				addedBrainstormButton = true;
			}

			// Headers
			if (trimmedLine.startsWith("# ")) {
				flushList(index);
				elements.push(
					<h1
						key={index}
						className="text-2xl font-bold mb-4 mt-6 text-gray-900"
					>
						{renderInlineFormatting(trimmedLine.substring(2), index)}
					</h1>
				);
				continue;
			}
			if (trimmedLine.startsWith("## ")) {
				flushList(index);
				elements.push(
					<h2
						key={index}
						className="text-xl font-semibold mb-3 mt-5 text-gray-800"
					>
						{renderInlineFormatting(trimmedLine.substring(3), index)}
					</h2>
				);
				continue;
			}
			if (trimmedLine.startsWith("### ")) {
				flushList(index);
				elements.push(
					<h3
						key={index}
						className="text-lg font-medium mb-2 mt-4 text-gray-800"
					>
						{renderInlineFormatting(trimmedLine.substring(4), index)}
					</h3>
				);
				continue;
			}

			// Checkboxes
			if (trimmedLine.startsWith("- [x]") || trimmedLine.startsWith("- [ ]")) {
				const isChecked = trimmedLine.startsWith("- [x]");
				const text = trimmedLine.replace(/^- \[[x ]\]\s*/, "");

				if (!inList) inList = true;
				listItems.push(
					<li key={`checkbox-${index}`} className="flex items-start gap-2">
						<span
							className={`text-sm mt-0.5 ${isChecked ? "text-green-600" : "text-gray-400"}`}
						>
							{isChecked ? "✅" : "☐"}
						</span>
						<span
							className={`flex-1 ${isChecked ? "line-through text-gray-500" : "text-gray-700"}`}
						>
							{renderInlineFormatting(text, index)}
						</span>
					</li>
				);
				continue;
			}

			// Regular lists
			if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
				const text = trimmedLine.substring(2);

				if (!inList) inList = true;
				listItems.push(
					<li key={`list-${index}`} className="flex items-start gap-2">
						<span className="text-gray-400 mt-1 text-sm">•</span>
						<span className="flex-1 text-gray-700">
							{renderInlineFormatting(text, index)}
						</span>
					</li>
				);
				continue;
			}

			// Numbered lists
			if (/^\d+\.\s/.test(trimmedLine)) {
				const match = trimmedLine.match(/^(\d+)\.\s(.*)$/);
				if (match) {
					if (!inList) inList = true;
					listItems.push(
						<li key={`numbered-${index}`} className="flex items-start gap-2">
							<span className="text-gray-500 font-medium text-sm mt-0.5">
								{match[1]}.
							</span>
							<span className="flex-1 text-gray-700">
								{renderInlineFormatting(match[2], index)}
							</span>
						</li>
					);
					continue;
				}
			}

			// If we reach here and were in a list, flush it
			if (inList) {
				flushList(index);
			}

			// Horizontal rule
			if (trimmedLine === "---") {
				elements.push(<hr key={index} className="my-6 border-gray-200" />);
				continue;
			}

			// Empty line
			if (trimmedLine === "") {
				elements.push(<div key={index} className="mb-2" />);
				continue;
			}

			// Regular paragraph
			elements.push(
				<p key={index} className="mb-3 text-gray-700 leading-relaxed">
					{renderInlineFormatting(trimmedLine, index)}
				</p>
			);
		}

		// Flush any remaining list items
		if (inList) {
			flushList(lines.length);
		}

		return elements;
	};

	return (
		<div className="flex flex-col h-full">
			{/* Editor Header */}
			<div className="border-b p-4">
				<div className="flex items-center justify-between mb-3">
					<Input
						value={title}
						onChange={(e) => handleTitleChange(e.target.value)}
						className="text-lg font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
						placeholder="Note title..."
					/>

					{isEditing && (
						<Button onClick={handleSave} size="sm">
							<Save className="h-4 w-4 mr-2" />
							Save
						</Button>
					)}
				</div>

				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<div>Created {note.createdAt.toLocaleDateString()}</div>
					<span>•</span>
					<div>Updated {note.updatedAt.toLocaleDateString()}</div>
					{note.tags.length > 0 && (
						<>
							<span>•</span>
							<div className="flex gap-1">
								{note.tags.map((tag) => (
									<Badge key={tag} variant="secondary" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						</>
					)}
				</div>
			</div>

			{/* Note Content - Preview Only */}
			<div className="flex-1 overflow-hidden">
				<ScrollArea className="h-full">
					<div className="p-6 prose prose-sm max-w-none">
						{renderContent(content)}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
};
