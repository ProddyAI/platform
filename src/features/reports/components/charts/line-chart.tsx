"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LineChartProps {
	data: {
		label: string;
		value: number;
	}[];
	height?: number;
	showPoints?: boolean;
	showLabels?: boolean;
	showGrid?: boolean;
	className?: string;
	lineColor?: string;
	pointColor?: string;
	areaColor?: string;
	formatValue?: (value: number) => string;
	onPointClick?: (label: string, value: number, index: number) => void;
}

export const LineChart = ({
	data,
	height = 200,
	showPoints = true,
	showLabels = true,
	showGrid = true,
	className,
	lineColor = "stroke-secondary",
	pointColor = "fill-secondary",
	areaColor = "fill-secondary/20",
	formatValue = (value) => value.toString(),
	onPointClick,
}: LineChartProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [tooltipPos, setTooltipPos] = useState<{
		top: string;
		left: string;
	} | null>(null);

	// containing the SVG chart. The SVG must be a direct child with data-point-index attributes.
	useEffect(() => {
		if (hoveredIndex === null) {
			setTooltipPos(null);
			return;
		}

		const container = containerRef.current;
		if (!container) {
			setTooltipPos(null);
			return;
		}

		const svgElement = container.querySelector("svg");
		if (!svgElement) {
			setTooltipPos(null);
			return;
		}

		const pointElement = svgElement.querySelector(
			`[data-point-index="${hoveredIndex}"]`
		) as SVGCircleElement;
		if (!pointElement) {
			setTooltipPos(null);
			return;
		}

		try {
			const svgRect = svgElement.getBoundingClientRect();
			const pointRect = pointElement.getBoundingClientRect();

			// Validate that the rects are valid and have proper dimensions
			if (
				!svgRect.width ||
				!svgRect.height ||
				!pointRect.width ||
				!pointRect.height
			) {
				setTooltipPos(null);
				return;
			}

			// Calculate position relative to the container
			const left = pointRect.left - svgRect.left + pointRect.width / 2;
			const top = pointRect.top - svgRect.top;

			// Validate calculated positions are finite numbers
			if (!Number.isFinite(left) || !Number.isFinite(top)) {
				setTooltipPos(null);
				return;
			}

			setTooltipPos({
				left: `${left}px`,
				top: `${top - 30}px`,
			});
		} catch {
			setTooltipPos(null);
		}
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

	const maxValue = Math.max(...data.map((item) => item.value));
	const minValue = Math.min(...data.map((item) => item.value));
	const range = maxValue - minValue;

	const paddingFactor = 0.2;
	const adjustedMaxValue = maxValue + range * paddingFactor;
	// Always start from 0 for better context
	const adjustedMinValue = 0;
	const adjustedRange = adjustedMaxValue - adjustedMinValue;

	// Create points for the line with internal margins
	const chartMargin = 5; // 5% margin on each side
	const chartWidth = 100 - chartMargin * 2;
	const chartHeight = 100 - chartMargin * 2;

	const points = data.map((item, index) => {
		const x = chartMargin + (index / (data.length - 1)) * chartWidth;
		const y =
			chartMargin +
			(100 -
				chartMargin -
				((item.value - adjustedMinValue) / adjustedRange) * chartHeight);
		return { x, y, ...item, index };
	});

	// Create the path for the line
	const linePath = points
		.map((point, index) => {
			return index === 0
				? `M ${point.x} ${point.y}`
				: `L ${point.x} ${point.y}`;
		})
		.join(" ");

	// Create the path for the area under the line
	const areaPath = `
    ${linePath}
    L ${points[points.length - 1].x} ${100 - chartMargin}
    L ${points[0].x} ${100 - chartMargin}
    Z
  `;

	// Thin x-axis labels to ~6 visible ticks so long ranges (e.g. 30 days) stay legible
	const maxVisibleLabels = 6;
	const labelStep = Math.max(1, Math.ceil(data.length / maxVisibleLabels));

	return (
		<div
			className={cn("w-full h-full flex flex-col overflow-hidden", className)}
			ref={containerRef}
		>
			<p className="sr-only">
				{`Line chart: ${data
					.map((item) => `${item.label}, ${formatValue(item.value)}`)
					.join("; ")}.`}
			</p>
			<div
				className="relative overflow-visible px-4 py-2 flex-1"
				style={{
					height: height !== undefined ? `${height}px` : undefined,
					minHeight: "200px",
				}}
			>
				<svg
					className="w-full h-full"
					preserveAspectRatio="xMidYMid meet"
					viewBox="0 0 100 100"
				>
					<title>Line chart</title>
					{/* Grid lines */}
					{showGrid && (
						<>
							{/* Horizontal grid lines */}
							{[chartMargin, 25, 50, 75, 100 - chartMargin].map((y) => (
								<line
									className="stroke-muted stroke-[0.5]"
									key={`h-${y}`}
									x1={chartMargin}
									x2={100 - chartMargin}
									y1={y}
									y2={y}
								/>
							))}

							{/* Vertical grid lines */}
							{points.map((point) => (
								<line
									className="stroke-muted stroke-[0.5]"
									key={`v-${point.index}`}
									x1={point.x}
									x2={point.x}
									y1={chartMargin}
									y2={100 - chartMargin}
								/>
							))}
						</>
					)}

					{/* Area under the line */}
					<path className={areaColor} d={areaPath} />

					{/* Line */}
					<path
						className={cn("fill-none stroke-[2]", lineColor)}
						d={linePath}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>

					{/* Points */}
					{showPoints &&
						points.map((point) => {
							const isHovered = hoveredIndex === point.index;

							return (
								<g key={point.index}>
									<circle
										aria-label={`${point.label}: ${formatValue(point.value)}`}
										className={cn(
											"stroke-white transition-all duration-200 outline-none",
											isHovered ? "stroke-[3.5]" : "stroke-[2.5]",
											pointColor,
											onPointClick &&
												"cursor-pointer focus-visible:stroke-[4] focus-visible:stroke-ring"
										)}
										cx={point.x}
										cy={point.y}
										data-point-index={point.index}
										onBlur={
											onPointClick ? () => setHoveredIndex(null) : undefined
										}
										onClick={
											onPointClick
												? () =>
														onPointClick(point.label, point.value, point.index)
												: undefined
										}
										onFocus={
											onPointClick
												? () => setHoveredIndex(point.index)
												: undefined
										}
										onKeyDown={
											onPointClick
												? (event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															onPointClick(
																point.label,
																point.value,
																point.index
															);
														}
													}
												: undefined
										}
										onMouseEnter={() => setHoveredIndex(point.index)}
										onMouseLeave={() => setHoveredIndex(null)}
										r={isHovered ? "3" : "2"}
										role={onPointClick ? "button" : undefined}
										tabIndex={onPointClick ? 0 : undefined}
									/>
									{isHovered && (
										<line
											className="stroke-secondary/30 stroke-[0.5] stroke-dashed pointer-events-none"
											x1={point.x}
											x2={point.x}
											y1={chartMargin}
											y2={100 - chartMargin}
										/>
									)}
								</g>
							);
						})}
				</svg>

				{/* DOM-based tooltip */}
				{hoveredIndex !== null && tooltipPos && (
					<div
						className="absolute bg-foreground/90 text-background text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50 -translate-x-1/2"
						style={{
							top: tooltipPos.top,
							left: tooltipPos.left,
						}}
					>
						{formatValue(data[hoveredIndex].value)}
					</div>
				)}
			</div>

			{/* X-axis labels */}
			{showLabels && (
				<ul className="flex justify-between mt-2 flex-shrink-0 px-4">
					{data.map((item, index) => {
						const isLastIndex = index === data.length - 1;
						const showLabelText = index % labelStep === 0 || isLastIndex;

						return (
							<li
								className={cn(
									"text-xs text-muted-foreground px-1 text-center",
									hoveredIndex === index && "font-medium text-foreground"
								)}
								key={item.label}
								onMouseEnter={() => setHoveredIndex(index)}
								onMouseLeave={() => setHoveredIndex(null)}
							>
								{showLabelText ? item.label : ""}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
