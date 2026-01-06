export interface PieSegment {
  label: string;
  value: number;
  color: string;
  percentage: number;
  startAngle: number;
  endAngle: number;
  index: number;
}

export const DEPTH = 12; // Moderate depth for 3D look
export const HOVER_EJECT = 12; // Distance to eject out on hover

/**
 * Creates the SVG path for the top (face) of a pie chart segment
 * @param segment - The pie segment data
 * @param radiusX - Horizontal radius of the ellipse
 * @param radiusY - Vertical radius of the ellipse
 * @param centerX - X coordinate of the center
 * @param centerY - Y coordinate of the center
 * @returns SVG path string
 */
export const createTopPath = (
  segment: PieSegment,
  radiusX: number,
  radiusY: number,
  centerX: number,
  centerY: number
): string => {
  const startAngleRad = (segment.startAngle / 100) * Math.PI * 2 - Math.PI / 2;
  const endAngleRad = (segment.endAngle / 100) * Math.PI * 2 - Math.PI / 2;
  
  const startX = centerX + radiusX * Math.cos(startAngleRad);
  const startY = centerY + radiusY * Math.sin(startAngleRad);
  const endX = centerX + radiusX * Math.cos(endAngleRad);
  const endY = centerY + radiusY * Math.sin(endAngleRad);
  
  const largeArcFlag = segment.percentage > 50 ? 1 : 0;
  
  return `M ${centerX} ${centerY} L ${startX} ${startY} A ${radiusX} ${radiusY} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
};

/**
 * Creates the SVG paths for the 3D sides of a pie chart segment
 * @param segment - The pie segment data
 * @param radiusX - Horizontal radius of the ellipse
 * @param radiusY - Vertical radius of the ellipse
 * @param centerX - X coordinate of the center
 * @param centerY - Y coordinate of the center
 * @param depth - Depth of the 3D effect
 * @param isHovered - Whether the segment is hovered
 * @returns Array of path objects with path string and type
 */
export const createSidePath = (
  segment: PieSegment,
  radiusX: number,
  radiusY: number,
  centerX: number,
  centerY: number,
  depth: number,
  isHovered = false
): Array<{ path: string; type: 'outer' | 'start' | 'end' }> => {
  const startAngleRad = (segment.startAngle / 100) * Math.PI * 2 - Math.PI / 2;
  const endAngleRad = (segment.endAngle / 100) * Math.PI * 2 - Math.PI / 2;
  
  const midAngle = (startAngleRad + endAngleRad) / 2;
  // Improved edge visibility - only show edges that are truly visible from the front
  const showStartEdge = isHovered || Math.sin(startAngleRad) > 0.1;
  const showEndEdge = isHovered || Math.sin(endAngleRad) > 0.1;
  const showOuterEdge = isHovered || Math.sin(midAngle) > 0.08;
  
  const startX = centerX + radiusX * Math.cos(startAngleRad);
  const startY = centerY + radiusY * Math.sin(startAngleRad);
  const endX = centerX + radiusX * Math.cos(endAngleRad);
  const endY = centerY + radiusY * Math.sin(endAngleRad);
  
  const paths: Array<{ path: string; type: 'outer' | 'start' | 'end' }> = [];
  
  // Outer edge (arc) with smooth gradient
  if (showOuterEdge) {
    const largeArcFlag = segment.percentage > 50 ? 1 : 0;
    const outerPath = `M ${startX} ${startY} L ${startX} ${startY + depth} A ${radiusX} ${radiusY} 0 ${largeArcFlag} 1 ${endX} ${endY + depth} L ${endX} ${endY} A ${radiusX} ${radiusY} 0 ${largeArcFlag} 0 ${startX} ${startY} Z`;
    paths.push({ path: outerPath, type: 'outer' });
  }
  
  // Start edge
  if (showStartEdge) {
    const startPath = `M ${centerX} ${centerY} L ${startX} ${startY} L ${startX} ${startY + depth} L ${centerX} ${centerY + depth} Z`;
    paths.push({ path: startPath, type: 'start' });
  }
  
  // End edge
  if (showEndEdge) {
    const endPath = `M ${centerX} ${centerY} L ${endX} ${endY} L ${endX} ${endY + depth} L ${centerX} ${centerY + depth} Z`;
    paths.push({ path: endPath, type: 'end' });
  }
  
  return paths;
};