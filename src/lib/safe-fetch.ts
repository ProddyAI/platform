/**
 * Safely parse a fetch Response that is expected to be JSON.
 *
 * Why: A naive `await response.json()` throws `SyntaxError: Unexpected token 'A'`
 * when the server returns Next.js's default HTML error page
 * ("A server error occurred...") instead of JSON. This helper inspects the
 * status and content-type first and surfaces a meaningful Error in that case.
 *
 * Returns the parsed JSON for 2xx JSON responses; throws an Error otherwise.
 */
export async function parseJsonResponse<T = unknown>(
	response: Response,
	fallbackErrorMessage = "Request failed"
): Promise<T> {
	const contentType = response.headers.get("content-type") ?? "";
	const isJson = contentType.toLowerCase().includes("application/json");

	if (response.ok && isJson) {
		return (await response.json()) as T;
	}

	// Read the body once as text so we can attempt both JSON and string fallbacks.
	let bodyText = "";
	try {
		bodyText = await response.text();
	} catch {
		// Ignore; we still have the status code to report.
	}

	if (isJson && bodyText) {
		try {
			const parsed = JSON.parse(bodyText) as {
				error?: unknown;
				message?: unknown;
			};
			if (response.ok) {
				return parsed as T;
			}
			const messageFromBody =
				typeof parsed.error === "string"
					? parsed.error
					: typeof parsed.message === "string"
						? parsed.message
						: undefined;
			throw new Error(messageFromBody ?? statusFallback(response));
		} catch (err) {
			if (err instanceof Error && err.message) throw err;
			throw new Error(statusFallback(response));
		}
	}

	if (response.ok) {
		// Server returned 2xx with a non-JSON body; treat as failure for callers
		// that expected JSON.
		throw new Error(
			`Expected JSON response but got ${contentType || "no content-type"}`
		);
	}

	throw new Error(statusFallback(response, fallbackErrorMessage));
}

function statusFallback(response: Response, fallback = "Request failed") {
	if (response.statusText) {
		return `${fallback} (${response.status} ${response.statusText})`;
	}
	return `${fallback} (HTTP ${response.status})`;
}
