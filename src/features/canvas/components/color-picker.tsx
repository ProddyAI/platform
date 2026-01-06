"use client";

import type { Color } from "@/features/canvas/types/canvas";
import { colorToCSS } from "@/lib/utils";

type ColorPickerProps = {
	onChange: (color: Color) => void;
	orientation?: "horizontal" | "vertical";
};

export const ColorPicker = ({
	onChange,
	orientation = "horizontal",
}: ColorPickerProps) => {
	const isVertical = orientation === "vertical";

	return (
		<div className={`flex gap-1 ${isVertical ? "flex-col" : "items-center"}`}>
			<ColorButton color={{ r: 243, g: 82, b: 35 }} onClick={onChange} />
			<ColorButton color={{ r: 255, g: 249, b: 177 }} onClick={onChange} />
			<ColorButton color={{ r: 68, g: 202, b: 99 }} onClick={onChange} />
			<ColorButton color={{ r: 39, g: 142, b: 237 }} onClick={onChange} />
			<ColorButton color={{ r: 155, g: 105, b: 245 }} onClick={onChange} />
			<ColorButton color={{ r: 252, g: 142, b: 42 }} onClick={onChange} />
			<ColorButton color={{ r: 0, g: 0, b: 0 }} onClick={onChange} />
			<ColorButton color={{ r: 255, g: 255, b: 255 }} onClick={onChange} />
		</div>
	);
};

type ColorButtonProps = {
	onClick: (color: Color) => void;
	color: Color;
};

const ColorButton = ({ color, onClick }: ColorButtonProps) => {
	return (
		<button
			className="w-8 h-8 items-center flex justify-center hover:opacity-75 transition"
			onClick={() => onClick(color)}
		>
			<div
				className="h-8 w-8 rounded-md border border-neutral-300"
				style={{ background: colorToCSS(color) }}
				aria-hidden
			/>
		</button>
	);
};
