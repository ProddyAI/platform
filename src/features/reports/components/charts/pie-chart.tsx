'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { calculateSvgTooltipPosition, getTooltipRectAttrs, getTooltipTextAttrs } from '@/features/reports/utils/tooltip-positioning';

interface PieChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  size?: number;
  showLegend?: boolean;
  className?: string;
  formatValue?: (value: number) => string;
  onSegmentClick?: (label: string, value: number, index: number) => void;
}

export const PieChart = ({
  data,
  size = 200,
  showLegend = true,
  className,
  formatValue = (value) => value.toString(),
  onSegmentClick,
}: PieChartProps) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-40 bg-muted/20 rounded-md", className)}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate segments
  let cumulativePercentage = 0;
  const segments = data.map((item, index) => {
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

  // SVG path for each segment
  const createSegmentPath = (segment: typeof segments[0]) => {
    const startAngleRad = (segment.startAngle / 100) * Math.PI * 2 - Math.PI / 2;
    const endAngleRad = (segment.endAngle / 100) * Math.PI * 2 - Math.PI / 2;
    
    const radius = 50;
    const center = { x: 50, y: 50 };
    
    const startX = center.x + radius * Math.cos(startAngleRad);
    const startY = center.y + radius * Math.sin(startAngleRad);
    const endX = center.x + radius * Math.cos(endAngleRad);
    const endY = center.y + radius * Math.sin(endAngleRad);
    
    const largeArcFlag = segment.percentage > 50 ? 1 : 0;
    
    return `M ${center.x} ${center.y} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-6", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {segments.map((segment) => {
            const isHovered = hoveredIndex === segment.index;
            
            return (
              <g key={segment.index}>
                <path
                  d={createSegmentPath(segment)}
                  fill={segment.color}
                  stroke="#fff"
                  strokeWidth="1"
                  className={cn(
                    "transition-all duration-200",
                    onSegmentClick && "cursor-pointer"
                  )}
                  style={{
                    filter: isHovered ? 'brightness(0.9)' : 'brightness(1)',
                  }}
                  onMouseEnter={() => setHoveredIndex(segment.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => onSegmentClick?.(segment.label, segment.value, segment.index)}
                />
                {/* Tooltip on hover */}
                {isHovered && (() => {
                  const midAngleRad = ((segment.startAngle + segment.endAngle) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
                  const tooltipDistance = 65; // Distance from center
                  const tooltipX = 50 + tooltipDistance * Math.cos(midAngleRad);
                  const tooltipY = 50 + tooltipDistance * Math.sin(midAngleRad);
                  
                  const tooltipPos = calculateSvgTooltipPosition({
                    viewBoxWidth: 100,
                    viewBoxHeight: 100,
                    tooltipWidth: 40,
                    tooltipHeight: 16,
                    padding: 3,
                    pointX: tooltipX,
                    pointY: tooltipY,
                  });
                  const rectAttrs = getTooltipRectAttrs(40, 16);
                  const textAttrs = getTooltipTextAttrs();
                  
                  return (
                    <g transform={tooltipPos.transform}>
                      <rect
                        {...rectAttrs}
                        className="fill-foreground/90 stroke-border stroke-[0.5]"
                      />
                      <text
                        {...textAttrs}
                        className="fill-background text-[3px] font-medium"
                      >
                        {segment.label}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </svg>
        
        {/* Center text showing total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-bold">{formatValue(total)}</span>
        </div>
      </div>
      
      {showLegend && (
        <div className="flex flex-col gap-2 flex-1">
          {segments.map((segment) => {
            const isHovered = hoveredIndex === segment.index;
            
            return (
              <div 
                key={segment.index}
                className={cn(
                  "flex items-center gap-2 p-1 rounded-md transition-colors",
                  isHovered && "bg-muted/50",
                  onSegmentClick && "cursor-pointer"
                )}
                onMouseEnter={() => setHoveredIndex(segment.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSegmentClick?.(segment.label, segment.value, segment.index)}
              >
                <div 
                  className="w-4 h-4 rounded-sm" 
                  style={{ backgroundColor: segment.color }}
                />
                <div className="flex-1 text-sm">{segment.label}</div>
                <div className="text-sm font-medium">{formatValue(segment.value)}</div>
                <div className="text-xs text-muted-foreground">
                  {segment.percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
