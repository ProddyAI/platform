"use node";

import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { v } from "convex/values";
import { parseAndSanitizeArguments } from "../src/lib/assistant-tool-audit";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

async function executeComposioAction(
	ctx: {
		runQuery: (query: any, args: any) => Promise<any>;
		runMutation: (mutation: any, args: any) => Promise<any>;
	},
	entityId: string,
	appNames: string[],
	message: string,
	workspaceId: Id<"workspaces">,
	userId: Id<"users">,
	memberId: Id<"members">
): Promise<{ success: boolean; response?: string; error?: string }> {
	try {
		if (!process.env.COMPOSIO_API_KEY) {
			return { success: false, error: "COMPOSIO_API_KEY is not configured" };
		}
		if (!process.env.OPENAI_API_KEY) {
			return { success: false, error: "OPENAI_API_KEY is not configured" };
		}

		const composio = new Composio({
			apiKey: process.env.COMPOSIO_API_KEY,
			provider: new VercelProvider(),
		});

		const connectedApps: string[] = [];
		let entityIdForTools = entityId;
		for (const appName of appNames) {
			const toolkit = appName.toLowerCase();
			try {
				let connectedAccount = await ctx.runQuery(
					api.integrations.getMyConnectedAccountByToolkit,
					{ workspaceId, toolkit }
				);
				if (!connectedAccount || connectedAccount.status !== "ACTIVE") {
					connectedAccount = await ctx.runQuery(
						api.integrations.getWorkspaceConnectedAccountByToolkit,
						{ workspaceId, toolkit }
					);
				}
				if (!connectedAccount || connectedAccount.status !== "ACTIVE") {
					continue;
				}

				const authConfig = await ctx.runQuery(
					api.integrations.getAuthConfigById,
					{ authConfigId: connectedAccount.authConfigId }
				);
				if (!authConfig?.composioAuthConfigId) {
					continue;
				}

				const resolvedEntityId =
					connectedAccount.userId && connectedAccount.userId.length > 0
						? connectedAccount.userId
						: entityId;
				entityIdForTools = resolvedEntityId;
				connectedApps.push(appName);
			} catch {
				// Skip app if tools cannot be resolved
			}
		}

		if (connectedApps.length === 0) {
			return {
				success: false,
				error: `No tools available for ${appNames.join(", ")}. Please connect the app first.`,
			};
		}

		const tools = await (composio as any).getTools(
			{ apps: connectedApps },
			entityIdForTools
		);

		if (!tools || Object.keys(tools).length === 0) {
			return {
				success: false,
				error: "No tools could be resolved for connected apps.",
			};
		}

		const result = await generateText({
			model: openai("gpt-5-mini"),
			system: `You are a helpful assistant with access to ${connectedApps.join(", ")} tools. Help the user accomplish their tasks using these tools. Be concise and clear.`,
			messages: [{ role: "user", content: message }],
			tools,
			temperature: 0.7,
		});

		const steps = Array.isArray(result.steps) ? result.steps : [];
		for (const step of steps) {
			const stepToolCalls = step.toolCalls ?? [];
			const stepToolResults = step.toolResults ?? [];
			for (const toolCall of stepToolCalls) {
				const toolCallAny = toolCall as any;
				const toolResultAny = stepToolResults.find(
					(tr: any) => tr.toolCallId === toolCallAny.toolCallId
				) as any;
				const outcome =
					toolResultAny?.result?.success === false ? "error" : "success";
				await ctx.runMutation(
					internal.assistantToolAudits.logExternalToolAttemptInternal,
					{
						workspaceId,
						memberId,
						userId,
						toolName: toolCallAny.toolName,
						toolkit: connectedApps[0]?.toUpperCase(),
						argumentsSnapshot: parseAndSanitizeArguments(
							JSON.stringify(toolCallAny.args ?? {})
						),
						outcome,
						error:
							outcome === "error"
								? String(
										toolResultAny?.result?.error || "Tool execution failed"
									)
								: undefined,
						executionPath: "convex-assistant",
						toolCallId: toolCallAny.toolCallId,
					}
				);
			}
		}

		return { success: true, response: result.text };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return { success: false, error: errorMessage };
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["GMAIL"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["SLACK"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["GITHUB"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["NOTION"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["CLICKUP"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
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
		if (!memberId) {
			return { success: false, error: "Member not found" };
		}
		return await executeComposioAction(
			ctx,
			`member_${memberId}`,
			["LINEAR"],
			args.instruction,
			args.workspaceId,
			args.userId,
			memberId
		);
	},
});
