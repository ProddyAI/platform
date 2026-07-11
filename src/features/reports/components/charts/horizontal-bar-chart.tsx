"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HorizontalBarChartProps {
	data: {
		id?: string;
		label: string;
		value: number;
		color?: string;
	}[];
	height?: number;
	showValues?: boolean;
	className?: string;
	animate?: boolean;
	formatValue?: (value: number) => string;
	onBarClick?: (label: string, value: number, index: number) => void;
}

export const HorizontalBarChart = ({
	data,
	height,
	showValues = true,
	className,
	animate = true,
	formatValue = (value) => value.toString(),
	onBarClick,
}: HorizontalBarChartProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

	return (
		<div className={cn("size-full overflow-auto", className)}>
			<div className="space-y-4 min-h-0">
				{data.map((item, index) => {
					const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
					const isHovered = hoveredIndex === index;

					const barContent = (
						<>
							<div className="flex justify-between items-center">
								<span className="text-sm truncate">{item.label}</span>
								{showValues && (
									<span className="text-sm tabular-nums text-muted-foreground">
										{formatValue(item.value)}
									</span>
								)}
							</div>

							<div
								className={cn(
									"w-full overflow-hidden rounded-full bg-muted",
									!height && "h-2"
								)}
								style={height ? { height: `${height}px` } : undefined}
							>
								<div
									className={cn(
										"h-full rounded-full transition-all duration-500",
										item.color || "bg-primary",
										isHovered ? "opacity-80" : "opacity-100",
										animate &&
											"animate-in slide-in-from-left motion-reduce:animate-none",
										onBarClick && "cursor-pointer"
									)}
									style={{ width: `${percentage}%` }}
								/>
							</div>
						</>
					);

					if (onBarClick) {
						return (
							<button
								aria-label={`${item.label}: ${formatValue(item.value)}`}
								className="w-full space-y-1 text-left"
								key={item.id ?? item.label}
								onClick={() => onBarClick(item.label, item.value, index)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onBarClick(item.label, item.value, index);
									}
								}}
								onMouseEnter={() => setHoveredIndex(index)}
								onMouseLeave={() => setHoveredIndex(null)}
								type="button"
							>
								{barContent}
							</button>
						);
					}

					return (
						<div
							className="space-y-1"
							key={item.id ?? item.label}
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
						>
							{barContent}
						</div>
					);
				})}
			</div>
		</div>
	);
};
