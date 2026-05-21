import type { Composio } from "@composio/core";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { api } from "@/../convex/_generated/api";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { buildAssistantSystemPrompt } from "@/lib/assistant-orchestration";
import {
	type AvailableApp,
	createComposioClient,
	filterToolsForQuery,
	getAllToolsForApps,
	getWorkspaceEntityId,
} from "@/lib/composio-config";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CONTROL_CHARS_PATTERN = "[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]";
const CONTROL_CHARS_REGEX = new RegExp(CONTROL_CHARS_PATTERN, "g");
const SOURCES_HEADING = "\nSources:\n";

type AssistantSource = {
	id: string;
	type: string;
	text: string;
};

type ToolkitKey =
	| "GMAIL"
	| "GITHUB"
	| "SLACK"
	| "NOTION"
	| "CLICKUP"
	| "LINEAR";

type IntegrationDetection = {
	needsExternalTools: boolean;
	selectedToolkit: ToolkitKey | "";
};

type ConnectedAccountRow = {
	status?: string;
	toolkit?: string;
	userId?: string;
};

type ComposioContext = {
	useComposio: boolean;
	connectedApps: AvailableApp[];
	composioTools: any[];
	composioClient: Composio<any> | null;
	userId: string;
};

const TOOLKIT_PATTERNS: Array<{ key: ToolkitKey; pattern: RegExp }> = [
	{
		key: "GMAIL",
		pattern:
			/\b(gmail|send\s+email|email\s+to|in\s+gmail|my\s+inbox|draft\s+email)\b/i,
	},
	{
		key: "GITHUB",
		pattern:
			/\b(github|github\s+(repo|repos|repository|repositories|issue|pr|commit)|in\s+github|on\s+github|my\s+(github\s+)?(repo|repos|repository|repositories))\b/i,
	},
	{
		key: "SLACK",
		pattern:
			/\b(slack|slack\s+(message|channel)|in\s+slack|on\s+slack|send\s+to\s+slack)\b/i,
	},
	{
		key: "NOTION",
		pattern:
			/\b(notion|notion\s+(page|database)|in\s+notion|on\s+notion|my\s+notion)\b/i,
	},
	{
		key: "CLICKUP",
		pattern:
			/\b(clickup|clickup\s+(task|project)|in\s+clickup|on\s+clickup|my\s+clickup)\b/i,
	},
	{
		key: "LINEAR",
		pattern:
			/\b(linear|linear\s+(issue|ticket)|in\s+linear|on\s+linear|my\s+linear)\b/i,
	},
];

function truncateIdentifier(value: unknown, maxLength = 24) {
	const normalized = String(value ?? "").trim();
	if (!normalized) return undefined;
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength)}...`
		: normalized;
}

function sanitizeToolResult(result: unknown): Record<string, unknown> {
	if (Array.isArray(result)) {
		return {
			kind: "array",
			count: result.length,
			items: result.slice(0, 3).map((item) => sanitizeToolResult(item)),
		};
	}

	if (!result || typeof result !== "object") {
		return {
			kind: typeof result,
			present: result !== undefined && result !== null,
		};
	}

	const record = result as Record<string, unknown>;
	return {
		kind: "object",
		status: typeof record.status === "string" ? record.status : undefined,
		type: typeof record.type === "string" ? record.type : undefined,
		id: truncateIdentifier(record.id),
		keys: Object.keys(record).slice(0, 8),
		itemCount: Array.isArray(record.items) ? record.items.length : undefined,
		resultCount: Array.isArray(record.results)
			? record.results.length
			: undefined,
	};
}

function inferSourceType(sourceText: string) {
	const prefix = sourceText.split(":")[0]?.trim().toLowerCase();
	switch (prefix) {
		case "task":
			return "task";
		case "note":
			return "note";
		case "message":
		case "channel messages":
			return "message";
		case "board card":
			return "card";
		case "calendar event":
			return "event";
		case "channel":
			return "channel";
		default:
			return "source";
	}
}

function parseAssistantResponse(content: string): {
	body: string;
	sources: AssistantSource[];
} {
	const markerIndex = content.lastIndexOf(SOURCES_HEADING);
	if (markerIndex < 0) {
		return { body: content, sources: [] };
	}

	const body = content.slice(0, markerIndex).trimEnd();
	const sources = content
		.slice(markerIndex + SOURCES_HEADING.length)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- "))
		.map((line) => line.slice(2).trim())
		.filter(Boolean)
		.map((sourceText, index) => ({
			id: `source-${index}-${sourceText}`,
			type: inferSourceType(sourceText),
			text: sourceText,
		}));

	return { body, sources };
}

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

function createOpenAIClient(): OpenAI {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY environment variable is required");
	}
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});
}

function applyConvexAuth(convex: ConvexHttpClient) {
	try {
		const token = convexAuthNextjsToken();
		if (token) {
			convex.setAuth(token);
			return;
		}
		if (isAuthenticatedNextjs()) {
			console.warn(
				"[Chatbot Assistant] Authenticated session but no Convex token found"
			);
		}
	} catch (err) {
		if (isAuthenticatedNextjs()) {
			console.warn(
				"[Chatbot Assistant] Failed to read Convex auth token from request",
				err
			);
		}
	}
}

async function verifyMemberOwnership(
	convex: ConvexHttpClient,
	memberId: string,
	currentUser: Doc<"users"> | null
): Promise<NextResponse | null> {
	const isAuthenticated = await isAuthenticatedNextjs();
	if (!isAuthenticated) {
		return NextResponse.json(
			{ error: "Authentication required when specifying memberId" },
			{ status: 401 }
		);
	}

	const token = await convexAuthNextjsToken();
	if (token && typeof token === "string") {
		convex.setAuth(token);
	}
	if (!currentUser) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	const member = await convex.query(api.members.getMemberById, {
		memberId: memberId as Id<"members">,
	});

	if (!member) {
		return NextResponse.json({ error: "Member not found" }, { status: 404 });
	}

	if (member.userId !== currentUser._id) {
		return NextResponse.json(
			{
				error:
					"Unauthorized: Cannot access integrations for another user's member",
			},
			{ status: 403 }
		);
	}
	return null;
}

function detectIntegrationNeed(message: string): IntegrationDetection {
	const queryLower = message.toLowerCase();
	const match = TOOLKIT_PATTERNS.find(({ pattern }) =>
		pattern.test(queryLower)
	);
	return {
		needsExternalTools: Boolean(match),
		selectedToolkit: match?.key ?? "",
	};
}

async function prepareComposioContext(
	convex: ConvexHttpClient,
	workspaceId: string,
	memberId: string | undefined,
	message: string,
	detection: IntegrationDetection
): Promise<ComposioContext> {
	const empty: ComposioContext = {
		useComposio: false,
		connectedApps: [],
		composioTools: [],
		composioClient: null,
		userId: "",
	};

	if (!detection.needsExternalTools || !process.env.COMPOSIO_API_KEY) {
		return empty;
	}

	try {
		const composioClient = createComposioClient();
		let userId = memberId
			? `member_${memberId}`
			: getWorkspaceEntityId(workspaceId);

		const dbAccounts = (await convex.query(
			api.integrations.getConnectedAccountsPublic,
			{
				workspaceId: workspaceId as Id<"workspaces">,
				memberId: memberId ? (memberId as Id<"members">) : undefined,
			}
		)) as ConnectedAccountRow[];

		const activeAccounts = dbAccounts.filter((acc) => acc.status === "ACTIVE");
		if (activeAccounts.length === 0) return empty;

		const normalizedToolkits = activeAccounts.flatMap((acc) => {
			const toolkit =
				typeof acc?.toolkit === "string" ? acc.toolkit.trim() : "";
			return toolkit ? [toolkit.toUpperCase()] : [];
		});
		const connectedApps = [...new Set(normalizedToolkits)] as AvailableApp[];

		const matchingAccount = detection.selectedToolkit
			? activeAccounts.find(
					(acc) =>
						(acc.toolkit ?? "").trim().toUpperCase() ===
						detection.selectedToolkit
				)
			: undefined;
		const accountForTools = matchingAccount ?? activeAccounts[0];
		if (accountForTools?.userId) {
			userId = accountForTools.userId;
		}

		if (connectedApps.length === 0) return empty;

		const allTools = await getAllToolsForApps(
			composioClient,
			userId,
			connectedApps
		);
		const composioTools = filterToolsForQuery(allTools, message, {
			maxTools: 20,
			preferDashboard: true,
		});

		return {
			useComposio: composioTools.length > 0,
			connectedApps,
			composioTools,
			composioClient,
			userId,
		};
	} catch (_error) {
		console.warn(
			"[Chatbot Assistant] Composio initialization failed, using Convex fallback"
		);
		return empty;
	}
}

function sanitizeConversationHistory(history: any) {
	return (history || [])
		.filter(
			(msg: any) =>
				msg &&
				["user", "assistant"].includes(msg.role) &&
				typeof msg.content === "string"
		)
		.map((msg: any) => ({
			role: msg.role as "user" | "assistant",
			content: msg.content.replace(CONTROL_CHARS_REGEX, "").trim(),
		}));
}

type ToolExecutionResult = {
	responseText: string;
	toolResults: any[];
	sources: AssistantSource[];
};

async function executeToolCallsAndFollowUp(
	openai: OpenAI,
	composioClient: Composio<any>,
	userId: string,
	completion: OpenAI.Chat.ChatCompletion,
	messages: OpenAI.Chat.ChatCompletionMessageParam[],
	fallbackText: string
): Promise<ToolExecutionResult> {
	const toolCalls = (completion.choices[0]?.message?.tool_calls ?? []) as any[];
	try {
		console.log(
			`[Chatbot] Executing ${toolCalls.length} tool calls with entityId: ${userId}`
		);
		const result = await composioClient.provider.handleToolCalls(
			userId,
			completion
		);
		logger.info("[Chatbot] Tool results summary", sanitizeToolResult(result));

		const toolResults = Array.isArray(result) ? result : [result];
		const sources: AssistantSource[] = toolCalls.map((call, idx) => ({
			id: `tool-${idx}`,
			type: "tool",
			text: `${call.function?.name || "Tool"} executed`,
		}));

		const resultMap: Record<string, any> = {};
		toolCalls.forEach((call, idx) => {
			resultMap[call.id] = toolResults[idx] ?? { success: true };
		});

		if (toolCalls.length !== toolResults.length) {
			console.warn(
				`[Chatbot Assistant] Tool calls and results count mismatch: ${toolCalls.length} calls, ${toolResults.length} results`
			);
		}

		const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			...messages,
			completion.choices[0].message,
			...toolCalls.map((call) => ({
				role: "tool" as const,
				tool_call_id: call.id,
				content: JSON.stringify(resultMap[call.id]),
			})),
		];

		const followUpCompletion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: followUpMessages,
			temperature: 0.7,
			max_tokens: 1500,
		});

		return {
			responseText:
				followUpCompletion.choices[0]?.message?.content || fallbackText,
			toolResults,
			sources,
		};
	} catch (toolError) {
		console.error("[Chatbot Assistant] Tool execution failed:", toolError);
		console.error("[Chatbot Assistant] userId used:", userId);
		return {
			responseText: `${fallbackText}\n\nNote: Some operations could not be completed. Please try again or check your integration settings.`,
			toolResults: [],
			sources: [],
		};
	}
}

async function runOpenAIComposioPath(params: {
	convex: ConvexHttpClient;
	context: ComposioContext;
	currentUser: Doc<"users"> | null;
	workspaceId: string;
	message: string;
	workspaceContext: unknown;
	conversationHistory: unknown;
}): Promise<NextResponse | null> {
	const {
		convex,
		context,
		currentUser,
		workspaceId,
		message,
		workspaceContext,
		conversationHistory,
	} = params;
	try {
		const openai = createOpenAIClient();
		const sanitizedHistory = sanitizeConversationHistory(conversationHistory);
		const assistantProfile = currentUser
			? await convex.mutation(api.assistantProfiles.recordSignal, {
					workspaceId: workspaceId as Id<"workspaces">,
					userId: currentUser._id,
					message,
				})
			: null;

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: "system",
				content: buildAssistantSystemPrompt({
					workspaceContext:
						typeof workspaceContext === "string" ? workspaceContext : "",
					connectedApps: context.connectedApps,
					externalToolsAllowed: true,
					conversationHistory: sanitizedHistory,
					latestUserMessage: message,
					assistantProfile: assistantProfile ?? undefined,
				}),
			},
			...sanitizedHistory,
			{ role: "user", content: message },
		];

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			tools: context.composioTools,
			messages,
			temperature: 0.7,
			max_tokens: 1500,
		});

		const initialResponseText =
			completion.choices[0]?.message?.content ||
			"I couldn't find anything relevant yet.";
		const toolCalls = completion.choices[0]?.message?.tool_calls ?? [];

		const { responseText, toolResults, sources } =
			toolCalls.length > 0
				? await executeToolCallsAndFollowUp(
						openai,
						context.composioClient as Composio<any>,
						context.userId,
						completion,
						messages,
						initialResponseText
					)
				: {
						responseText: initialResponseText,
						toolResults: [] as any[],
						sources: [] as AssistantSource[],
					};

		return NextResponse.json({
			success: true,
			response: responseText,
			sources,
			actions: [],
			toolResults,
			assistantType: "openai-composio",
			composioToolsUsed: true,
			connectedApps: context.connectedApps,
		});
	} catch (error) {
		console.error(
			"[Chatbot Assistant] OpenAI+Composio failed, falling back to Convex:",
			error
		);
		return null;
	}
}

async function recordAIUsage(convex: ConvexHttpClient, workspaceId: string) {
	try {
		await convex.mutation(api.usageTracking.recordAIRequestPublic, {
			workspaceId: workspaceId as Id<"workspaces">,
			featureType: "aiRequest",
		});
	} catch (trackErr) {
		console.warn("[UsageTracking] Failed to record AI request:", trackErr);
	}
}

async function runConvexAssistantPath(params: {
	convex: ConvexHttpClient;
	currentUser: Doc<"users"> | null;
	workspaceId: string;
	message: string;
}): Promise<NextResponse> {
	const { convex, currentUser, workspaceId, message } = params;
	try {
		if (!currentUser) {
			return NextResponse.json(
				{ success: false, error: "User not authenticated" },
				{ status: 401 }
			);
		}

		const conversationId = await convex.mutation(
			api.assistantChat.createConversation,
			{
				workspaceId: workspaceId as Id<"workspaces">,
				userId: currentUser._id,
				title: "Assistant Chat",
			}
		);

		const result = await convex.action(api.assistantChat.sendMessage, {
			conversationId,
			message,
			workspaceId: workspaceId as Id<"workspaces">,
			userId: currentUser._id,
		});

		if (!result.success) {
			return NextResponse.json(
				{
					success: false,
					error: result.error || "Assistant failed to respond",
				},
				{ status: 500 }
			);
		}

		const { body: responseText, sources } = parseAssistantResponse(
			result.content || "I couldn't find anything relevant yet."
		);

		return NextResponse.json({
			success: true,
			response: responseText,
			sources,
			actions: [],
			toolResults: [],
			assistantType: "ai-tools",
			composioToolsUsed: false,
		});
	} catch (error) {
		console.error("[Chatbot Assistant] AI assistant failed:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to generate assistant response",
			},
			{ status: 500 }
		);
	}
}

/**
 * Handle chatbot POST requests by routing the user's query through OpenAI+Composio tool integration when applicable, otherwise falling back to the Convex-based assistant.
 */
export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();
		applyConvexAuth(convex);

		const {
			message,
			workspaceContext,
			workspaceId,
			conversationHistory,
			memberId,
		} = await req.json();

		if (!message || !workspaceId) {
			return NextResponse.json(
				{ error: "Message and workspaceId are required" },
				{ status: 400 }
			);
		}

		const currentUser = await convex.query(api.users.current);

		if (memberId) {
			const errorResponse = await verifyMemberOwnership(
				convex,
				memberId,
				currentUser
			);
			if (errorResponse) return errorResponse;
		}

		const detection = detectIntegrationNeed(message);
		const composioContext = await prepareComposioContext(
			convex,
			workspaceId,
			memberId,
			message,
			detection
		);

		if (composioContext.useComposio && composioContext.composioClient) {
			const response = await runOpenAIComposioPath({
				convex,
				context: composioContext,
				currentUser,
				workspaceId,
				message,
				workspaceContext,
				conversationHistory,
			});
			if (response) return response;
		}

		await recordAIUsage(convex, workspaceId);
		return await runConvexAssistantPath({
			convex,
			currentUser,
			workspaceId,
			message,
		});
	} catch (error) {
		console.error("[Chatbot Assistant] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
