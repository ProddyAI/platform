export type UserConfirmationDecision = "confirm" | "cancel" | "none";

const HIGH_IMPACT_ACTION_PATTERN =
	/\b(send|delete|archive|merge|permission|permissions|grant|revoke)\b/i;

const CONFIRMATION_PATTERN =
	/^\s*(confirm|confirmed|i confirm|approve|approved|proceed|go ahead|yes[,\s]+proceed)\b/i;

const CANCELLATION_PATTERN =
	/^\s*(cancel|stop|abort|never\s*mind|do\s*not\s*proceed|don'?t\s*proceed)\b/i;

function normalizeToolName(toolName: string): string {
	return toolName.replace(/[_-]+/g, " ").toLowerCase();
}

export function isHighImpactToolName(toolName: string): boolean {
	return HIGH_IMPACT_ACTION_PATTERN.test(normalizeToolName(toolName));
}

export function getHighImpactToolNames(toolCalls: Array<any>): string[] {
	const highImpact = toolCalls
		.map((toolCall) => toolCall.function?.name)
		.filter((name): name is string => Boolean(name))
		.filter((name) => isHighImpactToolName(name));

	return [...new Set(highImpact)];
}

export function getUserConfirmationDecision(
	message: string
): UserConfirmationDecision {
	if (CANCELLATION_PATTERN.test(message)) {
		return "cancel";
	}
	if (CONFIRMATION_PATTERN.test(message)) {
		return "confirm";
	}
	return "none";
}

export function buildConfirmationRequiredMessage(toolNames: string[]): string {
	const actionList = toolNames.join(", ");
	return `This request includes a high-impact external action (${actionList}). Reply with "confirm" to proceed, or "cancel" to stop. No changes were made.`;
}

export function buildCancellationMessage(toolNames: string[]): string {
	const actionList = toolNames.join(", ");
	return `Cancelled high-impact external action (${actionList}). No changes were made.`;
}
