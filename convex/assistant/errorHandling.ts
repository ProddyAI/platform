/**
 * Error categorization and fallback strategies for the assistant.
 */

export type AssistantErrorType =
	| "rate_limit"
	| "tool_failure"
	| "context_too_large"
	| "authentication"
	| "unknown";

export type HandleAssistantErrorResult = {
	shouldRetry: boolean;
	fallbackMode?: "internal_only";
	message: string;
	userAction?: "reconnect_integration";
	adjustments?: { maxMessages?: number };
};

function normalizeMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Something went wrong. Please try again.";
}

export function categorizeError(error: unknown): AssistantErrorType {
	const msg = normalizeMessage(error).toLowerCase();
	if (
		msg.includes("rate limit") ||
		msg.includes("rate_limit") ||
		msg.includes("too many requests") ||
		msg.includes("429")
	) {
		return "rate_limit";
	}
	if (
		msg.includes("tool") ||
		msg.includes("composio") ||
		msg.includes("integration") ||
		msg.includes("execute")
	) {
		return "tool_failure";
	}
	if (
		msg.includes("context") ||
		msg.includes("token") ||
		msg.includes("length") ||
		msg.includes("too long")
	) {
		return "context_too_large";
	}
	if (
		msg.includes("auth") ||
		msg.includes("unauthorized") ||
		msg.includes("reconnect") ||
		msg.includes("credentials")
	) {
		return "authentication";
	}
	return "unknown";
}

export function formatUserFriendlyError(error: unknown): string {
	const t = categorizeError(error);
	switch (t) {
		case "rate_limit":
			return "Service is busy. Please wait a moment and try again.";
		case "tool_failure":
			return "An integration couldn't complete that. Try again or use workspace-only questions.";
		case "context_too_large":
			return "That request was too long. Try a shorter message or start a new chat.";
		case "authentication":
			return "Please reconnect the integration in Settings and try again.";
		default:
			return "Something went wrong. Please try again.";
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleAssistantError(
	error: unknown,
	context: { query: string; attemptCount: number }
): Promise<HandleAssistantErrorResult> {
	const errorType = categorizeError(error);

	switch (errorType) {
		case "rate_limit":
			if (context.attemptCount < 3) {
				await sleep(2 ** context.attemptCount * 1000);
				return { shouldRetry: true, message: "Retrying after rate limit…" };
			}
			return {
				shouldRetry: false,
				message: "Service is busy. Please wait a moment and try again.",
			};

		case "tool_failure":
			return {
				shouldRetry: false,
				fallbackMode: "internal_only",
				message:
					"An integration couldn't complete that. You can try again or ask about workspace content only.",
			};

		case "context_too_large":
			return {
				shouldRetry: false,
				adjustments: { maxMessages: 20 },
				message:
					"That request was too long. Try a shorter message or start a new chat.",
			};

		case "authentication":
			return {
				shouldRetry: false,
				userAction: "reconnect_integration",
				message: "Please reconnect your integration in Settings and try again.",
			};

		default:
			return {
				shouldRetry: false,
				message: formatUserFriendlyError(error),
			};
	}
}
