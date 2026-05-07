export function generatePlaceholderImage(
	text: string,
	width: number = 40,
	height: number = 40,
	bgColor: string = "#4f46e5",
	textColor: string = "#ffffff"
): string {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return generateSVGPlaceholder(text, width, height, bgColor, textColor);
	}

	try {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return generateSVGPlaceholder(text, width, height, bgColor, textColor);
		}

		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = textColor;
		ctx.font = `bold ${Math.floor(height * 0.4)}px Arial, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, width / 2, height / 2);

		return canvas.toDataURL();
	} catch (_error) {
		// Fallback to SVG if canvas fails
		return generateSVGPlaceholder(text, width, height, bgColor, textColor);
	}
}

/**
 * Generate an SVG-based placeholder image
 */
function generateSVGPlaceholder(
	text: string,
	width: number = 40,
	height: number = 40,
	bgColor: string = "#4f46e5",
	textColor: string = "#ffffff"
): string {
	const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            fill="${textColor}" font-family="Arial, sans-serif" font-size="${Math.floor(height * 0.4)}" font-weight="bold">${text}</text>
    </svg>
  `.trim();

	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate initials from a name
 * @param name - Full name
 * @returns Initials (up to 2 characters)
 */
export function getInitials(name: string): string {
	if (!name) return "U"; // Default for "User"

	const parts = name.trim().split(" ");
	if (parts.length === 1) {
		return parts[0].charAt(0).toUpperCase();
	}

	return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get a placeholder image URL for a user
 * @param name - User's name (optional)
 * @param imageUrl - User's actual image URL (optional)
 * @param userId - User's ID for consistent color generation (optional)
 * @returns Image URL to use
 */
export function getUserImageUrl(
	name?: string,
	imageUrl?: string,
	userId?: string
): string {
	if (imageUrl) {
		return imageUrl;
	}

	const initials = getInitials(name || "User");
	// Use userId or name for color generation, fallback to default color
	const colorKey = userId || name || "User";
	const bgColor = generateUserColor(colorKey);
	return generatePlaceholderImage(initials, 40, 40, bgColor);
}

/**
 * Generate a consistent color for a user based on their identifier
 * @param identifier - User identifier (ID, name, etc.)
 * @returns Hex color string
 */
export function generateUserColor(identifier: string): string {
	// Import stringToColor dynamically to avoid circular dependencies
	const colors = [
		"#FF5733", // Red
		"#33FF57", // Green
		"#3357FF", // Blue
		"#FF33A8", // Pink
		"#33FFF5", // Cyan
		"#FFD133", // Yellow
		"#9E33FF", // Purple
		"#FF8333", // Orange
		"#33FFBD", // Mint
		"#FF3333", // Bright Red
	];

	// Generate hash from identifier
	let hash = 0;
	for (let i = 0; i < identifier.length; i++) {
		hash = (hash << 5) - hash + identifier.charCodeAt(i);
		hash = hash & hash; // Convert to 32-bit integer
	}

	return colors[Math.abs(hash) % colors.length];
}
