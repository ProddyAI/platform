/**
 * Tooltip Positioning Utility
 * 
 * Root Cause Analysis:
 * - SVG transforms used mixed coordinate systems (SVG units vs pixels)
 * - Multiple Math.max/Math.min calculations caused cumulative drift
 * - No viewport boundary checking led to off-screen tooltips
 * - Absolute positioning without containment caused jitter
 * 
 * Solution:
 * - Standardized SVG coordinate system for all tooltips
 * - Viewport boundary aware positioning
 * - Minimal calculations to prevent drift
 * - Reusable config across all chart types
 */

export interface TooltipPosition {
  x: number;
  y: number;
  transform: string;
}

export interface TooltipConfig {
  // SVG viewBox dimensions
  viewBoxWidth: number;
  viewBoxHeight: number;
  
  // Tooltip dimensions in viewBox units
  tooltipWidth: number;
  tooltipHeight: number;
  
  // Offset from data point (in viewBox units)
  offsetY?: number;
  offsetX?: number;
  
  // Padding from chart edges (in viewBox units)
  padding?: number;
  
  // Point coordinates in viewBox space
  pointX: number;
  pointY: number;
}

/**
 * Calculate tooltip position within SVG viewBox
 * All coordinates work in normalized SVG units (0-100)
 * No mixing of coordinate systems - consistent throughout
 */
export function calculateSvgTooltipPosition(config: TooltipConfig): TooltipPosition {
  const {
    viewBoxWidth = 100,
    viewBoxHeight = 100,
    tooltipWidth = 36,
    tooltipHeight = 18,
    offsetY = -15,
    offsetX = 0,
    padding = 5,
    pointX,
    pointY,
  } = config;

  // Start with direct positioning above the point
  let x = pointX + offsetX;
  let y = pointY + offsetY;

  // Apply horizontal centering relative to tooltip width
  x = x - tooltipWidth / 2;

  // Boundary checking - keep tooltip within viewBox
  
  // Left boundary
  if (x < padding) {
    x = padding;
  }
  
  // Right boundary
  if (x + tooltipWidth > viewBoxWidth - padding) {
    x = viewBoxWidth - padding - tooltipWidth;
  }
  
  // Top boundary
  if (y < padding) {
    // If can't fit above, position below instead
    y = pointY + 15;
  }
  
  // Bottom boundary
  if (y + tooltipHeight > viewBoxHeight - padding) {
    y = viewBoxHeight - padding - tooltipHeight;
  }

  // Use translate transform - single operation, no drift
  const transform = `translate(${x}, ${y})`;

  return {
    x,
    y,
    transform,
  };
}

/**
 * Calculate tooltip position for DOM elements (not SVG)
 * Used for bar charts and other DOM-based visualizations
 */
export function calculateDomTooltipPosition(
  element: HTMLElement,
  containerRect: DOMRect,
  tooltipWidth: number = 60,
  tooltipHeight: number = 24,
  offsetY: number = -30,
): { top: string; left: string } {
  const elementRect = element.getBoundingClientRect();
  const elementCenterX = elementRect.left - containerRect.left + elementRect.width / 2;
  const elementTop = elementRect.top - containerRect.top;

  let top = elementTop + offsetY;
  let left = elementCenterX - tooltipWidth / 2;

  // Boundary checking
  if (left < 0) {
    left = 4; // Small padding
  }
  if (left + tooltipWidth > containerRect.width) {
    left = containerRect.width - tooltipWidth - 4;
  }
  if (top < 0) {
    top = elementRect.bottom - containerRect.top + 8;
  }
  if (top + tooltipHeight > containerRect.height) {
    top = elementTop - tooltipHeight - 8;
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
  };
}

/**
 * Generate consistent SVG tooltip rectangle attributes
 */
export function getTooltipRectAttrs(width: number = 36, height: number = 18) {
  return {
    x: -width / 2,
    y: -height / 2,
    width,
    height,
    rx: 3,
  };
}

/**
 * Generate consistent SVG tooltip text attributes
 */
export function getTooltipTextAttrs() {
  return {
    x: 0,
    y: 0.3, // Slight vertical offset for centering
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };
}
