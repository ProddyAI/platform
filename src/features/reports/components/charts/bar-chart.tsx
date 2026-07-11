"use client";

import { useEffect, useRef, useState } from "react";
import { calculateDomTooltipPosition } from "@/features/reports/utils/tooltip-positioning";
import { cn } from "@/lib/utils";

interface BarChartProps {
	data: {
		id?: string;
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
	activeIndex?: number;
	formatValue?: (value: number) => string;
	onBarClick?: (label: string, value: number, index: number) => void;
}

// Dashed gridlines behind the bars, evenly spaced from the baseline.
const GRIDLINE_STOPS = [25, 50, 75, 100] as const;

export const BarChart = ({
	data,
	height = 200,
	maxHeight,
	showValues = true,
	showLabels = true,
	className,
	animate = true,
	activeIndex,
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
			calculateDomTooltipPosition(hoveredElement, containerRect, 0, 28, -34)
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
			className={cn("relative flex items-end gap-2", className)}
			ref={containerRef}
			style={{ height: chartHeight }}
		>
			{/* Gridlines behind the bars */}
			<div
				className="pointer-events-none absolute inset-x-0 top-0"
				style={{ height: actualBarHeight }}
			>
				{GRIDLINE_STOPS.map((stop) => (
					<div
						className="absolute inset-x-0 border-t border-dashed border-border"
						key={stop}
						style={{ top: `${100 - stop}%` }}
					/>
				))}
			</div>

			{data.map((item, index) => {
				const percentage = (item.value / maxValue) * 100;
				const isActive = hoveredIndex === index || activeIndex === index;

				return (
					<button
						aria-disabled={!onBarClick}
						aria-label={`${item.label}: ${formatValue(item.value)}`}
						className="relative flex flex-col items-center justify-end flex-1 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						data-bar-id={item.id ?? item.label}
						data-bar-index={index}
						key={item.id ?? item.label}
						onBlur={() => setHoveredIndex(null)}
						onClick={
							onBarClick
								? () => onBarClick(item.label, item.value, index)
								: undefined
						}
						onFocus={() => setHoveredIndex(index)}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onBarClick?.(item.label, item.value, index);
							}
						}}
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
						style={{ height: chartHeight }}
						tabIndex={onBarClick ? 0 : -1}
						type="button"
					>
						<div
							className={cn(
								"relative w-full rounded-t-md transition-[height,background-color,opacity] duration-slow ease-out",
								!item.color && (isActive ? "bg-primary" : "bg-primary/15"),
								animate &&
									"animate-in fade-in-50 slide-in-from-bottom-3 motion-reduce:animate-none",
								onBarClick && "cursor-pointer"
							)}
							style={{
								height: `${(percentage / 100) * actualBarHeight}px`,
								backgroundColor: item.color,
								opacity: item.color ? (isActive ? 1 : 0.25) : undefined,
							}}
						/>

						{showLabels && (
							<div
								className={cn(
									"mt-2 text-xs truncate max-w-full px-1 text-center",
									isActive
										? "text-foreground font-medium"
										: "text-muted-foreground"
								)}
							>
								{item.label}
							</div>
						)}
					</button>
				);
			})}

			{showValues && hoveredIndex !== null && tooltipPos && (
				<div
					className="pointer-events-none absolute z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background shadow-md"
					style={{
						top: tooltipPos.top,
						left: tooltipPos.left,
					}}
				>
					{`${data[hoveredIndex].label}: ${formatValue(data[hoveredIndex].value)}`}
				</div>
			)}
		</div>
	);
};
