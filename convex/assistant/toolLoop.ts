type ToolCall = {
	id: string;
	type?: string;
	function?: {
		name: string;
		arguments: string;
	};
};

type AssistantMessage = {
	content?: string | null;
	tool_calls?: ToolCall[] | null;
};

type ConversationMessage =
	| {
			role: "system" | "user";
			content: string;
	  }
	| {
			role: "assistant";
			content: string | null;
			tool_calls?: ToolCall[];
	  }
	| { role: "tool"; tool_call_id: string; content: string };

type ToolExecutionResult = {
	result: unknown;
	sourceRefs?: string[];
	fallbackText?: string | null;
};

type ResolveAssistantToolLoopOptions = {
	initialAssistantMessage: AssistantMessage;
	baseMessages: ConversationMessage[];
	createCompletion: (messages: ConversationMessage[]) => Promise<AssistantMessage>;
	executeToolCall: (toolCall: ToolCall) => Promise<ToolExecutionResult>;
	initialResponseText: string;
	maxIterations?: number;
};

export type ResolveAssistantToolLoopResult = {
	responseText: string;
	sourceRefs: string[];
	executedTools: Array<{
		name: string;
		args: Record<string, unknown>;
	}>;
};

export async function resolveAssistantToolLoop(
	options: ResolveAssistantToolLoopOptions
): Promise<ResolveAssistantToolLoopResult> {
	const sourceRefs: string[] = [];
	const executedTools: Array<{
		name: string;
		args: Record<string, unknown>;
	}> = [];
	let responseText = options.initialResponseText;
	let assistantMessage = options.initialAssistantMessage;
	let workingMessages = [...options.baseMessages];
	const maxIterations = options.maxIterations ?? 5;

	for (let iteration = 0; iteration < maxIterations; iteration += 1) {
		const toolCalls = Array.isArray(assistantMessage.tool_calls)
			? assistantMessage.tool_calls.filter(
					(toolCall) => toolCall?.type === "function" && toolCall.function
				)
			: [];

		if (toolCalls.length === 0) {
			const content = assistantMessage.content?.trim();
			if (content) {
				responseText = content;
			}
			break;
		}

		const assistantContent = assistantMessage.content?.trim() ?? "";
		workingMessages = [
			...workingMessages,
			{
				role: "assistant",
				content: assistantContent || null,
				tool_calls: toolCalls,
			},
		];

		let latestFallbackText: string | null = null;
		const toolMessages: ConversationMessage[] = [];

		for (const toolCall of toolCalls) {
			const toolName = toolCall.function?.name ?? "unknownTool";
			let parsedArgs: Record<string, unknown>;
			try {
				parsedArgs = JSON.parse(toolCall.function?.arguments ?? "{}");
			} catch {
				parsedArgs = {};
			}

			executedTools.push({ name: toolName, args: parsedArgs });

			const executionResult = await options.executeToolCall(toolCall);
			for (const sourceRef of executionResult.sourceRefs ?? []) {
				sourceRefs.push(sourceRef);
			}
			if (executionResult.fallbackText?.trim()) {
				latestFallbackText = executionResult.fallbackText.trim();
			}

			toolMessages.push({
				role: "tool",
				tool_call_id: toolCall.id,
				content: JSON.stringify(executionResult.result ?? null),
			});
		}

		workingMessages = [...workingMessages, ...toolMessages];
		assistantMessage = await options.createCompletion(workingMessages);

		const nextContent = assistantMessage.content?.trim();
		if (nextContent) {
			responseText = nextContent;
		} else if (latestFallbackText) {
			responseText = latestFallbackText;
		}
	}

	return {
		responseText,
		sourceRefs,
		executedTools,
	};
}
