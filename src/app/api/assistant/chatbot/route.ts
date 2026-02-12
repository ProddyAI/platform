import type { Composio } from "@composio/core";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
	buildActionableErrorPayload,
	buildComposioFailureGuidance,
	buildRecoverableAssistantFallback,
	logRouteError,
} from "@/lib/assistant-error-utils";
import {
	buildAssistantResponseMetadata,
	buildAssistantSystemPrompt,
	classifyAssistantQuery,
} from "@/lib/assistant-orchestration";
import { parseAndSanitizeArguments } from "@/lib/assistant-tool-audit";
import {
	type AvailableApp,
	createComposioClient,
	filterToolsForQuery,
	getAllToolsForApps,
	getAnyConnectedApps,
	getWorkspaceEntityId,
} from "@/lib/composio-config";
import {
	buildCancellationMessage,
	buildConfirmationRequiredMessage,
	getHighImpactToolNames,
	getUserConfirmationDecision,
} from "@/lib/high-impact-action-confirmation";

export const dynamic = "force-dynamic";

/**
 * Create a Convex HTTP client configured from the NEXT_PUBLIC_CONVEX_URL environment variable.
 *
 * @returns A ConvexHttpClient instance pointed at the Convex backend URL from `NEXT_PUBLIC_CONVEX_URL`.
 * @throws If the `NEXT_PUBLIC_CONVEX_URL` environment variable is not set.
 */
function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

/**
 * Create an OpenAI client configured from the `OPENAI_API_KEY` environment variable.
 *
 * @returns An `OpenAI` client instance configured with the value of `OPENAI_API_KEY`.
 * @throws If `OPENAI_API_KEY` is not set in the environment.
 */
function createOpenAIClient(): OpenAI {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY environment variable is required");
	}
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});
}

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
			route: "Chatbot Assistant",
			stage: "audit_persist_failed",
			error,
			level: "warn",
		});
	}
}

/**
 * Handle chatbot POST requests by routing the user's query through OpenAI+Composio tool integration when applicable, otherwise falling back to the Convex-based assistant.
 *
 * This endpoint:
 * - Validates request payload and optional member-scoped access.
 * - Detects whether external integrations are needed and, if configured, attempts to use Composio tools together with OpenAI (including executing tool calls and performing follow-up reasoning).
 * - Falls back to the Convex assistant if Composio/OpenAI path is unavailable or fails.
 *
 * @param req - The incoming Next.js request whose JSON body must contain `message` and `workspaceId`, and may include `workspaceContext`, `conversationHistory`, and `memberId`.
 * @returns A JSON object describing the assistant result:
 * - `success`: `true` if a response was generated, `false` otherwise.
 * - On success:
 *   - `response`: Assistant reply text.
 *   - `sources`: Array of source badges `{ id, type, text }`.
 *   - `actions`: Array of suggested actions (may be empty).
 *   - `toolResults`: Array of executed tool results (empty if none).
 *   - `assistantType`: `'openai-composio'` when OpenAI+Composio was used, `'convex'` when using the Convex assistant.
 *   - `composioToolsUsed`: `true` if Composio tools were applied, `false` otherwise.
 *   - `connectedApps`: Present when OpenAI+Composio path was used and lists connected integrations.
 * - On failure:
 *   - `error`: A string describing the failure.
 */
export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();
		let authenticatedUserId: Id<"users"> | null = null;

		// Pass auth through to Convex so membership/tasks/channels work.
		// We attempt token retrieval even if isAuthenticatedNextjs() is false, because
		// auth state can depend on request cookies and runtime environment.
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			} else if (isAuthenticatedNextjs()) {
				logRouteError({
					route: "Chatbot Assistant",
					stage: "missing_convex_token",
					error: new Error("Authenticated session but no Convex token found"),
					level: "warn",
				});
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				logRouteError({
					route: "Chatbot Assistant",
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

			// Get the authenticated user's information
			const token = await convexAuthNextjsToken();
			if (token && typeof token === "string") {
				convex.setAuth(token);
			}

			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return NextResponse.json({ error: "User not found" }, { status: 404 });
			}
			authenticatedUserId = currentUser._id;

			// Get the member for this workspace and verify ownership
			const member = await convex.query(api.members.getMemberById, {
				memberId: memberId as Id<"members">,
			});

			if (!member) {
				return NextResponse.json(
					{ error: "Member not found" },
					{ status: 404 }
				);
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
		}

		// Check if Composio integration is available and relevant
		let useComposio: boolean = false;
		let connectedApps: AvailableApp[] = [];
		let composioTools: any[] = []; // Keep as any[] for OpenAI compatibility
		let composioClient: Composio | null = null; // Store composio client for reuse
		let userId: string = ""; // Composio uses userId as entity identifier
		let composioFallbackReason: string | null = null;
		let composioAttempted = false;
		const queryIntent = classifyAssistantQuery(message);
		const needsExternalTools = queryIntent.requiresExternalTools;

		// If external tools are needed and Composio is configured, try to use it
		if (needsExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
				composioAttempted = true;
				composioClient = createComposioClient();
				userId = memberId
					? `member_${memberId}`
					: getWorkspaceEntityId(workspaceId);

				// Get connected apps
				const apps = await getAnyConnectedApps(
					composioClient,
					workspaceId,
					userId
				);
				connectedApps = apps
					.filter((app) => app.connected)
					.map((app) => app.app);

				if (connectedApps.length > 0) {
					// Get all available tools
					const allTools = await getAllToolsForApps(
						composioClient,
						userId,
						connectedApps
					);

					// Filter tools based on query
					composioTools = filterToolsForQuery(allTools, message, {
						maxTools: 20, // Limit tools to avoid token overflow
						preferDashboard: true,
					});

					if (composioTools.length > 0) {
						useComposio = true;
					} else {
						composioFallbackReason = "no_matching_composio_tools";
					}
				} else {
					composioFallbackReason = "no_connected_apps";
				}
			} catch (_error) {
				// Composio setup failed, fall back to Convex
				composioFallbackReason = "composio_initialization_failed";
				logRouteError({
					route: "Chatbot Assistant",
					stage: "composio_initialization_failed",
					error: new Error(
						"Composio initialization failed, using Convex fallback"
					),
					level: "warn",
				});
			}
		} else if (needsExternalTools) {
			composioFallbackReason = "composio_not_configured";
		}

		// If Composio should be used, handle with OpenAI + Composio tools
		if (useComposio && composioTools.length > 0 && composioClient) {
			try {
				const openai = createOpenAIClient();
				// Reuse the composio client that already has userId context
				// userId is already set from the previous block

				// Build messages array
				// Sanitize conversation history to prevent system prompt injection
				const sanitizedHistory = (conversationHistory || [])
					.filter((msg: any) => {
						// Only allow 'user' and 'assistant' roles, block 'system' and unknown roles
						const allowedRoles = ["user", "assistant"];
						return (
							msg &&
							allowedRoles.includes(msg.role) &&
							typeof msg.content === "string"
						);
					})
					.map((msg: any) => ({
						role: msg.role as "user" | "assistant",
						// Strip control characters and normalize content
						content: msg.content
							.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
							.trim(),
					}));

				const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
					{
						role: "system",
						content: buildAssistantSystemPrompt({
							workspaceContext:
								typeof workspaceContext === "string" ? workspaceContext : "",
							connectedApps,
							externalToolsAllowed: true,
						}),
					},
					// Add sanitized conversation history
					...sanitizedHistory,
					{
						role: "user",
						content: message,
					},
				];

				// Create completion with tools
				const completion = await openai.chat.completions.create({
					model: "gpt-5-mini",
					tools: composioTools,
					messages,
					temperature: 0.7,
					max_tokens: 1500,
				});

				let responseText =
					completion.choices[0]?.message?.content || "No response generated";
				let toolResults: any[] = [];
				let sources: any[] = [];

				// Execute tool calls if any
				if (
					completion.choices[0]?.message?.tool_calls &&
					completion.choices[0].message.tool_calls.length > 0
				) {
					const toolCalls = completion.choices[0].message.tool_calls as any[];
					const highImpactToolNames = getHighImpactToolNames(toolCalls);
					const decision = getUserConfirmationDecision(message);

					if (highImpactToolNames.length > 0) {
						if (decision === "cancel") {
							return NextResponse.json({
								success: true,
								response: buildCancellationMessage(highImpactToolNames),
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
										internalEnabled: true,
										externalEnabled: true,
										externalUsed: false,
										connectedApps,
									},
								}),
							});
						}

						if (decision !== "confirm") {
							return NextResponse.json({
								success: true,
								response: buildConfirmationRequiredMessage(highImpactToolNames),
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
										internalEnabled: true,
										externalEnabled: true,
										externalUsed: false,
										connectedApps,
									},
								}),
							});
						}
					}

					try {
						// Use Composio's provider.handleToolCalls method (matches sample code pattern)
						const result = await composioClient.provider.handleToolCalls(
							userId,
							completion
						);

						// Extract tool results for display
						toolResults = Array.isArray(result) ? result : [result];

						// Create source badges for executed tools
						sources = toolCalls.map((call, idx) => ({
							id: `tool-${idx}`,
							type: "tool",
							text: `${call.function?.name || "Tool"} executed`,
						}));

						// Build result map indexed by tool call id for safe lookup
						const resultMap: Record<string, any> = {};
						toolCalls.forEach((call, idx) => {
							resultMap[call.id] = toolResults[idx] ?? { success: true };
						});

						await Promise.all(
							toolCalls.map(async (call) => {
								const toolResult = resultMap[call.id];
								const outcome: "success" | "error" =
									toolResult?.success === false || Boolean(toolResult?.error)
										? "error"
										: "success";

								await logExternalToolAuditEvent({
									convex,
									workspaceId: workspaceId as Id<"workspaces">,
									memberId: memberId as Id<"members"> | undefined,
									userId: authenticatedUserId ?? undefined,
									toolName: call.function?.name || "unknown_tool",
									toolkit: undefined,
									argumentsSnapshot: parseAndSanitizeArguments(
										call.function?.arguments || "{}"
									),
									outcome,
									error:
										outcome === "error"
											? String(
													toolResult?.error ||
														toolResult?.message ||
														"Tool execution failed"
												)
											: undefined,
									executionPath: "nextjs-openai-composio",
									toolCallId: call.id,
								});
							})
						);

						// Log warning if counts differ
						if (toolCalls.length !== toolResults.length) {
							logRouteError({
								route: "Chatbot Assistant",
								stage: "tool_results_mismatch",
								error: new Error(
									`Tool calls and results count mismatch: ${toolCalls.length} calls, ${toolResults.length} results`
								),
								level: "warn",
							});
						}

						// Get follow-up response with tool results
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
							model: "gpt-5-mini",
							messages: followUpMessages,
							temperature: 0.7,
							max_tokens: 1500,
						});

						responseText =
							followUpCompletion.choices[0]?.message?.content || responseText;
					} catch (toolError) {
						logRouteError({
							route: "Chatbot Assistant",
							stage: "tool_execution_failed",
							error: toolError,
						});
						await Promise.all(
							toolCalls.map(async (call) => {
								await logExternalToolAuditEvent({
									convex,
									workspaceId: workspaceId as Id<"workspaces">,
									memberId: memberId as Id<"members"> | undefined,
									userId: authenticatedUserId ?? undefined,
									toolName: call.function?.name || "unknown_tool",
									toolkit: undefined,
									argumentsSnapshot: parseAndSanitizeArguments(
										call.function?.arguments || "{}"
									),
									outcome: "error",
									error:
										toolError instanceof Error
											? toolError.message
											: "Tool execution failed",
									executionPath: "nextjs-openai-composio",
									toolCallId: call.id,
								});
							})
						);
						responseText += `\n\nNote: I couldn't complete one or more ${connectedApps.join(", ")} actions. ${buildComposioFailureGuidance()}`;
					}
				}

				return NextResponse.json({
					success: true,
					response: responseText,
					sources,
					actions: [],
					toolResults,
					assistantType: "openai-composio",
					composioToolsUsed: true,
					connectedApps,
					metadata: buildAssistantResponseMetadata({
						assistantType: "openai-composio",
						executionPath: "nextjs-openai-composio",
						intent: queryIntent,
						tools: {
							internalEnabled: true,
							externalEnabled: true,
							externalUsed: toolResults.length > 0,
							connectedApps,
						},
					}),
				});
			} catch (error) {
				logRouteError({
					route: "Chatbot Assistant",
					stage: "openai_composio_failed",
					error,
					context: { connectedAppsCount: connectedApps.length },
				});
				composioAttempted = true;
				composioFallbackReason = "openai_composio_failed";
				// Fall through to Convex assistant
			}
		}

		// Default: Use new AI-driven assistant with database-chat
		try {
			// Get or create conversation for this workspace/user
			// Use memberId if available, otherwise use workspace ID
			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return NextResponse.json(
					{ success: false, error: "User not authenticated" },
					{ status: 401 }
				);
			}

			// Create a unique conversation ID for this workspace + user
			// In production, you'd want to persist this and reuse it
			const conversationId = await convex.mutation(
				api.assistantChat.createConversation,
				{
					workspaceId: workspaceId as Id<"workspaces">,
					userId: currentUser._id,
					title: "Assistant Chat",
				}
			);

			// Call the AI assistant with the message
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

			const responseText = result.content || "No response generated";
			const responseMetadata =
				result.metadata ??
				buildAssistantResponseMetadata({
					assistantType: "convex",
					executionPath: "convex-assistant",
					intent: queryIntent,
					tools: {
						internalEnabled: true,
						externalEnabled: false,
						externalUsed: false,
						connectedApps,
					},
					fallback: {
						attempted: composioAttempted || Boolean(composioFallbackReason),
						reason: composioFallbackReason,
					},
				});

			return NextResponse.json({
				success: true,
				response: responseText,
				sources: [],
				actions: [],
				toolResults: [],
				assistantType: "convex",
				composioToolsUsed: false,
				metadata: responseMetadata,
			});
		} catch (error) {
			logRouteError({
				route: "Chatbot Assistant",
				stage: "convex_assistant_failed",
				error,
				context: {
					composioAttempted,
					composioFallbackReason,
				},
			});
			if (composioAttempted || composioFallbackReason) {
				const fallbackResponse = buildRecoverableAssistantFallback(
					"The external tools path could not complete your request"
				);
				return NextResponse.json({
					success: true,
					response: fallbackResponse,
					sources: [],
					actions: [],
					toolResults: [],
					assistantType: "convex",
					composioToolsUsed: false,
					metadata: buildAssistantResponseMetadata({
						assistantType: "convex",
						executionPath: "convex-assistant",
						intent: queryIntent,
						tools: {
							internalEnabled: true,
							externalEnabled: false,
							externalUsed: false,
							connectedApps,
						},
						fallback: {
							attempted: true,
							reason: composioFallbackReason ?? "convex_assistant_failed",
						},
					}),
				});
			}
			return NextResponse.json(
				buildActionableErrorPayload({
					message: "Assistant response generation failed.",
					nextStep:
						"Retry your message. If it keeps failing, refresh and try a shorter prompt.",
					code: "ASSISTANT_RESPONSE_FAILED",
				}),
				{ status: 500 }
			);
		}
	} catch (error) {
		logRouteError({
			route: "Chatbot Assistant",
			stage: "request_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Assistant request failed before processing completed.",
				nextStep:
					"Check required fields and retry. If this persists, reconnect integrations and try again.",
				code: "ASSISTANT_REQUEST_FAILED",
			}),
			{ status: 500 }
		);
	}
}
