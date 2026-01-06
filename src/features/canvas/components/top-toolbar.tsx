"use client";

import {
	Circle,
	Eraser,
	MousePointer2,
	Pencil,
	Square,
	StickyNote,
	Type,
} from "lucide-react";
import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { useMyPresence } from "../../../../liveblocks.config";
import {
	CanvasMode,
	type CanvasState,
	type Color,
	LayerType,
} from "../types/canvas";
import { ToolButton } from "./tool-button";

type TopToolbarProps = {
	canvasState?: CanvasState;
	setCanvasState?: (newState: CanvasState) => void;
	onColorChange?: (color: Color) => void;
	currentColor?: Color;
	strokeWidth?: number;
	onStrokeWidthChange?: (width: number) => void;
	toggleFullScreen?: () => void;
	isFullScreen?: boolean;
};

export const TopToolbar = ({
	canvasState,
	setCanvasState,
	onColorChange,
	currentColor,
	strokeWidth = 16,
	onStrokeWidthChange,
	toggleFullScreen,
	isFullScreen,
}: TopToolbarProps) => {
	// Get and update presence
	const [, updateMyPresence] = useMyPresence();

	// Handle color change
	const _handleColorChange = useCallback(
		(color: Color) => {
			if (onColorChange) {
				onColorChange(color);
			}
		},
		[onColorChange]
	);

	// Handle stroke width change
	const handleStrokeWidthChange = useCallback(
		(value: number[]) => {
			const newWidth = value[0];

			// Call external handler if provided
			if (onStrokeWidthChange) {
				onStrokeWidthChange(newWidth);
			}

			// Update presence
			updateMyPresence({ strokeWidth: newWidth });

			// Update canvas state if in pencil mode
			if (canvasState?.mode === CanvasMode.Pencil && setCanvasState) {
				setCanvasState({
					mode: CanvasMode.Pencil,
					strokeWidth: newWidth,
				});
			}
		},
		[canvasState, onStrokeWidthChange, setCanvasState, updateMyPresence]
	);

	// Check if pen tool is active
	const isPenActive = canvasState?.mode === CanvasMode.Pencil;

	return (
		<div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
			{/* Toolbar */}
			<div className="bg-white rounded-md p-1.5 flex flex-row gap-x-1 items-center shadow-md">
				<ToolButton
					label="Select"
					icon={MousePointer2}
					onClick={() => setCanvasState?.({ mode: CanvasMode.None })}
					isActive={
						canvasState?.mode === CanvasMode.None ||
						canvasState?.mode === CanvasMode.Translating ||
						canvasState?.mode === CanvasMode.SelectionNet ||
						canvasState?.mode === CanvasMode.Pressing ||
						canvasState?.mode === CanvasMode.Resizing
					}
				/>

				<ToolButton
					label="Text"
					icon={Type}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Inserting,
							layerType: LayerType.Text,
						})
					}
					isActive={
						canvasState?.mode === CanvasMode.Inserting &&
						canvasState?.layerType === LayerType.Text
					}
				/>

				<ToolButton
					label="Sticky note"
					icon={StickyNote}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Inserting,
							layerType: LayerType.Note,
						})
					}
					isActive={
						canvasState?.mode === CanvasMode.Inserting &&
						canvasState?.layerType === LayerType.Note
					}
				/>

				<ToolButton
					label="Rectangle"
					icon={Square}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Inserting,
							layerType: LayerType.Rectangle,
						})
					}
					isActive={
						canvasState?.mode === CanvasMode.Inserting &&
						canvasState?.layerType === LayerType.Rectangle
					}
				/>

				<ToolButton
					label="Ellipse"
					icon={Circle}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Inserting,
							layerType: LayerType.Ellipse,
						})
					}
					isActive={
						canvasState?.mode === CanvasMode.Inserting &&
						canvasState?.layerType === LayerType.Ellipse
					}
				/>

				<ToolButton
					label="Pen"
					icon={Pencil}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Pencil,
						})
					}
					isActive={canvasState?.mode === CanvasMode.Pencil}
				/>

				<ToolButton
					label="Eraser"
					icon={Eraser}
					onClick={() =>
						setCanvasState?.({
							mode: CanvasMode.Eraser,
						})
					}
					isActive={canvasState?.mode === CanvasMode.Eraser}
				/>
			</div>

			{/* Stroke Width Slider - Only visible when pen is active */}
			{isPenActive && (
				<div className="bg-white rounded-md p-2 shadow-md flex items-center">
					<div className="w-[120px]">
						<Slider
							value={[strokeWidth]}
							min={1}
							max={50}
							step={1}
							onValueChange={handleStrokeWidthChange}
						/>
					</div>
				</div>
			)}
		</div>
	);
};
