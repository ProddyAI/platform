import ContentEditable, {
	type ContentEditableEvent,
} from "react-contenteditable";
import { useMutation } from "../../../../liveblocks.config";
import { cn, colorToCSS, getContrastingTextColor } from "../../../lib/utils";
import type { NoteLayer } from "../types";

// Minimal sanitization: strip script tags, inline event handlers, and
// javascript: URIs before handing collaborator-authored HTML to ContentEditable.
const sanitizeHtml = (html: string) =>
	html
		.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
		.replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
		.replace(/\son\w+\s*=\s*'[^']*'/gi, "")
		.replace(/javascript:/gi, "");

const calculateFontSize = (width: number, height: number) => {
	const maxFontSize = 96;
	const scaleFactor = 0.15;
	const fontSizeBasedOnHeight = height * scaleFactor;
	const fontSizeBasedOnWidth = width * scaleFactor;

	return Math.min(fontSizeBasedOnHeight, fontSizeBasedOnWidth, maxFontSize);
};

type NoteProps = {
	id: string;
	layer: NoteLayer;
	onPointerDown: (e: React.PointerEvent, id: string) => void;
	selectionColor?: string;
};

export const Note = ({
	id,
	layer,
	onPointerDown,
	selectionColor,
}: NoteProps) => {
	const { x, y, width, height, fill, value } = layer;

	const updateValue = useMutation(({ storage }, newValue: string) => {
		const liveLayers = storage.get("layers");

		// Check if liveLayers is a LiveMap with a get method
		if (!liveLayers || typeof liveLayers.get !== "function") {
			console.error(
				"Error: liveLayers is not a LiveMap or doesn't have a get method",
				liveLayers
			);
			return;
		}

		const layer = liveLayers.get(id);

		if (layer) {
			// Update the layer with the new value
			layer.update({
				value: newValue,
			});
		}
	}, []);

	const handleContentChange = (e: ContentEditableEvent) => {
		updateValue(e.target.value);
	};

	return (
		<foreignObject
			className="shadow-md drop-shadow-xl"
			height={height}
			onPointerDown={(e) => onPointerDown(e, id)}
			style={{
				outline: selectionColor ? `1px solid ${selectionColor}` : "none",
				backgroundColor: fill ? colorToCSS(fill) : "hsl(var(--muted))",
			}}
			width={width}
			x={x}
			y={y}
		>
			<div className="relative size-full">
				{!value && (
					<span
						className="pointer-events-none absolute inset-0 flex items-center justify-center text-center opacity-50"
						style={{
							fontSize: calculateFontSize(width, height),
							color: fill
								? getContrastingTextColor(fill)
								: "hsl(var(--muted-foreground))",
						}}
					>
						Text
					</span>
				)}
				<ContentEditable
					className={cn(
						"size-full flex items-center justify-center text-center outline-none"
					)}
					html={value ? sanitizeHtml(value) : ""}
					onChange={handleContentChange}
					style={{
						fontSize: calculateFontSize(width, height),
						color: fill
							? getContrastingTextColor(fill)
							: "hsl(var(--foreground))",
					}}
				/>
			</div>
		</foreignObject>
	);
};
