"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CanvasItem {
	id: string;
	type: "text" | "shape" | "image" | "note";
	x: number;
	y: number;
	width: number;
	height: number;
	content: string;
	shapeType?: "rectangle" | "circle"; // For shape items
	style: {
		backgroundColor: string;
		borderColor: string;
		textColor: string;
		fontSize: number;
	};
	createdAt: Date;
	updatedAt: Date;
}

interface TestCanvasBoardProps {
	items: CanvasItem[];
	selectedTool: string;
	selectedItemId: string | null;
	zoom: number;
	onItemSelect: (itemId: string | null) => void;
	onItemUpdate: (itemId: string, updates: Partial<CanvasItem>) => void;
	onItemCreate: (
		item: Omit<CanvasItem, "id" | "createdAt" | "updatedAt">
	) => void;
	onItemDelete: (itemId: string) => void;
}

export const TestCanvasBoard = ({
	items,
	selectedTool,
	selectedItemId,
	zoom,
	onItemSelect,
	onItemUpdate,
	onItemCreate,
	onItemDelete,
}: TestCanvasBoardProps) => {
	const [isDragging, setIsDragging] = useState(false);
	const [_dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
	const canvasRef = useRef<HTMLDivElement>(null);

	const handleCanvasClick = (e: React.MouseEvent) => {
		// Only deselect if we're in select mode and clicking on empty canvas
		// Don't deselect when using other tools
		if (selectedTool === "select") {
			// Check if we clicked on an empty area (not on an item)
			const target = e.target as HTMLElement;
			if (
				target === canvasRef.current ||
				target.closest("[data-canvas-item]") === null
			) {
				onItemSelect(null);
			}
			return;
		}

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = (e.clientX - rect.left) / (zoom / 100);
		const y = (e.clientY - rect.top) / (zoom / 100);

		// Create new item based on selected tool
		let itemType: CanvasItem["type"] = "text";
		if (
			selectedTool === "text" ||
			selectedTool === "note" ||
			selectedTool === "image"
		) {
			itemType = selectedTool;
		} else if (selectedTool === "rectangle" || selectedTool === "circle") {
			itemType = "shape";
		}

		const newItem: Omit<CanvasItem, "id" | "createdAt" | "updatedAt"> = {
			type: itemType,
			x: x - 75, // Center the item
			y: y - 40,
			width: 150,
			height: 80,
			content: getDefaultContent(selectedTool),
			shapeType:
				selectedTool === "rectangle" || selectedTool === "circle"
					? selectedTool
					: undefined,
			style: {
				backgroundColor: "#fef3c7",
				borderColor: "#f59e0b",
				textColor: "#92400e",
				fontSize: 14,
			},
		};

		onItemCreate(newItem);
	};

	const getDefaultContent = (tool: string): string => {
		switch (tool) {
			case "text":
				return "Double-click to edit";
			case "rectangle":
			case "circle":
				return "Shape";
			case "note":
				return "Sticky note content...";
			default:
				return "New item";
		}
	};

	const handleItemMouseDown = (e: React.MouseEvent, item: CanvasItem) => {
		e.stopPropagation();

		if (selectedTool !== "select") return;

		onItemSelect(item.id);
		setIsDragging(true);

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = (e.clientX - rect.left) / (zoom / 100);
		const y = (e.clientY - rect.top) / (zoom / 100);

		setDragStart({ x, y });
		setDragOffset({
			x: x - item.x,
			y: y - item.y,
		});
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging || !selectedItemId) return;

		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;

		const x = (e.clientX - rect.left) / (zoom / 100);
		const y = (e.clientY - rect.top) / (zoom / 100);

		onItemUpdate(selectedItemId, {
			x: x - dragOffset.x,
			y: y - dragOffset.y,
		});
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	const handleItemDoubleClick = (item: CanvasItem) => {
		const newContent = prompt("Edit content:", item.content);
		if (newContent !== null) {
			onItemUpdate(item.id, { content: newContent });
		}
	};

	const renderItem = (item: CanvasItem) => {
		const isSelected = selectedItemId === item.id;

		return (
			<div
				key={item.id}
				data-canvas-item={item.id}
				className={cn(
					"absolute cursor-pointer border-2 transition-all",
					isSelected
						? "border-primary shadow-lg"
						: "border-transparent hover:border-muted-foreground/30",
					item.shapeType === "circle" && "rounded-full",
					item.type === "note" && "rounded-lg shadow-md",
					selectedTool === "select" ? "cursor-move" : "cursor-default"
				)}
				style={{
					left: item.x,
					top: item.y,
					width: item.width,
					height: item.height,
					backgroundColor: item.style.backgroundColor,
					borderColor: isSelected ? undefined : item.style.borderColor,
					color: item.style.textColor,
					fontSize: item.style.fontSize,
					transform: `scale(${zoom / 100})`,
					transformOrigin: "top left",
				}}
				onMouseDown={(e) => handleItemMouseDown(e, item)}
				onDoubleClick={() => handleItemDoubleClick(item)}
			>
				<div className="w-full h-full flex items-center justify-center p-2 text-center overflow-hidden">
					{item.type === "note" ? (
						<div className="text-xs leading-relaxed whitespace-pre-wrap">
							{item.content}
						</div>
					) : (
						<div className="font-medium truncate">{item.content}</div>
					)}
				</div>

				{isSelected && (
					<>
						{/* Resize handles */}
						<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary border border-background rounded-sm cursor-se-resize" />
						<div className="absolute -top-1 -right-1 w-3 h-3 bg-primary border border-background rounded-sm cursor-ne-resize" />
						<div className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary border border-background rounded-sm cursor-sw-resize" />
						<div className="absolute -top-1 -left-1 w-3 h-3 bg-primary border border-background rounded-sm cursor-nw-resize" />
					</>
				)}
			</div>
		);
	};

	return (
		<div className="flex-1 overflow-hidden bg-background">
			<div
				ref={canvasRef}
				className="w-full h-full relative overflow-auto cursor-crosshair"
				style={{
					backgroundImage: `
            radial-gradient(circle, #e5e7eb 1px, transparent 1px)
          `,
					backgroundSize: `${20 * (zoom / 100)}px ${20 * (zoom / 100)}px`,
				}}
				onClick={handleCanvasClick}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
			>
				{/* Canvas content area */}
				<div
					className="relative"
					style={{
						width: `${2000 * (zoom / 100)}px`,
						height: `${1500 * (zoom / 100)}px`,
						minWidth: "100%",
						minHeight: "100%",
					}}
				>
					{items.map(renderItem)}

					{/* Canvas info overlay */}
					{items.length === 0 && (
						<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div className="text-center text-muted-foreground">
								<div className="text-lg font-medium mb-2">
									Welcome to Canvas
								</div>
								<div className="text-sm">
									Select a tool from the sidebar and click to create items
								</div>
								<div className="text-xs mt-2">
									Use the select tool to move and edit items
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
