export async function register() {
	// Only initialize Sentry for Node.js runtime, not for Edge Runtime (middleware)
	// This prevents OpenTelemetry issues in middleware
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
	}
	
	// Edge runtime initialization is disabled to prevent native module errors
	// Middleware runs in Edge Runtime and doesn't support OpenTelemetry
}

export const onRequestError = (..._args: unknown[]) => {
	// Sentry is optional in this repo; no-op when not installed.
};
