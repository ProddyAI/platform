"use client";

import { useEffect, useRef, useState } from "react";
import { calculateDomTooltipPosition } from "@/features/reports/utils/tooltip-positioning";
import { cn } from "@/lib/utils";

interface BarChartProps {
	data: {
		label: string;
		value: number;
		color?: string;
	}[];
	height?: number;
	maxHeight?: number;
	showValues?: boolean;
	showLabels?: boolean;
	className?: string;
	animate?: boolean;
	formatValue?: (value: number) => string;
	onBarClick?: (label: string, value: number, index: number) => void;
}

export const BarChart = ({
	data,
	height = 200,
	maxHeight,
	showValues = true,
	showLabels = true,
	className,
	animate = true,
	formatValue = (value) => value.toString(),
	onBarClick,
}: BarChartProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [tooltipPos, setTooltipPos] = useState<{
		top: string;
		left: string;
	} | null>(null);

	useEffect(() => {
		if (hoveredIndex === null) {
			setTooltipPos(null);
			return;
		}

		const container = containerRef.current;
		if (!container) return;

		const hoveredElement = container.querySelector(
			`[data-bar-index="${hoveredIndex}"]`
		) as HTMLElement | null;

		if (!hoveredElement) return;

		const containerRect = container.getBoundingClientRect();
		setTooltipPos(
			calculateDomTooltipPosition(hoveredElement, containerRect, 50, 24, -30)
		);
	}, [hoveredIndex]);

	if (!data || data.length === 0) {
		return (
			<div
				className={cn(
					"flex items-center justify-center h-40 bg-muted/20 rounded-md",
					className
				)}
			>
				<p className="text-muted-foreground">No data available</p>
			</div>
		);
	}

	const maxValue = Math.max(...data.map((d) => d.value));

	const chartHeight = maxHeight ?? height;
	const labelHeight = showLabels ? 32 : 0;
	const actualBarHeight = chartHeight - labelHeight;

	return (
		<div
			ref={containerRef}
			className={cn("relative flex items-end gap-2", className)}
			style={{ height: chartHeight }}
		>
			{data.map((item, index) => {
				const percentage = (item.value / maxValue) * 100;
				const isHovered = hoveredIndex === index;

				return (
					<div
						key={index}
						data-bar-index={index}
						className="relative flex flex-col items-center justify-end flex-1 group"
						style={{ height: chartHeight }}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
						onClick={() => onBarClick?.(item.label, item.value, index)}
					>
						<div
							className={cn(
								"w-full rounded-t-md transition-all duration-300",
								item.color ? "" : "bg-pink-500",
								isHovered ? "opacity-80 scale-105" : "opacity-100",
								animate && "animate-in fade-in-50 slide-in-from-bottom-3",
								onBarClick && "cursor-pointer"
							)}
							style={{
								height: `${(percentage / 100) * actualBarHeight}px`,
								backgroundColor: item.color,
								transitionDelay: animate ? `${index * 50}ms` : "0ms",
							}}
						/>

						{showLabels && (
							<div className="mt-2 text-xs text-muted-foreground truncate max-w-full px-1 text-center">
								{item.label}
							</div>
						)}
					</div>
				);
			})}

			{showValues && hoveredIndex !== null && tooltipPos && (
				<div
					className="absolute bg-foreground/90 text-background text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50"
					style={{
						top: tooltipPos.top,
						left: tooltipPos.left,
					}}
				>
					{formatValue(data[hoveredIndex].value)}
				</div>
			)}
		</div>
	);
};
