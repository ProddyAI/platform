/**
 * External integration tools (Composio) for the Proddy agent.
 * Wraps assistantComposioTools with createTool for @convex-dev/agent.
 */

import { createTool } from "@convex-dev/agent";
import type { AssistantCtx } from "./internalTools";
import { api } from "../../_generated/api";
import { z } from "zod";

const instructionSchema = z.object({
	instruction: z.string().describe("What you want the integration to do"),
});

export const runGmailTool = createTool({
	description:
		"Use Gmail to send emails, read inbox messages, or search email threads. Provide a clear instruction like 'send email to alice@example.com about the roadmap'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runGmailTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});

export const runSlackTool = createTool({
	description:
		"Use Slack to post messages, find channels, reply in threads, or get channel info. This is your PRIMARY tool for any Slack operations. Provide a clear instruction like 'post in #general that the deploy is done'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runSlackTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});

export const runGithubTool = createTool({
	description:
		"Use GitHub to create issues, comment on PRs, or search repositories. Provide a clear instruction like 'create an issue in repo X about bug Y'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runGithubTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});

export const runNotionTool = createTool({
	description:
		"Use Notion to create or update pages and databases. Provide a clear instruction like 'create a page titled Q1 Plan with these bullets'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runNotionTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});

export const runClickupTool = createTool({
	description:
		"Use ClickUp to create or update tasks. Provide a clear instruction like 'create a task in List A titled Fix onboarding bug'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runClickupTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});

export const runLinearTool = createTool({
	description:
		"Use Linear to create or update issues. Provide a clear instruction like 'create a bug issue in Team X titled Login fails on Safari'.",
	args: instructionSchema,
	handler: async (ctx: AssistantCtx, args): Promise<unknown> => {
		return await ctx.runAction(api.assistantComposioTools.runLinearTool, {
			workspaceId: ctx.workspaceId,
			userId: ctx.userId,
			instruction: args.instruction,
		});
	},
});
