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

export const EDGE_VISIBILITY_THRESHOLD = 0.1; // For start and end edges
export const OUTER_EDGE_VISIBILITY_THRESHOLD = 0.08; // For outer arc edge

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
	// Handle full circle case (100% or very close to it)
	if (segment.percentage >= 99.9) {
		// Draw a full ellipse using two arcs
		const topX = centerX;
		const topY = centerY - radiusY;
		const bottomX = centerX;
		const bottomY = centerY + radiusY;

		return `M ${topX} ${topY} A ${radiusX} ${radiusY} 0 0 1 ${bottomX} ${bottomY} A ${radiusX} ${radiusY} 0 0 1 ${topX} ${topY} Z`;
	}

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
	_isHovered = false
): { path: string; type: "outer" | "start" | "end" }[] => {
	const paths: { path: string; type: "outer" | "start" | "end" }[] = [];

	// Handle full circle case (100% or very close to it)
	if (segment.percentage >= 99.9) {


		// Right side point (0°, which is at 3 o'clock position after -90° offset)
		const rightX = centerX + radiusX;
		const rightY = centerY;

		// Bottom point (90°)
		const bottomX = centerX;
		const bottomY = centerY + radiusY;

		// Left side point (180°)
		const leftX = centerX - radiusX;
		const leftY = centerY;


		const backPath = `M ${rightX} ${rightY} A ${radiusX} ${radiusY} 0 0 1 ${bottomX} ${bottomY} A ${radiusX} ${radiusY} 0 0 1 ${leftX} ${leftY} L ${leftX} ${leftY + depth} A ${radiusX} ${radiusY} 0 0 0 ${bottomX} ${bottomY + depth} A ${radiusX} ${radiusY} 0 0 0 ${rightX} ${rightY + depth} Z`;
		paths.push({ path: backPath, type: "outer" });

		return paths;
	}

	const startAngleRad = (segment.startAngle / 100) * Math.PI * 2 - Math.PI / 2;
	const endAngleRad = (segment.endAngle / 100) * Math.PI * 2 - Math.PI / 2;

	const startX = centerX + radiusX * Math.cos(startAngleRad);
	const startY = centerY + radiusY * Math.sin(startAngleRad);
	const endX = centerX + radiusX * Math.cos(endAngleRad);
	const endY = centerY + radiusY * Math.sin(endAngleRad);

	// Always show all edges for complete 3D effect on all segments
	const showOuterEdge = true;
	const showStartEdge = true;
	const showEndEdge = true;

	// Outer edge (arc) - always show for consistent 3D appearance
	if (showOuterEdge) {
		const largeArcFlag = segment.percentage > 50 ? 1 : 0;
		const outerPath = `M ${startX} ${startY} L ${startX} ${startY + depth} A ${radiusX} ${radiusY} 0 ${largeArcFlag} 1 ${endX} ${endY + depth} L ${endX} ${endY} A ${radiusX} ${radiusY} 0 ${largeArcFlag} 0 ${startX} ${startY} Z`;
		paths.push({ path: outerPath, type: "outer" });
	}

	// Start edge - only show if clearly visible
	if (showStartEdge) {
		const startPath = `M ${centerX} ${centerY} L ${startX} ${startY} L ${startX} ${startY + depth} L ${centerX} ${centerY + depth} Z`;
		paths.push({ path: startPath, type: "start" });
	}

	// End edge - only show if clearly visible
	if (showEndEdge) {
		const endPath = `M ${centerX} ${centerY} L ${endX} ${endY} L ${endX} ${endY + depth} L ${centerX} ${centerY + depth} Z`;
		paths.push({ path: endPath, type: "end" });
	}

	return paths;
};
