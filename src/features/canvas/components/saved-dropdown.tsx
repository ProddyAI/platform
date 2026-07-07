"use client";

import { useMutation, useQuery } from "convex/react";
import { FolderOpen, Loader, PaintBucket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChannelId } from "@/hooks/use-channel-id";
import { useConfirm } from "@/hooks/use-confirm";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface SavedCanvas {
	id: Id<"messages">;
	canvasName: string;
	roomId: string;
	savedCanvasId: string;
	creationTime: number;
}

export const SavedCanvasesDropdown = () => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const [savedCanvases, setSavedCanvases] = useState<SavedCanvas[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [ConfirmDeleteCanvasDialog, confirmDeleteCanvas] = useConfirm(
		"Delete canvas?",
		"Are you sure you want to delete this canvas? This action cannot be undone."
	);

	// Get the delete message mutation
	const deleteMessage = useMutation(api.messaging.messages.remove);

	// Get messages from the channel
	// Always call the hook, but skip the query if channelId is undefined
	const messages = useQuery(
		api.messaging.messages.get,
		channelId
			? {
					channelId,
					paginationOpts: {
						numItems: 100,
						cursor: null,
					},
				}
			: "skip"
	);

	// Extract canvas messages
	useEffect(() => {
		if (messages?.page) {
			setIsLoading(false);

			// Filter and parse canvas messages
			const canvasMessages: SavedCanvas[] = [];

			for (const message of messages.page) {
				try {
					const body = JSON.parse(message.body);

					if (body && body.type === "canvas") {
						canvasMessages.push({
							id: message._id,
							canvasName: body.canvasName,
							roomId: body.roomId,
							savedCanvasId: body.savedCanvasId,
							creationTime: message._creationTime,
						});
					}
				} catch (_e) {
					// Not a JSON message or not a canvas message, skip
				}
			}

			// Sort by creation time (newest first)
			canvasMessages.sort((a, b) => b.creationTime - a.creationTime);

			setSavedCanvases(canvasMessages);
		}
	}, [messages]);

	// Handle opening a saved canvas
	const handleOpenCanvas = (roomId: string, canvasName: string) => {
		if (!workspaceId || !channelId) return;

		// Show a loading toast
		toast.loading(`Loading canvas "${canvasName}"...`);

		// Use router.push for client-side navigation without page reload
		setTimeout(() => {
			const url = `/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${roomId}&canvasName=${encodeURIComponent(canvasName)}&t=${Date.now()}`;
			router.push(url);
		}, 100);
	};

	// Handle deleting a saved canvas
	const handleDeleteCanvas = async (
		messageId: Id<"messages">,
		roomId: string,
		canvasName: string
	) => {
		const ok = await confirmDeleteCanvas();
		if (!ok) return;

		try {
			// Delete the message from Convex
			await deleteMessage({ id: messageId });

			// Delete the Liveblocks room
			await deleteLiveblocksRoom(roomId);

			// Update the UI by removing the deleted canvas from the list
			setSavedCanvases((prev) =>
				prev.filter((canvas) => canvas.id !== messageId)
			);

			// Show success message
			toast.success(`Canvas "${canvasName}" deleted successfully`);
		} catch (error) {
			console.error("Error deleting canvas:", error);
			toast.error("Failed to delete canvas");
		}
	};

	// Function to delete a Liveblocks room
	const deleteLiveblocksRoom = async (roomId: string) => {
		try {
			// Make a request to your API route that will delete the Liveblocks room
			const response = await fetch(`/api/liveblocks/delete?roomId=${roomId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error(
					`Failed to delete Liveblocks room: ${response.statusText}`
				);
			}

			return await response.json();
		} catch (error) {
			console.error("Error deleting Liveblocks room:", error);
			throw error;
		}
	};

	// Always render the component, but handle the case when channelId is undefined
	return (
		<DropdownMenu>
			<ConfirmDeleteCanvasDialog />
			<DropdownMenuTrigger asChild>
				<Button
					aria-label="Saved canvases"
					className="h-6 w-6"
					size="icon"
					variant="ghost"
				>
					<FolderOpen className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{isLoading ? (
					<div className="p-4 flex items-center justify-center">
						<Loader className="h-4 w-4 animate-spin text-muted-foreground" />
					</div>
				) : savedCanvases.length > 0 ? (
					savedCanvases.map((canvas, index) => (
						<div key={canvas.id}>
							<div className="flex items-center gap-1">
								<DropdownMenuItem
									className="flex-1 min-w-0 cursor-pointer"
									onClick={() =>
										handleOpenCanvas(canvas.roomId, canvas.canvasName)
									}
								>
									<div className="flex items-center gap-2 min-w-0">
										<PaintBucket className="h-4 w-4 shrink-0" />
										<span className="truncate">{canvas.canvasName}</span>
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem
									aria-label={`Delete canvas "${canvas.canvasName}"`}
									className="w-8 shrink-0 justify-center px-0 cursor-pointer text-destructive focus:text-destructive"
									onClick={(e) => {
										e.stopPropagation();
										handleDeleteCanvas(
											canvas.id,
											canvas.roomId,
											canvas.canvasName
										);
									}}
								>
									<Trash2 className="h-4 w-4" />
								</DropdownMenuItem>
							</div>
							{index < savedCanvases.length - 1 && <DropdownMenuSeparator />}
						</div>
					))
				) : (
					<div className="px-2 py-4 text-center text-sm text-muted-foreground">
						No saved canvases found
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
