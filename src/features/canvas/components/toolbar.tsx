import { LiveList } from "@liveblocks/client";
import { Redo2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { useCallback } from "react";
import { useMutation } from "../../../../liveblocks.config";
import type { Color, Point } from "../types/canvas";
import { ColorPicker } from "./color-picker";
import { FlowchartGenerator } from "./flowchart-generator";
import { ToolButton } from "./tool-button";

type ToolbarProps = {
	onColorChange?: (color: Color) => void;
	currentColor?: Color;
	undo?: () => void;
	redo?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
	effectiveId?: string;
	onGenerateFlowchart?: (mermaidCode: string, position: Point) => void;
	camera?: { x: number; y: number };
};

export const Toolbar = ({
	onColorChange,
	undo,
	redo,
	canRedo = false,
	canUndo = false,
	effectiveId,
	onGenerateFlowchart,
	camera = { x: 0, y: 0 },
}: ToolbarProps = {}) => {
	// Handle color change
	const handleColorChange = useCallback(
		(color: Color) => {
			if (onColorChange) {
				onColorChange(color);
			}
		},
		[onColorChange]
	);

	// Default no-op functions for undo/redo if not provided
	const handleUndo = useCallback(() => {
		if (undo) {
			undo();
		}
	}, [undo]);

	const handleRedo = useCallback(() => {
		if (redo) {
			redo();
		}
	}, [redo]);

	// Add clear canvas functionality
	const clearCanvas = useMutation(
		({ storage }) => {
			try {
				// Get the storage objects
				const liveLayers = storage.get("layers");
				const liveLayerIds = storage.get("layerIds");

				// Check if we have a valid LiveMap object
				if (liveLayers && typeof liveLayers.entries === "function") {
					// Get all keys from the LiveMap
					const keys = Array.from(liveLayers.entries()).map(([key]) => key);

					// Delete each layer individually
					for (const key of keys) {
						liveLayers.delete(key);
					}
				}

				// Clear all layer IDs
				if (liveLayerIds) {
					// Check if it's a LiveList with a clear method
					if (typeof liveLayerIds.clear === "function") {
						liveLayerIds.clear();
					}
					// If it's a LiveList without clear but with delete
					else if (typeof liveLayerIds.delete === "function") {
						// Delete all items one by one from the end
						while (liveLayerIds.length > 0) {
							liveLayerIds.delete(liveLayerIds.length - 1);
						}
					}
					// If it's an array-like object with length
					else if (typeof liveLayerIds.length === "number") {
						// Try to create a new empty LiveList and replace the existing one
						try {
							storage.set("layerIds", new LiveList([]));
						} catch (_error) {
							// Handle error
						}
					}
				} else {
					// If layerIds doesn't exist, create a new empty one
					storage.set("layerIds", new LiveList([]));
				}

				// Force a storage update to ensure changes are synchronized
				storage.set("lastUpdate", Date.now());

				// Notify the user that the canvas has been cleared
				alert("Canvas cleared for all users in this channel");
			} catch (_error) {
				alert("Failed to clear canvas. Please try again.");
			}
		},
		[effectiveId]
	);

	return (
		<div className="absolute top-[55%] -translate-y-[50%] left-2 flex flex-col gap-y-4">
			{/* Color Palette - Vertical */}
			<div className="bg-white rounded-md p-2 shadow-md">
				<div className="flex flex-col gap-1">
					<ColorPicker onChange={handleColorChange} orientation="vertical" />
				</div>
			</div>

			{/* Undo/Redo Card */}
			<div className="bg-white rounded-md p-1.5 flex flex-col items-center shadow-md">
				<ToolButton
					label="Undo"
					icon={Undo2}
					onClick={handleUndo}
					isDisabled={!canUndo}
				/>
				<ToolButton
					label="Redo"
					icon={Redo2}
					onClick={handleRedo}
					isDisabled={!canRedo}
				/>
			</div>

			{/* AI Flowchart Generator Card */}
			{onGenerateFlowchart && (
				<div className="bg-white rounded-md p-1.5 flex flex-col items-center shadow-md">
					<FlowchartGenerator
						onGenerateFlowchart={onGenerateFlowchart}
						camera={camera}
					>
						<ToolButton
							label="AI Flowchart"
							icon={Sparkles}
							onClick={() => {}} // Handled by FlowchartGenerator
							variant="default"
						/>
					</FlowchartGenerator>
				</div>
			)}

			{/* Clear Canvas Card */}
			<div className="bg-white rounded-md p-1.5 flex flex-col items-center shadow-md">
				<ToolButton
					label="Clear Canvas"
					icon={Trash2}
					onClick={clearCanvas}
					variant="danger"
				/>
			</div>
		</div>
	);
};

export const ToolbarSkeleton = () => {
	return (
		<div
			className="absolute top-[55%] -translate-y-[50%] left-2 flex flex-col gap-y-4 bg-white h-[360px] w-[52px] shadow-md rounded-md"
			aria-hidden
		/>
	);
};
