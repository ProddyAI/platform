"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const COMPOSIO_BASE_V1 = "https://backend.composio.dev/api/v1";
const COMPOSIO_BASE_V2 = "https://backend.composio.dev/api/v2";
const COMPOSIO_BASE_V3 = "https://backend.composio.dev/api/v3";

export function isStarredRepoListRequest(message: string) {
	const normalized = message.trim().toLowerCase();
	return (
		/\b(my\s+)?starred\s+(repo|repos|repository|repositories)\b/i.test(
			normalized
		) ||
		/\b(starred|stars?)\b[\s\S]{0,20}\b(repo|repos|repository|repositories)\b/i.test(
			normalized
		)
	);
}

export function isAuthenticatedRepoListRequest(message: string) {
	const normalized = message.trim().toLowerCase();
	return (
		!isStarredRepoListRequest(normalized) &&
		/\b(my|authenticated user['’]s?)\s+(repo|repos|repository|repositories)\b/i.test(
			normalized
		) ||
		(!isStarredRepoListRequest(normalized) &&
			/\blist\s+(out\s+)?(my\s+)?(repo|repos|repository|repositories)\b/i.test(
				normalized
			)) ||
		(!isStarredRepoListRequest(normalized) &&
			/\bshow\s+(my\s+)?(repo|repos|repository|repositories)\b/i.test(
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

async function executeComposioAction(
	ctx: { runQuery: (query: any, args: any) => Promise<any> },
	entityId: string,
	appNames: string[],
	message: string,
	workspaceId: Id<"workspaces">
): Promise<{ success: boolean; response?: string; error?: string }> {
	try {
		const COMPOSIO_KEY = process.env.COMPOSIO_API_KEY;
		const OPENAI_KEY = process.env.OPENAI_API_KEY;
		if (!COMPOSIO_KEY) return { success: false, error: "COMPOSIO_API_KEY not configured" };
		if (!OPENAI_KEY) return { success: false, error: "OPENAI_API_KEY not configured" };

		const openai = new OpenAI({ apiKey: OPENAI_KEY });
		const normalizedMessage =
			appNames.includes("GITHUB") ? normalizeGithubInstruction(message) : message;
		console.log(`[Composio] Starting: entityId=${entityId}, apps=${appNames.join(",")}`);

		// Look up connected accounts from our DB to get composioAccountId
		const memberId = entityId.startsWith("member_")
			? (entityId.slice("member_".length) as Id<"members">)
			: undefined;

		const allAccounts = await ctx.runQuery(
			api.integrations.getConnectedAccountsPublic,
			{ workspaceId, memberId }
		);
		console.log(`[Composio] DB accounts: ${allAccounts.length}`);

		// For each app: look up the real UUID via Composio v1 API, then fetch tools via v2
		const tools: OpenAI.Chat.ChatCompletionTool[] = [];
		const uuidByToolName: Record<string, string> = {};

		for (const appName of appNames) {
			const toolkit = appName.toLowerCase();
			const dbAccount = allAccounts.find(
				(a: any) => a.toolkit?.toLowerCase() === toolkit && a.status === "ACTIVE"
			);
			if (!dbAccount) {
				console.log(`[Composio] No active ${toolkit} account in DB`);
				continue;
			}

			// Fetch the UUID from Composio v1 connected accounts
			const acctResp = await fetch(
				`${COMPOSIO_BASE_V1}/connectedAccounts?entityId=${entityId}&appName=${appName.toUpperCase()}`,
				{ headers: { "X-API-Key": COMPOSIO_KEY } }
			);
			const acctData = await acctResp.json();
			const composioAccounts: any[] = acctData?.items ?? [];
			const composioAccount = composioAccounts.find(
				(a: any) => a.appName?.toLowerCase() === toolkit && a.status === "ACTIVE"
			);
			// composioAccount may be undefined if not found by entityId filter
			let resolvedUUID: string | null = composioAccount?.id ?? null;

			if (!resolvedUUID) {
				console.log(`[Composio] No UUID found for ${toolkit} with entityId filter, trying without...`);
				// Try fetching ALL connections for this entity (no appName filter)
				const allAcctResp = await fetch(
					`${COMPOSIO_BASE_V1}/connectedAccounts?entityId=${entityId}`,
					{ headers: { "X-API-Key": COMPOSIO_KEY } }
				);
				const allAcctData = await allAcctResp.json();
				const allComposioAccounts: any[] = allAcctData?.items ?? [];
				const fallbackAccount = allComposioAccounts.find(
					(a: any) => a.appName?.toLowerCase() === toolkit && a.status === "ACTIVE"
				);
				if (fallbackAccount?.id) {
					resolvedUUID = fallbackAccount.id;
				} else if (dbAccount.composioAccountId) {
					// Last resort: use the composioAccountId we stored in our DB
					resolvedUUID = dbAccount.composioAccountId;
					console.log(`[Composio] Using DB composioAccountId as UUID: ${resolvedUUID}`);
				} else {
					console.log(`[Composio] No UUID found for ${toolkit} anywhere, skipping`);
					continue;
				}
			}

			const connectedAccountUUID: string = resolvedUUID;
			console.log(`[Composio] ${toolkit}: UUID=${connectedAccountUUID}`);

			// Fetch tools from Composio v3 API (v2 is deprecated)
			// toolkit_slug (snake_case, lowercase) scopes tools to only this app
			const searchQuery = encodeURIComponent(message.slice(0, 100));
			// v3 endpoint: /api/v3/tools?toolkit_slug=github&query=...
			const toolsUrl = `${COMPOSIO_BASE_V3}/tools?toolkit_slug=${toolkit.toLowerCase()}&query=${searchQuery}&limit=20`;
			console.log(`[Composio] Fetching tools: ${toolsUrl}`);
			const toolsResp = await fetch(
				toolsUrl,
				{ headers: { "X-API-Key": COMPOSIO_KEY } }
			);
			const toolsData = await toolsResp.json();
			let rawTools: any[] = toolsData?.items ?? toolsData?.tools ?? [];
			console.log(`[Composio] v3 tools response status=${toolsResp.status}, count=${rawTools.length}`);
			
			// If v3 returns 0, try without search query filter
			if (rawTools.length === 0) {
				console.log(`[Composio] v3 with search returned 0 for ${toolkit}, retrying without search...`);
				const fallbackResp = await fetch(
					`${COMPOSIO_BASE_V3}/tools?toolkit_slug=${toolkit.toLowerCase()}&limit=20`,
					{ headers: { "X-API-Key": COMPOSIO_KEY } }
				);
				const fallbackData = await fallbackResp.json();
				rawTools = fallbackData?.items ?? fallbackData?.tools ?? [];
				console.log(`[Composio] v3 fallback count=${rawTools.length}, keys=${Object.keys(fallbackData || {}).join(",")}`);
			}
			console.log(`[Composio] ${toolkit}: ${rawTools.length} tools. First: ${rawTools.slice(0, 3).map((t: any) => t.name || t.slug).join(", ")}`);

			for (const t of rawTools) {
				// Prefer slug (URL-safe like GITHUB_GET_USER) over human-readable name
				// OpenAI requires ^[a-zA-Z0-9_-]+$ — spaces are not allowed
				const rawName: string = t.slug || t.name || t.displayName || "";
				if (!rawName) continue;
				// Sanitize: replace spaces and invalid chars with underscores
				const name = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
				// Store mapping: sanitized name → UUID for execution
				uuidByToolName[name] = connectedAccountUUID;
				// Also store the original slug so we can use it in execution URL
				const execSlug = t.slug || rawName;
				uuidByToolName[`__slug__${name}`] = execSlug;
				tools.push({
					type: "function",
					function: {
						name,
						description: (t.description || t.displayName || rawName).slice(0, 300),
						parameters: t.inputSchema ?? t.parameters ?? { type: "object", properties: {} },
					},
				});
			}
		}

		if (tools.length === 0) {
			return {
				success: false,
				error: `No tools found for ${appNames.join(", ")}. Please connect the app first.`,
			};
		}

		console.log(`[Composio] Calling OpenAI with ${tools.length} tools (tool_choice=required)`);

		// First OpenAI call — force tool use
		const completion = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			tools,
			tool_choice: "required",
			messages: [
			{
					role: "system",
					content: `You are a helpful assistant with direct access to ${appNames.join(", ")} via tools. 
IMPORTANT: The user is already authenticated via OAuth — NEVER ask for a username, password, or token. 
Always call tools that work for the "authenticated user" (e.g. list repos for authenticated user, not repos for a specific username).
If the user asks for their repositories, you MUST list repositories for the authenticated user. NEVER use starred-repository tools or public repository search tools unless the user explicitly asks for starred repositories or search.
Available tools: ${tools.map(t => t.function.name).join(", ")}
ALWAYS call the most relevant tool immediately without explaining.`,
				},
				{ role: "user", content: normalizedMessage },
			],
			temperature: 0,
			max_tokens: 500,
		});

		const toolCalls = completion.choices[0]?.message?.tool_calls ?? [];
		console.log(`[Composio] OpenAI selected ${toolCalls.length} tool call(s): ${toolCalls.map(tc => tc.function?.name).join(", ")}`);

		if (toolCalls.length === 0) {
			return { success: true, response: completion.choices[0]?.message?.content || "Done." };
		}

		// Execute each tool via Composio API (try v3 first, v2 as fallback)
		const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

	for (const tc of toolCalls) {
			if (tc.type !== "function") continue;
			const toolName = tc.function.name; // sanitized name
			const toolArgs = JSON.parse(tc.function.arguments || "{}");
			const connectedAccountId = uuidByToolName[toolName];
			// Use the original slug for API URL (sanitized name might differ from slug)
			const execSlug = uuidByToolName[`__slug__${toolName}`] || toolName;
			console.log(`[Composio] Executing ${toolName} (slug=${execSlug}), connectedAccountId=${connectedAccountId}`);

			try {
				// Try v3 API first
				let execResp = await fetch(
					`${COMPOSIO_BASE_V3}/tools/${execSlug}/execute`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-API-Key": COMPOSIO_KEY,
						},
						body: JSON.stringify({
							connected_account_id: connectedAccountId, // v3 uses snake_case
							input: toolArgs,
						}),
					}
				);
				
				// Fall back to v2 if v3 returns 404
				if (execResp.status === 404) {
					console.log(`[Composio] v3 execute 404 for ${execSlug}, falling back to v2`);
					execResp = await fetch(
						`${COMPOSIO_BASE_V2}/actions/${execSlug}/execute`,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"X-API-Key": COMPOSIO_KEY,
							},
							body: JSON.stringify({
								connectedAccountId,
								input: toolArgs,
							}),
						}
					);
				}
				
				const result = await execResp.json();
				console.log(`[Composio] ${toolName} result (${execResp.status}): ${JSON.stringify(result).slice(0, 500)}`);
				toolMessages.push({
					role: "tool",
					tool_call_id: tc.id,
					content: JSON.stringify(result),
				});
			} catch (err) {
				console.error(`[Composio] ${toolName} execution error:`, err);
				toolMessages.push({
					role: "tool",
					tool_call_id: tc.id,
					content: JSON.stringify({ error: String(err) }),
				});
			}
		}

		// Second OpenAI call — format results
		const followUp = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: "Format the tool results clearly and concisely for the user." },
				{ role: "user", content: normalizedMessage },
				completion.choices[0].message as OpenAI.Chat.ChatCompletionMessageParam,
				...toolMessages,
			],
			temperature: 0.7,
			max_tokens: 1500,
		});

		const finalText = followUp.choices[0]?.message?.content || "Done.";
		console.log(`[Composio] Final: "${finalText.slice(0, 200)}"`);
		return { success: true, response: finalText };
	} catch (error) {
		console.error(`[Composio] Fatal:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

async function getMemberId(
	ctx: { runQuery: (query: any, args: any) => Promise<any> },
	workspaceId: Id<"workspaces">,
	userId: Id<"users">
): Promise<Id<"members"> | null> {
	const member = await ctx.runQuery(internal.members._getByWorkspaceAndUser, {
		workspaceId,
		userId,
	});
	return member?._id ?? null;
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["GMAIL"], args.instruction, args.workspaceId);
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["SLACK"], args.instruction, args.workspaceId);
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["GITHUB"], args.instruction, args.workspaceId);
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["NOTION"], args.instruction, args.workspaceId);
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["CLICKUP"], args.instruction, args.workspaceId);
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
				userId: args.userId, workspaceId: args.workspaceId, featureType: "aiRequest",
			});
		} catch (e) { console.warn("[UsageTracking] Failed:", e); }
		return executeComposioAction(ctx, `member_${memberId}`, ["LINEAR"], args.instruction, args.workspaceId);
	},
});
