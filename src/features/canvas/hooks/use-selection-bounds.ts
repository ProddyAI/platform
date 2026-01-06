import { useSelf, useStorage } from "../../../../liveblocks.config";
import type { XYWH } from "../types/canvas";

export const useSelectionBounds = (): XYWH | null => {
	const selection = useSelf((me) => me.presence.selection);

	const _lastUpdate = useStorage((root) => root.lastUpdate);

	const selectedLayers = useStorage((root) => {
		const layers = root.layers;

		const getLayer = (id: string) => {
			if (!layers) return null;

			if (typeof layers.get === "function") {
				return layers.get(id);
			}

			if (layers instanceof Map) {
				return layers.get(id);
			}

			if (layers && typeof layers === "object" && id in layers) {
				return (layers as any)[id];
			}

			return null;
		};

		// Only map if there's a selection
		return selection.length > 0 ? selection.map(getLayer).filter(Boolean) : [];
	});

	// If no selection or no layers found, return null
	if (!selection.length || !selectedLayers.length) return null;

	// Calculate the bounding box
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const layer of selectedLayers) {
		if (!layer) continue;

		// Get layer properties safely
		let x, y, width, height;

		try {
			// Try to get properties using get method first (for LiveObjects)
			if (typeof layer.get === "function") {
				x = layer.get("x");
				y = layer.get("y");
				width = layer.get("width");
				height = layer.get("height");
			} else {
				// Fall back to direct property access
				x = layer.x;
				y = layer.y;
				width = layer.width;
				height = layer.height;
			}

			// Ensure we have valid numbers
			if (
				typeof x !== "number" ||
				typeof y !== "number" ||
				typeof width !== "number" ||
				typeof height !== "number"
			) {
				console.warn("Invalid layer dimensions", { x, y, width, height });
				continue;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x + width);
			maxY = Math.max(maxY, y + height);
		} catch (error) {
			console.error("Error accessing layer properties:", error);
		}
	}

	// If we couldn't calculate valid bounds, return null
	if (
		minX === Infinity ||
		minY === Infinity ||
		maxX === -Infinity ||
		maxY === -Infinity
	) {
		return null;
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
};
