"use client";

import {
	Check,
	Clock,
	Download,
	Info,
	Maximize2,
	Minimize2,
	Plus,
	Save,
	Search,
	Share,
	Tag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TagInput } from "@/features/notes/components/tag-input";
import { cn } from "@/lib/utils";
import { LiveParticipants } from "./live-participants";

interface LiveHeaderProps {
	// Common props
	type: "notes" | "canvas";

	// Title props
	title?: string;
	onTitleChange?: (title: string) => void;
	isEditingTitle?: boolean;

	// Action props
	onSave?: () => void;
	onShare?: () => void;
	onExport?: () => void;
	onCreateItem?: () => void;
	hasUnsavedChanges?: boolean;

	// Search props (mainly for notes)
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
	showSearch?: boolean;

	// Fullscreen props (mainly for canvas)
	toggleFullScreen?: () => void;
	isFullScreen?: boolean;
	showFullScreenToggle?: boolean;

	// Metadata props
	createdAt?: number;
	updatedAt?: number;

	// Tags props (mainly for notes)
	tags?: string[];
	onTagsChange?: (tags: string[]) => void;
	showTags?: boolean;

	// Auto-save props
	autoSaveStatus?: "saving" | "saved" | "error" | null;
	lastSaved?: number;

	// Styling
	className?: string;
}

export const LiveHeader = ({
	type,
	title,
	onTitleChange,
	isEditingTitle = false,
	onSave,
	onShare,
	onExport,
	onCreateItem,
	hasUnsavedChanges = false,
	searchQuery = "",
	onSearchChange,
	showSearch = false,
	toggleFullScreen,
	isFullScreen = false,
	showFullScreenToggle = false,
	createdAt,
	updatedAt,
	tags = [],
	onTagsChange,
	showTags = false,
	autoSaveStatus = null,
	lastSaved,
	className,
}: LiveHeaderProps) => {
	const [localTitle, setLocalTitle] = useState(title || "");
	const [isEditing, setIsEditing] = useState(isEditingTitle);

	useEffect(() => {
		setLocalTitle(title || "");
	}, [title]);

	const handleTitleSubmit = () => {
		if (onTitleChange && localTitle.trim()) {
			onTitleChange(localTitle.trim());
		}
		setIsEditing(false);
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleTitleSubmit();
		} else if (e.key === "Escape") {
			setLocalTitle(title || "");
			setIsEditing(false);
		}
	};

	// Format auto-save status
	const formatAutoSaveStatus = () => {
		if (autoSaveStatus === "saving") return "Saving...";
		if (autoSaveStatus === "saved" && lastSaved) {
			const now = Date.now();
			const diff = now - lastSaved;
			if (diff < 60000) return "Saved just now";
			if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`;
			return `Saved ${Math.floor(diff / 3600000)}h ago`;
		}
		if (autoSaveStatus === "error") return "Save failed";
		return null;
	};

	return (
		<div className={cn("border-b bg-white p-4 flex flex-col gap-1", className)}>
			{/* Top Row - Title, Actions, and Participants */}
			<div className="flex items-center justify-between gap-4">
				{/* Left Section - Title */}
				<div className="flex items-center gap-4 flex-1 min-w-0">
					{title !== undefined && (
						<div className="flex items-center gap-2 min-w-0">
							<div className="flex items-center gap-1">
								{isEditing ? (
									<Input
										autoFocus
										className="text-lg font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
										onBlur={handleTitleSubmit}
										onChange={(e) => setLocalTitle(e.target.value)}
										onKeyDown={handleTitleKeyDown}
										value={localTitle}
									/>
								) : (
									<button
										className="text-lg font-semibold text-left truncate hover:text-primary transition-colors"
										onClick={() => setIsEditing(true)}
										title="Click to edit title"
									>
										{title ||
											`Untitled ${type === "notes" ? "Note" : "Canvas"}`}
									</button>
								)}

								{/* Info Icon for Created/Updated dates */}
								{(createdAt || updatedAt) && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-help flex-shrink-0">
													<Info className="h-4 w-4" />
												</button>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs" side="bottom">
												<div className="space-y-1">
													{createdAt && (
														<div>
															<span className="font-semibold">Created:</span>{" "}
															{new Date(createdAt).toLocaleDateString("en-US", {
																year: "numeric",
																month: "short",
																day: "numeric",
																hour: "2-digit",
																minute: "2-digit",
															})}
														</div>
													)}
													{updatedAt && (
														<div>
															<span className="font-semibold">Updated:</span>{" "}
															{new Date(updatedAt).toLocaleDateString("en-US", {
																year: "numeric",
																month: "short",
																day: "numeric",
																hour: "2-digit",
																minute: "2-digit",
															})}
														</div>
													)}
												</div>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>

							{/* Auto-save status */}
							{autoSaveStatus && (
								<div className="flex items-center gap-1 text-xs text-muted-foreground">
									{autoSaveStatus === "saving" && (
										<Clock className="h-3 w-3 animate-spin" />
									)}
									{autoSaveStatus === "saved" && (
										<Check className="h-3 w-3 text-green-600" />
									)}
									<span>{formatAutoSaveStatus()}</span>
								</div>
							)}

							{hasUnsavedChanges && !autoSaveStatus && (
								<Badge className="text-xs" variant="secondary">
									Unsaved
								</Badge>
							)}
						</div>
					)}
				</div>

				{/* Right Section - Actions and Participants */}
				<div className="flex items-center gap-2">
					{/* Create Button */}
					{onCreateItem && (
						<Button onClick={onCreateItem} size="sm" variant="outline">
							<Plus className="h-4 w-4 mr-2" />
							New {type === "notes" ? "Note" : "Canvas"}
						</Button>
					)}

					{/* Save Button */}
					{onSave && (
						<Button disabled={!hasUnsavedChanges} onClick={onSave} size="sm">
							<Save className="h-4 w-4 mr-2" />
							Save
						</Button>
					)}

					{/* Share Button */}
					{onShare && (
						<Button onClick={onShare} size="sm" variant="outline">
							<Share className="h-4 w-4 mr-2" />
							Share
						</Button>
					)}

					{/* Export Button */}
					{onExport && (
						<Button onClick={onExport} size="sm" variant="outline">
							<Download className="h-4 w-4 mr-2" />
							Export
						</Button>
					)}

					{/* Fullscreen Toggle */}
					{showFullScreenToggle && toggleFullScreen && (
						<Button onClick={toggleFullScreen} size="sm" variant="outline">
							{isFullScreen ? (
								<Minimize2 className="h-4 w-4" />
							) : (
								<Maximize2 className="h-4 w-4" />
							)}
						</Button>
					)}

					{/* Live Participants - moved inside header */}
					<div className="flex items-center border-l pl-2 ml-2">
						<LiveParticipants
							className="flex items-center"
							isFullScreen={isFullScreen}
							variant={type}
						/>
					</div>
				</div>
			</div>

			{/* Second Row - Tags */}
			<div className="flex items-center justify-between gap-4">
				{/* Right - Tags or Search */}
				<div className="flex items-center gap-4">
					{/* Tags for both notes and canvas */}
					{showTags && onTagsChange && (
						<div className="flex items-center gap-2">
							<Tag className="h-4 w-4 text-muted-foreground" />
							<TagInput
								className="max-w-md"
								onTagsChange={onTagsChange}
								placeholder="Add tags..."
								tags={tags}
							/>
						</div>
					)}

					{/* Search Bar (if enabled) */}
					{showSearch && onSearchChange && (
						<div className="flex items-center gap-2 max-w-sm">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-9"
									onChange={(e) => onSearchChange(e.target.value)}
									placeholder={`Search ${type}...`}
									value={searchQuery}
								/>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
