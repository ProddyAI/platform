"use client";

import { memo } from "react";

import { useSelf, useStorage } from "../../../../liveblocks.config";
import { useSelectionBounds } from "../hooks/use-selection-bounds";
import { combineSides, LayerType, Side, type XYWH } from "../types/canvas";

interface SelectionBoxProps {
	onResizeHandlePointerDown: (corner: Side, initialBounds: XYWH) => void;
}

const HANDLE_WIDTH = 8;

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

		return (
			<>
				<rect
					className="fill-transparent stroke-blue-500 stroke-1 pointer-events-none"
					height={bounds.height}
					style={{
						transform: `translate(${bounds.x}px, ${bounds.y}px)`,
					}}
					width={bounds.width}
					x={0}
					y={0}
				/>
				{isShowingHandles && (
					<>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(
									combineSides(Side.Top, Side.Left),
									bounds
								);
							}}
							style={{
								cursor: "nwse-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2}px,
                  ${bounds.y - HANDLE_WIDTH / 2}px
                )
              `,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(Side.Top, bounds);
							}}
							style={{
								cursor: "ns-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x + bounds.width / 2 - HANDLE_WIDTH / 2}px,
                  ${bounds.y - HANDLE_WIDTH / 2}px
                )
              `,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(
									combineSides(Side.Top, Side.Right),
									bounds
								);
							}}
							style={{
								cursor: "nesw-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2 + bounds.width}px,
                  ${bounds.y - HANDLE_WIDTH / 2}px
                )`,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(Side.Right, bounds);
							}}
							style={{
								cursor: "ew-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2 + bounds.width}px,
                  ${bounds.y + bounds.height / 2 - HANDLE_WIDTH / 2}px
                )`,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(
									combineSides(Side.Bottom, Side.Right),
									bounds
								);
							}}
							style={{
								cursor: "nwse-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2 + bounds.width}px,
                  ${bounds.y - HANDLE_WIDTH / 2 + bounds.height}px
                )`,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(Side.Bottom, bounds);
							}}
							style={{
								cursor: "ns-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x + bounds.width / 2 - HANDLE_WIDTH / 2}px,
                  ${bounds.y - HANDLE_WIDTH / 2 + bounds.height}px
                )`,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(
									combineSides(Side.Bottom, Side.Left),
									bounds
								);
							}}
							style={{
								cursor: "nesw-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2}px,
                  ${bounds.y - HANDLE_WIDTH / 2 + bounds.height}px
                )`,
							}}
							x={0}
							y={0}
						/>
						<rect
							className="fill-white stroke-1 stroke-blue-500"
							onPointerDown={(e) => {
								e.stopPropagation();
								onResizeHandlePointerDown(Side.Left, bounds);
							}}
							style={{
								cursor: "ew-resize",
								width: `${HANDLE_WIDTH}px`,
								height: `${HANDLE_WIDTH}px`,
								transform: `
                translate(
                  ${bounds.x - HANDLE_WIDTH / 2}px,
                  ${bounds.y - HANDLE_WIDTH / 2 + bounds.height / 2}px
                )`,
							}}
							x={0}
							y={0}
						/>
					</>
				)}
			</>
		);
	}
);

SelectionBox.displayName = "SelectionBox";
