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

	// Get the delete message mutation
	const deleteMessage = useMutation(api.messages.remove);

	// Get messages from the channel
	// Always call the hook, but skip the query if channelId is undefined
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
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="h-6 w-6">
					<FolderOpen className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{isLoading ? (
					<div className="p-4 flex items-center justify-center">
						<Loader className="h-4 w-4 animate-spin text-muted-foreground" />
					</div>
				) : savedCanvases.length > 0 ? (
					savedCanvases.map((canvas) => (
						<div key={canvas.id} className="flex flex-col">
							<DropdownMenuItem
								onClick={() =>
									handleOpenCanvas(canvas.roomId, canvas.canvasName)
								}
								className="cursor-pointer"
							>
								<div className="flex items-center justify-between w-full">
									<div className="flex items-center gap-2">
										<PaintBucket className="h-4 w-4" />
										<span className="truncate">{canvas.canvasName}</span>
									</div>
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteCanvas(
										canvas.id,
										canvas.roomId,
										canvas.canvasName
									);
								}}
								className="cursor-pointer text-red-500 hover:text-red-700 hover:bg-red-100"
							>
								<div className="flex items-center gap-2">
									<Trash2 className="h-4 w-4" />
									<span>Delete</span>
								</div>
							</DropdownMenuItem>
							{savedCanvases.indexOf(canvas) < savedCanvases.length - 1 && (
								<DropdownMenuSeparator />
							)}
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
