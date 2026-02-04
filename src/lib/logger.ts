// Simple logger utility to replace console usage in production code
export const logger = {
	debug: (message: string, ...args: unknown[]) => {
		if (process.env.NODE_ENV === "development") {
			console.debug(`[DEBUG] ${message}`, ...args);
		}
	},

	info: (_message: string, ..._args: unknown[]) => {
		if (process.env.NODE_ENV === "development") {
		}
	},

	warn: (message: string, ...args: unknown[]) => {
		console.warn(`[WARN] ${message}`, ...args);
	},

	error: (message: string, ...args: unknown[]) => {
		console.error(`[ERROR] ${message}`, ...args);
	},
};
