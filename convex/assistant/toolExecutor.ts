import type { FunctionReference } from "convex/server";
import type OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";

type ToolHandlerType = "query" | "mutation" | "action";

export async function executeToolHandler(
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
	return messages as OpenAI.Chat.ChatCompletionMessageParam[];
}
