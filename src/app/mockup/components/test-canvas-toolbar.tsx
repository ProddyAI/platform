"use client";

import {
	Circle,
	Image,
	MousePointer,
	Square,
	StickyNote,
	Trash2,
	Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

interface TestCanvasToolbarProps {
	selectedTool: string;
	onToolSelect: (toolId: string) => void;
	selectedItem?: CanvasItem;
	onItemUpdate?: (itemId: string, updates: Partial<CanvasItem>) => void;
	onItemDelete?: (itemId: string) => void;
}

const tools = [
	{ id: "select", name: "Select", icon: MousePointer },
	{ id: "text", name: "Text", icon: Type },
	{ id: "rectangle", name: "Rectangle", icon: Square },
	{ id: "circle", name: "Circle", icon: Circle },
	{ id: "note", name: "Sticky Note", icon: StickyNote },
	{ id: "image", name: "Image", icon: Image },
];

const colors = [
	"#fef3c7",
	"#dbeafe",
	"#dcfce7",
	"#fce7f3",
	"#f1f5f9",
	"#fef2f2",
	"#f59e0b",
	"#3b82f6",
	"#22c55e",
	"#ec4899",
	"#64748b",
	"#ef4444",
];

export const TestCanvasToolbar = ({
	selectedTool,
	onToolSelect,
	selectedItem,
	onItemUpdate,
	onItemDelete,
}: TestCanvasToolbarProps) => {
	const handleColorChange = (color: string) => {
		if (selectedItem && onItemUpdate) {
			onItemUpdate(selectedItem.id, {
				style: {
					...selectedItem.style,
					backgroundColor: color,
				},
			});
		}
	};

	return (
		<div className="w-64 border-r bg-muted/30 flex flex-col">
			{/* Tools */}
			<div className="p-4 border-b">
				<h3 className="font-medium mb-3">Tools</h3>
				<div className="grid grid-cols-2 gap-2">
					{tools.map((tool) => {
						const Icon = tool.icon;
						return (
							<Button
								key={tool.id}
								variant={selectedTool === tool.id ? "default" : "ghost"}
								size="sm"
								onClick={() => onToolSelect(tool.id)}
								className={cn(
									"flex flex-col gap-1 h-auto py-3",
									selectedTool === tool.id &&
										"bg-primary text-primary-foreground"
								)}
							>
								<Icon className="h-4 w-4" />
								<span className="text-xs">{tool.name}</span>
							</Button>
						);
					})}
				</div>
			</div>

			{/* Properties */}
			{selectedItem && (
				<div className="p-4 border-b">
					<h3 className="font-medium mb-3">Properties</h3>

					<div className="space-y-3">
						<div>
							<label className="text-xs font-medium text-muted-foreground mb-2 block">
								Background Color
							</label>
							<div className="grid grid-cols-6 gap-1">
								{colors.map((color) => (
									<button
										key={color}
										onClick={() => handleColorChange(color)}
										className={cn(
											"w-6 h-6 rounded border-2 transition-all",
											selectedItem.style.backgroundColor === color
												? "border-primary scale-110"
												: "border-border hover:scale-105"
										)}
										style={{ backgroundColor: color }}
									/>
								))}
							</div>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">
								Position
							</label>
							<div className="grid grid-cols-2 gap-2">
								<div className="text-xs">
									<span className="text-muted-foreground">X:</span>{" "}
									{Math.round(selectedItem.x)}
								</div>
								<div className="text-xs">
									<span className="text-muted-foreground">Y:</span>{" "}
									{Math.round(selectedItem.y)}
								</div>
							</div>
						</div>

						<div>
							<label className="text-xs font-medium text-muted-foreground mb-1 block">
								Size
							</label>
							<div className="grid grid-cols-2 gap-2">
								<div className="text-xs">
									<span className="text-muted-foreground">W:</span>{" "}
									{Math.round(selectedItem.width)}
								</div>
								<div className="text-xs">
									<span className="text-muted-foreground">H:</span>{" "}
									{Math.round(selectedItem.height)}
								</div>
							</div>
						</div>

						<Separator />

						<Button
							variant="destructive"
							size="sm"
							className="w-full"
							onClick={() => {
								if (selectedItem && onItemDelete) {
									onItemDelete(selectedItem.id);
								}
							}}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</Button>
					</div>
				</div>
			)}

			{/* Canvas Items List */}
			<div className="flex-1">
				<div className="p-4 border-b">
					<h3 className="font-medium">Canvas Items</h3>
				</div>
				<ScrollArea className="flex-1">
					<div className="p-2">
						<div className="text-center py-8 text-muted-foreground">
							<StickyNote className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<div className="text-sm">Canvas items will appear here</div>
							<div className="text-xs mt-1">Select items to see properties</div>
						</div>
					</div>
				</ScrollArea>
			</div>
		</div>
	);
};
