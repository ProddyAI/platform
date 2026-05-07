"use client";

import type React from "react";
import { memo } from "react";
import { useStorage } from "../../../../liveblocks.config";
import { colorToCSS } from "../../../lib/utils";
import { LayerType } from "../types/canvas";

import { Ellipse } from "./eliipse";
import { Mermaid } from "./mermaid";
import { Note } from "./note";
import { Path } from "./path";
import { Rectangle } from "./rectangle";
import { Text } from "./text";

type LayerPreviewProps = {
	id: string;
	onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
	selectionColor?: string;
};

export const LayerPreview = memo(
	({ id, onLayerPointerDown, selectionColor }: LayerPreviewProps) => {
		// Force re-render when lastUpdate changes
		const _lastUpdate = useStorage((root) => root.lastUpdate);

		const layer = useStorage((root) => {
			// Check if root.layers exists and has a get method
			if (root.layers && typeof root.layers.get === "function") {
				const layer = root.layers.get(id);
				if (layer) {
					return layer;
				}
			}
			return null;
		});

		if (!layer) return null;

		// Get the layer type
		const type = layer.type;

		switch (type) {
			case LayerType.Path:
				return (
					<Path
						fill={layer.fill ? colorToCSS(layer.fill) : "#000"}
						key={id}
						onPointerDown={(e) => onLayerPointerDown(e, id)}
						points={layer.points}
						stroke={selectionColor}
						strokeWidth={layer.strokeWidth}
						x={layer.x}
						y={layer.y}
					/>
				);
			case LayerType.Note:
				return (
					<Note
						id={id}
						layer={layer as any}
						onPointerDown={onLayerPointerDown}
						selectionColor={selectionColor}
					/>
				);
			case LayerType.Text:
				return (
					<Text
						id={id}
						layer={layer as any}
						onPointerDown={onLayerPointerDown}
						selectionColor={selectionColor}
					/>
				);
			case LayerType.Ellipse:
				return (
					<Ellipse
						id={id}
						layer={layer as any}
						onPointerDown={onLayerPointerDown}
						selectionColor={selectionColor}
					/>
				);
			case LayerType.Rectangle:
				return (
					<Rectangle
						id={id}
						layer={layer as any}
						onPointerDown={onLayerPointerDown}
						selectionColor={selectionColor}
					/>
				);
			case LayerType.Mermaid:
				return (
					<Mermaid
						id={id}
						layer={layer as any}
						onPointerDown={onLayerPointerDown}
						selectionColor={selectionColor}
					/>
				);
			default:
				return null;
		}
	}
);

LayerPreview.displayName = "LayerPreview";
