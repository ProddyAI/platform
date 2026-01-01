export interface TooltipPosition {
  x: number;
  y: number;
  transform: string;
}

export interface TooltipConfig {
  viewBoxWidth: number;
  viewBoxHeight: number;
  tooltipWidth: number;
  tooltipHeight: number;
  offsetY?: number;
  offsetX?: number;
  padding?: number;
  pointX: number;
  pointY: number;
}

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

  let x = pointX + offsetX;
  let y = pointY + offsetY;

  x = x - tooltipWidth / 2;

  if (x < padding) {
    x = padding;
  }

  if (x + tooltipWidth > viewBoxWidth - padding) {
    x = viewBoxWidth - padding - tooltipWidth;
  }

  if (y < padding) {
    y = pointY + 15;
  }

  if (y + tooltipHeight > viewBoxHeight - padding) {
    y = viewBoxHeight - padding - tooltipHeight;
  }

  const transform = `translate(${x}, ${y})`;

  return {
    x,
    y,
    transform,
  };
}

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

  if (left < 0) {
    left = 4;
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

export function getTooltipRectAttrs(width: number = 36, height: number = 18) {
  return {
    x: -width / 2,
    y: -height / 2,
    width,
    height,
    rx: 3,
  };
}

export function getTooltipTextAttrs() {
  return {
    x: 0,
    y: 0.3,
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  };
}
