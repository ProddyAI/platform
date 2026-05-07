import type React from "react";
import type { RectangleLayer } from "@/features/canvas/types/canvas";
import { colorToCSS } from "@/lib/utils";

type RectangleProps = {
	id: string;
	layer: RectangleLayer;
	onPointerDown: (e: React.PointerEvent, id: string) => void;
	selectionColor?: string;
};

export const Rectangle = ({
	id,
	layer,
	onPointerDown,
	selectionColor,
}: RectangleProps) => {
	const { x, y, width, height, fill } = layer;

	return (
		<rect
			className="drop-shadow-md"
			fill={fill ? colorToCSS(fill) : "#000"}
			height={height}
			onPointerDown={(e) => onPointerDown(e, id)}
			stroke={selectionColor || "transparent"}
			strokeWidth={1}
			style={{
				transform: `translate(${x}px, ${y}px)`,
			}}
			width={width}
			x={0}
			y={0}
		/>
	);
};
