'use client';

import { useState, useCallback } from 'react';
import { Camera } from '../types/canvas';

export function useCamera(initialPosition: Camera = { x: 0, y: 0 }) {
	const [camera, setCamera] = useState<Camera>(initialPosition);

	const onWheel = useCallback((e: React.WheelEvent) => {
		setCamera((camera) => ({
			x: camera.x - e.deltaX,
			y: camera.y - e.deltaY,
		}));
	}, []);

	return {
		camera,
		setCamera,
		onWheel,
	};
}
