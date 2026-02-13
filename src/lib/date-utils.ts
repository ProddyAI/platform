import { formatDistanceToNow } from "date-fns";

/**
 * Safely format a timestamp to a human-readable relative time string
 * with fallback for invalid or null timestamps
 */
export const safeFormatDistanceToNow = (
	timestamp: number | null | undefined,
	options?: { addSuffix?: boolean; stripAbout?: boolean }
): string => {
	try {
		// Check for null/undefined or invalid numbers
		if (
			!timestamp ||
			Number.isNaN(Number(timestamp))
		) {
			return "recently";
		}

		const date = new Date(Number(timestamp));

		// Validate the date
		if (date.toString() === "Invalid Date") {
			return "recently";
		}

		let formatted = formatDistanceToNow(date, {
			addSuffix: options?.addSuffix ?? true,
		});

		// Optionally strip "about " prefix for more compact display
		if (options?.stripAbout) {
			formatted = formatted.replace("about ", "");
		}

		return formatted;
	} catch (_error) {
		return "recently";
	}
};
