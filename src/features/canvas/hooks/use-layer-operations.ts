'use client';

import { nanoid } from 'nanoid';
import { useMutation } from '../../../../liveblocks.config';
import { Camera, Color, LayerType, Point, MermaidLayer } from '../types/canvas';
import { LiveMap, LiveList, LiveObject } from '@liveblocks/client';
import { penPointsToPathLayer } from '../../../lib/utils';

const MAX_LAYERS = 100;

export function useLayerOperations(lastUsedColor: Color) {
	const insertLayer = useMutation(
		(
			{ storage, setMyPresence },
			layerType:
				| LayerType.Ellipse
				| LayerType.Rectangle
				| LayerType.Text
				| LayerType.Note
				| LayerType.Mermaid,
			position: Point
		) => {
			try {
				let liveLayers = storage.get('layers');
				let liveLayerIds = storage.get('layerIds');

				if (!liveLayers || typeof liveLayers.set !== 'function') {
					liveLayers = new LiveMap<string, LiveObject<any>>();
					storage.set('layers', liveLayers);
				}

				if (!liveLayerIds || typeof liveLayerIds.push !== 'function') {
					liveLayerIds = new LiveList<string>([]);
					storage.set('layerIds', liveLayerIds);
				}

				// Check if we've reached the maximum number of layers
				if (liveLayers.size >= MAX_LAYERS) return;

				const layerId = nanoid();

				// Center the shape around the clicked position
				const centerX = position.x - 50; // Half of width (100)
				const centerY = position.y - 50; // Half of height (100)

				// Create the appropriate layer data
				let layerData;
				if (layerType === LayerType.Text) {
					// For text layers, use dimensions that will auto-resize based on content
					layerData = {
						type: layerType,
						x: position.x - 50, // Center at cursor
						y: position.y - 25, // Center at cursor
						height: 50, // Initial height
						width: 100, // Initial width
						fill: lastUsedColor,
						value: '',
					};
				} else if (layerType === LayerType.Note) {
					layerData = {
						type: layerType,
						x: centerX,
						y: centerY,
						height: 100,
						width: 200, // Notes are wider by default
						fill: lastUsedColor,
						value: '',
					};
				} else if (layerType === LayerType.Mermaid) {
					layerData = {
						type: layerType,
						x: centerX,
						y: centerY,
						height: 300,
						width: 400, // Mermaid diagrams are larger by default
						fill: lastUsedColor,
						mermaidCode: 'flowchart TD\n    A([Start]) --> B[Process]\n    B --> C([End])',
					};
				} else {
					layerData = {
						type: layerType,
						x: centerX,
						y: centerY,
						height: 100,
						width: 100,
						fill: lastUsedColor,
					};
				}

				// Create a LiveObject and set it in the map
				const liveObject = new LiveObject(layerData);
				liveLayers.set(layerId, liveObject);
				liveLayerIds.push(layerId);

				// Force a storage update to ensure changes are synchronized
				storage.set('lastUpdate', Date.now());

				setMyPresence({ selection: [layerId] }, { addToHistory: true });
			} catch (error) {}
		},
		[lastUsedColor]
	);

	// Insert a path (drawing)
	const insertPath = useMutation(
		({ storage, self, setMyPresence }) => {
			const { pencilDraft, strokeWidth } = self.presence;

			if (pencilDraft == null || pencilDraft.length < 2) {
				setMyPresence({ pencilDraft: null });
				return;
			}

			try {
				// Get the storage objects
				let liveLayers = storage.get('layers');
				let liveLayerIds = storage.get('layerIds');

				// Initialize storage if needed
				if (!liveLayers || typeof liveLayers.set !== 'function') {
					liveLayers = new LiveMap<string, LiveObject<any>>();
					storage.set('layers', liveLayers);
				}

				if (!liveLayerIds || typeof liveLayerIds.push !== 'function') {
					liveLayerIds = new LiveList<string>([]);
					storage.set('layerIds', liveLayerIds);
				}

				// Check if we've reached the maximum number of layers
				if (liveLayers.size >= MAX_LAYERS) {
					setMyPresence({ pencilDraft: null });
					return;
				}

				const id = nanoid();

				// Create the path layer
				const pathLayer = penPointsToPathLayer(
					pencilDraft,
					lastUsedColor,
					strokeWidth
				);

				// Create a LiveObject and set it in the map
				const liveObject = new LiveObject(pathLayer);
				liveLayerIds.push(id);
				liveLayers.set(id, liveObject);

				// Force a storage update to ensure changes are synchronized
				storage.set('lastUpdate', Date.now());

				// Clear the pencil draft after successfully adding the path
				setMyPresence({ pencilDraft: null });
			} catch (error) {
				setMyPresence({ pencilDraft: null });
			}
		},
		[lastUsedColor]
	);

	// Erase a layer by ID
	const eraseLayerById = useMutation(({ storage }, layerId: string) => {
		if (!layerId) return;

		try {
			// Get the storage objects
			const liveLayers = storage.get('layers');
			const liveLayerIds = storage.get('layerIds');

			// Check if we have valid LiveMap and LiveList objects
			if (!liveLayers || typeof liveLayers.delete !== 'function') return;
			if (!liveLayerIds) return;

			// Check if the layer exists before trying to delete it
			const layerExists = liveLayers.has(layerId);
			if (!layerExists) return;

			// Delete the layer from the LiveMap
			liveLayers.delete(layerId);

			// Find and remove the layer ID from the LiveList
			const layerIdsArray = Array.from(liveLayerIds);
			const index = layerIdsArray.indexOf(layerId);

			if (index !== -1 && typeof liveLayerIds.delete === 'function') {
				liveLayerIds.delete(index);
			}

			// Force a storage update to ensure changes are synchronized
			storage.set('lastUpdate', Date.now());
		} catch (error) {}
	}, []);

// Insert a Mermaid diagram with custom code
const insertMermaidLayer = useMutation(
	({ storage, setMyPresence }, mermaidCode: string, position: Point) => {
		try {
			// Get the storage objects
			let liveLayers = storage.get('layers');
			let liveLayerIds = storage.get('layerIds');

			// Initialize storage if needed
			if (!liveLayers || typeof liveLayers.set !== 'function') {
				liveLayers = new LiveMap<string, LiveObject<any>>();
				storage.set('layers', liveLayers);
			}

			if (!liveLayerIds || typeof liveLayerIds.push !== 'function') {
				liveLayerIds = new LiveList<string>([]);
				storage.set('layerIds', liveLayerIds);
			}

			// Check layer limit
			if (liveLayerIds.length >= MAX_LAYERS) {
				console.warn('Maximum number of layers reached');
				return;
			}

			const layerId = nanoid();

			const layerData: MermaidLayer = {
				type: LayerType.Mermaid,
				x: position.x - 200, // Center the diagram
				y: position.y - 150,
				height: 300,
				width: 400,
				fill: lastUsedColor,
				mermaidCode: mermaidCode,
			};

			// Create a LiveObject and set it in the map
			const liveObject = new LiveObject(layerData);
			liveLayers.set(layerId, liveObject);
			liveLayerIds.push(layerId);

			// Force a storage update to ensure changes are synchronized
			storage.set('lastUpdate', Date.now());

			setMyPresence({ selection: [layerId] }, { addToHistory: true });

			return layerId;
		} catch (error) {
			console.error('Error inserting Mermaid layer:', error);
			return null;
		}
	},
	[lastUsedColor]
);

	return {
		insertLayer,
		insertPath,
		eraseLayerById,
		insertMermaidLayer,
	};
}
