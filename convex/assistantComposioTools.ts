"use node";

import { Composio } from "@composio/core";
import { v } from "convex/values";
import OpenAI from "openai";
import { parseAndSanitizeArguments } from "../src/lib/assistant-tool-audit";
import {
	buildCancellationMessage,
	buildConfirmationRequiredMessage,
	getHighImpactToolNames,
	getUserConfirmationDecision,
} from "../src/lib/high-impact-action-confirmation";
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

		const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
		const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

		const tools: any[] = [];
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

				const entityIdForTools =
					connectedAccount.userId && connectedAccount.userId.length > 0
						? connectedAccount.userId
						: entityId;

				const appTools = await composio.tools.get(entityIdForTools, {
					authConfigIds: [authConfig.composioAuthConfigId],
					limit: 100,
				});

				const toolsArray = Array.isArray(appTools)
					? appTools
					: typeof appTools === "object" && appTools !== null
						? Object.values(appTools)
						: appTools
							? [appTools]
							: [];
				tools.push(...toolsArray);
			} catch {
				// Skip app if tools cannot be resolved
			}
		}

		if (tools.length === 0) {
			return {
				success: false,
				error: `No tools available for ${appNames.join(", ")}. Please connect the app first.`,
			};
		}

		const openaiTools = tools.map((tool: any) => ({
			type: "function" as const,
			function: {
				name: tool.function?.name || tool.name || tool.slug,
				description: tool.function?.description || tool.description,
				parameters:
					tool.parameters ?? tool.schema ?? tool.function?.parameters ?? {},
			},
		}));

		const completion = await openaiClient.chat.completions.create({
			model: "gpt-5-mini",
			tools: openaiTools,
			messages: [
				{
					role: "system",
					content: `You are a helpful assistant with access to ${appNames.join(", ")} tools. Help the user accomplish their tasks using these tools. Be concise and clear.`,
				},
				{ role: "user", content: message },
			],
			temperature: 0.7,
			max_tokens: 1000,
		});

		const responseText =
			completion.choices[0]?.message?.content || "No response generated";

		if (
			completion.choices[0]?.message?.tool_calls &&
			completion.choices[0].message.tool_calls.length > 0
		) {
			const toolCalls = completion.choices[0].message.tool_calls;
			const highImpactToolNames = getHighImpactToolNames(toolCalls);
			const decision = getUserConfirmationDecision(message);

			if (highImpactToolNames.length > 0) {
				if (decision === "cancel") {
					return {
						success: true,
						response: buildCancellationMessage(highImpactToolNames),
					};
				}
				if (decision !== "confirm") {
					return {
						success: true,
						response: buildConfirmationRequiredMessage(highImpactToolNames),
					};
				}
			}

			for (const toolCall of toolCalls) {
				if (toolCall.type === "function") {
					const sanitizedArgs = parseAndSanitizeArguments(
						toolCall.function.arguments
					);
					let actionParams: Record<string, unknown> | undefined;
					try {
						const parsed = JSON.parse(toolCall.function.arguments);
						if (
							parsed &&
							typeof parsed === "object" &&
							!Array.isArray(parsed)
						) {
							actionParams = parsed as Record<string, unknown>;
						}
					} catch (error) {
						await ctx.runMutation(
							internal.assistantToolAudits.logExternalToolAttemptInternal,
							{
								workspaceId,
								memberId,
								userId,
								toolName: toolCall.function.name,
								toolkit: appNames[0]?.toUpperCase(),
								argumentsSnapshot: sanitizedArgs,
								outcome: "error",
								error:
									error instanceof Error
										? error.message
										: "Invalid tool call arguments",
								executionPath: "convex-assistant",
								toolCallId: toolCall.id,
							}
						);
						throw error;
					}

					try {
						await composio.tools.execute(toolCall.function.name, {
							userId: entityId,
							arguments: actionParams,
						});
						await ctx.runMutation(
							internal.assistantToolAudits.logExternalToolAttemptInternal,
							{
								workspaceId,
								memberId,
								userId,
								toolName: toolCall.function.name,
								toolkit: appNames[0]?.toUpperCase(),
								argumentsSnapshot: sanitizedArgs,
								outcome: "success",
								executionPath: "convex-assistant",
								toolCallId: toolCall.id,
							}
						);
					} catch (error) {
						await ctx.runMutation(
							internal.assistantToolAudits.logExternalToolAttemptInternal,
							{
								workspaceId,
								memberId,
								userId,
								toolName: toolCall.function.name,
								toolkit: appNames[0]?.toUpperCase(),
								argumentsSnapshot: sanitizedArgs,
								outcome: "error",
								error: error instanceof Error ? error.message : "Unknown error",
								executionPath: "convex-assistant",
								toolCallId: toolCall.id,
							}
						);
						throw error;
					}
				}
			}
		}

		return { success: true, response: responseText };
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
