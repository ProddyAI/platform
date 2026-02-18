import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
	buildActionableErrorPayload,
	logRouteError,
} from "@/lib/assistant-error-utils";
import {
	buildAssistantResponseMetadata,
	buildAssistantSystemPrompt,
} from "@/lib/assistant-orchestration";
import { parseAndSanitizeArguments } from "@/lib/assistant-tool-audit";
import {
	getWorkspaceEntityId,
} from "@/lib/composio-config";
import {
	analyzeActionForConfirmation,
	buildCancellationMessage,
	buildConfirmationPrompt,
	parseUserConfirmationResponse,
} from "@/lib/ai-confirmation-logic";
import { classifyAssistantQueryWithAI } from "@/lib/ai-query-classifier";
import { UnifiedToolManager } from "@/lib/unified-tool-manager";

export const dynamic = "force-dynamic";

/**
 * Create a Convex HTTP client configured from the NEXT_PUBLIC_CONVEX_URL environment variable.
 */
function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

/**
 * Log external tool audit events to Convex
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
			route: "Chatbot Assistant (AI SDK)",
			stage: "audit_persist_failed",
			error,
			level: "warn",
		});
	}
}

/**
 * Modernized chatbot handler using Vercel AI SDK
 *
 * This endpoint:
 * - Uses AI-powered query classification (replaces regex-based)
 * - Uses AI-powered tool selection (replaces deterministic scoring)
 * - Uses AI-powered confirmation logic (replaces regex-based high-impact detection)
 * - Unified single-path architecture with better error handling
 * - Composio integration via VercelProvider for AI SDK
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
					route: "Chatbot Assistant (AI SDK)",
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
			return NextResponse.json(
				{ error: "Message and workspaceId are required" },
				{ status: 400 }
			);
		}

		// Verify authentication when memberId is provided
		if (memberId) {
			const isAuthenticated = await isAuthenticatedNextjs();
			if (!isAuthenticated) {
				return NextResponse.json(
					{ error: "Authentication required when specifying memberId" },
					{ status: 401 }
				);
			}

			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return NextResponse.json({ error: "User not found" }, { status: 404 });
			}
			authenticatedUserId = currentUser._id;

			// Verify member ownership
			const member = await convex.query(api.members.getMemberById, {
				memberId: memberId as Id<"members">,
			});

			if (!member) {
				return NextResponse.json({ error: "Member not found" }, { status: 404 });
			}

			if (member.userId !== currentUser._id) {
				return NextResponse.json(
					{ error: "Unauthorized: Member belongs to different user" },
					{ status: 403 }
				);
			}
		}

		// AI-powered query classification
		const queryIntent = await classifyAssistantQueryWithAI(message);

		console.log("[AI Classification]", {
			mode: queryIntent.mode,
			requiresExternal: queryIntent.requiresExternalTools,
			apps: queryIntent.requestedExternalApps,
			reasoning: queryIntent.reasoning,
		});

		//Initialize Composio if external tools needed and API key available
		let composio: Composio<any> | null = null;
		let workspaceEntityId: string | undefined;
		let connectedApps: string[] = [];

		if (queryIntent.requiresExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
				composio = new Composio({
					apiKey: process.env.COMPOSIO_API_KEY,
					provider: new VercelProvider(),
				});

				workspaceEntityId = getWorkspaceEntityId(workspaceId as Id<"workspaces">);

				// Check connected apps
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
					composio = null; // Don't use Composio if no apps connected
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

		// Get all relevant tools (internal + external)
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
		const sanitizedHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
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

		// First, generate initial response to see what tools will be called
		// We use maxSteps: 1 to stop before tool execution
		const initialResult = await generateText({
			model: openai("gpt-4o-mini"),
			system: buildAssistantSystemPrompt({
				workspaceContext: typeof workspaceContext === "string" ? workspaceContext : "",
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
		});

		// Check if there are tool calls that need confirmation
		const firstStep = initialResult.steps[0];
		if (firstStep?.toolCalls && firstStep.toolCalls.length > 0) {
			// AI-powered confirmation analysis
			const confirmationAnalysis = await analyzeActionForConfirmation(
				firstStep.toolCalls.map((tc: any) => ({
					name: tc.toolName,
					description: tools[tc.toolName]?.description,
					arguments: tc.args,
				})),
				message
			);

			console.log("[AI Confirmation Analysis]", confirmationAnalysis);

			// If confirmation required, check user's message for confirmation
			if (confirmationAnalysis.requiresConfirmation) {
				const userDecision = await parseUserConfirmationResponse(message);

				if (userDecision.decision === "cancel") {
					return NextResponse.json({
						success: true,
						response: buildCancellationMessage(confirmationAnalysis),
						sources: [],
						actions: [],
						toolResults: [],
						assistantType: "openai-composio",
						composioToolsUsed: false,
						connectedApps,
						metadata: buildAssistantResponseMetadata({
							assistantType: "openai-composio",
							executionPath: "nextjs-openai-composio",
							intent: queryIntent,
							tools: {
								internalEnabled: false,
								externalEnabled: true,
								externalUsed: false,
								connectedApps,
							},
						}),
					});
				}

				if (userDecision.decision !== "confirm") {
					// Need confirmation - return prompt
					return NextResponse.json({
						success: true,
						response: buildConfirmationPrompt(confirmationAnalysis),
						sources: [],
						actions: [],
						toolResults: [],
						assistantType: "openai-composio",
						composioToolsUsed: false,
						connectedApps,
						metadata: buildAssistantResponseMetadata({
							assistantType: "openai-composio",
							executionPath: "nextjs-openai-composio",
							intent: queryIntent,
							tools: {
								internalEnabled: false,
								externalEnabled: true,
								externalUsed: false,
								connectedApps,
							},
						}),
					});
				}
			}

			// User confirmed or no confirmation needed - proceed with execution
			// Log tool executions
			for (const toolCall of firstStep.toolCalls as any[]) {
				const toolResult = (firstStep.toolResults || []).find(
					(tr: any) => tr.toolCallId === toolCall.toolCallId
				) as any;
				const outcome = toolResult?.result?.success === false ? "error" : "success";
				await logExternalToolAuditEvent({
					convex,
					workspaceId: workspaceId as Id<"workspaces">,
					memberId: memberId as Id<"members"> | undefined,
					userId: authenticatedUserId ?? undefined,
					toolName: toolCall.toolName,
					toolkit: undefined,
					argumentsSnapshot: parseAndSanitizeArguments(
						JSON.stringify(toolCall.args)
					),
					outcome,
					error:
						outcome === "error"
							? String(
									toolResult?.result?.error || "Tool execution failed"
								)
							: undefined,
					executionPath: "nextjs-openai-composio-ai-sdk",
					toolCallId: toolCall.toolCallId,
				});
			}
		}

		const result = initialResult;

		// Build sources from tool calls
		const sources = result.steps
			.flatMap((step) => step.toolCalls || [])
			.map((toolCall, idx) => ({
				id: `tool-${idx}`,
				type: "tool",
				text: `${(toolCall as any).toolName} executed`,
			}));

		return NextResponse.json({
			success: true,
			response: result.text,
			sources,
			actions: [],
			toolResults: result.steps
				.flatMap((step) => step.toolResults || [])
				.map((tr: any) => tr.result),
			assistantType: "unified-ai-sdk",
			composioToolsUsed: composio !== null && queryIntent.requiresExternalTools,
			connectedApps,
			metadata: buildAssistantResponseMetadata({
				assistantType: "openai-composio",
				executionPath: "nextjs-openai-composio",
				intent: queryIntent,
				tools: {
					internalEnabled: true,
					externalEnabled: composio !== null,
					externalUsed: composio !== null && queryIntent.requiresExternalTools,
					connectedApps,
				},
			}),
		});

	} catch (error: any) {
		logRouteError({
			route: "Chatbot Assistant (AI SDK)",
			stage: "request_failed",
			error,
		});

		return NextResponse.json(
			buildActionableErrorPayload({
				message: "An error occurred while processing your request.",
				nextStep: "Retry in a few seconds. If it persists, refresh and try again.",
				code: "ASSISTANT_CHATBOT_FAILED",
				recoverable: true,
			}),
			{ status: 500 }
		);
	}
}
