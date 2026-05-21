"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action } from "./_generated/server";

const COMPOSIO_BASE_V2 = "https://backend.composio.dev/api/v2";
const COMPOSIO_BASE_V3 = "https://backend.composio.dev/api/v3";
const COMPOSIO_BASE_V3_1 = "https://backend.composio.dev/api/v3.1";

function debugLog(...args: unknown[]) {
	if (process.env.COMPOSIO_DEBUG === "1") console.log(...args);
}

export function isStarredRepoListRequest(message: string) {
	const normalized = message.trim().toLowerCase();
	return (
		/\b(my\s+)?starred\s+(repo|repos|repository|repositories)\b/iu.test(
			normalized
		) ||
		/\b(starred|stars?)\b[\s\S]{0,20}\b(repo|repos|repository|repositories)\b/iu.test(
			normalized
		)
	);
}

export function isAuthenticatedRepoListRequest(message: string) {
	const normalized = message.trim().toLowerCase();
	return (
		(!isStarredRepoListRequest(normalized) &&
			/\b(my|authenticated user['']s?)\s+(repo|repos|repository|repositories)\b/iu.test(
				normalized
			)) ||
		(!isStarredRepoListRequest(normalized) &&
			/\blist\s+(out\s+)?(my\s+)?(repo|repos|repository|repositories)\b/iu.test(
				normalized
			)) ||
		(!isStarredRepoListRequest(normalized) &&
			/\bshow\s+(my\s+)?(repo|repos|repository|repositories)\b/iu.test(
				normalized
			))
	);
}

export function normalizeGithubInstruction(message: string) {
	if (isStarredRepoListRequest(message)) {
		return "List repositories starred by the authenticated user. Do not list owned repositories unless the user asks for them.";
	}
	if (isAuthenticatedRepoListRequest(message)) {
		return "List repositories for the authenticated user. Do not list starred repositories. Do not search public repositories.";
	}
	return message;
}

type ComposioAccountItem = {
	id?: string;
	appName?: string;
	status?: string;
};

type ComposioToolItem = {
	slug?: string;
	name?: string;
	displayName?: string;
	description?: string;
	inputSchema?: unknown;
	parameters?: unknown;
};

type DbAccount = ComposioAccountItem & {
	toolkit?: string;
	composioAccountId?: string;
	userId?: string;
};

async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeoutMs = 10000
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	const upstreamSignal = options.signal;
	const abortHandler = () => controller.abort();

	if (upstreamSignal) {
		if (upstreamSignal.aborted) {
			controller.abort();
		} else {
			upstreamSignal.addEventListener("abort", abortHandler, { once: true });
		}
	}

	try {
		return await fetch(url, {
			...options,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeoutId);
		upstreamSignal?.removeEventListener("abort", abortHandler);
	}
}

async function fetchComposioToolDefs(
	composioKey: string,
	toolkit: string,
	searchHint: string
): Promise<ComposioToolItem[]> {
	const searchQuery = encodeURIComponent(searchHint.slice(0, 100));
	const toolsUrl = `${COMPOSIO_BASE_V3}/tools?toolkit_slug=${toolkit}&query=${searchQuery}&limit=20`;
	debugLog(`[Composio] Fetching tools: ${toolsUrl}`);

	const resp = await fetchWithTimeout(toolsUrl, {
		headers: { "X-API-Key": composioKey },
	});
	const data = (await resp.json()) as {
		items?: ComposioToolItem[];
		tools?: ComposioToolItem[];
	};
	let rawTools: ComposioToolItem[] = data?.items ?? data?.tools ?? [];
	debugLog(
		`[Composio] v3 tools status=${resp.status}, count=${rawTools.length}`
	);

	if (rawTools.length === 0) {
		debugLog(
			`[Composio] v3 search returned 0 for ${toolkit}, retrying without search...`
		);
		const fallbackResp = await fetchWithTimeout(
			`${COMPOSIO_BASE_V3}/tools?toolkit_slug=${toolkit}&limit=20`,
			{ headers: { "X-API-Key": composioKey } }
		);
		const fallbackData = (await fallbackResp.json()) as {
			items?: ComposioToolItem[];
			tools?: ComposioToolItem[];
		};
		rawTools = fallbackData?.items ?? fallbackData?.tools ?? [];
		debugLog(`[Composio] v3 fallback count=${rawTools.length}`);
	}

	debugLog(
		`[Composio] ${toolkit}: ${rawTools.length} tools. First: ${rawTools
			.slice(0, 3)
			.map((t) => t.name || t.slug)
			.join(", ")}`
	);
	return rawTools;
}

async function executeComposioToolCall(
	composioKey: string,
	execSlug: string,
	userId: string,
	toolArgs: Record<string, unknown>
): Promise<unknown> {
	// v3.1 is the documented current execute endpoint:
	//   POST /api/v3.1/tools/execute/{tool_slug}
	//   body: { user_id, arguments }
	// We pass user_id (the Composio entity id) rather than connected_account_id
	// so Composio auto-resolves to the currently active connection. Passing a
	// cached UUID can produce 400 "No connected account found" if the
	// underlying connection was rotated, deleted, or never existed under that id.
	const v3Body = JSON.stringify({
		user_id: userId,
		arguments: toolArgs,
	});

	let execResp = await fetchWithTimeout(
		`${COMPOSIO_BASE_V3_1}/tools/execute/${execSlug}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": composioKey,
			},
			body: v3Body,
		}
	);

	if (execResp.status === 404) {
		debugLog(`[Composio] v3.1 execute 404 for ${execSlug}, trying v3 fallback`);
		execResp = await fetchWithTimeout(
			`${COMPOSIO_BASE_V3}/tools/execute/${execSlug}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": composioKey,
				},
				body: v3Body,
			}
		);
	}

	if (execResp.status === 404) {
		debugLog(`[Composio] v3 execute 404 for ${execSlug}, falling back to v2`);
		execResp = await fetchWithTimeout(
			`${COMPOSIO_BASE_V2}/actions/${execSlug}/execute`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": composioKey,
				},
				body: JSON.stringify({ entityId: userId, input: toolArgs }),
			}
		);
	}

	const resultText = await execResp.text();
	let result: unknown;
	try {
		result = JSON.parse(resultText);
	} catch {
		result = { raw: resultText };
	}

	debugLog(
		`[Composio] tool result (${execResp.status}): ${JSON.stringify(result).slice(0, 500)}`
	);

	if (!execResp.ok) {
		console.error(
			`[Composio] execute failed: slug=${execSlug} status=${execResp.status} body=${resultText.slice(0, 500)}`
		);
		throw new Error(
			`Composio execute failed (${execResp.status}): ${resultText.slice(0, 300)}`
		);
	}

	const resultObj =
		result && typeof result === "object"
			? (result as Record<string, unknown>)
			: null;
	if (resultObj && resultObj.successful === false) {
		const errMsg =
			typeof resultObj.error === "string"
				? resultObj.error
				: JSON.stringify(resultObj.error ?? resultObj);
		console.error(
			`[Composio] execute returned successful=false: slug=${execSlug} error=${errMsg.slice(0, 500)}`
		);
		throw new Error(
			`Composio tool ${execSlug} failed: ${errMsg.slice(0, 300)}`
		);
	}

	return result;
}

type ComposioToolsBuildResult = {
	tools: OpenAI.Chat.ChatCompletionTool[];
	// Maps OpenAI tool name -> Composio entity user_id (used at execute time),
	// plus parallel keys `__slug__${name}` -> raw Composio tool slug.
	contextByToolName: Record<string, string>;
};

function buildComposioSystemPrompt(
	appNames: string[],
	message: string,
	tools: OpenAI.Chat.ChatCompletionTool[]
): string {
	const toolNames = tools
		.filter(
			(t): t is OpenAI.Chat.ChatCompletionFunctionTool => t.type === "function"
		)
		.map((t) => t.function.name)
		.join(", ");
	return `You are a helpful assistant with direct access to ${appNames.join(", ")} via tools.
IMPORTANT: The user is already authenticated via OAuth — NEVER ask for a username, password, or token.
Always call tools that work for the "authenticated user" (e.g. list repos for authenticated user, not repos for a specific username).
${
	isStarredRepoListRequest(message)
		? "The user is asking for STARRED repositories. You MUST use the tool that lists starred repositories for the authenticated user. Do NOT list owned repositories."
		: "If the user asks for their repositories, you MUST list repositories for the authenticated user (owned repos). Do NOT use starred-repository tools unless the user explicitly asks for starred repositories."
}
Available tools: ${toolNames}
ALWAYS call the most relevant tool immediately without explaining.`;
}

async function buildOpenAIToolsFromApps(
	composioKey: string,
	entityId: string,
	appNames: string[],
	message: string,
	allAccounts: unknown[]
): Promise<ComposioToolsBuildResult | { error: string }> {
	const tools: OpenAI.Chat.ChatCompletionTool[] = [];
	const contextByToolName: Record<string, string> = {};

	for (const appName of appNames) {
		const toolkit = appName.toLowerCase();
		const dbAccount = (allAccounts as DbAccount[]).find(
			(a) => a.toolkit?.toLowerCase() === toolkit && a.status === "ACTIVE"
		);
		if (!dbAccount) {
			debugLog(`[Composio] No active ${toolkit} account in DB`);
			continue;
		}

		// Prefer the entity id stored on the DB row (this is what was used when
		// the connection was initiated, e.g. `member_xxx` or `workspace_xxx`).
		// Fall back to the caller-provided entityId for legacy rows.
		const executionUserId =
			(typeof dbAccount.userId === "string" && dbAccount.userId.trim()) ||
			entityId;
		debugLog(`[Composio] ${toolkit}: user_id=${executionUserId}`);

		const toolSearchHint =
			appNames.includes("GITHUB") && isAuthenticatedRepoListRequest(message)
				? "list repositories authenticated user"
				: message;

		const rawTools = await fetchComposioToolDefs(
			composioKey,
			toolkit,
			toolSearchHint
		);

		for (const t of rawTools) {
			const rawName: string = t.slug || t.name || t.displayName || "";
			if (!rawName) continue;
			const name = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
			contextByToolName[name] = executionUserId;
			contextByToolName[`__slug__${name}`] = t.slug || rawName;
			tools.push({
				type: "function",
				function: {
					name,
					description: (t.description || t.displayName || rawName).slice(
						0,
						300
					),
					parameters: (t.inputSchema ??
						t.parameters ?? { type: "object", properties: {} }) as Record<
						string,
						unknown
					>,
				},
			});
		}
	}

	if (tools.length === 0) {
		return {
			error: `No tools found for ${appNames.join(", ")}. Please connect the app first.`,
		};
	}

	return { tools, contextByToolName };
}

async function runComposioToolCallLoop(
	openai: OpenAI,
	composioKey: string,
	toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
	contextByToolName: Record<string, string>,
	normalizedMessage: string,
	assistantMessage: OpenAI.Chat.ChatCompletionMessageParam
): Promise<string> {
	const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

	for (const tc of toolCalls) {
		if (tc.type !== "function") continue;
		const toolName = tc.function.name;
		const toolArgs = JSON.parse(tc.function.arguments || "{}") as Record<
			string,
			unknown
		>;
		const executionUserId = contextByToolName[toolName];
		const execSlug = contextByToolName[`__slug__${toolName}`] || toolName;
		debugLog(
			`[Composio] Executing ${toolName} (slug=${execSlug}), user_id=${executionUserId}`
		);

		try {
			const result = await executeComposioToolCall(
				composioKey,
				execSlug,
				executionUserId,
				toolArgs
			);
			toolMessages.push({
				role: "tool",
				tool_call_id: tc.id,
				content: JSON.stringify(result),
			});
		} catch (err) {
			console.error("[Composio] tool execution error:", toolName, err);
			toolMessages.push({
				role: "tool",
				tool_call_id: tc.id,
				content: JSON.stringify({ error: String(err) }),
			});
		}
	}

	const followUp = await openai.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [
			{
				role: "system",
				content: "Format the tool results clearly and concisely for the user.",
			},
			{ role: "user", content: normalizedMessage },
			assistantMessage,
			...toolMessages,
		],
		temperature: 0.7,
		max_tokens: 1500,
	});

	const finalText = followUp.choices[0]?.message?.content || "Done.";
	debugLog(`[Composio] Final: "${finalText.slice(0, 200)}"`);
	return finalText;
}

async function executeComposioAction(
	ctx: ActionCtx,
	entityId: string,
	appNames: string[],
	message: string,
	workspaceId: Id<"workspaces">
): Promise<{ success: boolean; response?: string; error?: string }> {
	try {
		const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY;
		const OPENAI_KEY = process.env.OPENAI_API_KEY;
		if (!COMPOSIO_KEY)
			return { success: false, error: "COMPOSIO_API_KEY not configured" };
		if (!OPENAI_KEY)
			return { success: false, error: "OPENAI_API_KEY not configured" };

		const openai = new OpenAI({ apiKey: OPENAI_KEY });
		const normalizedMessage = appNames.includes("GITHUB")
			? normalizeGithubInstruction(message)
			: message;
		debugLog(
			`[Composio] Starting: entityId=${entityId}, apps=${appNames.join(",")}`
		);

		const memberId = entityId.startsWith("member_")
			? (entityId.slice("member_".length) as Id<"members">)
			: undefined;

		const allAccounts = await ctx.runQuery(
			api.integrations.getConnectedAccountsPublic,
			{ workspaceId, memberId }
		);
		debugLog(`[Composio] DB accounts: ${(allAccounts as unknown[]).length}`);

		const built = await buildOpenAIToolsFromApps(
			COMPOSIO_KEY,
			entityId,
			appNames,
			message,
			allAccounts
		);
		if ("error" in built) {
			return { success: false, error: built.error };
		}

		const { tools, contextByToolName } = built;
		debugLog(
			`[Composio] Calling OpenAI with ${tools.length} tools (tool_choice=required)`
		);

		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			tools,
			tool_choice: "required",
			messages: [
				{
					role: "system",
					content: buildComposioSystemPrompt(appNames, message, tools),
				},
				{ role: "user", content: normalizedMessage },
			],
			temperature: 0,
			max_tokens: 500,
		});

		const toolCalls = completion.choices[0]?.message?.tool_calls ?? [];
		const functionToolNames = toolCalls
			.filter(
				(tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall =>
					tc.type === "function"
			)
			.map((tc) => tc.function.name);
		console.log(
			`[Composio] apps=${appNames.join(",")} selected ${toolCalls.length} tool call(s): ${functionToolNames.join(", ")}`
		);

		if (toolCalls.length === 0) {
			return {
				success: true,
				response: completion.choices[0]?.message?.content || "Done.",
			};
		}

		const assistantMessage = completion.choices[0]
			.message as OpenAI.Chat.ChatCompletionMessageParam;
		const finalText = await runComposioToolCallLoop(
			openai,
			COMPOSIO_KEY,
			toolCalls,
			contextByToolName,
			normalizedMessage,
			assistantMessage
		);
		return { success: true, response: finalText };
	} catch (error) {
		console.error("[Composio] Fatal:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function getMemberId(
	ctx: ActionCtx,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
): Promise<Id<"members"> | null> {
	const member = await ctx.runQuery(internal.members._getByWorkspaceAndUser, {
		workspaceId,
		userId,
	});
	return (member as { _id: Id<"members"> } | null)?._id ?? null;
}

export const runGmailTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["GMAIL"],
			args.instruction,
			args.workspaceId
		);
	},
});

export const runSlackTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["SLACK"],
			args.instruction,
			args.workspaceId
		);
	},
});

export const runGithubTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["GITHUB"],
			args.instruction,
			args.workspaceId
		);
	},
});

export const runNotionTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["NOTION"],
			args.instruction,
			args.workspaceId
		);
	},
});

export const runClickupTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["CLICKUP"],
			args.instruction,
			args.workspaceId
		);
	},
});

export const runLinearTool = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
		instruction: v.string(),
	},
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) return { success: false, error: "Member not found" };
		try {
			await ctx.runMutation(internal.usageTracking.recordAIRequest, {
				userId: args.userId,
				workspaceId: args.workspaceId,
				featureType: "aiRequest",
			});
		} catch (e) {
			console.warn("[UsageTracking] Failed:", e);
		}
		return executeComposioAction(
			ctx,
			`member_${memberId}`,
			["LINEAR"],
			args.instruction,
			args.workspaceId
		);
	},
});
