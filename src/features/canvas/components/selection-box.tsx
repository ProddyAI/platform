"use client";

import { memo } from "react";

import { useSelf, useStorage } from "../../../../liveblocks.config";
import { useSelectionBounds } from "../hooks/use-selection-bounds";
import { combineSides, LayerType, Side, type XYWH } from "../types";

interface SelectionBoxProps {
	onResizeHandlePointerDown: (corner: Side, initialBounds: XYWH) => void;
}

const HANDLE_WIDTH = 8;
// Visual handle stays 8px, but the pointer target is padded out to a more
// touch-friendly ~24px hit area without changing the rendered size.
const HANDLE_HIT_WIDTH = 24;

export const SelectionBox = memo(
	({ onResizeHandlePointerDown }: SelectionBoxProps) => {
		const soleLayerId = useSelf((me) =>
			me.presence.selection.length === 1 ? me.presence.selection[0] : null
		);

		const isShowingHandles = useStorage(
			(root) =>
				soleLayerId && root.layers.get(soleLayerId)?.type !== LayerType.Path
		);

		const bounds = useSelectionBounds();

		if (!bounds) {
			return null;
		}

		const handles: {
			side: Side;
			cursor: string;
			cx: number;
			cy: number;
		}[] = [
			{
				side: combineSides(Side.Top, Side.Left),
				cursor: "nwse-resize",
				cx: bounds.x,
				cy: bounds.y,
			},
			{
				side: Side.Top,
				cursor: "ns-resize",
				cx: bounds.x + bounds.width / 2,
				cy: bounds.y,
			},
			{
				side: combineSides(Side.Top, Side.Right),
				cursor: "nesw-resize",
				cx: bounds.x + bounds.width,
				cy: bounds.y,
			},
			{
				side: Side.Right,
				cursor: "ew-resize",
				cx: bounds.x + bounds.width,
				cy: bounds.y + bounds.height / 2,
			},
			{
				side: combineSides(Side.Bottom, Side.Right),
				cursor: "nwse-resize",
				cx: bounds.x + bounds.width,
				cy: bounds.y + bounds.height,
			},
			{
				side: Side.Bottom,
				cursor: "ns-resize",
				cx: bounds.x + bounds.width / 2,
				cy: bounds.y + bounds.height,
			},
			{
				side: combineSides(Side.Bottom, Side.Left),
				cursor: "nesw-resize",
				cx: bounds.x,
				cy: bounds.y + bounds.height,
			},
			{
				side: Side.Left,
				cursor: "ew-resize",
				cx: bounds.x,
				cy: bounds.y + bounds.height / 2,
			},
		];

		return (
			<>
				<rect
					className="fill-transparent stroke-primary stroke-1 pointer-events-none"
					height={bounds.height}
					style={{
						transform: `translate(${bounds.x}px, ${bounds.y}px)`,
					}}
					width={bounds.width}
					x={0}
					y={0}
				/>
				{isShowingHandles &&
					handles.map(({ side, cursor, cx, cy }) => (
						<g key={side}>
							{/* Larger, invisible pointer target for a touch-friendly hit area. */}
							<rect
								aria-label="Resize selection"
								className="fill-transparent"
								onPointerDown={(e) => {
									e.stopPropagation();
									onResizeHandlePointerDown(side, bounds);
								}}
								role="button"
								style={{
									cursor,
									width: `${HANDLE_HIT_WIDTH}px`,
									height: `${HANDLE_HIT_WIDTH}px`,
									transform: `translate(${cx - HANDLE_HIT_WIDTH / 2}px, ${cy - HANDLE_HIT_WIDTH / 2}px)`,
								}}
								x={0}
								y={0}
							/>
							<rect
								className="fill-background stroke-1 stroke-primary pointer-events-none"
								style={{
									width: `${HANDLE_WIDTH}px`,
									height: `${HANDLE_WIDTH}px`,
									transform: `translate(${cx - HANDLE_WIDTH / 2}px, ${cy - HANDLE_WIDTH / 2}px)`,
								}}
								x={0}
								y={0}
							/>
						</g>
					))}
			</>
		);
	}
);

SelectionBox.displayName = "SelectionBox";
