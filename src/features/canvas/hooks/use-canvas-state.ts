'use client';

import { useState } from 'react';
import {
	CanvasMode,
	CanvasState,
	Color,
	LayerType,
	Point,
	Side,
	XYWH,
} from '../types/canvas';

export function useCanvasState(initialColor: Color = { r: 0, g: 0, b: 0 }) {
	const [canvasState, setCanvasState] = useState<CanvasState>({
		mode: CanvasMode.None,
	});

	const [lastUsedColor, setLastUsedColor] = useState<Color>(initialColor);
	const [strokeWidth, setStrokeWidth] = useState<number>(16);

	const setMode = (mode: CanvasMode) => {
		if (mode === CanvasMode.None) {
			setCanvasState({ mode: CanvasMode.None });
		} else {
			console.error(`Unsupported mode: ${mode}`);
		}
	};

	const setPressing = (origin: Point) => {
		setCanvasState({ mode: CanvasMode.Pressing, origin });
	};

	const setSelectionNet = (origin: Point, current: Point) => {
		setCanvasState({ mode: CanvasMode.SelectionNet, origin, current });
	};

	const setTranslating = (current: Point) => {
		setCanvasState({ mode: CanvasMode.Translating, current });
	};

	const setInserting = (
		layerType:
			| LayerType.Ellipse
			| LayerType.Rectangle
			| LayerType.Text
			| LayerType.Note
	) => {
		setCanvasState({ mode: CanvasMode.Inserting, layerType });
	};

	const setResizing = (initialBounds: XYWH, corner: Side) => {
		setCanvasState({ mode: CanvasMode.Resizing, initialBounds, corner });
	};

	const setPencil = () => {
		setCanvasState({ mode: CanvasMode.Pencil, strokeWidth });
	};

	const setEraser = () => {
		setCanvasState({ mode: CanvasMode.Eraser });
	};

	return {
		canvasState,
		setCanvasState,
		lastUsedColor,
		setLastUsedColor,
		strokeWidth,
		setStrokeWidth,
		setMode,
		setPressing,
		setSelectionNet,
		setTranslating,
		setInserting,
		setResizing,
		setPencil,
		setEraser,
	};
}
