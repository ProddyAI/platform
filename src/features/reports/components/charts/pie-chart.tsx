'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { createTopPath, createSidePath, DEPTH, HOVER_EJECT, type PieSegment } from './utils/pie-chart-paths';
import { adjustColor, darkenColor, lightenColor } from './utils/color-utils';

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
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
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
  
  const handleMouseEnter = useCallback((index: number, event: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredIndex(index);
    
    // Calculate tooltip position relative to viewport
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredIndex(null);
      setTooltipPosition(null);
    }, 50);
  }, []);
  
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (hoveredIndex !== null) {
      setTooltipPosition({
        x: event.clientX,
        y: event.clientY
      });
    }
  }, [hoveredIndex]);
  
  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-40 bg-muted/20 rounded-md", className)}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let cumulativePercentage = 0;
  const segments: PieSegment[] = data.map((item, index) => {
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

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full flex items-start justify-start pt-4 pl-4", className)} 
      style={{ overflow: 'visible' }}
    >
      {/* Pie Chart Container - Positioned to the left and top */}
      <div 
        className="relative flex items-center justify-center"
        style={{ 
          width: '90%',
          height: '100%',
          maxWidth: maxSize ?? size,
          maxHeight: maxSize ?? size,
          overflow: 'visible',
          marginLeft: '0',
        }}
      >
        <svg 
          viewBox="0 0 140 130" 
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible', isolation: 'isolate' }}
        >
          <defs>
            {/* Side gradient for depth - enhanced matte style */}
            {segments.map((segment) => (
              <linearGradient 
                key={`side-gradient-${segment.index}`} 
                id={`sideGradient-${segment.index}`}
                x1="0%" 
                y1="0%" 
                x2="0%" 
                y2="100%"
              >
                <stop offset="0%" stopColor={darkenColor(segment.color, 0.2)} />
                <stop offset="50%" stopColor={darkenColor(segment.color, 0.35)} />
                <stop offset="100%" stopColor={darkenColor(segment.color, 0.45)} />
              </linearGradient>
            ))}
            
            {/* Top surface subtle gradient for depth perception */}
            {segments.map((segment) => (
              <linearGradient 
                key={`top-gradient-${segment.index}`} 
                id={`topGradient-${segment.index}`}
                x1="0%" 
                y1="0%" 
                x2="0%" 
                y2="100%"
              >
                <stop offset="0%" stopColor={lightenColor(segment.color, 0.05)} />
                <stop offset="100%" stopColor={segment.color} />
              </linearGradient>
            ))}
            
            {/* Drop shadow filter for tooltip */}
            <filter id="tooltip-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
              <feOffset dx="0" dy="2" result="offsetblur"/>
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* LAYER 1: All 3D sides (non-hovered segments) */}
          {segments.filter(seg => hoveredIndex !== seg.index).map((segment) => {
            const isHovered = false;
            const ejectAmount = 0;
            
            const midAngleRad = ((segment.startAngle + segment.endAngle) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
            const offsetX = ejectAmount * Math.cos(midAngleRad);
            const offsetY = ejectAmount * Math.sin(midAngleRad);
            
            const centerX = 70 + offsetX;
            const centerY = 52 + offsetY;
            const radiusX = 65;
            const radiusY = 44;
            
            const sidePaths = createSidePath(segment, radiusX, radiusY, centerX, centerY, DEPTH, isHovered);
            
            return (
              <g key={`depth-${segment.index}`}>
                {sidePaths?.map((pathData, idx) => (
                <path
                    key={`side-${segment.index}-${idx}`}
                    d={pathData.path}
                    fill={`url(#sideGradient-${segment.index})`}
                    stroke="none"
                    fillOpacity="1"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      transition: 'all 0.3s ease-out',
                    }}
                  />
                ))}
              </g>
            );
          })}
          
          {/* LAYER 2: Hovered segment's 3D sides */}
          {hoveredIndex !== null && segments.filter(seg => hoveredIndex === seg.index).map((segment) => {
            const isHovered = true;
            const ejectAmount = HOVER_EJECT;
            
            const midAngleRad = ((segment.startAngle + segment.endAngle) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
            const offsetX = ejectAmount * Math.cos(midAngleRad);
            const offsetY = ejectAmount * Math.sin(midAngleRad);
            
            const centerX = 70 + offsetX;
            const centerY = 52 + offsetY;
            const radiusX = 65;
            const radiusY = 44;
            
            const sidePaths = createSidePath(segment, radiusX, radiusY, centerX, centerY, DEPTH, isHovered);
            
            return (
              <g key={`depth-hovered-${segment.index}`}>
                {sidePaths?.map((pathData, idx) => (
                <path
                    key={`side-${segment.index}-${idx}`}
                    d={pathData.path}
                    fill={`url(#sideGradient-${segment.index})`}
                    stroke="none"
                    fillOpacity="1"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      transition: 'all 0.3s ease-out',
                      filter: 'brightness(1.15)',
                    }}
                  />
                ))}
              </g>
            );
          })}
          
          {/* LAYER 3: All top surfaces (non-hovered segments) */}
          {segments.filter(seg => hoveredIndex !== seg.index).map((segment) => {
            const ejectAmount = 0;
            
            const midAngleRad = ((segment.startAngle + segment.endAngle) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
            const offsetX = ejectAmount * Math.cos(midAngleRad);
            const offsetY = ejectAmount * Math.sin(midAngleRad);
            
            const centerX = 70 + offsetX;
            const centerY = 52 + offsetY;
            const radiusX = 65;
            const radiusY = 44;
            
            const topPath = createTopPath(segment, radiusX, radiusY, centerX, centerY);
            
            return (
              <g 
                key={`top-${segment.index}`}
                className={cn(
                  "transition-all duration-300 ease-out",
                  onSegmentClick && "cursor-pointer"
                )}
                onMouseEnter={(e) => handleMouseEnter(segment.index, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onClick={() => onSegmentClick?.(segment.label, segment.value, segment.index)}
                style={{ pointerEvents: 'all' }}
              >
                <path
                  d={topPath}
                  fill={`url(#topGradient-${segment.index})`}
                  fillOpacity="1"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="0.8"
                  style={{
                    transition: 'all 0.3s ease-out',
                    filter: 'brightness(1)',
                  }}
                />
                
                <path
                  d={topPath}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  style={{
                    opacity: 0.4,
                    transition: 'all 0.3s ease-out',
                  }}
                />
              </g>
            );
          })}
          
          {/* LAYER 4: Hovered segment's top surface (always on top) */}
          {hoveredIndex !== null && segments.filter(seg => hoveredIndex === seg.index).map((segment) => {
            const ejectAmount = HOVER_EJECT;
            
            const midAngleRad = ((segment.startAngle + segment.endAngle) / 2 / 100) * Math.PI * 2 - Math.PI / 2;
            const offsetX = ejectAmount * Math.cos(midAngleRad);
            const offsetY = ejectAmount * Math.sin(midAngleRad);
            
            const centerX = 70 + offsetX;
            const centerY = 52 + offsetY;
            const radiusX = 65;
            const radiusY = 44;
            
            const topPath = createTopPath(segment, radiusX, radiusY, centerX, centerY);
            
            return (
              <g 
                key={`top-hovered-${segment.index}`}
                className={cn(
                  "transition-all duration-300 ease-out",
                  onSegmentClick && "cursor-pointer"
                )}
                onMouseEnter={(e) => handleMouseEnter(segment.index, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onClick={() => onSegmentClick?.(segment.label, segment.value, segment.index)}
                style={{ pointerEvents: 'all' }}
              >
                <path
                  d={topPath}
                  fill={`url(#topGradient-${segment.index})`}
                  fillOpacity="1"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="0.8"
                  style={{
                    transition: 'all 0.3s ease-out',
                    filter: 'brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  }}
                />
                
                <path
                  d={topPath}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  style={{
                    opacity: 0.6,
                    transition: 'all 0.3s ease-out',
                  }}
                />
              </g>
            );
          })}
          
        </svg>
      </div>
      
      {/* HTML Tooltip - Displayed above all page elements */}
      {hoveredIndex !== null && tooltipPosition && (
        <div
          className="fixed pointer-events-none animate-in fade-in duration-200"
          style={{
            left: tooltipPosition.x + 15,
            top: tooltipPosition.y - 10,
            zIndex: 9999,
          }}
        >
          <div 
            className="bg-background dark:bg-gray-900 rounded-lg shadow-xl border-2 px-3 py-2"
            style={{
              borderColor: segments[hoveredIndex].color,
            }}
          >
            <div className="text-xs font-bold text-foreground mb-0.5">
              {segments[hoveredIndex].label}
            </div>
            <div 
              className="text-xs font-bold"
              style={{
                color: segments[hoveredIndex].color,
              }}
            >
              {formatValue(segments[hoveredIndex].value)}
            </div>
          </div>
        </div>
      )}
      
      {/* Compact Legend - Top Right */}
      {showLegend && (
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 bg-background dark:bg-background rounded-lg p-2.5 border border-border/40 shadow-lg" style={{ zIndex: 1 }}>
          {segments.map((segment) => {
            const isHovered = hoveredIndex === segment.index;
            
            return (
              <div 
                key={segment.index}
                className={cn(
                  "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all duration-300",
                  isHovered && "bg-muted/50 scale-105",
                  onSegmentClick && "cursor-pointer"
                )}
                onMouseEnter={(e) => handleMouseEnter(segment.index, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                onClick={() => onSegmentClick?.(segment.label, segment.value, segment.index)}
                style={{
                  boxShadow: isHovered ? `0 0 0 1px ${segment.color}40` : 'none',
                }}
              >
                {/* Color indicator */}
                <div 
                  className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300",
                    isHovered && "scale-125"
                  )}
                  style={{ 
                    backgroundColor: segment.color,
                    boxShadow: isHovered ? `0 0 8px ${segment.color}` : 'none',
                  }}
                />
                
                {/* Label */}
                <div 
                  className={cn(
                    "text-xs font-medium transition-colors duration-300 whitespace-nowrap",
                    isHovered 
                      ? "text-foreground" 
                      : "text-foreground/70 dark:text-foreground/60"
                  )}
                >
                  {segment.label}
                </div>
                
                {/* Value - Show either formatted value or percentage */}
                <div 
                  className={cn(
                    "text-xs font-bold transition-all duration-300",
                    isHovered && "scale-110"
                  )}
                  style={{
                    color: isHovered ? segment.color : 'currentColor',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {formatValue(segment.value)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};