import { openai } from "@ai-sdk/openai";
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import type { NextRequest } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { classifyAssistantQueryWithAI } from "@/lib/ai-query-classifier";
import { logRouteError } from "@/lib/assistant-error-utils";
import { buildAssistantSystemPrompt } from "@/lib/assistant-orchestration";
import { parseAndSanitizeArguments } from "@/lib/assistant-tool-audit";
import { getWorkspaceEntityId } from "@/lib/composio-config";
import { UnifiedToolManager } from "@/lib/unified-tool-manager";

export const dynamic = "force-dynamic";

/**
 * Create a Convex HTTP client
 */
function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

/**
 * Log external tool audit events
 */
async function logExternalToolAuditEvent(params: {
	convex: ConvexHttpClient;
	workspaceId: Id<"workspaces">;
	memberId?: Id<"members">;
	userId?: Id<"users">;
	toolName: string;
	toolkit?: string;
	argumentsSnapshot: unknown;
	outcome: "success" | "error";
	error?: string;
	executionPath: string;
	toolCallId?: string;
}) {
	try {
		await params.convex.mutation(
			api.assistantToolAudits.logExternalToolAttempt,
			{
				workspaceId: params.workspaceId,
				memberId: params.memberId,
				userId: params.userId,
				toolName: params.toolName,
				toolkit: params.toolkit,
				argumentsSnapshot: params.argumentsSnapshot,
				outcome: params.outcome,
				error: params.error,
				executionPath: params.executionPath,
				toolCallId: params.toolCallId,
			}
		);
	} catch (error) {
		logRouteError({
			route: "Chatbot Assistant Stream",
			stage: "audit_persist_failed",
			error,
			level: "warn",
		});
	}
}

/**
 * Streaming chatbot handler using Vercel AI SDK
 *
 * Provides real-time streaming of assistant responses with:
 * - AI-powered query classification
 * - Unified tool management (internal + external)
 * - Real-time confirmation prompts
 * - Streaming text responses
 */
export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();
		let authenticatedUserId: Id<"users"> | null = null;

		// Set up auth
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				logRouteError({
					route: "Chatbot Assistant Stream",
					stage: "convex_token_read_failed",
					error: err,
					level: "warn",
				});
			}
		}

		const {
			message,
			workspaceContext,
			workspaceId,
			conversationHistory,
			memberId,
		} = await req.json();

		if (!message || !workspaceId) {
			return new Response(
				JSON.stringify({ error: "Message and workspaceId are required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		// Verify authentication when memberId is provided
		if (memberId) {
			const isAuthenticated = await isAuthenticatedNextjs();
			if (!isAuthenticated) {
				return new Response(
					JSON.stringify({
						error: "Authentication required when specifying memberId",
					}),
					{ status: 401, headers: { "Content-Type": "application/json" } }
				);
			}

			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return new Response(JSON.stringify({ error: "User not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
			authenticatedUserId = currentUser._id;

			// Verify member ownership
			const member = await convex.query(api.members.getMemberById, {
				memberId: memberId as Id<"members">,
			});

			if (!member) {
				return new Response(JSON.stringify({ error: "Member not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}

			if (member.userId !== currentUser._id) {
				return new Response(
					JSON.stringify({
						error: "Unauthorized: Member belongs to different user",
					}),
					{ status: 403, headers: { "Content-Type": "application/json" } }
				);
			}
		}

		// AI-powered query classification (with caching)
		const queryIntent = await classifyAssistantQueryWithAI(message);

		console.log("[AI Classification]", {
			mode: queryIntent.mode,
			requiresExternal: queryIntent.requiresExternalTools,
			apps: queryIntent.requestedExternalApps,
			reasoning: queryIntent.reasoning,
		});

		// Initialize Composio if external tools needed
		let composio: Composio<any> | null = null;
		let workspaceEntityId: string | undefined;
		let connectedApps: string[] = [];

		if (queryIntent.requiresExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
				composio = new Composio({
					apiKey: process.env.COMPOSIO_API_KEY,
					provider: new VercelProvider(),
				});

				workspaceEntityId = getWorkspaceEntityId(
					workspaceId as Id<"workspaces">
				);

				const connections = await (composio as any).integrations?.list({
					entityId: workspaceEntityId,
				});
				const activeConnections = (connections || []).filter(
					(c: any) => c.status === "ACTIVE"
				);
				connectedApps = activeConnections.map(
					(c: any) => c.appName?.toUpperCase() || "UNKNOWN"
				);

				if (activeConnections.length === 0) {
					console.log("[Composio] No active connections found");
					composio = null;
				}
			} catch (error) {
				console.error("[Composio] Initialization failed:", error);
				composio = null;
			}
		}

		// Create unified tool manager
		const toolManager = new UnifiedToolManager({
			convex,
			composio: composio || undefined,
			workspaceId: workspaceId as Id<"workspaces">,
			userId: authenticatedUserId || undefined,
			workspaceEntityId,
		});

		// Get all relevant tools
		const tools = await toolManager.getAllTools({
			includeInternal: true,
			includeExternal: queryIntent.requiresExternalTools,
			requestedApps: queryIntent.requestedExternalApps,
		});

		console.log("[Tools] Loaded", {
			totalTools: Object.keys(tools).length,
			internalIncluded: true,
			externalIncluded: queryIntent.requiresExternalTools,
		});

		// Build message history
		const sanitizedHistory = (
			Array.isArray(conversationHistory) ? conversationHistory : []
		)
			.filter((msg: any) => {
				const allowedRoles = ["user", "assistant"];
				return (
					msg &&
					allowedRoles.includes(msg.role) &&
					typeof msg.content === "string"
				);
			})
			.map((msg: any) => ({
				role: msg.role as "user" | "assistant",
				content: msg.content
					.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
					.trim(),
			}));

		// Stream response with AI SDK
		const result = await streamText({
			model: openai("gpt-4o-mini"),
			system: buildAssistantSystemPrompt({
				workspaceContext:
					typeof workspaceContext === "string" ? workspaceContext : "",
				connectedApps,
				externalToolsAllowed: true,
			}),
			messages: [
				...sanitizedHistory,
				{
					role: "user",
					content: message,
				},
			],
			tools,
			temperature: 0.7,
			onStepFinish: async (step) => {
				// Log tool executions
				if (step.toolCalls && step.toolCalls.length > 0) {
					for (const toolCall of step.toolCalls) {
						const toolCallAny = toolCall as any;
						const toolResult = (step.toolResults || []).find(
							(tr: any) => tr.toolCallId === toolCallAny.toolCallId
						) as any;
						const outcome =
							toolResult?.result?.success === false ? "error" : "success";

						await logExternalToolAuditEvent({
							convex,
							workspaceId: workspaceId as Id<"workspaces">,
							memberId: memberId as Id<"members"> | undefined,
							userId: authenticatedUserId ?? undefined,
							toolName: toolCallAny.toolName,
							toolkit: undefined,
							argumentsSnapshot: parseAndSanitizeArguments(
								JSON.stringify(toolCallAny.args)
							),
							outcome,
							error:
								outcome === "error"
									? String(toolResult?.result?.error || "Tool execution failed")
									: undefined,
							executionPath: "nextjs-streaming-ai-sdk",
							toolCallId: toolCallAny.toolCallId,
						});
					}
				}
			},
		});

		// Return streaming response
		return result.toTextStreamResponse();
	} catch (error: any) {
		logRouteError({
			route: "Chatbot Assistant Stream",
			stage: "request_failed",
			error,
		});

		return new Response(
			JSON.stringify({
				error: "An error occurred while processing your request",
				details: error.message,
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}
