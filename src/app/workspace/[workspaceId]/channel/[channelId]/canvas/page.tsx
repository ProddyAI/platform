"use client";

import { useMutation, useQuery } from "convex/react";
import { PaintBucket } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { StreamAudioRoom } from "@/features/audio";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { ExcalidrawCanvas } from "@/features/canvas/components/excalidraw-canvas";
import { LiveblocksRoom, LiveHeader, LiveSidebar } from "@/features/live";
import { useChannelId } from "@/hooks/use-channel-id";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

// Interface for saved canvas data
interface SavedCanvas {
	id: Id<"messages">;
	canvasName: string;
	roomId: string;
	savedCanvasId: string;
	creationTime: number;
}

const CanvasPage = () => {
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();
	const _searchParams = useSearchParams();
	const _router = useRouter();
	const _pathname = usePathname();

	// State - simplified like notes page
	const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [isCreatingCanvas, setIsCreatingCanvas] = useState(false);

	// Create a reference to the main container for full screen functionality
	const pageContainerRef = useRef<HTMLDivElement>(null);

	// Get channel information for the title
	const channel = useQuery(api.channels.getById, { id: channelId });

	// Set document title based on channel name
	useDocumentTitle(channel ? `Canvas - ${channel.name}` : "Canvas");

	// Get current user
	const { data: currentUser } = useCurrentUser();

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

	// Parse canvas messages for the sidebar
	const canvasItems = useMemo(() => {
		const canvasMessages: any[] = [];
		if (messages?.page) {
			messages.page.forEach((message) => {
				try {
					const body = JSON.parse(message.body);
					if (body.type === "canvas" && body.canvasName && body.roomId) {
						const canvasItem = {
							_id: message._id,
							body: message.body,
							canvasName: body.canvasName,
							roomId: body.roomId,
							savedCanvasId: body.savedCanvasId,
							createdAt: message._creationTime,
							updatedAt: message._creationTime,
							tags: message.tags || body.tags || [],
						};
						canvasMessages.push(canvasItem);
					}
				} catch (_error) {
					// Skip invalid JSON
				}
			});
		}
		return canvasMessages;
	}, [messages]);

	// If we were opened from a shared link (e.g. from a canvas message),
	// auto-select the matching canvas so all clients join the same Liveblocks room.
	useEffect(() => {
		const roomIdFromUrl = _searchParams?.get("roomId");
		const canvasIdFromUrl = _searchParams?.get("canvasId");
		const candidate = roomIdFromUrl || canvasIdFromUrl;

		if (!candidate) return;
		if (activeCanvasId) return;

		const match = canvasItems.find(
			(item) =>
				item._id === candidate ||
				item.roomId === candidate ||
				item.savedCanvasId === candidate
		);
		if (match) {
			// We allow setting to roomId as well because activeCanvas lookup supports it.
			setActiveCanvasId(roomIdFromUrl || match._id);
		}
	}, [canvasItems, _searchParams, activeCanvasId]);

	// Get active canvas
	const activeCanvas = activeCanvasId
		? canvasItems.find(
				(item) => item._id === activeCanvasId || item.roomId === activeCanvasId
			)
		: null;

	// Keep the URL in sync with the active canvas so sharing/copying the link
	// reliably opens the same Liveblocks room (and therefore the same Stream call).
	useEffect(() => {
		if (!activeCanvas?.roomId) return;

		const currentRoomId = _searchParams?.get("roomId");
		if (currentRoomId === activeCanvas.roomId) return;

		const nextParams = new URLSearchParams(_searchParams?.toString() ?? "");
		nextParams.set("roomId", activeCanvas.roomId);
		// Avoid ambiguity: we treat roomId as the canonical identifier.
		nextParams.delete("canvasId");

		_router.replace(`${_pathname}?${nextParams.toString()}`);
	}, [activeCanvas?.roomId, _router, _pathname, _searchParams]);

	// Function to toggle full screen
	const toggleFullScreen = useCallback(() => {
		if (!document.fullscreenElement) {
			// Enter full screen - use the page container element
			if (pageContainerRef?.current) {
				pageContainerRef.current
					.requestFullscreen()
					.then(() => {
						setIsFullScreen(true);
					})
					.catch((err) => {
						console.error(
							`Error attempting to enable full-screen mode: ${err.message}`
						);
					});
			}
		} else {
			// Exit full screen
			document
				.exitFullscreen()
				.then(() => {
					setIsFullScreen(false);
				})
				.catch((err) => {
					console.error(
						`Error attempting to exit full-screen mode: ${err.message}`
					);
				});
		}
	}, []);

	// Listen for fullscreen changes (e.g., when user presses Escape)
	useEffect(() => {
		const handleFullscreenChange = () => {
			// Update state based on actual fullscreen status
			setIsFullScreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// Mutations for updating and creating messages
	const createMessage = useMutation(api.messages.create);
	const updateMessage = useMutation(api.messages.update);
	const deleteMessage = useMutation(api.messages.remove);

	// Handle canvas selection from sidebar - simplified like notes
	const handleCanvasSelect = useCallback((canvasId: string) => {
		setActiveCanvasId(canvasId);
	}, []);

	// Handle canvas deletion
	const handleDeleteCanvas = useCallback(
		async (canvasId: string) => {
			if (window.confirm("Are you sure you want to delete this canvas?")) {
				try {
					await deleteMessage({ id: canvasId as Id<"messages"> });
					toast.success("Canvas deleted successfully");
					// If the deleted canvas was active, clear the selection
					if (activeCanvasId === canvasId) {
						setActiveCanvasId(null);
					}
				} catch (error) {
					toast.error("Failed to delete canvas");
					console.error("Error deleting canvas:", error);
				}
			}
		},
		[deleteMessage, activeCanvasId]
	);

	// Handle canvas rename
	const handleRenameCanvas = useCallback(
		async (canvasId: string, newName: string) => {
			try {
				// Find the canvas item to get its current data
				const canvasItem = canvasItems.find((item) => item._id === canvasId);
				if (!canvasItem) {
					toast.error("Canvas not found");
					return;
				}

				// Parse the current body to update only the canvas name
				const currentBody = JSON.parse(canvasItem.body);
				const updatedBody = {
					...currentBody,
					canvasName: newName,
				};

				await updateMessage({
					id: canvasId as Id<"messages">,
					body: JSON.stringify(updatedBody),
				});

				toast.success("Canvas renamed successfully");
			} catch (error) {
				toast.error("Failed to rename canvas");
				console.error("Error renaming canvas:", error);
			}
		},
		[updateMessage, canvasItems]
	);

	// Function to create a new canvas - simplified like notes
	const handleCreateCanvas = async () => {
		if (!workspaceId || !channelId || !currentUser) {
			toast.error("Cannot create canvas: missing required data");
			return;
		}

		try {
			setIsCreatingCanvas(true);

			// Generate a unique canvas ID and room ID
			const canvasId = `${channelId}-${Date.now()}`;
			const roomId = `canvas-${canvasId}`;
			const canvasName = "Untitled Canvas";

			// Create a canvas message in the channel
			const messageId = await createMessage({
				workspaceId: workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify({
					type: "canvas",
					roomId: roomId,
					canvasName: canvasName,
					savedCanvasId: canvasId,
				}),
				tags: [], // Initialize with empty tags
			});

			// Set the new canvas as active
			setActiveCanvasId(messageId);
			toast.success("Canvas created successfully");
		} catch (error) {
			console.error("Error creating canvas:", error);
			toast.error("Failed to create canvas");
		} finally {
			setIsCreatingCanvas(false);
		}
	};

	const handleUpdateCanvasTags = async (
		messageId: Id<"messages">,
		newTags: string[]
	) => {
		try {
			const canvasData = JSON.parse(activeCanvas.body);
			await updateMessage({
				id: messageId,
				body: JSON.stringify({
					...canvasData,
					tags: newTags,
				}),
				tags: newTags,
			});
			toast.success("Tags updated successfully");
		} catch (error) {
			console.error("Error updating canvas tags:", error);
			toast.error("Failed to update tags");
		}
	};

	// Show empty state with sidebar if no canvas is selected (like notes page)
	if (!activeCanvas) {
		return (
			<div
				ref={pageContainerRef}
				className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""}`}
			>
				{/* Canvas Sidebar - always show even when no canvas selected */}
				{!isFullScreen && (
					<LiveSidebar
						type="canvas"
						items={canvasItems}
						selectedItemId={activeCanvasId}
						onItemSelect={(canvasId) => handleCanvasSelect(canvasId)}
						collapsed={sidebarCollapsed}
						onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
						onCreateItem={handleCreateCanvas}
						onDeleteItem={handleDeleteCanvas}
						onRenameItem={handleRenameCanvas}
						workspaceId={workspaceId}
						channelId={channelId}
					/>
				)}

				<div className="flex-1 flex flex-col items-center justify-center gap-y-6 bg-white dark:bg-gray-900">
					<PaintBucket className="size-16 text-secondary" />
					<h2 className="text-2xl font-semibold">Canvas</h2>
					<p className="text-sm text-muted-foreground mb-2">
						Create a new canvas to start drawing and collaborating
					</p>
					<Button
						onClick={handleCreateCanvas}
						disabled={isCreatingCanvas}
						className="flex items-center gap-2"
					>
						{isCreatingCanvas ? (
							<>
								<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
								Creating Canvas...
							</>
						) : (
							<>
								<PaintBucket className="h-4 w-4" />
								Create New Canvas
							</>
						)}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<LiveblocksRoom roomId={activeCanvas.roomId} roomType="canvas">
			<div
				ref={pageContainerRef}
				className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-white dark:bg-gray-900" : ""}`}
			>
				{!isFullScreen && (
					<LiveSidebar
						type="canvas"
						items={canvasItems}
						selectedItemId={activeCanvasId}
						onItemSelect={(canvasId) => handleCanvasSelect(canvasId)}
						collapsed={sidebarCollapsed}
						onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
						onCreateItem={handleCreateCanvas}
						onDeleteItem={handleDeleteCanvas}
						onRenameItem={handleRenameCanvas}
						workspaceId={workspaceId}
						channelId={channelId}
					/>
				)}

				<div className="flex flex-col flex-1 overflow-hidden relative">
					{/* Canvas Header - hidden in fullscreen */}
					{!isFullScreen && (
						<LiveHeader
							type="canvas"
							title={activeCanvas.canvasName}
							onTitleChange={(newTitle) => {
								// You can implement canvas title update here
							}}
							onCreateItem={handleCreateCanvas}
							toggleFullScreen={toggleFullScreen}
							isFullScreen={isFullScreen}
							showFullScreenToggle={true}
							createdAt={activeCanvas.createdAt}
							updatedAt={activeCanvas.updatedAt}
							onSave={() => {
								// Implement canvas save functionality
							}}
							hasUnsavedChanges={false} // You can track canvas changes here
							autoSaveStatus="saved"
							lastSaved={activeCanvas.updatedAt}
							tags={activeCanvas.tags || []}
							onTagsChange={(newTags) => {
								handleUpdateCanvasTags(activeCanvas._id, newTags);
							}}
							showTags={true}
						/>
					)}

					<div className="flex flex-1 overflow-hidden">
						<div className="flex-1 relative">
							<ExcalidrawCanvas />
						</div>
					</div>
				</div>

				{/* Audio Room Component */}
				{activeCanvas.roomId && (
					<StreamAudioRoom
						roomId={activeCanvas.roomId}
						workspaceId={workspaceId}
						channelId={channelId}
						canvasName={activeCanvas.canvasName || "Canvas Audio Room"}
						isFullScreen={isFullScreen}
					/>
				)}
			</div>
		</LiveblocksRoom>
	);
};

export default CanvasPage;
