export const ASSISTANT_METADATA_SCHEMA_VERSION = "v1";

export type AssistantExternalApp =
	| "GMAIL"
	| "GITHUB"
	| "SLACK"
	| "NOTION"
	| "CLICKUP"
	| "LINEAR";

export type AssistantExecutionPath =
	| "convex-assistant"
	| "nextjs-openai-composio";

export type AssistantQueryMode = "internal" | "external" | "hybrid";

export type AssistantResponseMetadata = {
	schemaVersion: typeof ASSISTANT_METADATA_SCHEMA_VERSION;
	assistantType: "convex" | "openai-composio";
	executionPath: AssistantExecutionPath;
	intent: {
		mode: AssistantQueryMode;
		requiresExternalTools: boolean;
		requestedExternalApps: AssistantExternalApp[];
	};
	tools: {
		internalEnabled: boolean;
		externalEnabled: boolean;
		externalUsed: boolean;
		connectedApps: string[];
	};
	fallback: {
		attempted: boolean;
		reason: string | null;
	};
};

export type AssistantIntent = {
	mode: AssistantQueryMode;
	requiresExternalTools: boolean;
	requestedExternalApps: AssistantExternalApp[];
};

const EXTERNAL_APP_PATTERNS: Array<{
	app: AssistantExternalApp;
	pattern: RegExp;
}> = [
	{
		app: "GMAIL",
		pattern:
			/\b(gmail|send\s+email|email\s+to|in\s+gmail|my\s+inbox|draft\s+email)\b/i,
	},
	{
		app: "GITHUB",
		pattern:
			/\b(github|github\s+(repo|issue|pr|commit)|in\s+github|on\s+github)\b/i,
	},
	{
		app: "SLACK",
		pattern:
			/\b(slack|slack\s+(message|channel)|in\s+slack|on\s+slack|send\s+to\s+slack)\b/i,
	},
	{
		app: "NOTION",
		pattern:
			/\b(notion|notion\s+(page|database)|in\s+notion|on\s+notion|my\s+notion)\b/i,
	},
	{
		app: "CLICKUP",
		pattern:
			/\b(clickup|clickup\s+(task|project)|in\s+clickup|on\s+clickup|my\s+clickup)\b/i,
	},
	{
		app: "LINEAR",
		pattern:
			/\b(linear|linear\s+(issue|ticket)|in\s+linear|on\s+linear|my\s+linear)\b/i,
	},
];

const INTERNAL_SIGNAL_PATTERN =
	/\b(workspace|channel|message|calendar|meeting|task|board|card|note|summary|search|assigned|today|tomorrow|next week)\b/i;

const BASE_SYSTEM_PROMPT = `You are Proddy, a personal work assistant for team workspaces.

Your role:
- Help users manage their calendar, meetings, tasks, and workspace activities
- Provide summaries of channels and conversations
- Answer questions about workspace data
- Be concise, actionable, and friendly

Guidelines:
- Use available tools for real-time data when needed
- Format responses with clear headings and bullet points
- When showing dates/times, use readable formats
- If you don't have information, say so clearly
- Never invent data; only use tool outputs and user-provided context`;

export function classifyAssistantQuery(message: string): AssistantIntent {
	const normalized = message.toLowerCase();
	const requestedExternalApps = EXTERNAL_APP_PATTERNS.filter(({ pattern }) =>
		pattern.test(normalized)
	).map(({ app }) => app);
	const uniqueRequestedExternalApps = [...new Set(requestedExternalApps)];
	const requiresExternalTools = uniqueRequestedExternalApps.length > 0;
	const hasInternalSignal = INTERNAL_SIGNAL_PATTERN.test(normalized);
	const mode: AssistantQueryMode = requiresExternalTools
		? hasInternalSignal
			? "hybrid"
			: "external"
		: "internal";

	return {
		mode,
		requiresExternalTools,
		requestedExternalApps: uniqueRequestedExternalApps,
	};
}

export function buildAssistantSystemPrompt(options?: {
	workspaceContext?: string;
	connectedApps?: string[];
	externalToolsAllowed?: boolean;
}): string {
	const connectedApps = options?.connectedApps ?? [];
	const externalToolsAllowed = options?.externalToolsAllowed ?? false;
	const policyLine = externalToolsAllowed
		? connectedApps.length > 0
			? `External tool policy: external actions are allowed only for connected apps: ${connectedApps.join(", ")}.`
			: "External tool policy: external actions are allowed but no connected apps are available. Explain the required connection step before continuing."
		: "External tool policy: do not use external integration tools for this request; respond using workspace/internal capabilities only.";

	const contextLine = options?.workspaceContext?.trim()
		? `Workspace context: ${options.workspaceContext.trim()}`
		: "";

	return [BASE_SYSTEM_PROMPT, policyLine, contextLine]
		.filter(Boolean)
		.join("\n\n");
}

export function buildAssistantResponseMetadata(input: {
	assistantType: AssistantResponseMetadata["assistantType"];
	executionPath: AssistantExecutionPath;
	intent: AssistantIntent;
	tools: AssistantResponseMetadata["tools"];
	fallback?: AssistantResponseMetadata["fallback"];
}): AssistantResponseMetadata {
	return {
		schemaVersion: ASSISTANT_METADATA_SCHEMA_VERSION,
		assistantType: input.assistantType,
		executionPath: input.executionPath,
		intent: {
			mode: input.intent.mode,
			requiresExternalTools: input.intent.requiresExternalTools,
			requestedExternalApps: input.intent.requestedExternalApps,
		},
		tools: input.tools,
		fallback: input.fallback ?? {
			attempted: false,
			reason: null,
		},
	};
}
