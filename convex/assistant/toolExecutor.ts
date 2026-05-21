import type { FunctionReference } from "convex/server";
import type OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";

type ToolHandlerType = "query" | "mutation" | "action";

export function executeToolHandler(
	ctx: ActionCtx,
	handlerType: ToolHandlerType,
	handler: FunctionReference<"query" | "mutation" | "action", "public">,
	args: Record<string, unknown>
): Promise<unknown> {
	if (handlerType === "query") {
		return ctx.runQuery(handler as FunctionReference<"query", "public">, args);
	}
	if (handlerType === "mutation") {
		return ctx.runMutation(
			handler as FunctionReference<"mutation", "public">,
			args
		);
	}
	return ctx.runAction(handler as FunctionReference<"action", "public">, args);
}

export function toOpenAIChatMessages(
	messages: Array<{
		role: string;
		content: string | null;
		tool_calls?: Array<{
			id: string;
			type?: string;
			function?: { name: string; arguments: string };
		}>;
		tool_call_id?: string;
	}>
): OpenAI.Chat.ChatCompletionMessageParam[] {
	return messages.map((message, index) => {
		switch (message.role) {
			case "system":
			case "user": {
				if (typeof message.content !== "string") {
					throw new Error(
						`Invalid chat message at index ${index}: ${message.role} messages require string content.`
					);
				}
				return {
					role: message.role,
					content: message.content,
				};
			}
			case "assistant": {
				const hasStringContent = typeof message.content === "string";
				const toolCalls = message.tool_calls?.map((toolCall, toolIndex) => {
					if (
						typeof toolCall?.id !== "string" ||
						!toolCall.id.trim() ||
						typeof toolCall?.function?.name !== "string" ||
						!toolCall.function.name.trim() ||
						typeof toolCall?.function?.arguments !== "string"
					) {
						throw new Error(
							`Invalid chat message at index ${index}: assistant tool_calls[${toolIndex}] must include id, function.name, and function.arguments strings.`
						);
					}
					return {
						id: toolCall.id,
						type: "function" as const,
						function: {
							name: toolCall.function.name,
							arguments: toolCall.function.arguments,
						},
					};
				});
				if (!hasStringContent && !toolCalls?.length) {
					throw new Error(
						`Invalid chat message at index ${index}: assistant messages require string content or valid tool_calls.`
					);
				}
				const assistantMessage: OpenAI.Chat.ChatCompletionAssistantMessageParam =
					{
						role: "assistant",
					};
				if (hasStringContent) {
					assistantMessage.content = message.content;
				} else if (message.content === null) {
					assistantMessage.content = null;
				}
				if (toolCalls?.length) {
					assistantMessage.tool_calls = toolCalls;
				}
				return assistantMessage;
			}
			case "tool": {
				if (typeof message.content !== "string") {
					throw new Error(
						`Invalid chat message at index ${index}: tool messages require string content.`
					);
				}
				if (
					typeof message.tool_call_id !== "string" ||
					!message.tool_call_id.trim()
				) {
					throw new Error(
						`Invalid chat message at index ${index}: tool messages require a tool_call_id string.`
					);
				}
				return {
					role: "tool",
					content: message.content,
					tool_call_id: message.tool_call_id,
				};
			}
			default:
				throw new Error(
					`Invalid chat message at index ${index}: unsupported role "${message.role}".`
				);
		}
	});
}
