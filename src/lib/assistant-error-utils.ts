import { sanitizeAuditPayload } from "@/lib/assistant-tool-audit";

const REDACTED = "[REDACTED]";
const MAX_ERROR_MESSAGE_LENGTH = 280;
const SENSITIVE_VALUE_PATTERN =
	/(Bearer\s+)[^\s]+|((?:api[_-]?key|token|secret|password|authorization|cookie)\s*[:=]\s*)["']?[^"',\s}]+/gi;

type ErrorLike = {
	name?: string;
	message?: string;
	stack?: string;
	code?: string;
	status?: number;
};

export function sanitizeErrorMessage(input: string): string {
	return input
		.replace(SENSITIVE_VALUE_PATTERN, (...args) => {
			if (args[1]) {
				return `${args[1]}${REDACTED}`;
			}
			if (args[2]) {
				return `${args[2]}${REDACTED}`;
			}
			return REDACTED;
		})
		.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function normalizeError(error: unknown): {
	name: string;
	message: string;
	code?: string;
	stack?: string;
} {
	const err = (error ?? {}) as ErrorLike;
	const message =
		typeof err.message === "string" && err.message.trim().length > 0
			? err.message
			: "Unknown error";
	return {
		name: typeof err.name === "string" ? err.name : "Error",
		message: sanitizeErrorMessage(message),
		code: typeof err.code === "string" ? err.code : undefined,
		stack:
			typeof err.stack === "string"
				? sanitizeErrorMessage(err.stack.split("\n").slice(0, 3).join("\n"))
				: undefined,
	};
}

export function logRouteError(params: {
	route: string;
	stage: string;
	error: unknown;
	context?: Record<string, unknown>;
	level?: "warn" | "error";
}) {
	const payload = {
		stage: params.stage,
		error: normalizeError(params.error),
		context: sanitizeAuditPayload(params.context ?? {}),
	};
	if (params.level === "warn") {
		console.warn(`[${params.route}] ${params.stage}`, payload);
		return;
	}
	console.error(`[${params.route}] ${params.stage}`, payload);
}

export function buildActionableErrorPayload(params: {
	message: string;
	nextStep: string;
	code: string;
	recoverable?: boolean;
	fallbackResponse?: string;
}): {
	success: false;
	error: string;
	nextStep: string;
	code: string;
	recoverable: boolean;
	fallbackResponse?: string;
} {
	return {
		success: false,
		error: params.message,
		nextStep: params.nextStep,
		code: params.code,
		recoverable: params.recoverable ?? false,
		fallbackResponse: params.fallbackResponse,
	};
}

export function buildComposioFailureGuidance(): string {
	return "Check your connected integrations in Assistant settings, then retry.";
}

export function buildRecoverableAssistantFallback(reason?: string): string {
	const base =
		"I hit a temporary issue with external integrations, but I can still help with workspace tasks.";
	if (!reason) {
		return `${base} Try again in a moment or reconnect the integration.`;
	}
	return `${base} Reason: ${reason}. Try again in a moment or reconnect the integration.`;
}
