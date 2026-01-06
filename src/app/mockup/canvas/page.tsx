"use client";

import { Palette } from "lucide-react";
import { useState } from "react";
import {
	TestAudioRoom,
	TestCanvasBoard,
	TestCanvasChat,
	TestCanvasHeader,
	TestCanvasToolbar,
	TestLiveCursors,
	TestNavigation,
	useTestLiveCursors,
} from "@/app/mockup/components";
import { TEST_CANVAS_ITEMS } from "@/app/mockup/data/shared-test-data";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

export interface CanvasItem {
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

export interface CanvasTool {
	id: string;
	name: string;
	icon: string;
	active: boolean;
}

const TestCanvasPage = () => {
	useDocumentTitle("Canvas");
	const { showCursors } = useTestLiveCursors(true);

	const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(
		TEST_CANVAS_ITEMS as CanvasItem[]
	);
	const [selectedTool, setSelectedTool] = useState<string>("select");
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [zoom, setZoom] = useState(100);

	const handleItemUpdate = (itemId: string, updates: Partial<CanvasItem>) => {
		setCanvasItems((prev) =>
			prev.map((item) =>
				item.id === itemId
					? { ...item, ...updates, updatedAt: new Date() }
					: item
			)
		);
	};

	const handleItemCreate = (
		item: Omit<CanvasItem, "id" | "createdAt" | "updatedAt">
	) => {
		const newItem: CanvasItem = {
			...item,
			id: `item-${Date.now()}`,
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		setCanvasItems((prev) => [...prev, newItem]);
	};

	const handleItemDelete = (itemId: string) => {
		setCanvasItems((prev) => prev.filter((item) => item.id !== itemId));
		if (selectedItemId === itemId) {
			setSelectedItemId(null);
		}
	};

	const handleToolSelect = (toolId: string) => {
		setSelectedTool(toolId);
	};

	const handleZoomChange = (newZoom: number) => {
		setZoom(Math.max(25, Math.min(200, newZoom)));
	};

	return (
		<div className="flex h-full flex-col">
			{/* Generic Header */}
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
					>
						<Palette className="mr-2 size-5" />
						<span className="truncate">Canvas</span>
					</Button>

					<TestNavigation />
				</div>
			</div>

			{/* Specific Canvas Header */}
			<TestCanvasHeader
				zoom={zoom}
				onZoomChange={handleZoomChange}
				itemCount={canvasItems.length}
			/>

			<div className="flex flex-1 overflow-hidden">
				<TestCanvasToolbar
					selectedTool={selectedTool}
					onToolSelect={handleToolSelect}
					selectedItem={canvasItems.find((item) => item.id === selectedItemId)}
					onItemUpdate={handleItemUpdate}
					onItemDelete={handleItemDelete}
				/>

				<div className="flex-1 overflow-hidden">
					<TestCanvasBoard
						items={canvasItems}
						selectedTool={selectedTool}
						selectedItemId={selectedItemId}
						zoom={zoom}
						onItemSelect={setSelectedItemId}
						onItemUpdate={handleItemUpdate}
						onItemCreate={handleItemCreate}
						onItemDelete={handleItemDelete}
					/>
				</div>

				{/* Fixed Right Chat Panel */}
				<TestCanvasChat />
			</div>

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />

			{/* Audio Room */}
			<TestAudioRoom />
		</div>
	);
};

export default TestCanvasPage;
