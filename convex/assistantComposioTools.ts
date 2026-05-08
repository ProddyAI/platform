"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const COMPOSIO_BASE_V1 = "https://backend.composio.dev/api/v1";
const COMPOSIO_BASE_V2 = "https://backend.composio.dev/api/v2";

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

			if (!composioAccount?.id) {
				console.log(`[Composio] No UUID found for ${toolkit} in Composio, trying without appName filter`);
				// Try without appName filter
				const allAcctResp = await fetch(
					`${COMPOSIO_BASE_V1}/connectedAccounts?entityId=${entityId}`,
					{ headers: { "X-API-Key": COMPOSIO_KEY } }
				);
				const allAcctData = await allAcctResp.json();
				const allComposioAccounts: any[] = allAcctData?.items ?? [];
				const fallbackAccount = allComposioAccounts.find(
					(a: any) => a.appName?.toLowerCase() === toolkit && a.status === "ACTIVE"
				);
				if (!fallbackAccount?.id) {
					console.log(`[Composio] Still no ${toolkit} UUID found`);
					continue;
				}
				composioAccount.id = fallbackAccount.id;
			}

			const connectedAccountUUID: string = composioAccount.id;
			console.log(`[Composio] ${toolkit}: UUID=${connectedAccountUUID}`);

			// Fetch tools from Composio v2 API using the UUID
			const toolsResp = await fetch(
				`${COMPOSIO_BASE_V2}/actions?connectedAccountIds=${connectedAccountUUID}&limit=20`,
				{ headers: { "X-API-Key": COMPOSIO_KEY } }
			);
			const toolsData = await toolsResp.json();
			const rawTools: any[] = toolsData?.items ?? [];
			console.log(`[Composio] ${toolkit}: ${rawTools.length} tools. First: ${rawTools.slice(0, 3).map((t: any) => t.name).join(", ")}`);

			for (const t of rawTools) {
				const name: string = t.name || t.slug;
				if (!name) continue;
				uuidByToolName[name] = connectedAccountUUID;
				tools.push({
					type: "function",
					function: {
						name,
						description: t.description || name,
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
					content: `You are a helpful assistant with direct access to ${appNames.join(", ")} via tools. ALWAYS call a tool to answer. Do not explain, just call the most appropriate tool immediately.`,
				},
				{ role: "user", content: message },
			],
			temperature: 0,
			max_tokens: 500,
		});

		const toolCalls = completion.choices[0]?.message?.tool_calls ?? [];
		console.log(`[Composio] OpenAI selected ${toolCalls.length} tool call(s): ${toolCalls.map(tc => tc.function?.name).join(", ")}`);

		if (toolCalls.length === 0) {
			return { success: true, response: completion.choices[0]?.message?.content || "Done." };
		}

		// Execute each tool via Composio v2 API with UUID connectedAccountId
		const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		for (const tc of toolCalls) {
			if (tc.type !== "function") continue;
			const toolName = tc.function.name;
			const toolArgs = JSON.parse(tc.function.arguments || "{}");
			const connectedAccountId = uuidByToolName[toolName];
			console.log(`[Composio] Executing ${toolName}, connectedAccountId=${connectedAccountId}`);

			try {
				const execResp = await fetch(
					`${COMPOSIO_BASE_V2}/actions/${toolName}/execute`,
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
				{ role: "user", content: message },
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
