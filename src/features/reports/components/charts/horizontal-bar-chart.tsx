"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HorizontalBarChartProps {
	data: {
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
	height = 30,
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
		<div className={cn("w-full h-full overflow-auto", className)}>
			<div className="space-y-4 min-h-0">
				{data.map((item, index) => {
					const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
					const isHovered = hoveredIndex === index;

					return (
						<div
							key={index}
							className="space-y-1"
							onMouseEnter={() => setHoveredIndex(index)}
							onMouseLeave={() => setHoveredIndex(null)}
							onClick={() => onBarClick?.(item.label, item.value, index)}
						>
							<div className="flex justify-between items-center">
								<span className="text-sm truncate">{item.label}</span>
								{showValues && (
									<span className="text-sm text-muted-foreground">
										{formatValue(item.value)}
									</span>
								)}
							</div>

							<div className="h-3 w-full bg-muted rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full rounded-full transition-all duration-500",
										item.color || "bg-secondary",
										isHovered ? "opacity-80" : "opacity-100",
										animate && "animate-in slide-in-from-left",
										onBarClick && "cursor-pointer"
									)}
									style={{
										width: `${percentage}%`,
										transitionDelay: animate ? `${index * 50}ms` : "0ms",
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
