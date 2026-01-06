"use client";

import { useMutation, useQuery } from "convex/react";
import { Download, Edit2, FilePlus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useRoom } from "../../../../liveblocks.config";
import { ExportCanvasDialog } from "./export-canvas-dialog";
import { NewCanvasDialog } from "./new-canvas-dialog";
import { SaveCanvasDialog } from "./save-canvas-dialog";
import { SavedCanvasesDropdown } from "./saved-dropdown";

interface CanvasNameProps {
	savedCanvasName?: string | null;
}

export const CanvasName = ({ savedCanvasName }: CanvasNameProps) => {
	const router = useRouter();
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();
	const [isEditing, setIsEditing] = useState(false);
	const [canvasName, setCanvasName] = useState("Untitled1");
	const [inputValue, setInputValue] = useState("");
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const [isNewCanvasConfirmOpen, setIsNewCanvasConfirmOpen] = useState(false);
	const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

	// Track if this is an existing saved canvas
	const [isExistingSavedCanvas, setIsExistingSavedCanvas] = useState(false);

	// Get the current URL to check for roomId parameter
	const currentRoomId =
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("roomId")
			: null;

	// Get Liveblocks room
	const room = useRoom();

	// Get Convex mutation for creating messages
	const createMessage = useMutation(api.messages.create);

	// Get channel data to use as initial canvas name
	// Always call the hook, but skip the query if channelId is undefined
	const channelData = useQuery(
		api.channels.getById,
		channelId ? { id: channelId } : "skip"
	);

	// Update canvas name when data is loaded or savedCanvasName is provided
	useEffect(() => {
		// If a saved canvas name is provided, use it and mark as existing saved canvas
		if (savedCanvasName && currentRoomId) {
			setCanvasName(savedCanvasName);
			setInputValue(savedCanvasName);
			setIsExistingSavedCanvas(true);
		}
		// Otherwise use the channel name
		else if (channelData?.name) {
			// Format the channel name for display (capitalize first letter)
			const formattedName = channelData.name
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");

			setCanvasName(`${formattedName} Canvas`);
			setInputValue(`${formattedName} Canvas`);
			setIsExistingSavedCanvas(false);
		}
	}, [channelData, savedCanvasName, currentRoomId]);

	const handleEditClick = () => {
		setIsEditing(true);
		setInputValue(canvasName);
	};

	const handleSave = () => {
		if (inputValue.trim()) {
			setCanvasName(inputValue.trim());
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setIsEditing(false);
			setInputValue(canvasName);
		}
	};

	// Show the new canvas confirmation dialog
	const handleNewCanvasClick = () => {
		setIsNewCanvasConfirmOpen(true);
	};

	// Handle creating a new canvas after confirmation
	const handleNewCanvas = () => {
		if (!channelId || !workspaceId) {
			toast.error("Cannot create new canvas: missing required data");
			return;
		}

		// Create a new canvas with a new room ID
		// Add a timestamp to ensure we get a fresh URL that bypasses any caching
		const timestamp = Date.now();

		// Show a loading message
		toast.loading("Creating new canvas...");

		// Use setTimeout to ensure the toast is shown before navigation
		setTimeout(() => {
			const url = `/workspace/${workspaceId}/channel/${channelId}/canvas?new=true&t=${timestamp}`;
			// Use router.push for client-side navigation without page reload
			router.push(url);
		}, 100);
	};

	// Quick save function for existing saved canvases
	const handleQuickSave = async () => {
		try {
			if (
				!channelId ||
				!workspaceId ||
				!room ||
				!currentRoomId ||
				!savedCanvasName
			) {
				toast.error("Cannot quick save: missing required data");
				return;
			}

			// Show a saving toast
			toast.loading(`Saving changes to "${savedCanvasName}"...`);

			// We don't need to create a new message, as we're updating an existing canvas
			// The changes are automatically saved in the Liveblocks room

			// Show success message after a short delay
			setTimeout(() => {
				toast.success(`Changes saved to "${savedCanvasName}"`);
			}, 500);
		} catch (error) {
			console.error("Error quick saving canvas:", error);
			toast.error("Failed to save changes");
		}
	};

	// Handle saving the canvas with a file name (for new canvases)
	const handleSaveCanvas = async (fileName: string) => {
		try {
			if (!channelId || !workspaceId || !room) {
				toast.error("Cannot save canvas: missing required data");
				return;
			}

			// Generate a unique ID for the saved canvas
			const savedCanvasId = `${channelId}-${Date.now()}`;

			// Store the current room ID to save in the message
			const roomIdToSave = room.id;

			// Create a message in the channel with the canvas link
			await createMessage({
				workspaceId: workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify({
					type: "canvas",
					canvasName: fileName,
					roomId: roomIdToSave,
					savedCanvasId: savedCanvasId,
				}),
			});

			toast.success(`Canvas saved as "${fileName}"`);

			// Navigate to the main canvas page
			// Use router.push for client-side navigation without page reload
			const url = `/workspace/${workspaceId}/channel/${channelId}/canvas`;
			router.push(url);
		} catch (error) {
			console.error("Error saving canvas:", error);
			toast.error("Failed to save canvas");
		}
	};

	return (
		<>
			<div className="absolute top-2 left-2 bg-white rounded-md p-2 shadow-md z-50 flex items-center">
				{isEditing ? (
					<div className="flex items-center">
						<Input
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={handleKeyDown}
							onBlur={handleSave}
							autoFocus
							className="h-8 w-40 text-sm"
						/>
					</div>
				) : (
					<div className="flex items-center">
						<span className="text-sm font-medium mr-2">{canvasName}</span>
						<div className="flex items-center gap-1">
							<Hint label="Rename canvas" side="right">
								<Button
									onClick={handleEditClick}
									variant="ghost"
									size="icon"
									className="h-6 w-6"
								>
									<Edit2 className="h-3.5 w-3.5" />
								</Button>
							</Hint>
							<Hint
								label={isExistingSavedCanvas ? "Save changes" : "Save canvas"}
								side="right"
							>
								<Button
									onClick={
										isExistingSavedCanvas
											? handleQuickSave
											: () => setIsSaveDialogOpen(true)
									}
									variant="ghost"
									size="icon"
									className="h-6 w-6"
								>
									<Save className="h-3.5 w-3.5" />
								</Button>
							</Hint>
							<Hint label="Open saved canvases" side="right">
								<SavedCanvasesDropdown />
							</Hint>
							<Hint label="New Canvas" side="right">
								<Button
									onClick={handleNewCanvasClick}
									variant="ghost"
									size="icon"
									className="h-6 w-6"
								>
									<FilePlus className="h-3.5 w-3.5" />
								</Button>
							</Hint>
							<Hint label="Export Canvas" side="right">
								<Button
									onClick={() => setIsExportDialogOpen(true)}
									variant="ghost"
									size="icon"
									className="h-6 w-6"
								>
									<Download className="h-3.5 w-3.5" />
								</Button>
							</Hint>
						</div>
					</div>
				)}
			</div>

			<SaveCanvasDialog
				open={isSaveDialogOpen}
				onOpenChange={setIsSaveDialogOpen}
				onSave={handleSaveCanvas}
			/>

			<NewCanvasDialog
				open={isNewCanvasConfirmOpen}
				onOpenChange={setIsNewCanvasConfirmOpen}
				onConfirm={handleNewCanvas}
			/>

			<ExportCanvasDialog
				open={isExportDialogOpen}
				onOpenChange={setIsExportDialogOpen}
				canvasName={canvasName}
			/>
		</>
	);
};
