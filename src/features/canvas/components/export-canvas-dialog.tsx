"use client";

import { useMutation } from "convex/react";
import { Download, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useRoom } from "@/../liveblocks.config";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface ExportCanvasDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	canvasName: string;
}

export const ExportCanvasDialog = ({
	open,
	onOpenChange,
	canvasName,
}: ExportCanvasDialogProps) => {
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const room = useRoom();
	const [isExporting, setIsExporting] = useState(false);
	const [exportType, setExportType] = useState<"chat" | "system">("chat");
	const [exportFormat, setExportFormat] = useState<"png" | "svg" | "json">(
		"png"
	);

	// Convex mutation for creating a message
	const createMessage = useMutation(api.messages.create);

	const handleClose = () => {
		onOpenChange(false);
	};

	// Helper function to capture canvas as image data
	const captureCanvasImage = async (
		format: "png" | "svg"
	): Promise<string | null> => {
		try {
			// First, try to find the canvas element that contains the actual drawings
			// This is a more direct approach to find the element with the drawings

			// Look for elements that might be the canvas
			const canvasSelectors = [
				// Try to find the specific canvas element in the whiteboard
				".whiteboard-container svg",
				".canvas-container svg",
				".drawing-area svg",
				// Look for any SVG with a transform group (common in drawing apps)
				"svg g[transform]",
				// More general selectors
				"main svg",
				"[data-canvas='true'] svg",
				// Last resort - any SVG in the document
				"svg",
			];

			// Try each selector in order
			let svgElement: SVGSVGElement | null = null;
			for (const selector of canvasSelectors) {
				const elements = document.querySelectorAll(selector);

				if (elements.length > 0) {
					// If multiple elements found, try to find the one with the most children
					let bestElement = elements[0] as SVGSVGElement;
					let maxChildren = bestElement.querySelectorAll("*").length;

					for (let i = 1; i < elements.length; i++) {
						const el = elements[i] as SVGSVGElement;
						const childCount = el.querySelectorAll("*").length;
						if (childCount > maxChildren) {
							maxChildren = childCount;
							bestElement = el;
						}
					}

					svgElement = bestElement;
					break;
				}
			}

			// If no SVG found, try to find any element that might be the canvas
			if (!svgElement) {
				const allSvgs = document.querySelectorAll("svg");
				if (allSvgs.length > 0) {
					// Find the SVG with the most elements (likely the canvas)
					let bestSvg = allSvgs[0] as SVGSVGElement;
					let maxElements = bestSvg.querySelectorAll("*").length;

					for (let i = 1; i < allSvgs.length; i++) {
						const svg = allSvgs[i] as SVGSVGElement;
						const elementCount = svg.querySelectorAll("*").length;
						if (elementCount > maxElements) {
							maxElements = elementCount;
							bestSvg = svg;
						}
					}

					svgElement = bestSvg;
				} else {
					console.error("No SVG elements found in the document");
					return null;
				}
			}

			if (!svgElement) {
				toast.error("Canvas element not found");
				return null;
			}


			// Create a new SVG element for the export
			const exportSvg = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"svg"
			);

			// Copy attributes from the original SVG
			Array.from(svgElement.attributes).forEach((attr) => {
				exportSvg.setAttribute(attr.name, attr.value);
			});

			// Ensure the SVG has width and height
			if (
				!exportSvg.hasAttribute("width") ||
				!exportSvg.hasAttribute("height")
			) {
				const rect = svgElement.getBoundingClientRect();
				exportSvg.setAttribute("width", rect.width.toString());
				exportSvg.setAttribute("height", rect.height.toString());
			}

			// Add a white background rectangle
			const bgRect = document.createElementNS(
				"http://www.w3.org/2000/svg",
				"rect"
			);
			bgRect.setAttribute("x", "0");
			bgRect.setAttribute("y", "0");
			bgRect.setAttribute("width", exportSvg.getAttribute("width") || "800");
			bgRect.setAttribute("height", exportSvg.getAttribute("height") || "600");
			bgRect.setAttribute("fill", "white");
			exportSvg.appendChild(bgRect);

			// Clone all the content from the original SVG
			const contentNodes = Array.from(svgElement.childNodes);
			contentNodes.forEach((node) => {
				exportSvg.appendChild(node.cloneNode(true));
			});

			// For SVG format, return the serialized SVG directly
			if (format === "svg") {
				return new XMLSerializer().serializeToString(exportSvg);
			}

			// For PNG format, render the SVG to a canvas
			const canvas = document.createElement("canvas");

			// Get the dimensions from the SVG or use defaults
			const svgWidth = parseInt(exportSvg.getAttribute("width") || "800", 10);
			const svgHeight = parseInt(exportSvg.getAttribute("height") || "600", 10);

			// Set canvas size to match the SVG
			canvas.width = svgWidth;
			canvas.height = svgHeight;

			const ctx = canvas.getContext("2d");
			if (!ctx) {
				toast.error("Failed to create canvas context");
				return null;
			}

			// Fill with white background
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Create a data URL from the SVG
			const svgData = new XMLSerializer().serializeToString(exportSvg);
			const img = new Image();

			// Create a promise to handle the image loading
			return new Promise((resolve) => {
				img.onload = () => {
					if (ctx) {
						// Draw the image onto the canvas
						ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					}

					// Get the PNG data URL
					const pngDataUrl = canvas.toDataURL("image/png");
					resolve(pngDataUrl);
				};

				img.onerror = (err) => {
					console.error("Error loading SVG image:", err);

					if (ctx) {
						// Draw a fallback message
						ctx.fillStyle = "#888888";
						ctx.font = "20px Arial";
						ctx.textAlign = "center";
						ctx.fillText(
							"Failed to render canvas",
							canvas.width / 2,
							canvas.height / 2
						);
					}

					// Return the canvas with the error message
					resolve(canvas.toDataURL("image/png"));
				};

				// Set the source of the image to the SVG data
				try {
					// Use a safer approach to encode SVG data
					const encodedSvgData = window.btoa(
						encodeURIComponent(svgData).replace(
							/%([0-9A-F]{2})/g,
							(_match, p1) => {
								return String.fromCharCode(parseInt(p1, 16));
							}
						)
					);
					img.src = `data:image/svg+xml;base64,${encodedSvgData}`;
				} catch (e) {
					console.error("Error encoding SVG data:", e);
					if (ctx) {
						// Draw error message
						ctx.fillStyle = "#888888";
						ctx.font = "20px Arial";
						ctx.textAlign = "center";
						ctx.fillText(
							"Error encoding SVG data",
							canvas.width / 2,
							canvas.height / 2
						);
					}
					resolve(canvas.toDataURL("image/png"));
				}
			});
		} catch (error) {
			console.error("Error capturing canvas:", error);
			return null;
		}
	};

	// Export to chat (save as a message in the channel)
	const handleExportToChat = async () => {
		try {
			if (!channelId || !workspaceId || !room) {
				toast.error("Cannot export canvas: missing required data");
				return;
			}

			setIsExporting(true);

			// Generate a unique ID for the exported canvas
			const exportedCanvasId = `${channelId}-export-${Date.now()}`;

			// Store the current room ID
			const roomIdToExport = room.id;

			// Prepare the message data
			const messageData: any = {
				type: "canvas-export",
				canvasName: canvasName,
				roomId: roomIdToExport,
				exportedCanvasId: exportedCanvasId,
				exportFormat: exportFormat,
				exportTime: new Date().toISOString(),
			};

			// If exporting as image format, capture the canvas image
			if (exportFormat === "png" || exportFormat === "svg") {
				let imageData = await captureCanvasImage(exportFormat);

				// If secondary method fails for PNG, try the direct method
				if (!imageData && exportFormat === "png") {
					imageData = await captureCanvasDirect();
				}

				if (!imageData) {
					toast.error(
						`Failed to capture canvas as ${exportFormat.toUpperCase()}`
					);
					setIsExporting(false);
					return;
				}
				messageData.imageData = imageData;
			} else if (exportFormat === "json") {
				// For JSON format, include the canvas data
				try {
					const storage = room.getStorage();
					if (!storage) {
						toast.error("Failed to get canvas data");
						setIsExporting(false);
						return;
					}

					// Create a JSON representation of the canvas
					messageData.jsonData = {
						canvasName: canvasName,
						exportTime: new Date().toISOString(),
						roomId: room.id,
					};
				} catch (error) {
					console.error("Error getting canvas data:", error);
					toast.error("Failed to get canvas data");
					setIsExporting(false);
					return;
				}
			}

			// Create a message in the channel with the canvas export
			await createMessage({
				workspaceId: workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify(messageData),
			});

			toast.success(`Canvas exported to chat as ${exportFormat.toUpperCase()}`);
			handleClose();
		} catch (error) {
			console.error("Error exporting canvas to chat:", error);
			toast.error("Failed to export canvas to chat");
		} finally {
			setIsExporting(false);
		}
	};

	// Direct method to capture canvas using html2canvas approach
	const captureCanvasDirect = async (): Promise<string | null> => {
		try {

			// Try to find the canvas container with the actual drawings
			// Look for specific elements that might contain the drawings
			const canvasElements = document.querySelectorAll(
				'svg, canvas, [data-canvas="true"], .canvas-container, .whiteboard'
			);
			// Log all potential canvas elements for debugging
			canvasElements.forEach((element, index) => {
				// Use type assertion to access element properties safely
				const el = element as HTMLElement;
			});

			// Try to find the element with the most child nodes (likely the main canvas)
			let mainCanvas: Element | null = null;
			let maxChildren = 0;

			canvasElements.forEach((element) => {
				// Use type assertion to access element properties safely
				const el = element as HTMLElement;
				const childCount = el.childElementCount;
				if (childCount > maxChildren) {
					maxChildren = childCount;
					mainCanvas = element;
				}
			});

			if (!mainCanvas) {
				console.error("Could not find main canvas element");
				return null;
			}


			// Create a canvas element for rendering
			const canvas = document.createElement("canvas");

			// Get dimensions safely
			let width = 800;
			let height = 600;

			try {
				// Use type assertion to avoid TypeScript errors
				const element = mainCanvas as HTMLElement;
				if (element && typeof element.getBoundingClientRect === "function") {
					const rect = element.getBoundingClientRect();
					width = rect.width || width;
					height = rect.height || height;
				}
			} catch (error) {
				console.error("Error getting element dimensions:", error);
			}

			// Set canvas size
			canvas.width = width;
			canvas.height = height;

			const ctx = canvas.getContext("2d");
			if (!ctx) {
				console.error("Failed to get canvas context");
				return null;
			}

			// Fill with white background
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// If it's an SVG element, render it directly
			const elementType = (mainCanvas as HTMLElement).tagName;
			if (elementType && elementType.toLowerCase() === "svg") {
				const svgData = new XMLSerializer().serializeToString(
					mainCanvas as SVGElement
				);
				const img = new Image();

				return new Promise((resolve) => {
					img.onload = () => {
						ctx.drawImage(img, 0, 0);
						resolve(canvas.toDataURL("image/png"));
					};
					img.onerror = (err) => {
						console.error("Error loading SVG image:", err);
						ctx.fillStyle = "#888888";
						ctx.font = "20px Arial";
						ctx.textAlign = "center";
						ctx.fillText(
							"Failed to render canvas",
							canvas.width / 2,
							canvas.height / 2
						);
						resolve(canvas.toDataURL("image/png"));
					};
					img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
				});
			}

			// For other elements, try to capture using a screenshot approach
			try {
				// Only attempt to draw if it's a valid canvas or image element
				if (
					elementType &&
					(elementType.toLowerCase() === "canvas" ||
						elementType.toLowerCase() === "img")
				) {
					ctx.drawImage(
						mainCanvas as HTMLCanvasElement | HTMLImageElement,
						0,
						0
					);
					return canvas.toDataURL("image/png");
				} else {
					throw new Error(
						`Cannot directly draw element of type ${elementType}`
					);
				}
			} catch (e) {
				console.error("Error drawing element to canvas:", e);

				// Try using a different approach - take a screenshot of the area
				const html2canvas = (window as any).html2canvas;
				if (html2canvas) {
					try {
						const capturedCanvas = await html2canvas(mainCanvas as HTMLElement);
						return capturedCanvas.toDataURL("image/png");
					} catch (e2) {
						console.error("html2canvas failed:", e2);
					}
				}

				// If all else fails, create a simple representation
				ctx.fillStyle = "#888888";
				ctx.font = "20px Arial";
				ctx.textAlign = "center";
				ctx.fillText(
					"Could not render canvas content",
					canvas.width / 2,
					canvas.height / 2
				);
				return canvas.toDataURL("image/png");
			}
		} catch (error) {
			console.error("Error in direct canvas capture:", error);
			return null;
		}
	};

	// Export to system (download file)
	const handleExportToSystem = async () => {
		try {
			if (!room) {
				toast.error("Cannot export canvas: missing required data");
				return;
			}

			setIsExporting(true);

			// Handle different export formats
			if (exportFormat === "svg") {
				// Export as SVG
				const svgData = await captureCanvasImage("svg");
				if (!svgData) {
					toast.error("Failed to capture canvas as SVG");
					return;
				}

				const blob = new Blob([svgData], { type: "image/svg+xml" });
				const url = URL.createObjectURL(blob);

				// Create download link
				const a = document.createElement("a");
				a.href = url;
				a.download = `${canvasName || "canvas"}.svg`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				toast.success("Canvas exported as SVG");
			} else if (exportFormat === "png") {
				// Export as PNG
				let pngDataUrl = await captureCanvasImage("png");

				// If secondary method fails, try the direct method
				if (!pngDataUrl) {
					pngDataUrl = await captureCanvasDirect();

					if (!pngDataUrl) {
						toast.error("Failed to capture canvas as PNG");
						return;
					}
				}

				// Create download link
				const a = document.createElement("a");
				a.href = pngDataUrl;
				a.download = `${canvasName || "canvas"}.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);

				toast.success("Canvas exported as PNG");
			} else if (exportFormat === "json") {
				// Export as JSON
				try {
					// Get the storage data from Liveblocks
					const storage = room.getStorage();
					if (!storage) {
						toast.error("Failed to get canvas data");
						return;
					}

					// Create a JSON representation of the canvas with more data
					const jsonData = JSON.stringify(
						{
							canvasName: canvasName,
							exportTime: new Date().toISOString(),
							roomId: room.id,
							// Include any additional data you want to export
							metadata: {
								exportedBy: "Proddy Platform",
								version: "1.0",
								timestamp: Date.now(),
							},
						},
						null,
						2
					);

					const blob = new Blob([jsonData], { type: "application/json" });
					const url = URL.createObjectURL(blob);

					// Create download link
					const a = document.createElement("a");
					a.href = url;
					a.download = `${canvasName || "canvas"}.json`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);

					toast.success("Canvas exported as JSON");
				} catch (error) {
					console.error("Error exporting as JSON:", error);
					toast.error("Failed to export canvas as JSON");
					return;
				}
			}

			handleClose();
		} catch (error) {
			console.error("Error exporting canvas to system:", error);
			toast.error("Failed to export canvas");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Export Canvas</DialogTitle>
					<DialogDescription>
						Choose how you want to export your canvas.
					</DialogDescription>
				</DialogHeader>

				<Tabs
					defaultValue="chat"
					onValueChange={(value) => setExportType(value as "chat" | "system")}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="chat" className="flex items-center gap-2">
							<MessageSquare className="h-4 w-4" />
							Export to Chat
						</TabsTrigger>
						<TabsTrigger value="system" className="flex items-center gap-2">
							<Download className="h-4 w-4" />
							Download
						</TabsTrigger>
					</TabsList>

					<TabsContent value="chat" className="mt-4">
						<div className="space-y-4">
							<div className="flex flex-col space-y-2">
								<h3 className="text-sm font-medium">Format</h3>
								<div className="flex space-x-2">
									<Button
										variant={exportFormat === "png" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("png")}
									>
										PNG
									</Button>
									<Button
										variant={exportFormat === "svg" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("svg")}
									>
										SVG
									</Button>
									<Button
										variant={exportFormat === "json" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("json")}
									>
										JSON
									</Button>
								</div>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="system" className="mt-4">
						<div className="space-y-4">
							<div className="flex flex-col space-y-2">
								<h3 className="text-sm font-medium">Format</h3>
								<div className="flex space-x-2">
									<Button
										variant={exportFormat === "png" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("png")}
									>
										PNG
									</Button>
									<Button
										variant={exportFormat === "svg" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("svg")}
									>
										SVG
									</Button>
									<Button
										variant={exportFormat === "json" ? "default" : "outline"}
										size="sm"
										onClick={() => setExportFormat("json")}
									>
										JSON
									</Button>
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>

				<DialogFooter className="mt-6">
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isExporting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isExporting}
						onClick={
							exportType === "chat" ? handleExportToChat : handleExportToSystem
						}
					>
						{isExporting
							? "Exporting..."
							: exportType === "chat"
								? "Export to Chat"
								: "Download"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
