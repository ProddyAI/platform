/**
 * Proddy Assistant Agent - unified agent using @convex-dev/agent.
 * Uses thread-based conversations with workspace and Composio tools.
 */

import { openai } from "@ai-sdk/openai";
import { Agent } from "@convex-dev/agent";
import { stepCountIs } from "ai";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type AssistantCtx, allTools } from "./tools";

const BASE_INSTRUCTIONS = `You are Proddy, a personal work assistant for team workspaces.

Your role:
- Help users manage their calendar, meetings, tasks, and workspace activities
- Provide summaries of channels and conversations
- Answer questions about workspace data
- Be concise, actionable, and friendly

Guidelines:
- Use available tools for real-time data when needed
- Format responses with clear headings and bullet points
- When showing dates/times, use readable formats
- If you don't have information, say so clearly
- Never invent data; only use tool outputs and user-provided context`;

/** Custom context for tool handlers (workspaceId, userId). */
export type ProddyAgentContext = {
	workspaceId: Id<"workspaces">;
	userId: Id<"users">;
};

/**
 * Agent with custom context (workspaceId, userId) so tools can call workspace-scoped APIs.
 * Pass { ...ctx, workspaceId, userId } when calling generateText / continueThread.
 */
export const proddyAgent: Agent<ProddyAgentContext> =
	new Agent<ProddyAgentContext>(components.agent, {
		name: "Proddy Assistant",
		languageModel: openai.chat("gpt-4o-mini"),
		instructions: BASE_INSTRUCTIONS,
		tools: allTools,
		stopWhen: stepCountIs(5),
		callSettings: {
			temperature: 0.7,
		},
	});

export type { AssistantCtx };
