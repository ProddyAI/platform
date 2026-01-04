import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
	type Camera,
	type Color,
	type Layer,
	type Point,
	type XYWH,
	type Side,
	LayerType,
} from '../features/canvas/types/canvas';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function colorToCSS(color: Color) {
	return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export function connectionIdToColor(connectionId: number): string {
	const colors = [
		'#FF5733', // Red
		'#33FF57', // Green
		'#3357FF', // Blue
		'#FF33A8', // Pink
		'#33FFF5', // Cyan
		'#FFD133', // Yellow
		'#9E33FF', // Purple
		'#FF8333', // Orange
		'#33FFBD', // Mint
		'#FF3333', // Bright Red
	];

	return colors[connectionId % colors.length];
}

export function stringToColor(input: string): string {
	const colors = [
		'#FF5733', // Red
		'#33FF57', // Green
		'#3357FF', // Blue
		'#FF33A8', // Pink
		'#33FFF5', // Cyan
		'#FFD133', // Yellow
		'#9E33FF', // Purple
		'#FF8333', // Orange
		'#33FFBD', // Mint
		'#FF3333', // Bright Red
	];

	// Generate hash from string (similar to tag color generation)
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) - hash) + input.charCodeAt(i);
		hash = hash & hash; // Convert to 32-bit integer
	}

	return colors[Math.abs(hash) % colors.length];
}

/**
 * Finds layers that intersect with a selection rectangle
 */
export function findIntersectingLayersWithRectangle(
	layerIds: readonly string[],
	layers: any, // Use any type to accommodate different map implementations
	start: Point,
	end: Point
): string[] {
	if (!layerIds || !layers || !start || !end) {
		return [];
	}

	// Calculate the bounds of the selection rectangle
	const minX = Math.min(start.x, end.x);
	const maxX = Math.max(start.x, end.x);
	const minY = Math.min(start.y, end.y);
	const maxY = Math.max(start.y, end.y);

	// Add a small tolerance to make selection easier
	const tolerance = 5;

	const intersectingLayers = layerIds.filter((layerId) => {
		if (!layerId) return false;

		// Check if the layer exists in the map
		if (!layers.has(layerId)) {
			return false;
		}

		const layer = layers.get(layerId);
		if (!layer) return false;

		// Get layer properties safely
		let layerX, layerY, layerWidth, layerHeight;

		try {
			// Try to get properties using get method first (for LiveObjects)
			if (typeof layer.get === 'function') {
				layerX = layer.get('x');
				layerY = layer.get('y');
				layerWidth = layer.get('width');
				layerHeight = layer.get('height');
			} else {
				// Fall back to direct property access
				layerX = layer.x;
				layerY = layer.y;
				layerWidth = layer.width;
				layerHeight = layer.height;
			}
		} catch (error) {
			console.error('Error accessing layer properties:', error);
			return false;
		}

		// Check for intersection with tolerance
		const intersects =
			layerX + layerWidth + tolerance >= minX &&
			layerX - tolerance <= maxX &&
			layerY + layerHeight + tolerance >= minY &&
			layerY - tolerance <= maxY;

		return intersects;
	});

	return intersectingLayers;
}

/**
 * Finds a layer at a specific point
 */
export function findLayerAtPoint(
	layerIds: readonly string[],
	layers: any, // Use any type to accommodate different map implementations
	point: Point,
	tolerance: number = 5 // Tolerance radius in pixels
): string | null {
	if (!layerIds || !layers || !point) {
		return null;
	}

	// Check from top to bottom (last added layer first)
	for (let i = layerIds.length - 1; i >= 0; i--) {
		const layerId = layerIds[i];

		if (!layerId) {
			continue;
		}

		// Check if the layer exists in the map
		if (!layers.has(layerId)) {
			continue;
		}

		const layer = layers.get(layerId);

		if (!layer) {
			continue;
		}

		// Use a larger tolerance for path layers
		const effectiveTolerance =
			layer.type === 'path' ? tolerance * 2 : tolerance;

		// For path layers, we need special handling
		if (layer.type === 'path' && layer.points) {
			// Simple bounding box check first for efficiency
			if (
				point.x >= layer.x - effectiveTolerance &&
				point.x <= layer.x + (layer.width || 0) + effectiveTolerance &&
				point.y >= layer.y - effectiveTolerance &&
				point.y <= layer.y + (layer.height || 0) + effectiveTolerance
			) {
				return layerId;
			}
		} else {
			// For regular shapes, check if point is inside the bounding box
			if (
				point.x >= layer.x - effectiveTolerance &&
				point.x <= layer.x + (layer.width || 0) + effectiveTolerance &&
				point.y >= layer.y - effectiveTolerance &&
				point.y <= layer.y + (layer.height || 0) + effectiveTolerance
			) {
				return layerId;
			}
		}
	}

	return null;
}

/**
 * Converts pencil points to a path layer
 */
export function penPointsToPathLayer(
	points: [number, number, number][],
	color: Color,
	strokeWidth?: number
): Layer {
	if (points.length < 2) {
		throw new Error('Cannot create path with less than 2 points');
	}

	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const point of points) {
		const [x, y] = point;
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}

	return {
		type: LayerType.Path,
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
		fill: color,
		points: points.map(([x, y, pressure]) => [x - minX, y - minY, pressure]),
		strokeWidth: strokeWidth || 16,
	};
}

/**
 * Converts a pointer event to canvas coordinates
 * Takes into account the SVG's bounding box and camera position
 */
export function pointerEventToCanvasPoint(
	e: React.PointerEvent,
	camera: Camera
): Point {
	// Get the SVG element that contains the pointer event
	const svgElement = e.currentTarget as SVGSVGElement;

	// Get the bounding client rect of the SVG
	const svgRect = svgElement.getBoundingClientRect();

	// Calculate the point in SVG coordinates
	const x = e.clientX - svgRect.left;
	const y = e.clientY - svgRect.top;

	// Apply camera transformation (subtract camera position)
	return {
		x: x - camera.x,
		y: y - camera.y,
	};
}

/**
 * Calculates new bounds when resizing a layer
 */
export function resizeBounds(bounds: XYWH, corner: Side, point: Point): XYWH {
	const result = { ...bounds };

	if (corner === 'top' || corner === 'top-left' || corner === 'top-right') {
		result.height = bounds.height - (point.y - bounds.y);
		result.y = point.y;
	}

	if (
		corner === 'bottom' ||
		corner === 'bottom-left' ||
		corner === 'bottom-right'
	) {
		result.height = point.y - bounds.y;
	}

	if (corner === 'left' || corner === 'top-left' || corner === 'bottom-left') {
		result.width = bounds.width - (point.x - bounds.x);
		result.x = point.x;
	}

	if (
		corner === 'right' ||
		corner === 'top-right' ||
		corner === 'bottom-right'
	) {
		result.width = point.x - bounds.x;
	}

	return result;
}

/**
 * Gets a contrasting text color (black or white) based on background color
 */
export function getContrastingTextColor(color: Color): string {
	// Calculate luminance using the formula: 0.299*R + 0.587*G + 0.114*B
	const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;

	// Use white text for dark backgrounds, black text for light backgrounds
	return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Converts stroke points to SVG path
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
	if (!stroke.length) return '';

	const d = stroke.reduce(
		(acc, [x0, y0], i, arr) => {
			const [x1, y1] = arr[(i + 1) % arr.length];
			acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
			return acc;
		},
		['M', ...stroke[0], 'Q']
	);

	d.push('Z');
	return d.join(' ');
}
