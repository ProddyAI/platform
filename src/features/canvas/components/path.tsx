import getStroke from "perfect-freehand";
import type React from "react";
import { getSvgPathFromStroke } from "../../../lib/utils";

type PathProps = {
	x: number;
	y: number;
	points: number[][];
	fill: string;
	onPointerDown?: (e: React.PointerEvent) => void;
	stroke?: string;
	strokeWidth?: number;
};

export const Path = ({
	x,
	y,
	points,
	fill,
	onPointerDown,
	stroke,
	strokeWidth = 16,
}: PathProps) => {
	// Guard against invalid/empty points to prevent SVG NaN errors
	if (
		!points ||
		!Array.isArray(points) ||
		points.length === 0 ||
		points.some(
			(pt) =>
				!Array.isArray(pt) ||
				pt.length < 2 ||
				pt.some(
					(v) => typeof v !== "number" || Number.isNaN(v) || !Number.isFinite(v)
				)
		)
	) {
		return null;
	}

	// Process the stroke with perfect-freehand
	const strokePath = getStroke(points, {
		size: strokeWidth,
		thinning: 0.5,
		smoothing: 0.5,
		streamline: 0.5,
	});

	// Convert the stroke to an SVG path
	const pathData = getSvgPathFromStroke(strokePath);

	// Skip rendering if pathData contains NaN (safety net)
	if (!pathData || pathData.includes("NaN")) {
		return null;
	}

	return (
		<path
			className="drop-shadow-md"
			d={pathData}
			fill={fill}
			onPointerDown={onPointerDown}
			stroke={stroke}
			strokeWidth={1}
			style={{
				transform: `translate(${x}px, ${y}px)`,
			}}
			x={0}
			y={0}
		/>
	);
};
