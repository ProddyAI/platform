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
	smooth?: boolean;
	formatValue?: (value: number) => string;
	onPointClick?: (label: string, value: number, index: number) => void;
}

interface ChartPoint {
	x: number;
	y: number;
	label: string;
	value: number;
	index: number;
}

/** Straight-segment path (`M`/`L` commands only). */
const buildLinearPath = (points: ChartPoint[]): string =>
	points
		.map((point, index) =>
			index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
		)
		.join(" ");

/**
 * Smooth path through every point via a uniform Catmull-Rom spline,
 * converted to cubic bezier segments (the standard 1/6-tension conversion).
 * Falls back to endpoints/neighbors when a segment lacks a full neighbor set.
 */
const buildSmoothPath = (points: ChartPoint[]): string => {
	if (points.length < 3) return buildLinearPath(points);

	let path = `M ${points[0].x} ${points[0].y}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;

		const cp1x = p1.x + (p2.x - p0.x) / 6;
		const cp1y = p1.y + (p2.y - p0.y) / 6;
		const cp2x = p2.x - (p3.x - p1.x) / 6;
		const cp2y = p2.y - (p3.y - p1.y) / 6;

		path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}
	return path;
};

export const LineChart = ({
	data,
	height = 200,
	showPoints = true,
	showLabels = true,
	showGrid = true,
	className,
	lineColor = "stroke-primary",
	// Accepted for API compatibility; the hovered/active dot now always
	// renders with the fixed white-fill/primary-stroke treatment below.
	pointColor: _pointColor = "fill-primary",
	areaColor = "fill-primary/10",
	smooth = true,
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

	const points: ChartPoint[] = data.map((item, index) => {
		const x = chartMargin + (index / (data.length - 1)) * chartWidth;
		const y =
			chartMargin +
			(100 -
				chartMargin -
				((item.value - adjustedMinValue) / adjustedRange) * chartHeight);
		return { x, y, label: item.label, value: item.value, index };
	});

	// Create the path for the line — smoothed via Catmull-Rom/bezier by default.
	const linePath = smooth ? buildSmoothPath(points) : buildLinearPath(points);

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
			className={cn("size-full flex flex-col overflow-hidden", className)}
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
					className="size-full"
					preserveAspectRatio="xMidYMid meet"
					viewBox="0 0 100 100"
				>
					<title>Line chart</title>
					{/* Grid lines — horizontal only */}
					{showGrid &&
						[chartMargin, 25, 50, 75, 100 - chartMargin].map((y) => (
							<line
								className="stroke-border"
								key={`h-${y}`}
								strokeDasharray="3 3"
								strokeWidth={0.5}
								x1={chartMargin}
								x2={100 - chartMargin}
								y1={y}
								y2={y}
							/>
						))}

					{/* Area under the line */}
					<path className={cn(areaColor, "stroke-none")} d={areaPath} />

					{/* Line */}
					<path
						className={cn("fill-none stroke-[2]", lineColor)}
						d={linePath}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>

					{/* Points — hidden at rest, only the hovered/active point renders */}
					{showPoints &&
						points.map((point) => {
							const isHovered = hoveredIndex === point.index;

							return (
								<g key={point.index}>
									{isHovered && (
										<line
											className="stroke-border pointer-events-none"
											strokeWidth={0.5}
											x1={point.x}
											x2={point.x}
											y1={chartMargin}
											y2={100 - chartMargin}
										/>
									)}

									{/* Hit target — always present so the whole line stays
									    interactive even though the dot itself is hidden at rest. */}
									<circle
										aria-label={`${point.label}: ${formatValue(point.value)}`}
										className={cn(
											"fill-transparent outline-none",
											onPointClick &&
												"cursor-pointer focus-visible:fill-primary/10"
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
										r={6}
										role={onPointClick ? "button" : undefined}
										tabIndex={onPointClick ? 0 : undefined}
									/>

									{/* Visible dot — only the hovered/active point */}
									{isHovered && (
										<circle
											className="pointer-events-none"
											cx={point.x}
											cy={point.y}
											fill="white"
											r={3}
											stroke="hsl(var(--primary))"
											strokeWidth={2}
										/>
									)}
								</g>
							);
						})}
				</svg>

				{/* DOM-based tooltip */}
				{hoveredIndex !== null && tooltipPos && (
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
