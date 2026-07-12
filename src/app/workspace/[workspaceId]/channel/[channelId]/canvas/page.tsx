"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Palette, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { ExcalidrawCanvas } from "@/features/canvas/components/excalidraw-canvas";
import { LiveblocksRoom, LiveHeader, LiveSidebar } from "@/features/live";
import { useChannelId } from "@/hooks/use-channel-id";
import { useConfirm } from "@/hooks/use-confirm";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const StreamAudioRoom = dynamic(
	() =>
		import("@/features/audio/components/stream-audio-room").then(
			(m) => m.StreamAudioRoom
		),
	{ ssr: false }
);

interface CanvasItem {
	_id: Id<"messages">;
	body: string;
	canvasName: string;
	roomId: string;
	savedCanvasId?: string;
	createdAt: number;
	updatedAt: number;
	tags: string[];
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

	const [ConfirmDeleteCanvasDialog, confirmDeleteCanvas] = useConfirm(
		"Delete canvas?",
		"Are you sure you want to delete this canvas? This action cannot be undone."
	);

	// Create a reference to the main container for full screen functionality
	const pageContainerRef = useRef<HTMLDivElement>(null);

	// Get channel information for the title
	const channel = useQuery(api.messaging.channels.getById, { id: channelId });

	// Set document title based on channel name
	useDocumentTitle(channel ? `Canvas - ${channel.name}` : "Canvas");

	// Get current user
	const { data: currentUser } = useCurrentUser();

	// Get messages from the channel to find saved canvases
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

	// Parse canvas messages for the sidebar
	const canvasItems = useMemo(() => {
		const canvasMessages: CanvasItem[] = [];
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

	// Channel messages are still resolving on first paint; distinguish "loading"
	// from "genuinely empty" so the empty state doesn't flash before data lands.
	const isLoadingCanvases = messages === undefined && Boolean(channelId);
	const hasCanvases = canvasItems.length > 0;

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
			setIsFullScreen(Boolean(document.fullscreenElement));
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// Mutations for updating and creating messages
	const createMessage = useMutation(api.messaging.messages.create);
	const updateMessage = useMutation(api.messaging.messages.update);
	const deleteMessage = useMutation(api.messaging.messages.remove);

	// Handle canvas selection from sidebar - simplified like notes
	const handleCanvasSelect = useCallback((canvasId: string) => {
		setActiveCanvasId(canvasId);
	}, []);

	// Handle canvas deletion
	const handleDeleteCanvas = useCallback(
		async (canvasId: string) => {
			const ok = await confirmDeleteCanvas();
			if (!ok) return;

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
		},
		[deleteMessage, activeCanvasId, confirmDeleteCanvas]
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
				workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify({
					type: "canvas",
					roomId,
					canvasName,
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
				className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-background" : ""}`}
				ref={pageContainerRef}
			>
				{/* Canvas Sidebar - always show even when no canvas selected */}
				{!isFullScreen && (
					<LiveSidebar
						channelId={channelId}
						collapsed={sidebarCollapsed}
						items={canvasItems}
						onCreateItem={handleCreateCanvas}
						onDeleteItem={handleDeleteCanvas}
						onItemSelect={(canvasId) => handleCanvasSelect(canvasId)}
						onRenameItem={handleRenameCanvas}
						onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
						selectedItemId={activeCanvasId}
						type="canvas"
						workspaceId={workspaceId}
					/>
				)}

				<div className="flex-1 flex items-center justify-center bg-background">
					{isLoadingCanvases ? (
						<div className="flex flex-col items-center gap-y-4">
							<Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" />
							<p className="text-sm text-muted-foreground">Loading canvases…</p>
						</div>
					) : (
						<div className="text-center space-y-5 max-w-sm px-6 duration-300 animate-in fade-in-50 motion-reduce:animate-none">
							<div className="mx-auto size-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
								<Palette className="size-10 text-primary" />
							</div>
							<div>
								<h3 className="text-xl font-semibold mb-2">
									{hasCanvases ? "No canvas selected" : "No canvas yet"}
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{hasCanvases
										? "Pick a canvas from the sidebar to jump back in, or start a fresh one."
										: "Create a canvas to sketch ideas, diagram flows, and think through problems with your team in real time."}
								</p>
							</div>
							<Button disabled={isCreatingCanvas} onClick={handleCreateCanvas}>
								{isCreatingCanvas ? (
									<>
										<Loader2 className="size-4 mr-2 animate-spin motion-reduce:animate-none" />
										Creating...
									</>
								) : (
									<>
										<Plus className="size-4 mr-2" />
										{hasCanvases ? "New canvas" : "Create canvas"}
									</>
								)}
							</Button>
						</div>
					)}
				</div>
				<ConfirmDeleteCanvasDialog />
			</div>
		);
	}

	return (
		<LiveblocksRoom roomId={activeCanvas.roomId} roomType="canvas">
			<div
				className={`flex h-full ${isFullScreen ? "fixed inset-0 z-50 bg-background" : ""}`}
				ref={pageContainerRef}
			>
				{!isFullScreen && (
					<LiveSidebar
						channelId={channelId}
						collapsed={sidebarCollapsed}
						items={canvasItems}
						onCreateItem={handleCreateCanvas}
						onDeleteItem={handleDeleteCanvas}
						onItemSelect={(canvasId) => handleCanvasSelect(canvasId)}
						onRenameItem={handleRenameCanvas}
						onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
						selectedItemId={activeCanvasId}
						type="canvas"
						workspaceId={workspaceId}
					/>
				)}

				<div className="flex flex-col flex-1 overflow-hidden relative">
					{/* Canvas Header - hidden in fullscreen */}
					{!isFullScreen && (
						// autoSaveStatus/hasUnsavedChanges/lastSaved are intentionally left
						// unset: ExcalidrawCanvas persists the scene via a debounced
						// Liveblocks write and exposes no save-state signal today, so
						// asserting "saved" here would be fabricated. Show nothing rather
						// than a status we can't actually vouch for.
						<LiveHeader
							createdAt={activeCanvas.createdAt}
							isFullScreen={isFullScreen}
							onCreateItem={handleCreateCanvas}
							onTagsChange={(newTags) => {
								handleUpdateCanvasTags(activeCanvas._id, newTags);
							}}
							onTitleChange={async (newTitle) => {
								const trimmedTitle = newTitle.trim();
								if (!trimmedTitle || trimmedTitle === activeCanvas.canvasName) {
									return;
								}
								try {
									await handleRenameCanvas(activeCanvas._id, trimmedTitle);
								} catch (error) {
									console.error("Error updating canvas title:", error);
									toast.error("Failed to update canvas title");
								}
							}}
							showFullScreenToggle
							showTags
							tags={activeCanvas.tags || []}
							title={activeCanvas.canvasName}
							toggleFullScreen={toggleFullScreen}
							type="canvas"
							updatedAt={activeCanvas.updatedAt}
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
						canvasName={activeCanvas.canvasName || "Canvas Audio Room"}
						channelId={channelId}
						isFullScreen={isFullScreen}
						roomId={activeCanvas.roomId}
						workspaceId={workspaceId as Id<"workspaces">}
					/>
				)}
				<ConfirmDeleteCanvasDialog />
			</div>
		</LiveblocksRoom>
	);
};

export default CanvasPage;
