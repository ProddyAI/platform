"use client";

import { useQuery } from "convex/react";
import {
	ChevronLeft,
	ChevronRight,
	Copy,
	Download,
	Edit3,
	FileImage,
	MoreHorizontal,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

interface CanvasSidebarProps {
	selectedCanvasId?: string;
	onCanvasSelect: (
		canvasId: string,
		roomId: string,
		canvasName: string
	) => void;
	collapsed: boolean;
	onToggleCollapse: () => void;
	onCreateCanvas: () => void;
}

interface CanvasMessage {
	_id: Id<"messages">;
	body: string;
	_creationTime: number;
	canvasName?: string;
	roomId?: string;
	savedCanvasId?: string;
}

export const CanvasSidebar = ({
	selectedCanvasId,
	onCanvasSelect,
	collapsed,
	onToggleCollapse,
	onCreateCanvas,
}: CanvasSidebarProps) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [hoveredCanvasId, setHoveredCanvasId] = useState<string | null>(null);
	const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

	const _workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const _router = useRouter();

	// Get messages from the channel to find saved canvases
	const messages = useQuery(
		api.messages.get,
		channelId
			? {
					channelId: channelId,
					paginationOpts: {
						numItems: 100,
						cursor: null,
					},
				}
			: "skip"
	);

	// Parse canvas messages
	const canvasMessages: CanvasMessage[] = [];
	if (messages?.page) {
		messages.page.forEach((message) => {
			try {
				const body = JSON.parse(message.body);
				if (body.type === "canvas" && body.canvasName && body.roomId) {
					canvasMessages.push({
						...message,
						canvasName: body.canvasName,
						roomId: body.roomId,
						savedCanvasId: body.savedCanvasId,
					});
				}
			} catch (_error) {
				// Skip invalid JSON
			}
		});
	}

	// Filter canvases based on search query
	const filteredCanvases = canvasMessages.filter((canvas) =>
		canvas.canvasName?.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Format creation time
	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

		if (diffInHours < 24) {
			return date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		} else if (diffInHours < 24 * 7) {
			return date.toLocaleDateString([], {
				weekday: "short",
				hour: "2-digit",
				minute: "2-digit",
			});
		} else {
			return date.toLocaleDateString([], { month: "short", day: "numeric" });
		}
	};

	if (collapsed) {
		return (
			<div className="w-16 border-r bg-muted/30 flex flex-col items-center py-4">
				<Button
					className="mb-4"
					onClick={onToggleCollapse}
					size="sm"
					variant="ghost"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
				<Button
					className="mb-2"
					onClick={onCreateCanvas}
					size="sm"
					variant="ghost"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<div className="w-80 border-r bg-muted/30 flex flex-col">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<h2 className="font-semibold text-lg">Canvases</h2>
				<div className="flex items-center gap-2">
					<Button onClick={onToggleCollapse} size="sm" variant="ghost">
						<ChevronLeft className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Search and Create */}
			<div className="p-4 border-b">
				<div className="flex gap-2 mb-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search canvases..."
							value={searchQuery}
						/>
					</div>
					<Button onClick={onCreateCanvas} size="sm">
						<Plus className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Canvas List */}
			<ScrollArea className="flex-1">
				<div className="p-2">
					{filteredCanvases.length === 0 ? (
						<div className="text-center py-8">
							<FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<p className="text-sm text-muted-foreground">
								{searchQuery
									? "No canvases match your search"
									: "No canvases yet"}
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{filteredCanvases.map((canvas) => (
								<div
									className="relative group"
									key={canvas._id}
									onMouseEnter={() => setHoveredCanvasId(canvas._id)}
									onMouseLeave={() => {
										// Don't hide if dropdown is open for this canvas
										if (openDropdownId !== canvas._id) {
											setHoveredCanvasId(null);
										}
									}}
								>
									<button
										className={cn(
											"w-full text-left p-3 rounded-lg border transition-all duration-200 hover:shadow-sm",
											selectedCanvasId === canvas.savedCanvasId
												? "bg-primary/10 border-primary/20 shadow-sm"
												: "bg-white border-border hover:bg-muted/50"
										)}
										onClick={() =>
											onCanvasSelect(
												canvas.savedCanvasId || canvas._id,
												canvas.roomId!,
												canvas.canvasName!
											)
										}
									>
										<div className="flex items-start justify-between">
											<div className="flex-1 min-w-0">
												<h3 className="font-medium text-sm truncate mb-1">
													{canvas.canvasName}
												</h3>
												<p className="text-xs text-muted-foreground">
													{formatTime(canvas._creationTime)}
												</p>
											</div>
											<FileImage className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
										</div>
									</button>

									{/* Actions Menu */}
									{hoveredCanvasId === canvas._id && (
										<div className="absolute top-2 right-2">
											<DropdownMenu
												onOpenChange={(open) => {
													if (open) {
														setOpenDropdownId(canvas._id);
													} else {
														setOpenDropdownId(null);
														setHoveredCanvasId(null);
													}
												}}
											>
												<DropdownMenuTrigger asChild>
													<Button
														className="h-6 w-6 p-0 bg-white/80 hover:bg-white"
														size="sm"
														variant="ghost"
													>
														<MoreHorizontal className="h-3 w-3" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem>
														<Edit3 className="h-4 w-4 mr-2" />
														Rename
													</DropdownMenuItem>
													<DropdownMenuItem>
														<Copy className="h-4 w-4 mr-2" />
														Duplicate
													</DropdownMenuItem>
													<DropdownMenuItem>
														<Download className="h-4 w-4 mr-2" />
														Export
													</DropdownMenuItem>
													<DropdownMenuItem className="text-destructive">
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};
