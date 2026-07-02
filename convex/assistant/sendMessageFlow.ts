import { getAuthUserId } from "@convex-dev/auth/server";
import type { FunctionReference } from "convex/server";
import type OpenAI from "openai";
import OpenAIClient from "openai";
import { api, components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { getDatabaseChatConversation } from "./databaseChatConversation";
import { resolvePreflightContext } from "./preflightResolver";
import type { AssistantProfileRecord } from "./profile";
import { validateRelativeDueDateSelection } from "./relativeDate";
import {
	buildTaskDraftFailureMessage,
	formatPendingTaskDraftConfirmation,
	isPendingTaskCancellation,
	isPendingTaskConfirmation,
} from "./taskDrafts";
import { executeToolHandler, toOpenAIChatMessages } from "./toolExecutor";
import { resolveAssistantToolLoop } from "./toolLoop";
import {
	collectSourceRefsFromToolResult,
	createFallbackResponseFromToolResult,
	dedupeSourceRefs,
} from "./toolResults";

export type PendingTaskDraft = {
	title: string;
	description?: string;
	assigneeMemberId?: Id<"members">;
	assigneeUserId?: Id<"users">;
	assigneeName?: string;
	dueDate?: number;
	priority?: "low" | "medium" | "high";
	updatedAt: number;
};

export type SendMessageResult = {
	success: boolean;
	content?: string;
	error?: string;
};

export type SendMessageContext = {
	apiKey: string;
	resolvedWorkspaceId: Id<"workspaces">;
	resolvedUserId: Id<"users">;
	activeConversationId: string;
	pendingTaskDraft?: PendingTaskDraft;
};

type ToolHandlerType = "query" | "mutation" | "action";

export type SendMessageToolDefinition = {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, { type: string; description?: string }>;
		required?: string[];
	};
	handlerType: ToolHandlerType;
	handler: FunctionReference<"query" | "mutation" | "action", "public">;
	contextParams?: {
		needsWorkspaceId?: boolean;
		needsUserId?: boolean;
	};
};

type SendMessageArgs = {
	conversationId: string;
	message: string;
	workspaceId?: Id<"workspaces">;
	userId?: Id<"users">;
};

export async function prepareSendMessageContext(
	ctx: ActionCtx,
	args: SendMessageArgs
): Promise<SendMessageResult | SendMessageContext> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return { success: false, error: "OPENAI_API_KEY not configured" };
	}

	const conversationMeta = await ctx.runQuery(
		api.assistantConversations.getByConversationId,
		{ conversationId: args.conversationId }
	);

	const resolvedWorkspaceId =
		args.workspaceId ?? conversationMeta?.workspaceId ?? null;
	const resolvedUserId =
		args.userId ?? conversationMeta?.userId ?? (await getAuthUserId(ctx));

	if (!resolvedWorkspaceId || !resolvedUserId) {
		return {
			success: false,
			error: "Missing workspace or user context for this conversation.",
		};
	}

	let activeConversationId = args.conversationId;
	const existingConversation = await getDatabaseChatConversation(
		ctx,
		activeConversationId
	);

	if (!existingConversation) {
		activeConversationId = await ctx.runMutation(
			api.assistantChat.createConversation,
			{
				workspaceId: resolvedWorkspaceId,
				userId: resolvedUserId,
				title: "Assistant Chat",
				forceNew: true,
			}
		);
	}

	const latestConversationMeta = await ctx.runQuery(
		api.assistantConversations.getByWorkspaceAndUser,
		{
			workspaceId: resolvedWorkspaceId,
			userId: resolvedUserId,
		}
	);
	const pendingTaskDraft =
		latestConversationMeta?.conversationId === activeConversationId
			? latestConversationMeta.pendingTaskDraft
			: undefined;

	return {
		apiKey,
		resolvedWorkspaceId,
		resolvedUserId,
		activeConversationId,
		pendingTaskDraft,
	};
}

export async function recordSendMessageUsage(
	ctx: ActionCtx,
	context: SendMessageContext
) {
	const usageLimitCheck = await ctx.runQuery(
		internal.usageTracking.checkAIUsageLimit,
		{
			workspaceId: context.resolvedWorkspaceId,
			featureType: "aiRequest",
		}
	);
	if (!usageLimitCheck.allowed) {
		throw new Error("Limit reached. Upgrade your plan to continue.");
	}

	try {
		await ctx.runMutation(internal.usageTracking.recordAIRequest, {
			userId: context.resolvedUserId,
			workspaceId: context.resolvedWorkspaceId,
			featureType: "aiRequest",
		});
	} catch (error) {
		console.warn("[UsageTracking] Failed to record AI request:", error);
	}
}

export async function persistAssistantTurn(
	ctx: ActionCtx,
	context: SendMessageContext,
	responseText: string
) {
	await ctx.runMutation(components.databaseChat.messages.add, {
		conversationId: context.activeConversationId,
		role: "assistant",
		content: responseText,
	});
	await ctx.runMutation(api.assistantConversations.upsertConversation, {
		workspaceId: context.resolvedWorkspaceId,
		userId: context.resolvedUserId,
		conversationId: context.activeConversationId,
		lastMessageAt: Date.now(),
	});
}

async function handlePendingTaskConfirmation(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext
): Promise<SendMessageResult | null> {
	if (!context.pendingTaskDraft || !isPendingTaskConfirmation(args.message)) {
		return null;
	}

	const created = await ctx.runMutation(
		api.assistantConversations.createTaskFromPendingDraft,
		{
			workspaceId: context.resolvedWorkspaceId,
			userId: context.resolvedUserId,
		}
	);
	const assigneeSuffix =
		created.assigneeName?.trim() &&
		context.pendingTaskDraft.assigneeUserId !== context.resolvedUserId
			? ` for ${created.assigneeName.trim()}`
			: "";
	const responseText = `Created the task "${created.title}"${assigneeSuffix}.`;

	await persistAssistantTurn(ctx, context, responseText);
	return { success: true, content: responseText };
}

async function handlePendingTaskCancellation(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext
): Promise<SendMessageResult | null> {
	if (!context.pendingTaskDraft || !isPendingTaskCancellation(args.message)) {
		return null;
	}

	await ctx.runMutation(api.assistantConversations.clearPendingTaskDraft, {
		workspaceId: context.resolvedWorkspaceId,
		userId: context.resolvedUserId,
	});
	const responseText = "Canceled the pending task draft.";

	await persistAssistantTurn(ctx, context, responseText);
	return { success: true, content: responseText };
}

export async function processSendMessageEarlyPaths(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext
): Promise<SendMessageResult | null> {
	const confirmation = await handlePendingTaskConfirmation(ctx, args, context);
	if (confirmation) {
		return confirmation;
	}

	const cancellation = await handlePendingTaskCancellation(ctx, args, context);
	if (cancellation) {
		return cancellation;
	}

	return null;
}

export async function recordAssistantSignal(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext
): Promise<AssistantProfileRecord | null> {
	try {
		return await ctx.runMutation(api.assistantProfiles.recordSignal, {
			workspaceId: context.resolvedWorkspaceId,
			userId: context.resolvedUserId,
			message: args.message,
		});
	} catch (signalError) {
		console.warn("[Assistant] recordSignal failed (non-fatal):", signalError);
		return null;
	}
}

async function applySemanticSearchFallback(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext,
	collectedSourceRefs: string[],
	defaultResponseText: string
): Promise<string> {
	try {
		const search = await ctx.runAction(api.assistantTools.semanticSearch, {
			workspaceId: context.resolvedWorkspaceId,
			query: args.message,
			limit: 5,
		});
		const results: Array<{
			id: string;
			text: string;
			type: string;
			score: number;
			sourceRefs: string[];
		}> = search.results ?? [];

		if (!results.length) {
			return "I couldn't find anything relevant in your workspace yet.";
		}

		for (const result of results) {
			for (const ref of result.sourceRefs) {
				if (typeof ref === "string" && ref.trim()) {
					collectedSourceRefs.push(ref.trim());
				}
			}
		}

		const lines = results
			.slice(0, 5)
			.map((result, index) => {
				const text = String(result.text ?? "").trim();
				const snippet = text.length > 160 ? `${text.slice(0, 160)}…` : text;
				return `- (${index + 1}) ${snippet || "(no snippet)"}`;
			})
			.join("\n");
		return `I found a few relevant items:\n${lines}`.trim();
	} catch (fallbackError) {
		console.error(
			"[Assistant] Semantic search fallback failed",
			fallbackError,
			{
				conversationId: args.conversationId,
				messageSummary: createSafeMessageSummary(args.message),
			}
		);
		return defaultResponseText;
	}
}

function createSafeMessageSummary(message: string): string {
	const trimmed = message.trim();
	let hash = 0;
	for (let i = 0; i < trimmed.length; i++) {
		hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
	}
	return `len=${trimmed.length},hash=${hash.toString(16)}`;
}

type AssistantToolCall = {
	id: string;
	type?: string;
	function?: {
		name: string;
		arguments: string;
	};
};

function buildExecuteToolCall(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext,
	toolDefinitions: SendMessageToolDefinition[]
) {
	return async (toolCall: AssistantToolCall) => {
		const toolName = toolCall.function?.name ?? "";
		const tool = toolDefinitions.find((entry) => entry.name === toolName);
		if (!tool) {
			return {
				result: {
					success: false,
					error: `Unknown tool: ${toolName}`,
				},
				fallbackText: null,
				sourceRefs: [],
			};
		}

		try {
			const parsedArgs = JSON.parse(toolCall.function?.arguments ?? "{}");
			const fullArgs: Record<string, unknown> = { ...parsedArgs };

			if (toolName === "draftTaskForConfirmation") {
				const relativeDateValidation = validateRelativeDueDateSelection({
					message: args.message,
					dueDate:
						typeof fullArgs.dueDate === "number" ? fullArgs.dueDate : undefined,
				});
				if (relativeDateValidation) {
					return {
						result: {
							success: false,
							error: relativeDateValidation,
						},
						sourceRefs: [],
						fallbackText: relativeDateValidation,
					};
				}
			}

			if (tool.contextParams?.needsWorkspaceId) {
				fullArgs.workspaceId = context.resolvedWorkspaceId;
			}
			if (tool.contextParams?.needsUserId) {
				fullArgs.userId = context.resolvedUserId;
			}

			const result = await executeToolHandler(
				ctx,
				tool.handlerType,
				tool.handler,
				fullArgs
			);

			return {
				result,
				sourceRefs: collectSourceRefsFromToolResult(toolName, result),
				fallbackText: createFallbackResponseFromToolResult(toolName, result),
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Tool execution failed";
			return {
				result: {
					success: false,
					error: message,
				},
				sourceRefs: [],
				fallbackText:
					toolName === "draftTaskForConfirmation"
						? buildTaskDraftFailureMessage(message)
						: `I hit an issue while using ${toolName}. Please try again.`,
			};
		}
	};
}

type RunSendMessageCompletionOptions = {
	buildSystemPrompt: (options?: {
		hasPendingTaskDraft?: boolean;
		pendingTaskDraftSummary?: string;
		pendingTaskDraftAssigneeMemberId?: string;
		pendingTaskDraftAssigneeName?: string;
		preflightContext?: string;
		assistantProfile?: AssistantProfileRecord;
	}) => string;
	toolDefinitions: SendMessageToolDefinition[];
};

export type RunSendMessageCompletionResult =
	| { kind: "early"; responseText: string }
	| { kind: "complete"; responseText: string; streamId: string };

export async function runSendMessageCompletion(
	ctx: ActionCtx,
	args: SendMessageArgs,
	context: SendMessageContext,
	assistantProfile: AssistantProfileRecord | null,
	options: RunSendMessageCompletionOptions
): Promise<RunSendMessageCompletionResult> {
	const rawMessages = await ctx.runQuery(
		components.databaseChat.messages.list,
		{
			conversationId: context.activeConversationId,
		}
	);
	const preflightContext = await resolvePreflightContext({
		ctx,
		workspaceId: context.resolvedWorkspaceId,
		userId: context.resolvedUserId,
		message: args.message,
	});

	if (preflightContext.earlyResponse) {
		await persistAssistantTurn(ctx, context, preflightContext.earlyResponse);
		return { kind: "early", responseText: preflightContext.earlyResponse };
	}

	const messages = [
		{
			role: "system",
			content: options.buildSystemPrompt({
				hasPendingTaskDraft: Boolean(context.pendingTaskDraft),
				pendingTaskDraftSummary: context.pendingTaskDraft
					? formatPendingTaskDraftConfirmation(context.pendingTaskDraft)
					: undefined,
				pendingTaskDraftAssigneeMemberId:
					context.pendingTaskDraft?.assigneeMemberId,
				pendingTaskDraftAssigneeName: context.pendingTaskDraft?.assigneeName,
				preflightContext: preflightContext.promptText,
				assistantProfile: assistantProfile ?? undefined,
			}),
		},
		...rawMessages.map((message) => ({
			role: message.role,
			content: message.content,
		})),
	];

	const openai = new OpenAIClient({
		apiKey: context.apiKey,
	});
	const openaiTools: OpenAI.Chat.ChatCompletionTool[] =
		options.toolDefinitions.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
			},
		}));

	const completion = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
		tools: openaiTools,
		temperature: 0.7,
		max_tokens: 2000,
	});

	const streamId = await ctx.runMutation(
		(components.databaseChat.stream as any).create,
		{
			conversationId: context.activeConversationId,
		}
	);

	let responseText =
		completion.choices[0]?.message?.content ||
		"I couldn't find anything relevant yet.";
	const toolCalls = completion.choices[0]?.message?.tool_calls;
	const collectedSourceRefs: string[] = [...preflightContext.sourceRefs];

	const shouldRunSemanticFallback =
		!completion.choices[0]?.message?.content?.trim() &&
		(!toolCalls || toolCalls.length === 0);

	if (shouldRunSemanticFallback) {
		responseText = await applySemanticSearchFallback(
			ctx,
			args,
			context,
			collectedSourceRefs,
			responseText
		);
	}

	if (toolCalls && toolCalls.length > 0) {
		const loopResult = await resolveAssistantToolLoop({
			initialAssistantMessage: completion.choices[0].message,
			baseMessages: messages as Array<{
				role: "system" | "user" | "assistant";
				content: string;
			}>,
			initialResponseText: responseText,
			createCompletion: async (followUpMessages) => {
				const followUpCompletion = await openai.chat.completions.create({
					model: "gpt-4o-mini",
					messages: toOpenAIChatMessages(followUpMessages),
					tools: openaiTools,
					temperature: 0.7,
					max_tokens: 2000,
				});

				return followUpCompletion.choices[0]?.message ?? {};
			},
			executeToolCall: buildExecuteToolCall(
				ctx,
				args,
				context,
				options.toolDefinitions
			),
		});

		for (const ref of loopResult.sourceRefs) {
			collectedSourceRefs.push(ref);
		}
		responseText = loopResult.responseText;
	}

	if (collectedSourceRefs.length) {
		const unique = dedupeSourceRefs(collectedSourceRefs).slice(0, 5);
		responseText = `${responseText.trim()}\n\nSources:\n${unique
			.map((source) => `- ${source}`)
			.join("\n")}`.trim();
	}

	return { kind: "complete", responseText, streamId };
}

export async function finalizeSendMessageSuccess(
	ctx: ActionCtx,
	context: SendMessageContext,
	responseText: string,
	streamId: string
): Promise<SendMessageResult> {
	await ctx.runMutation((components.databaseChat.stream as any).finish, {
		streamId,
	});
	await persistAssistantTurn(ctx, context, responseText);
	await ctx.scheduler.runAfter(
		0,
		internal.assistantTitles.autoGenerateTitleIfNeeded,
		{
			conversationId: context.activeConversationId,
			workspaceId: context.resolvedWorkspaceId,
			userId: context.resolvedUserId,
		}
	);

	return { success: true, content: responseText };
}

export async function handleSendMessageFailure(
	ctx: ActionCtx,
	context: SendMessageContext,
	streamId: string | null,
	error: unknown,
	_args: SendMessageArgs
): Promise<SendMessageResult> {
	console.error("[Assistant] Error:", error);

	if (streamId) {
		try {
			await ctx.runMutation((components.databaseChat.stream as any).finish, {
				streamId,
			});
		} catch (streamError) {
			console.warn(
				"[Assistant] Failed to close stream after error:",
				streamError
			);
		}
	}

	try {
		const responseText =
			error instanceof Error
				? buildTaskDraftFailureMessage(error.message)
				: "I ran into an issue while processing that request. Please try again.";
		await persistAssistantTurn(ctx, context, responseText);
	} catch (persistError) {
		console.warn("[Assistant] Failed to persist error response:", persistError);
	}

	return {
		success: false,
		error: error instanceof Error ? error.message : "Unknown error",
	};
}
