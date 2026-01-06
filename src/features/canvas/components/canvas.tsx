"use client";

import type React from "react";
import { useCallback, useEffect, useMemo } from "react";
import { LiveCursorsPresence } from "@/features/live";
import {
	useCanRedo,
	useCanUndo,
	useHistory,
	useMutation,
	useRoom,
	useSelf,
	useStorage,
} from "../../../../liveblocks.config";
import {
	colorToCSS,
	connectionIdToColor,
	findLayerAtPoint,
	pointerEventToCanvasPoint,
} from "../../../lib/utils";
// Import refactored hooks
import {
	useCamera,
	useCanvasState,
	useDrawing,
	useLayerOperations,
	useSelection,
} from "../hooks";
import { useDeleteLayers } from "../hooks/use-delete-layers";
import { useDisableScrollBounce } from "../hooks/use-disable-scroll-bounce";
import { CanvasMode, LayerType, type Point } from "../types/canvas";
import { CanvasName } from "./canvas-name";
import { LayerPreview } from "./layer-preview";
import { Path } from "./path";
import { SelectionBox } from "./selection-box";
import { Toolbar } from "./toolbar";
import { TopToolbar } from "./top-toolbar";

// Constants are now defined in the hooks

// Props type definition
type CanvasProps = {
	boardId?: string;
	canvasId?: string;
	savedCanvasName?: string | null;
	toggleFullScreen?: () => void;
	isFullScreen?: boolean;
	onTitleChange?: (title: string) => void;
	onSave?: () => void;
	onCreateCanvas?: () => void;
	hasUnsavedChanges?: boolean;
	workspaceId?: string;
	channelId?: string;
	createdAt?: number;
	updatedAt?: number;
};

export const Canvas = ({
	boardId,
	canvasId,
	savedCanvasName,
	toggleFullScreen,
	isFullScreen,
	onTitleChange,
	onSave,
	onCreateCanvas,
	hasUnsavedChanges,
	workspaceId,
	channelId,
	createdAt,
	updatedAt,
}: CanvasProps) => {
	// Use canvasId if provided, otherwise fall back to boardId for backward compatibility
	const effectiveId = canvasId || boardId;
	// Get the room instance
	const _room = useRoom();

	// Get the entire storage
	useStorage((root) => {
		return root;
	});

	// Get the layerIds with fallback
	const layerIds = useStorage((root) => {
		// Always return root.layerIds, even if it's not a LiveList
		// Our mutation functions will handle creating a LiveList if needed
		if (!root.layerIds) {
			return [];
		}

		return root.layerIds;
	});

	const pencilDraft = useSelf((me) => me.presence.pencilDraft);
	const presenceStrokeWidth = useSelf((me) => me.presence.strokeWidth);

	// Use refactored hooks
	const {
		canvasState,
		setCanvasState,
		lastUsedColor,
		setLastUsedColor,
		strokeWidth,
		setStrokeWidth,
	} = useCanvasState();

	const { camera, onWheel } = useCamera();

	useDisableScrollBounce();
	const history = useHistory();
	const canUndo = useCanUndo();
	const canRedo = useCanRedo();

	// All these functions are now provided by the refactored hooks

	// onWheel is now provided by useCamera hook

	// Use refactored layer operations hook
	const { insertLayer, insertPath, eraseLayerById, insertMermaidLayer } =
		useLayerOperations(lastUsedColor);

	// Use refactored drawing hook
	const { startDrawing, continueDrawing } = useDrawing(
		canvasState.mode,
		lastUsedColor,
		strokeWidth
	);

	// Use refactored selection hook
	const {
		unselectLayers,
		updateSelectionNet,
		startMultiSelection,
		resizeSelectedLayer,
		onResizeHandlePointerDown,
		translateSelectedLayers,
	} = useSelection(canvasState, setCanvasState, layerIds, history);

	// Handle flowchart generation
	const handleGenerateFlowchart = useCallback(
		(mermaidCode: string, position: Point) => {
			insertMermaidLayer(mermaidCode, position);
		},
		[insertMermaidLayer]
	);

	const onPointerMove = useMutation(
		({ setMyPresence, self, storage }, e: React.PointerEvent) => {
			e.preventDefault();

			const current = pointerEventToCanvasPoint(e, camera);

			// Always update cursor position first to ensure real-time cursor movement
			setMyPresence({
				cursor: current,
				// Preserve other presence values
				penColor: self.presence.penColor || lastUsedColor,
			});

			if (canvasState.mode === CanvasMode.Pressing) {
				startMultiSelection(current, canvasState.origin);
			} else if (canvasState.mode === CanvasMode.SelectionNet) {
				updateSelectionNet(current, canvasState.origin);
			} else if (canvasState.mode === CanvasMode.Translating) {
				translateSelectedLayers(current);
			} else if (canvasState.mode === CanvasMode.Resizing) {
				resizeSelectedLayer(current);
			} else if (canvasState.mode === CanvasMode.Pencil) {
				continueDrawing(current, e);
			} else if (canvasState.mode === CanvasMode.Eraser && e.buttons === 1) {
				// Only erase when mouse button is pressed
				// Get the layers from storage
				const liveLayers = storage.get("layers");

				if (!liveLayers) {
					return;
				}

				// Find a layer at the current point with increased tolerance
				const layerId = findLayerAtPoint(layerIds, liveLayers, current, 15); // Use larger tolerance

				if (layerId) {
					// Erase the layer
					eraseLayerById(layerId);

					// Force a re-render by updating lastUpdate
					storage.set("lastUpdate", Date.now());
				}
			}
		},
		[
			startMultiSelection,
			updateSelectionNet,
			continueDrawing,
			canvasState,
			resizeSelectedLayer,
			camera,
			translateSelectedLayers,
			lastUsedColor,
			layerIds,
			eraseLayerById,
		]
	);

	const onPointerLeave = useMutation(
		({ setMyPresence, self }) => {
			setMyPresence({
				cursor: null,
				// Preserve other presence values
				penColor: self.presence.penColor || lastUsedColor,
			});
		},
		[lastUsedColor]
	);

	const onPointerDown = useMutation(
		({ storage }, e: React.PointerEvent) => {
			const point = pointerEventToCanvasPoint(e, camera);

			if (canvasState.mode === CanvasMode.Inserting) return;

			if (canvasState.mode === CanvasMode.Pencil) {
				startDrawing(point, e.pressure);
				return;
			}

			// Handle eraser mode
			if (canvasState.mode === CanvasMode.Eraser) {
				// Get the layers from storage
				const liveLayers = storage.get("layers");

				if (!liveLayers) {
					return;
				}

				// Find a layer at the current point with increased tolerance
				const layerId = findLayerAtPoint(layerIds, liveLayers, point, 15); // Use larger tolerance

				if (layerId) {
					// Erase the layer
					eraseLayerById(layerId);

					// Force a re-render by updating lastUpdate
					storage.set("lastUpdate", Date.now());
				}

				return;
			}

			setCanvasState({ origin: point, mode: CanvasMode.Pressing });
		},
		[
			camera,
			canvasState.mode,
			setCanvasState,
			startDrawing,
			layerIds,
			eraseLayerById,
		]
	);

	const onPointerUp = useMutation(
		({ storage }, e) => {
			const point = pointerEventToCanvasPoint(e, camera);

			if (
				canvasState.mode === CanvasMode.None ||
				canvasState.mode === CanvasMode.Pressing
			) {
				unselectLayers();
				setCanvasState({
					mode: CanvasMode.None,
				});
			} else if (canvasState.mode === CanvasMode.Pencil) {
				// When finishing a drawing, make sure to insert the path
				insertPath();

				// Force a storage update to ensure changes are synchronized
				try {
					storage.set("lastUpdate", Date.now());
				} catch (_error) {
					// Silently handle error
				}
			} else if (canvasState.mode === CanvasMode.Inserting) {
				insertLayer(canvasState.layerType, point);
			} else {
				setCanvasState({
					mode: CanvasMode.None,
				});
			}

			history.resume();
		},
		[
			setCanvasState,
			camera,
			canvasState,
			history,
			insertLayer,
			unselectLayers,
			insertPath,
		]
	);

	// Use a simple mock implementation to avoid potential infinite loops
	const selections = useMemo(() => {
		return [
			[1, ["layer1", "layer2"]] as [number, string[]],
			[2, ["layer3"]] as [number, string[]],
		];
	}, []);

	const onLayerPointerDown = useMutation(
		(
			{ self, setMyPresence, storage },
			e: React.PointerEvent,
			layerId: string
		) => {
			// Handle eraser mode
			if (canvasState.mode === CanvasMode.Eraser) {
				e.stopPropagation();

				// Use our dedicated eraser function
				eraseLayerById(layerId);

				// Force a re-render by updating lastUpdate
				storage.set("lastUpdate", Date.now());

				return;
			}

			// Skip for pencil and inserting modes
			if (
				canvasState.mode === CanvasMode.Pencil ||
				canvasState.mode === CanvasMode.Inserting
			)
				return;

			history.pause();
			e.stopPropagation();

			const point = pointerEventToCanvasPoint(e, camera);

			if (!self.presence.selection.includes(layerId)) {
				setMyPresence({ selection: [layerId] }, { addToHistory: true });
			}

			// Store the current point for translation
			setCanvasState({ mode: CanvasMode.Translating, current: point });
		},
		[setCanvasState, camera, history, canvasState.mode, eraseLayerById]
	);

	const layerIdsToColorSelection = useMemo(() => {
		const layerIdsToColorSelection: Record<string, string> = {};

		for (const user of selections) {
			const [connectionId, selection] = user;

			for (const layerId of selection) {
				layerIdsToColorSelection[layerId] = connectionIdToColor(connectionId);
			}
		}

		return layerIdsToColorSelection;
	}, [selections]);

	const _deleteLayers = useDeleteLayers();

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			switch (e.key) {
				case "z":
					if (e.ctrlKey || e.metaKey) {
						if (e.shiftKey || e.altKey) history.redo();
						else history.undo();

						break;
					}
			}
		}

		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [history]);

	// Determine the cursor style based on the canvas state
	const getCursorStyle = () => {
		switch (canvasState.mode) {
			case CanvasMode.Pencil:
				return "cursor-pencil";
			case CanvasMode.Eraser:
				return "cursor-crosshair"; // Use crosshair cursor for eraser
			case CanvasMode.Inserting:
				if (canvasState.layerType === LayerType.Text) {
					return "cursor-text";
				} else if (canvasState.layerType === LayerType.Note) {
					return "cursor-note";
				} else {
					return "cursor-crosshair";
				}
			case CanvasMode.Pressing:
			case CanvasMode.SelectionNet:
				return "cursor-crosshair";
			case CanvasMode.Translating:
				return "cursor-move";
			case CanvasMode.Resizing:
				return "cursor-nwse-resize";
			default:
				return "cursor-default";
		}
	};

	return (
		<div className="flex flex-col h-full relative">
			<main className="flex-1 w-full relative bg-neutral-100 touch-none">
				<CanvasName savedCanvasName={savedCanvasName} />
				<TopToolbar
					canvasState={canvasState}
					setCanvasState={setCanvasState}
					onColorChange={setLastUsedColor}
					currentColor={lastUsedColor}
					strokeWidth={strokeWidth}
					onStrokeWidthChange={setStrokeWidth}
					toggleFullScreen={toggleFullScreen}
					isFullScreen={isFullScreen}
				/>
				<Toolbar
					onColorChange={setLastUsedColor}
					currentColor={lastUsedColor}
					canRedo={canRedo}
					canUndo={canUndo}
					undo={history.undo}
					redo={history.redo}
					effectiveId={effectiveId}
					onGenerateFlowchart={handleGenerateFlowchart}
					camera={camera}
				/>

				<svg
					className={`h-full w-full ${getCursorStyle()}`}
					onWheel={onWheel}
					onPointerMove={onPointerMove}
					onPointerLeave={onPointerLeave}
					onPointerDown={onPointerDown}
					onPointerUp={onPointerUp}
				>
					<g
						style={{
							transform: `translate(${camera.x}px, ${camera.y}px)`,
						}}
					>
						{/* Render all layers */}
						{Array.isArray(layerIds) &&
							layerIds.map((layerId) => (
								<LayerPreview
									key={layerId}
									id={layerId}
									onLayerPointerDown={onLayerPointerDown}
									selectionColor={layerIdsToColorSelection[layerId]}
								/>
							))}

						{/* Show empty canvas message only if no layers, no active drawing, and not in an active tool mode */}
						{Array.isArray(layerIds) &&
							layerIds.length === 0 &&
							(!pencilDraft || pencilDraft.length === 0) &&
							canvasState.mode !== CanvasMode.Inserting &&
							canvasState.mode !== CanvasMode.Pencil &&
							canvasState.mode !== CanvasMode.Eraser && (
								<g>
									{/* Empty canvas state */}
									<text
										x="50%"
										y="50%"
										textAnchor="middle"
										fill="#888"
										fontSize="14"
										fontFamily="sans-serif"
									>
										Canvas is empty. Start drawing or add shapes.
									</text>
								</g>
							)}
						<SelectionBox
							onResizeHandlePointerDown={onResizeHandlePointerDown}
						/>
						{canvasState.mode === CanvasMode.SelectionNet &&
							canvasState.current != null && (
								<rect
									className="fill-blue-500/5 stroke-blue-500 stroke-1"
									x={Math.min(canvasState.origin.x, canvasState.current.x)}
									y={Math.min(canvasState.origin.y, canvasState.current.y)}
									width={Math.abs(canvasState.origin.x - canvasState.current.x)}
									height={Math.abs(
										canvasState.origin.y - canvasState.current.y
									)}
								/>
							)}
						<LiveCursorsPresence variant="canvas" showDrawingPaths={true} />
						{pencilDraft != null && pencilDraft.length > 0 && (
							<Path
								points={pencilDraft}
								fill={colorToCSS(lastUsedColor)}
								x={0}
								y={0}
								strokeWidth={presenceStrokeWidth || 16}
							/>
						)}
					</g>
				</svg>
			</main>
		</div>
	);
};
