"use client";

import {
	Download,
	Layers,
	RotateCcw,
	Share,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TestCanvasHeaderProps {
	zoom: number;
	onZoomChange: (zoom: number) => void;
	itemCount: number;
}

export const TestCanvasHeader = ({
	zoom,
	onZoomChange,
	itemCount,
}: TestCanvasHeaderProps) => {
	const handleZoomIn = () => {
		onZoomChange(zoom + 25);
	};

	const handleZoomOut = () => {
		onZoomChange(zoom - 25);
	};

	const handleResetZoom = () => {
		onZoomChange(100);
	};

	return (
		<div className="border-b bg-muted/30 p-3">
			<div className="flex items-center justify-between">
				{/* Left side - Canvas Stats */}
				<div className="flex items-center gap-4 text-sm text-foreground">
					<div className="flex items-center gap-1">
						<Layers className="h-4 w-4" />
						<span>{itemCount} items</span>
					</div>

					<div className="flex items-center gap-1">
						<ZoomIn className="h-4 w-4" />
						<span>{zoom}%</span>
					</div>
				</div>

				{/* Right side - Canvas Controls */}
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1 border rounded-lg p-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleZoomOut}
							disabled={zoom <= 25}
						>
							<ZoomOut className="h-4 w-4" />
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={handleResetZoom}
							className="text-xs px-2"
						>
							{zoom}%
						</Button>

						<Button
							variant="ghost"
							size="sm"
							onClick={handleZoomIn}
							disabled={zoom >= 200}
						>
							<ZoomIn className="h-4 w-4" />
						</Button>
					</div>

					<Button variant="ghost" size="sm">
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset
					</Button>

					<Button variant="ghost" size="sm">
						<Share className="h-4 w-4 mr-2" />
						Share
					</Button>

					<Button variant="ghost" size="sm">
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>
				</div>
			</div>
		</div>
	);
};
