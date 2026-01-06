/**
 * Normalizes a hex color to 6-character format
 * @param hex - Hex color string without the '#' prefix
 * @returns Normalized 6-character hex string
 */
const normalizeHex = (hex: string): string => {
  // Handle shorthand hex (e.g., 'fff' -> 'ffffff')
  if (hex.length === 3) {
    return hex.split('').map(char => char + char).join('');
  }
  return hex;
};

/**
 * Validates if a string is a valid hex color
 * @param color - Color string to validate
 * @returns True if valid hex color
 */
const isValidHex = (color: string): boolean => {
  const hex = color.replace('#', '');
  return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex);
};

/**
 * Adjusts the brightness of a hex color by a given amount
 * @param color - Hex color string (e.g., '#FF5733', '#fff')
 * @param amount - Amount to adjust (-1 to 1, negative darkens, positive lightens)
 * @returns Adjusted hex color string
 */
export const adjustColor = (color: string, amount: number): string => {
  // Validate input
  if (!isValidHex(color)) {
    console.warn(`Invalid hex color format: ${color}. Returning original color.`);
    return color;
  }
  
  const hex = normalizeHex(color.replace('#', ''));
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Additional safety check for NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn(`Failed to parse color: ${color}. Returning original color.`);
    return color;
  }
  
  const adjust = (val: number) => Math.max(0, Math.min(255, Math.floor(val * (1 + amount))));
  
  const newR = adjust(r);
  const newG = adjust(g);
  const newB = adjust(b);
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

/**
 * Darkens a hex color by a given amount
 * @param color - Hex color string
 * @param amount - Amount to darken (0 to 1, default 0.35)
 * @returns Darkened hex color string
 */
export const darkenColor = (color: string, amount: number = 0.35): string => 
  adjustColor(color, -amount);

/**
 * Lightens a hex color by a given amount
 * @param color - Hex color string
 * @param amount - Amount to lighten (0 to 1, default 0.2)
 * @returns Lightened hex color string
 */
export const lightenColor = (color: string, amount: number = 0.2): string => 
  adjustColor(color, amount);