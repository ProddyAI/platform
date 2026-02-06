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
	type AvailableApp,
	createComposioClient,
	filterToolsForQuery,
	getAllToolsForApps,
	getAnyConnectedApps,
	getWorkspaceEntityId,
} from "@/lib/composio-config";

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

		// Pass auth through to Convex so membership/tasks/channels work.
		// We attempt token retrieval even if isAuthenticatedNextjs() is false, because
		// auth state can depend on request cookies and runtime environment.
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			} else if (isAuthenticatedNextjs()) {
				console.warn(
					"[Chatbot Assistant] Authenticated session but no Convex token found"
				);
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				console.warn(
					"[Chatbot Assistant] Failed to read Convex auth token from request",
					err
				);
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

		// Detect if query needs external tools (Gmail, GitHub, Slack, Notion, ClickUp, or Linear)
		// Tightened patterns to require explicit app names or contextual phrases to reduce false positives
		const queryLower = message.toLowerCase();
		const needsGmail =
			/\b(gmail|send\s+email|email\s+to|in\s+gmail|my\s+inbox|draft\s+email)\b/i.test(
				queryLower
			);
		const needsGithub =
			/\b(github|github\s+(repo|issue|pr|commit)|in\s+github|on\s+github)\b/i.test(
				queryLower
			);
		const needsSlack =
			/\b(slack|slack\s+(message|channel)|in\s+slack|on\s+slack|send\s+to\s+slack)\b/i.test(
				queryLower
			);
		const needsNotion =
			/\b(notion|notion\s+(page|database)|in\s+notion|on\s+notion|my\s+notion)\b/i.test(
				queryLower
			);
		const needsClickup =
			/\b(clickup|clickup\s+(task|project)|in\s+clickup|on\s+clickup|my\s+clickup)\b/i.test(
				queryLower
			);
		const needsLinear =
			/\b(linear|linear\s+(issue|ticket)|in\s+linear|on\s+linear|my\s+linear)\b/i.test(
				queryLower
			);
		const needsExternalTools =
			needsGmail ||
			needsGithub ||
			needsSlack ||
			needsNotion ||
			needsClickup ||
			needsLinear;

		// If external tools are needed and Composio is configured, try to use it
		if (needsExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
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
					}
				}
			} catch (_error) {
				// Composio setup failed, fall back to Convex
				console.warn(
					"[Chatbot Assistant] Composio initialization failed, using Convex fallback"
				);
			}
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
						content: msg.content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim(),
					}));

				const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
					{
						role: "system",
						content: `You are Proddy AI, an intelligent workspace assistant with access to ${connectedApps.join(", ")} integrations. Help the user accomplish their tasks using these tools when appropriate. For workspace-related queries (messages, tasks, notes), acknowledge that you can help but may need to access workspace data. ${workspaceContext || ""}`,
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
					model: "gpt-4o-mini",
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
					try {
						// Use Composio's provider.handleToolCalls method (matches sample code pattern)
						const result = await composioClient.provider.handleToolCalls(
							userId,
							completion
						);

						// Extract tool results for display
						toolResults = Array.isArray(result) ? result : [result];

						// Create source badges for executed tools
						const toolCalls = completion.choices[0].message.tool_calls as any[];
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

						// Log warning if counts differ
						if (toolCalls.length !== toolResults.length) {
							console.warn(
								`[Chatbot Assistant] Tool calls and results count mismatch: ${toolCalls.length} calls, ${toolResults.length} results`
							);
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
							model: "gpt-4o-mini",
							messages: followUpMessages,
							temperature: 0.7,
							max_tokens: 1500,
						});

						responseText =
							followUpCompletion.choices[0]?.message?.content || responseText;
					} catch (toolError) {
						console.error(
							"[Chatbot Assistant] Tool execution failed:",
							toolError
						);
						responseText +=
							"\n\nNote: Some operations could not be completed. Please try again or check your integration settings.";
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
				});
			} catch (error) {
				console.error(
					"[Chatbot Assistant] OpenAI+Composio failed, falling back to Convex:",
					error
				);
				// Fall through to Convex assistant
			}
		}

		// Default: Use Convex assistant (Gemini-based)
		try {
			const result = await convex.action(api.chatbot.askAssistant, {
				query: message,
				workspaceId: workspaceId as Id<"workspaces">,
			});

			const responseText = result?.answer || "No response generated";
			const sources = (result?.sources ?? []).map((s: string, idx: number) => ({
				id: `source-${idx}`,
				type: "source",
				text: s,
			}));

			const actions = Array.isArray((result as any)?.actions)
				? (result as any).actions
				: [];

			return NextResponse.json({
				success: true,
				response: responseText,
				sources,
				actions,
				toolResults: [],
				assistantType: "convex",
				composioToolsUsed: false,
			});
		} catch (error) {
			console.error("[Chatbot Assistant] Convex assistant failed:", error);
			return NextResponse.json(
				{
					success: false,
					error:
						error instanceof Error
							? error.message
							: "Failed to generate assistant response",
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("[Chatbot Assistant] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
