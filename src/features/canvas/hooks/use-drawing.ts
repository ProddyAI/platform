'use client';

import { useMutation } from '../../../../liveblocks.config';
import { CanvasMode, Color, Point } from '../types/canvas';

export function useDrawing(
	canvasMode: CanvasMode,
	lastUsedColor: Color,
	strokeWidth: number = 16
) {
	const startDrawing = useMutation(
		({ setMyPresence }, point: Point, pressure: number) => {
			setMyPresence({
				pencilDraft: [[point.x, point.y, pressure]],
				penColor: lastUsedColor,
				strokeWidth: strokeWidth,
			});
		},
		[lastUsedColor, strokeWidth]
	);

	const continueDrawing = useMutation(
		({ self, setMyPresence }, point: Point, e: React.PointerEvent) => {
			const {
				pencilDraft,
				penColor,
				strokeWidth: currentStrokeWidth,
			} = self.presence;

			if (
				canvasMode !== CanvasMode.Pencil ||
				e.buttons !== 1 ||
				pencilDraft == null
			)
				return;

			// Always use the current penColor or fallback to lastUsedColor
			const currentPenColor = penColor || lastUsedColor;

			// Use current stroke width or fallback to default
			const effectiveStrokeWidth = currentStrokeWidth || strokeWidth;

			// Only add a new point if it's different from the last one
			let newDraft: [number, number, number][] = pencilDraft;

			// Check if we need to add a new point
			if (
				!(
					pencilDraft.length === 1 &&
					pencilDraft[0][0] === point.x &&
					pencilDraft[0][1] === point.y
				)
			) {
				newDraft = [
					...pencilDraft,
					[point.x, point.y, e.pressure] as [number, number, number],
				];
			}

			setMyPresence({
				cursor: point,
				pencilDraft: newDraft,
				penColor: currentPenColor,
				strokeWidth: effectiveStrokeWidth,
			});
		},
		[canvasMode, lastUsedColor, strokeWidth]
	);

	return {
		startDrawing,
		continueDrawing,
	};
}
