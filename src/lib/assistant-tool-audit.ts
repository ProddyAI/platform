const REDACTED_VALUE = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 2000;
const SENSITIVE_KEY_PATTERN =
	/(^|_|-)(token|secret|password|passphrase|api[_-]?key|authorization|cookie|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)(_|-|$)/i;

function sanitizeString(input: string): string {
	return input
		.replace(/(Bearer\s+)[^\s]+/gi, `$1${REDACTED_VALUE}`)
		.replace(
			/(token|secret|password|api[_-]?key)\s*[:=]\s*["']?[^"',\s}]+/gi,
			`$1=${REDACTED_VALUE}`
		)
		.slice(0, MAX_STRING_LENGTH);
}

export function sanitizeAuditPayload(
	value: unknown,
	depth = 0,
	parentKey = ""
): unknown {
	if (depth > MAX_DEPTH) {
		return "[TRUNCATED]";
	}

	if (value === null || value === undefined) {
		return value;
	}

	if (SENSITIVE_KEY_PATTERN.test(parentKey)) {
		return REDACTED_VALUE;
	}

	if (typeof value === "string") {
		return sanitizeString(value);
	}

	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) =>
			sanitizeAuditPayload(item, depth + 1, parentKey)
		);
	}

	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>);
		const sanitized: Record<string, unknown> = {};
		for (const [key, childValue] of entries) {
			sanitized[key] = sanitizeAuditPayload(childValue, depth + 1, key);
		}
		return sanitized;
	}

	return String(value).slice(0, MAX_STRING_LENGTH);
}

export function parseAndSanitizeArguments(rawArguments: string): unknown {
	try {
		return sanitizeAuditPayload(JSON.parse(rawArguments));
	} catch {
		return sanitizeAuditPayload(rawArguments);
	}
}
