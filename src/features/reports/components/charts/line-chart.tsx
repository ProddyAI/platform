'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { calculateSvgTooltipPosition, getTooltipRectAttrs, getTooltipTextAttrs } from '@/features/reports/utils/tooltip-positioning';

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
  lineColor = 'stroke-secondary',
  pointColor = 'fill-secondary',
  formatValue = (value) => value.toString(),
  onPointClick,
}: LineChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-40 bg-muted/20 rounded-md", className)}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));
  const minValue = Math.min(...data.map(item => item.value));
  const range = maxValue - minValue;

  // Add padding to the top and bottom
  const paddingFactor = 0.1;
  const adjustedMaxValue = maxValue + range * paddingFactor;
  const adjustedMinValue = Math.max(0, minValue - range * paddingFactor);
  const adjustedRange = adjustedMaxValue - adjustedMinValue;

  // Create points for the line with internal margins
  const chartMargin = 5; // 5% margin on each side
  const chartWidth = 100 - (chartMargin * 2);
  const chartHeight = 100 - (chartMargin * 2);

  const points = data.map((item, index) => {
    const x = chartMargin + (index / (data.length - 1)) * chartWidth;
    const y = chartMargin + (100 - chartMargin - ((item.value - adjustedMinValue) / adjustedRange) * chartHeight);
    return { x, y, ...item, index };
  });

  // Create the path for the line
  const linePath = points.map((point, index) => {
    return index === 0
      ? `M ${point.x} ${point.y}`
      : `L ${point.x} ${point.y}`;
  }).join(' ');

  // Create the path for the area under the line
  const areaPath = `
    ${linePath}
    L ${points[points.length - 1].x} ${100 - chartMargin}
    L ${points[0].x} ${100 - chartMargin}
    Z
  `;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative overflow-hidden px-4 py-2" style={{ height: `${height}px` }}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {showGrid && (
            <>
              {/* Horizontal grid lines */}
              {[chartMargin, 25, 50, 75, 100 - chartMargin].map((y) => (
                <line
                  key={`h-${y}`}
                  x1={chartMargin}
                  y1={y}
                  x2={100 - chartMargin}
                  y2={y}
                  className="stroke-muted stroke-[0.5]"
                />
              ))}

              {/* Vertical grid lines */}
              {points.map((point) => (
                <line
                  key={`v-${point.index}`}
                  x1={point.x}
                  y1={chartMargin}
                  x2={point.x}
                  y2={100 - chartMargin}
                  className="stroke-muted stroke-[0.5]"
                />
              ))}
            </>
          )}

          {/* Area under the line */}
          <path
            d={areaPath}
            className="fill-secondary/10"
          />

          {/* Line */}
          <path
            d={linePath}
            className={cn("fill-none stroke-1", lineColor)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {showPoints && points.map((point) => {
            const isHovered = hoveredIndex === point.index;

            return (
              <g
                key={point.index}
                className="transition-transform duration-200"
                style={{ transform: isHovered ? 'scale(1.5)' : 'scale(1)' }}
                onMouseEnter={() => setHoveredIndex(point.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onPointClick?.(point.label, point.value, point.index)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1.5"
                  className={cn(
                    "stroke-white stroke-2",
                    pointColor,
                    onPointClick && "cursor-pointer"
                  )}
                />

                {isHovered && (
                   <>
                     {/* Tooltip - using standardized positioning utility */}
                     {(() => {
                       const tooltipPos = calculateSvgTooltipPosition({
                         viewBoxWidth: 100,
                         viewBoxHeight: 100,
                         tooltipWidth: 36,
                         tooltipHeight: 18,
                         offsetY: -15,
                         offsetX: 0,
                         padding: chartMargin + 5,
                         pointX: point.x,
                         pointY: point.y,
                       });
                       const rectAttrs = getTooltipRectAttrs(36, 18);
                       const textAttrs = getTooltipTextAttrs();
                       return (
                         <g transform={tooltipPos.transform}>
                           <rect
                             {...rectAttrs}
                             className="fill-foreground/90 stroke-border stroke-[0.5]"
                           />
                           <text
                             {...textAttrs}
                             className="fill-background text-[4px] font-medium"
                           >
                             {formatValue(point.value)}
                           </text>
                         </g>
                       );
                     })()}

                     {/* Vertical guide line */}
                     <line
                       x1={point.x}
                       y1={chartMargin}
                       x2={point.x}
                       y2={100 - chartMargin}
                       className="stroke-secondary/30 stroke-[0.5] stroke-dashed"
                     />
                   </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      {showLabels && (
        <div className="flex justify-between mt-2">
          {data.map((item, index) => (
            <div
              key={index}
              className={cn(
                "text-xs text-muted-foreground px-1 text-center",
                hoveredIndex === index && "font-medium text-foreground"
              )}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
