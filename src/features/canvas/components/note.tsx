import ContentEditable, {
	type ContentEditableEvent,
} from "react-contenteditable";
import { useMutation } from "../../../../liveblocks.config";
import { cn, colorToCSS, getContrastingTextColor } from "../../../lib/utils";
import type { NoteLayer } from "../types/canvas";

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
			x={x}
			y={y}
			width={width}
			height={height}
			onPointerDown={(e) => onPointerDown(e, id)}
			style={{
				outline: selectionColor ? `1px solid ${selectionColor}` : "none",
				backgroundColor: fill ? colorToCSS(fill) : "#000",
			}}
			className="shadow-md drop-shadow-xl"
		>
			<ContentEditable
				html={value || "Text"}
				onChange={handleContentChange}
				className={cn(
					"h-full w-full flex items-center justify-center text-center outline-none"
				)}
				style={{
					fontSize: calculateFontSize(width, height),
					color: fill ? getContrastingTextColor(fill) : "#000",
				}}
			/>
		</foreignObject>
	);
};
