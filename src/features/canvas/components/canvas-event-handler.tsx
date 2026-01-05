"use client";

import { useMutation } from "../../../../liveblocks.config";
import { Camera, CanvasMode, CanvasState, Color, LayerType, Point } from "../types/canvas";
import { findLayerAtPoint, pointerEventToCanvasPoint } from "../../../lib/utils";

interface CanvasEventHandlerProps {
  camera: Camera;
  canvasState: CanvasState;
  layerIds: string[];
  lastUsedColor: Color;
  setCanvasState: (state: any) => void;
  startDrawing: (point: Point, pressure: number) => void;
  continueDrawing: (point: Point, e: React.PointerEvent) => void;
  insertPath: () => void;
  eraseLayerById: (layerId: string) => void;
  insertLayer: (layerType: any, point: Point) => void;
  unselectLayers: () => void;
  startMultiSelection: (current: Point, origin: Point) => void;
  updateSelectionNet: (current: Point, origin: Point) => void;
  translateSelectedLayers: (point: Point) => void;
  strokeWidth?: number; // Add stroke width prop
  history: any;
  children: (props: {
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  }) => React.ReactNode;
}

export const CanvasEventHandler = ({
  camera,
  canvasState,
  layerIds,
  lastUsedColor,
  setCanvasState,
  startDrawing,
  continueDrawing,
  insertPath,
  eraseLayerById,
  insertLayer,
  unselectLayers,
  startMultiSelection,
  updateSelectionNet,
  translateSelectedLayers,
  strokeWidth = 16, // Default to 16 if not provided
  history,
  children
}: CanvasEventHandlerProps) => {
  // Handle pointer move
  const onPointerMove = useMutation(
    ({ setMyPresence, self, storage }, e: React.PointerEvent) => {
      e.preventDefault();

      const current = pointerEventToCanvasPoint(e, camera);

      // Always update cursor position
      setMyPresence({
        cursor: current,
        penColor: self.presence.penColor || lastUsedColor,
        strokeWidth: self.presence.strokeWidth || strokeWidth,
      });

      if (canvasState.mode === CanvasMode.Pressing) {
        startMultiSelection(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.SelectionNet) {
        updateSelectionNet(current, canvasState.origin);
      } else if (canvasState.mode === CanvasMode.Translating) {
        translateSelectedLayers(current);
      } else if (canvasState.mode === CanvasMode.Pencil) {
        continueDrawing(current, e);
      } else if (canvasState.mode === CanvasMode.Eraser && e.buttons === 1) {
        // Only erase when mouse button is pressed
        const liveLayers = storage.get("layers");
        if (!liveLayers) return;

        // Find a layer at the current point with increased tolerance
        const layerId = findLayerAtPoint(layerIds, liveLayers, current, 15);
        if (layerId) {
          eraseLayerById(layerId);
          storage.set("lastUpdate", Date.now());
        }
      }
    },
    [
      startMultiSelection,
      updateSelectionNet,
      continueDrawing,
      canvasState,
      camera,
      translateSelectedLayers,
      lastUsedColor,
      layerIds,
      eraseLayerById,
    ],
  );

  // Handle pointer leave
  const onPointerLeave = useMutation(({ setMyPresence, self }) => {
    setMyPresence({
      cursor: null,
      penColor: self.presence.penColor || lastUsedColor,
    });
  }, [lastUsedColor]);

  // Handle pointer down
  const onPointerDown = useMutation(
    ({ storage }, e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (canvasState.mode === CanvasMode.Inserting) return;

      if (canvasState.mode === CanvasMode.Pencil) {
        startDrawing(point, e.pressure);
        return;
      }

      // Handle eraser mode
      if (canvasState.mode === CanvasMode.Eraser) {
        const liveLayers = storage.get("layers");
        if (!liveLayers) return;

        // Find a layer at the current point with increased tolerance
        const layerId = findLayerAtPoint(layerIds, liveLayers, point, 15);
        if (layerId) {
          eraseLayerById(layerId);
          storage.set("lastUpdate", Date.now());
        }
        return;
      }

      setCanvasState({ origin: point, mode: CanvasMode.Pressing });
    },
    [camera, canvasState.mode, setCanvasState, startDrawing, layerIds, eraseLayerById],
  );

  // Handle pointer up
  const onPointerUp = useMutation(
    ({ storage }, e) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (
        canvasState.mode === CanvasMode.None ||
        canvasState.mode === CanvasMode.Pressing
      ) {
        unselectLayers();
        setCanvasState({
          mode: CanvasMode.None,
        });
      } else if (canvasState.mode === CanvasMode.Pencil) {
        insertPath();
        storage.set("lastUpdate", Date.now());
      } else if (canvasState.mode === CanvasMode.Inserting) {
        insertLayer(canvasState.layerType, point);
      } else {
        setCanvasState({
          mode: CanvasMode.None,
        });
      }

      history.resume();
    },
    [
      setCanvasState,
      camera,
      canvasState,
      history,
      insertLayer,
      unselectLayers,
      insertPath,
    ],
  );

  // Handle layer pointer down
  const onLayerPointerDown = useMutation(
    ({ self, setMyPresence, storage }, e: React.PointerEvent, layerId: string) => {
      // Handle eraser mode
      if (canvasState.mode === CanvasMode.Eraser) {
        e.stopPropagation();
        eraseLayerById(layerId);
        storage.set("lastUpdate", Date.now());
        return;
      }

      // Skip for pencil and inserting modes
      if (
        canvasState.mode === CanvasMode.Pencil ||
        canvasState.mode === CanvasMode.Inserting
      )
        return;

      history.pause();

      try {
        // Get the layer
        const liveLayers = storage.get("layers");
        if (!liveLayers || typeof liveLayers.get !== 'function') return;

        const layer = liveLayers.get(layerId);
        if (!layer) return;

        // Check if it's a text layer - need to access the value from the LiveObject
        const layerData = layer.toObject();
        const isTextLayer = layerData.type === LayerType.Text;

        // For text layers, we handle dragging in the component itself
        // Just select the layer and don't set the canvas state to translating
        if (isTextLayer) {
          // Select the layer if not already selected
          if (!self.presence.selection.includes(layerId)) {
            setMyPresence({ selection: [layerId] }, { addToHistory: true });
          }

          // Force a storage update to ensure changes are synchronized
          storage.set("lastUpdate", Date.now());
          return;
        }
      } catch (error) {
        console.error("Error handling layer pointer down:", error);
        return;
      }

      // For non-text layers, proceed with normal translation
      // Calculate the exact pointer position in canvas coordinates
      const point = pointerEventToCanvasPoint(e, camera);

      // Select the layer if not already selected
      if (!self.presence.selection.includes(layerId)) {
        setMyPresence({ selection: [layerId] }, { addToHistory: true });
      }

      // Store the current point for translation
      setCanvasState({
        mode: CanvasMode.Translating,
        current: point
      });

      // Force a storage update to ensure changes are synchronized
      storage.set("lastUpdate", Date.now());
    },
    [setCanvasState, camera, history, canvasState.mode, eraseLayerById],
  );

  return (
    <>
      {children({
        onPointerMove,
        onPointerLeave,
        onPointerDown,
        onPointerUp,
        onLayerPointerDown
      })}
    </>
  );
};
