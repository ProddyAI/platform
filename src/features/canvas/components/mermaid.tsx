"use client";

import DOMPurify from "dompurify";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "../../../../liveblocks.config";
import { colorToCSS } from "../../../lib/utils";
import type { MermaidLayer } from "../types/canvas";
import { MermaidEditDialog } from "./mermaid-edit-dialog";

type MermaidProps = {
	id: string;
	layer: MermaidLayer;
	onPointerDown: (e: React.PointerEvent, id: string) => void;
	selectionColor?: string;
};

export const Mermaid = ({
	id,
	layer,
	onPointerDown,
	selectionColor,
}: MermaidProps) => {
	const { x, y, width, height, fill, mermaidCode } = layer;
	const containerRef = useRef<HTMLDivElement>(null);
	const svgContainerRef = useRef<HTMLDivElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [renderedSvg, setRenderedSvg] = useState<string>("");
	const [isMounted, setIsMounted] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

	// Update layer content
	const updateMermaidCode = useMutation(
		({ storage }, newCode: string) => {
			const liveLayers = storage.get("layers");
			if (liveLayers) {
				const layer = liveLayers.get(id);
				if (layer) {
					// Type assertion to ensure we can access mermaidCode property
					(layer as any).set("mermaidCode", newCode);
				}
			}
		},
		[id]
	);

	// Handle client-side mounting
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Safely render sanitized SVG
	useEffect(() => {
		if (renderedSvg && svgContainerRef.current) {
			// Sanitize the SVG content to prevent XSS attacks
			const sanitizedSvg = DOMPurify.sanitize(renderedSvg, {
				USE_PROFILES: { svg: true, svgFilters: true },
				ALLOWED_TAGS: [
					"svg",
					"g",
					"path",
					"text",
					"tspan",
					"rect",
					"circle",
					"ellipse",
					"line",
					"polyline",
					"polygon",
					"defs",
					"marker",
					"foreignObject",
					"div",
					"p",
					"span",
				],
				ALLOWED_ATTR: [
					"viewBox",
					"width",
					"height",
					"x",
					"y",
					"x1",
					"x2",
					"y1",
					"y2",
					"cx",
					"cy",
					"r",
					"rx",
					"ry",
					"d",
					"fill",
					"stroke",
					"stroke-width",
					"stroke-dasharray",
					"opacity",
					"transform",
					"class",
					"id",
					"style",
					"font-family",
					"font-size",
					"text-anchor",
					"dominant-baseline",
				],
				ADD_TAGS: ["foreignObject"],
				ADD_ATTR: ["xmlns", "xmlns:xlink", "role"],
			});

			// Safely set the innerHTML with sanitized content
			svgContainerRef.current.innerHTML = sanitizedSvg;
		}
	}, [renderedSvg]);

	useEffect(() => {
		if (!isMounted) return;

		const renderMermaid = async () => {
			if (!mermaidCode) {
				return;
			}

			// Check if we're in browser environment
			if (typeof window === "undefined") {
				return;
			}

			try {
				setIsLoading(true);
				setError(null);

				// Dynamic import of mermaid to avoid SSR issues
				const mermaid = (await import("mermaid")).default;

				// Initialize mermaid with configuration
				mermaid.initialize({
					startOnLoad: false,
					theme: "default",
					securityLevel: "loose",
					fontFamily: "Arial, sans-serif",
					fontSize: 12,
					flowchart: {
						useMaxWidth: false,
						htmlLabels: true,
						curve: "basis",
					},
				});

				// Generate unique ID for this diagram
				const diagramId = `mermaid-${id}-${Date.now()}`;

				// Render the mermaid diagram
				const { svg } = await mermaid.render(diagramId, mermaidCode);

				// Clean up the SVG to make it responsive
				const cleanedSvg = svg
					.replace(/width="[^"]*"/, 'width="100%"')
					.replace(/height="[^"]*"/, 'height="100%"');

				setRenderedSvg(cleanedSvg);
				setIsLoading(false);
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				const errorMessage =
					err instanceof Error ? err.message : "Unknown error";
				setError(`Failed to render diagram: ${errorMessage}`);
				setIsLoading(false);
			}
		};

		// Add a small delay to ensure the component is mounted
		const timer = setTimeout(renderMermaid, 200);
		return () => clearTimeout(timer);
	}, [mermaidCode, id, isMounted]);

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsEditDialogOpen(true);
	};

	const handleSaveMermaidCode = (newCode: string) => {
		updateMermaidCode(newCode);
	};

	// Don't render anything until mounted (SSR safety)
	if (!isMounted) {
		return (
			<>
				<foreignObject
					className="shadow-md drop-shadow-xl cursor-pointer"
					height={height}
					onDoubleClick={handleDoubleClick}
					onPointerDown={(e) => onPointerDown(e, id)}
					style={{
						outline: selectionColor ? `1px solid ${selectionColor}` : "none",
						backgroundColor: fill ? colorToCSS(fill) : "#f9f9f9",
					}}
					width={width}
					x={x}
					y={y}
				>
					<div
						className="h-full w-full flex items-center justify-center bg-gray-100 border border-gray-300 rounded"
						style={{ fontSize: "12px", color: "#666" }}
					>
						<div className="text-center">
							<div>Loading...</div>
						</div>
					</div>
				</foreignObject>

				{/* Edit Dialog */}
				<MermaidEditDialog
					mermaidCode={mermaidCode}
					onOpenChange={setIsEditDialogOpen}
					onSave={handleSaveMermaidCode}
					open={isEditDialogOpen}
				/>
			</>
		);
	}

	if (isLoading) {
		return (
			<>
				<foreignObject
					className="shadow-md drop-shadow-xl cursor-pointer"
					height={height}
					onDoubleClick={handleDoubleClick}
					onPointerDown={(e) => onPointerDown(e, id)}
					style={{
						outline: selectionColor ? `1px solid ${selectionColor}` : "none",
						backgroundColor: fill ? colorToCSS(fill) : "#f9f9f9",
					}}
					width={width}
					x={x}
					y={y}
				>
					<div
						className="h-full w-full flex items-center justify-center bg-gray-100 border border-gray-300 rounded"
						style={{ fontSize: "12px", color: "#666" }}
					>
						<div className="text-center">
							<div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
							<div>Rendering diagram...</div>
						</div>
					</div>
				</foreignObject>

				{/* Edit Dialog */}
				<MermaidEditDialog
					mermaidCode={mermaidCode}
					onOpenChange={setIsEditDialogOpen}
					onSave={handleSaveMermaidCode}
					open={isEditDialogOpen}
				/>
			</>
		);
	}

	if (error) {
		return (
			<>
				<foreignObject
					className="shadow-md drop-shadow-xl cursor-pointer"
					height={height}
					onDoubleClick={handleDoubleClick}
					onPointerDown={(e) => onPointerDown(e, id)}
					style={{
						outline: selectionColor ? `1px solid ${selectionColor}` : "none",
						backgroundColor: fill ? colorToCSS(fill) : "#fee2e2",
					}}
					width={width}
					x={x}
					y={y}
				>
					<div
						className="h-full w-full flex items-center justify-center bg-red-50 border border-red-300 rounded text-red-600"
						style={{ fontSize: "12px" }}
					>
						<div className="text-center p-2">
							<div className="font-medium mb-1">Diagram Error</div>
							<div className="text-xs">{error}</div>
						</div>
					</div>
				</foreignObject>

				{/* Edit Dialog */}
				<MermaidEditDialog
					mermaidCode={mermaidCode}
					onOpenChange={setIsEditDialogOpen}
					onSave={handleSaveMermaidCode}
					open={isEditDialogOpen}
				/>
			</>
		);
	}

	return (
		<>
			<foreignObject
				className="shadow-md drop-shadow-xl cursor-pointer"
				height={height}
				onDoubleClick={handleDoubleClick}
				onPointerDown={(e) => onPointerDown(e, id)}
				style={{
					outline: selectionColor ? `1px solid ${selectionColor}` : "none",
					backgroundColor: fill ? colorToCSS(fill) : "white",
				}}
				width={width}
				x={x}
				y={y}
			>
				<div
					className="h-full w-full overflow-hidden rounded border border-gray-200 bg-white"
					ref={containerRef}
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "4px",
					}}
				>
					{renderedSvg && (
						<div
							className="w-full h-full flex items-center justify-center"
							ref={svgContainerRef}
							style={{
								maxWidth: "100%",
								maxHeight: "100%",
							}}
						/>
					)}
				</div>
			</foreignObject>

			{/* Edit Dialog */}
			<MermaidEditDialog
				mermaidCode={mermaidCode}
				onOpenChange={setIsEditDialogOpen}
				onSave={handleSaveMermaidCode}
				open={isEditDialogOpen}
			/>
		</>
	);
};
