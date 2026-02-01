"use client";

import { BringToFront, SendToBack, Trash2 } from "lucide-react";
import { memo } from "react";
import { useMutation, useSelf } from "../../../../liveblocks.config";
import { Hint } from "../../../components/hint";
import { Button } from "../../../components/ui/button";
import { useDeleteLayers } from "../hooks/use-delete-layers";
import { useSelectionBounds } from "../hooks/use-selection-bounds";
import type { Camera, Color } from "../types/canvas";

import { ColorPicker } from "./color-picker";

type SelectionToolsProps = {
	camera: Camera;
	setLastUsedColor: (color: Color) => void;
};

export const SelectionTools = memo(
	({ camera, setLastUsedColor }: SelectionToolsProps) => {
		const selection = useSelf((me) => me.presence.selection);

		const moveToFront = useMutation(
			({ storage }) => {
				const liveLayerIds = storage.get("layerIds");
				const indices: number[] = [];

				// Handle both LiveList and regular arrays
				const arr =
					typeof liveLayerIds.toImmutable === "function"
						? liveLayerIds.toImmutable()
						: Array.isArray(liveLayerIds)
							? liveLayerIds
							: Array.from(liveLayerIds);

				for (let i = 0; i < arr.length; i++) {
					if (selection.includes(arr[i])) indices.push(i);
				}

				// Handle both LiveList and regular arrays for the move operation
				for (let i = indices.length - 1; i >= 0; i--) {
					const targetIndex = arr.length - 1 - (indices.length - 1 - i);

					if (typeof liveLayerIds.move === "function") {
						// Use LiveList move method if available
						liveLayerIds.move(indices[i], targetIndex);
					} else if (Array.isArray(liveLayerIds)) {
						// Fallback for regular arrays
						const item = liveLayerIds[indices[i]];
						liveLayerIds.splice(indices[i], 1);
						liveLayerIds.splice(targetIndex, 0, item);
					}
				}
			},
			[selection]
		);

		const moveToBack = useMutation(
			({ storage }) => {
				const liveLayerIds = storage.get("layerIds");
				const indices: number[] = [];

				// Handle both LiveList and regular arrays
				const arr =
					typeof liveLayerIds.toImmutable === "function"
						? liveLayerIds.toImmutable()
						: Array.isArray(liveLayerIds)
							? liveLayerIds
							: Array.from(liveLayerIds);

				for (let i = 0; i < arr.length; i++) {
					if (selection.includes(arr[i])) indices.push(i);
				}

				// Handle both LiveList and regular arrays for the move operation
				for (let i = 0; i < indices.length; i++) {
					if (typeof liveLayerIds.move === "function") {
						// Use LiveList move method if available
						liveLayerIds.move(indices[i], i);
					} else if (Array.isArray(liveLayerIds)) {
						// Fallback for regular arrays
						const item = liveLayerIds[indices[i]];
						liveLayerIds.splice(indices[i], 1);
						liveLayerIds.splice(i, 0, item);
					}
				}
			},
			[selection]
		);

		const setFill = useMutation(
			({ storage }, fill: Color) => {
				const liveLayers = storage.get("layers");
				setLastUsedColor(fill);

				selection.forEach((id) => {
					const layer = liveLayers.get(id);

					if (layer) {
						// Handle both LiveObject and regular objects
						if (typeof layer.set === "function") {
							// Use LiveObject set method if available
							layer.set("fill", fill);
						} else if (layer && typeof layer === "object") {
							// Fallback for regular objects
							(layer as any).fill = fill;
						}
					}
				});
			},
			[selection, setLastUsedColor]
		);

		const deleteLayers = useDeleteLayers();

		const selectionBounds = useSelectionBounds();

		if (!selectionBounds) return null;

		const x = selectionBounds.width / 2 + selectionBounds.x + camera.x;
		const y = selectionBounds.y + camera.y;

		return (
			<div
				className="absolute p-3 rounded-xl bg-white shadow-sm border flex select-none"
				style={{
					transform: `translate(
            calc(${x}px - 50%),
            calc(${y - 16}px - 100%)
        )`,
				}}
			>
				<ColorPicker onChange={setFill} />

				<div className="flex flex-col gap-y-0.5">
					<Hint label="Bring to front">
						<Button onClick={moveToFront} size="icon" variant="ghost">
							<BringToFront />
						</Button>
					</Hint>
					<Hint label="Bring to back" side="bottom">
						<Button onClick={moveToBack} size="icon" variant="ghost">
							<SendToBack />
						</Button>
					</Hint>
				</div>

				<div className="flex items-center pl-2 ml-2 border-l border-neutral-200">
					<Hint label="Delete">
						<Button onClick={deleteLayers} size="icon" variant="ghost">
							<Trash2 />
						</Button>
					</Hint>
				</div>
			</div>
		);
	}
);

SelectionTools.displayName = "SelectionTools";
