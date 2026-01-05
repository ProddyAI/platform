'use client';

import { useCallback } from 'react';
import { useMutation } from '../../../../liveblocks.config';
import { CanvasMode, Point, Side, XYWH } from '../types/canvas';
import {
	findIntersectingLayersWithRectangle,
	resizeBounds,
} from '../../../lib/utils';

const MULTISELECTION_THRESHOLD = 2;

export function useSelection(
	canvasState: any,
	setCanvasState: (state: any) => void,
	layerIds: readonly string[],
	history: any
) {
	const unselectLayers = useMutation(({ self, setMyPresence }) => {
		if (self.presence.selection.length > 0) {
			setMyPresence({ selection: [] }, { addToHistory: true });
		}
	}, []);

	const updateSelectionNet = useMutation(
		({ storage, setMyPresence }, current: Point, origin: Point) => {
			try {
				const layersMap = storage.get('layers');

				if (!layersMap) return;

				setCanvasState({
					mode: CanvasMode.SelectionNet,
					origin,
					current,
				});

				const ids = findIntersectingLayersWithRectangle(
					layerIds,
					layersMap,
					origin,
					current
				);

				setMyPresence({ selection: ids });
			} catch (error) {
				console.error('Error updating selection net:', error);
			}
		},
		[layerIds, setCanvasState]
	);

	const startMultiSelection = useCallback(
		(current: Point, origin: Point) => {
			if (
				Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) >
				MULTISELECTION_THRESHOLD
			) {
				setCanvasState({
					mode: CanvasMode.SelectionNet,
					origin,
					current,
				});
			}
		},
		[setCanvasState]
	);

	const resizeSelectedLayer = useMutation(
		({ storage, self }, point: Point) => {
			if (canvasState.mode !== CanvasMode.Resizing) return;

			try {
				const bounds = resizeBounds(
					canvasState.initialBounds,
					canvasState.corner,
					point
				);

				const minWidth = 20;
				const minHeight = 20;
				const newBounds = {
					...bounds,
					width: Math.max(bounds.width, minWidth),
					height: Math.max(bounds.height, minHeight),
				};

				const liveLayers = storage.get('layers');

				if (!liveLayers || typeof liveLayers.get !== 'function') return;

				const layerId = self.presence.selection[0];
				if (!layerId) return;

				const layer = liveLayers.get(layerId);

				if (layer) {
					layer.update(newBounds);

					storage.set('lastUpdate', Date.now());
				}
			} catch (error) {
				console.error('Error resizing layer:', error);
			}
		},
		[canvasState]
	);

	const onResizeHandlePointerDown = useCallback(
		(corner: Side, initialBounds: XYWH) => {
			history.pause();

			setCanvasState({
				mode: CanvasMode.Resizing,
				initialBounds,
				corner,
			});
		},
		[history, setCanvasState]
	);

	const translateSelectedLayers = useMutation(
		({ storage, self }, point: Point) => {
			if (canvasState.mode !== CanvasMode.Translating) return;

			try {
				const offset = {
					x: point.x - canvasState.current.x,
					y: point.y - canvasState.current.y,
				};

				const liveLayers = storage.get('layers');

				if (!liveLayers || typeof liveLayers.get !== 'function') return;

				for (const id of self.presence.selection) {
					const layer = liveLayers.get(id);

					if (layer) {
						try {
							let currentX, currentY;

							if (typeof layer.toObject === 'function') {
								const layerData = layer.toObject();
								currentX = layerData.x;
								currentY = layerData.y;
							} else if (typeof layer.get === 'function') {
								currentX = layer.get('x');
								currentY = layer.get('y');
							} else {
								console.warn(
									'Using direct property access on layer - this may cause type errors'
								);
								const layerAny = layer as any;
								currentX = layerAny.x;
								currentY = layerAny.y;
							}

							if (
								typeof currentX !== 'number' ||
								typeof currentY !== 'number'
							) {
								console.warn('Invalid layer position', { currentX, currentY });
								continue;
							}

							layer.update({
								x: currentX + offset.x,
								y: currentY + offset.y,
							});
						} catch (error) {
							console.error('Error updating layer position:', error);
						}
					}
				}

				setCanvasState({
					mode: CanvasMode.Translating,
					current: point,
				});

				storage.set('lastUpdate', Date.now());
			} catch (error) {
				console.error('Error translating layers:', error);
			}
		},
		[canvasState, setCanvasState]
	);

	return {
		unselectLayers,
		updateSelectionNet,
		startMultiSelection,
		resizeSelectedLayer,
		onResizeHandlePointerDown,
		translateSelectedLayers,
	};
}
