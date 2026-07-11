"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PieChartProps {
	data: {
		label: string;
		value: number;
		color: string;
	}[];
	size?: number;
	maxSize?: number;
	showLegend?: boolean;
	className?: string;
	formatValue?: (value: number) => string;
	onSegmentClick?: (label: string, value: number, index: number) => void;
}

interface PieSegment {
	label: string;
	value: number;
	color: string;
	percentage: number;
	startAngle: number;
	endAngle: number;
	index: number;
}

/**
 * Builds the SVG path for a flat 2D donut segment (an annulus sector), or a
 * full ring when the segment spans the entire chart.
 */
const createDonutSegmentPath = (
	segment: PieSegment,
	innerRadius: number,
	outerRadius: number,
	centerX: number,
	centerY: number
): string => {
	// Handle full circle case (100% or very close to it): draw a ring using
	// two opposite-wound circles combined with an even-odd fill.
	if (segment.percentage >= 99.9) {
		const outerTop = `${centerX} ${centerY - outerRadius}`;
		const outerBottom = `${centerX} ${centerY + outerRadius}`;
		const innerTop = `${centerX} ${centerY - innerRadius}`;
		const innerBottom = `${centerX} ${centerY + innerRadius}`;

		return [
			`M ${outerTop} A ${outerRadius} ${outerRadius} 0 0 1 ${outerBottom} A ${outerRadius} ${outerRadius} 0 0 1 ${outerTop} Z`,
			`M ${innerTop} A ${innerRadius} ${innerRadius} 0 0 0 ${innerBottom} A ${innerRadius} ${innerRadius} 0 0 0 ${innerTop} Z`,
		].join(" ");
	}

	const startAngleRad = (segment.startAngle / 100) * Math.PI * 2 - Math.PI / 2;
	const endAngleRad = (segment.endAngle / 100) * Math.PI * 2 - Math.PI / 2;

	const outerStartX = centerX + outerRadius * Math.cos(startAngleRad);
	const outerStartY = centerY + outerRadius * Math.sin(startAngleRad);
	const outerEndX = centerX + outerRadius * Math.cos(endAngleRad);
	const outerEndY = centerY + outerRadius * Math.sin(endAngleRad);
	const innerStartX = centerX + innerRadius * Math.cos(startAngleRad);
	const innerStartY = centerY + innerRadius * Math.sin(startAngleRad);
	const innerEndX = centerX + innerRadius * Math.cos(endAngleRad);
	const innerEndY = centerY + innerRadius * Math.sin(endAngleRad);

	const largeArcFlag = segment.percentage > 50 ? 1 : 0;

	return `M ${outerStartX} ${outerStartY} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY} Z`;
};

export const PieChart = ({
	data,
	size = 400,
	maxSize,
	showLegend = true,
	className,
	formatValue = (value) => value.toString(),
	onSegmentClick,
}: PieChartProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [tooltipPosition, setTooltipPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Cleanup hover timeout on unmount
	useEffect(() => {
		return () => {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current);
			}
		};
	}, []);

	const handleMouseEnter = useCallback(
		(
			index: number,
			event: React.MouseEvent<Element> | React.FocusEvent<Element>
		) => {
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current);
			}
			setHoveredIndex(index);

			// Calculate tooltip position relative to viewport
			const rect = containerRef.current?.getBoundingClientRect();
			if (rect) {
				const targetRect = event.currentTarget.getBoundingClientRect();
				const x =
					"clientX" in event
						? event.clientX
						: targetRect.left + targetRect.width / 2;
				const y =
					"clientY" in event
						? event.clientY
						: targetRect.top + targetRect.height / 2;
				setTooltipPosition({
					x,
					y,
				});
			}
		},
		[]
	);

	const handleMouseLeave = useCallback(() => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current);
		}
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredIndex(null);
			setTooltipPosition(null);
		}, 50);
	}, []);

	const handleMouseMove = useCallback(
		(event: React.MouseEvent) => {
			if (hoveredIndex !== null) {
				setTooltipPosition({
					x: event.clientX,
					y: event.clientY,
				});
			}
		},
		[hoveredIndex]
	);

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

	const total = data.reduce((sum, item) => sum + item.value, 0);

	// If total is 0, show a single greyed out segment
	const isAllZero = total === 0;
	const greyColor = "hsl(var(--muted-foreground))";

	let cumulativePercentage = 0;
	const segments: PieSegment[] = isAllZero
		? [
				{
					label: "No data",
					value: 0,
					color: greyColor,
					percentage: 100,
					startAngle: 0,
					endAngle: 100,
					index: 0,
				},
			]
		: data.map((item, index) => {
				const percentage = (item.value / total) * 100;
				const startAngle = cumulativePercentage;
				cumulativePercentage += percentage;
				const endAngle = cumulativePercentage;

				return {
					...item,
					percentage,
					startAngle,
					endAngle,
					index,
				};
			});

	const outerRadius = 44;
	const innerRadius = outerRadius * 0.7;
	const centerX = 50;
	const centerY = 50;

	return (
		<div
			className={cn(
				"relative flex h-full w-full flex-col items-center justify-center gap-3 py-2",
				className
			)}
			ref={containerRef}
		>
			{/* Flat 2D donut chart */}
			<div
				className="relative flex min-h-0 flex-1 items-center justify-center"
				style={{
					width: "100%",
					height: "100%",
					maxWidth: maxSize ?? size,
					maxHeight: maxSize ?? size,
				}}
			>
				<svg
					className="w-full h-full"
					preserveAspectRatio="xMidYMid meet"
					viewBox="0 0 100 100"
				>
					<title>Pie chart</title>
					{segments.map((segment) => {
						const isInteractive = Boolean(onSegmentClick);
						const isDimmed =
							hoveredIndex !== null && hoveredIndex !== segment.index;

						return (
							<path
								aria-label={`${segment.label}: ${formatValue(segment.value)}`}
								className={cn(
									"outline-none",
									isInteractive && "cursor-pointer",
									isInteractive &&
										"focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								)}
								d={createDonutSegmentPath(
									segment,
									innerRadius,
									outerRadius,
									centerX,
									centerY
								)}
								fill={segment.color}
								fillRule="evenodd"
								key={segment.index}
								onBlur={handleMouseLeave}
								onClick={
									onSegmentClick
										? () =>
												onSegmentClick(
													segment.label,
													segment.value,
													segment.index
												)
										: undefined
								}
								onFocus={(e) => handleMouseEnter(segment.index, e)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onSegmentClick?.(
											segment.label,
											segment.value,
											segment.index
										);
									}
								}}
								onMouseEnter={(e) => handleMouseEnter(segment.index, e)}
								onMouseLeave={handleMouseLeave}
								onMouseMove={handleMouseMove}
								role={isInteractive ? "button" : undefined}
								stroke="hsl(var(--background))"
								strokeWidth={0.5}
								style={{
									opacity: isDimmed ? 0.45 : 1,
									transition: "opacity var(--duration-normal) ease-out",
								}}
								tabIndex={isInteractive ? 0 : -1}
							/>
						);
					})}
				</svg>

				{/* Center total */}
				{!isAllZero && (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
						<span className="text-2xl font-semibold tabular-nums text-foreground">
							{formatValue(total)}
						</span>
					</div>
				)}
			</div>

			{/* HTML Tooltip - Displayed following cursor */}
			{hoveredIndex !== null && tooltipPosition && !isAllZero && (
				<div
					className="fixed pointer-events-none animate-in fade-in duration-fast"
					style={{
						left: tooltipPosition.x + 15,
						top: tooltipPosition.y - 10,
						zIndex: 9999,
					}}
				>
					<div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
						<div className="mb-0.5 flex items-center gap-1.5">
							<span
								className="size-1.5 flex-shrink-0 rounded-full"
								style={{ backgroundColor: segments[hoveredIndex].color }}
							/>
							<span className="text-xs font-semibold text-popover-foreground">
								{segments[hoveredIndex].label}
							</span>
						</div>
						<div
							className="text-xs font-semibold tabular-nums"
							style={{
								color: segments[hoveredIndex].color,
							}}
						>
							{formatValue(segments[hoveredIndex].value)}
						</div>
					</div>
				</div>
			)}

			{/* Legend - wraps below the chart so it never overlaps it */}
			{showLegend && !isAllZero && (
				<div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-1">
					{segments.map((segment) => {
						const isHovered = hoveredIndex === segment.index;
						const isInteractive = Boolean(onSegmentClick);

						return (
							<button
								aria-label={`${segment.label}: ${formatValue(segment.value)}`}
								className={cn(
									"flex max-w-[10rem] items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									isHovered && "bg-muted/50",
									isInteractive && "cursor-pointer"
								)}
								key={segment.index}
								onBlur={handleMouseLeave}
								onClick={
									onSegmentClick
										? () =>
												onSegmentClick(
													segment.label,
													segment.value,
													segment.index
												)
										: undefined
								}
								onFocus={(e) => handleMouseEnter(segment.index, e)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onSegmentClick?.(
											segment.label,
											segment.value,
											segment.index
										);
									}
								}}
								onMouseEnter={(e) => handleMouseEnter(segment.index, e)}
								onMouseLeave={handleMouseLeave}
								onMouseMove={handleMouseMove}
								tabIndex={isInteractive ? 0 : -1}
								type="button"
							>
								{/* Color indicator */}
								<span
									className="size-1.5 flex-shrink-0 rounded-full"
									style={{ backgroundColor: segment.color }}
								/>

								{/* Label */}
								<span
									className={cn(
										"truncate min-w-0 text-xs",
										isHovered ? "text-foreground" : "text-muted-foreground"
									)}
								>
									{segment.label}
								</span>

								{/* Value - Show either formatted value or percentage */}
								<span
									className="text-xs font-medium tabular-nums flex-shrink-0"
									style={{
										color: isHovered ? segment.color : "currentColor",
									}}
								>
									{formatValue(segment.value)}
								</span>
							</button>
						);
					})}
				</div>
			)}

			{/* "No Data" message for all-zero case */}
			{showLegend && isAllZero && (
				<div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-md">
					<div className="size-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
					<div className="text-xs font-medium text-muted-foreground">
						No data available
					</div>
				</div>
			)}
		</div>
	);
};
