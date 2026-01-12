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

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

function createOpenAIClient(): OpenAI {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY environment variable is required");
	}
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});
}

export async function POST(req: NextRequest) {
	try {
		const convex = createConvexClient();

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

		if (memberId) {
			const isAuthenticated = await isAuthenticatedNextjs();
			if (!isAuthenticated) {
				return NextResponse.json(
					{ error: "Authentication required when specifying memberId" },
					{ status: 401 }
				);
			}

			const token = await convexAuthNextjsToken();
			if (token && typeof token === "string") {
				convex.setAuth(token);
			}

			const currentUser = await convex.query(api.users.current);
			if (!currentUser) {
				return NextResponse.json({ error: "User not found" }, { status: 404 });
			}

			const member = await convex.query(api.members._getMemberById, {
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

		let useComposio: boolean = false;
		let connectedApps: AvailableApp[] = [];
		let composioTools: any[] = []; // Keep as any[] for OpenAI compatibility
		let composioClient: Composio | null = null;
		let userId: string = "";

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

		if (needsExternalTools && process.env.COMPOSIO_API_KEY) {
			try {
				composioClient = createComposioClient();
				userId = memberId
					? `member_${memberId}`
					: getWorkspaceEntityId(workspaceId);

				const apps = await getAnyConnectedApps(
					composioClient,
					workspaceId,
					userId
				);
				connectedApps = apps
					.filter((app) => app.connected)
					.map((app) => app.app);

				if (connectedApps.length > 0) {
					const allTools = await getAllToolsForApps(
						composioClient,
						userId,
						connectedApps
					);

					composioTools = filterToolsForQuery(allTools, message, {
						maxTools: 20,
						preferDashboard: true,
					});

					if (composioTools.length > 0) {
						useComposio = true;
					}
				}
			} catch (_error) {
				console.warn(
					"[Chatbot Assistant] Composio initialization failed, using Convex fallback"
				);
			}
		}

		if (useComposio && composioTools.length > 0 && composioClient) {
			try {
				const openai = createOpenAIClient();

				const sanitizedHistory = (conversationHistory || [])
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
						content: msg.content.replace(/[\x00-\x1F\x7F]/g, "").trim(),
					}));

				const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
					{
						role: "system",
						content: `You are Proddy AI, an intelligent workspace assistant with access to ${connectedApps.join(", ")} integrations. Help the user accomplish their tasks using these tools when appropriate. For workspace-related queries (messages, tasks, notes), acknowledge that you can help but may need to access workspace data. ${workspaceContext || ""}`,
					},
					...sanitizedHistory,
					{
						role: "user",
						content: message,
					},
				];

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

				if (
					completion.choices[0]?.message?.tool_calls &&
					completion.choices[0].message.tool_calls.length > 0
				) {
					try {
						const result = await composioClient.provider.handleToolCalls(
							userId,
							completion
						);

						toolResults = Array.isArray(result) ? result : [result];

						const toolCalls = completion.choices[0].message.tool_calls as any[];
						sources = toolCalls.map((call, idx) => ({
							id: `tool-${idx}`,
							type: "tool",
							text: `${call.function?.name || "Tool"} executed`,
						}));

						const resultMap: Record<string, any> = {};
						toolCalls.forEach((call, idx) => {
							resultMap[call.id] = toolResults[idx] ?? { success: true };
						});

						if (toolCalls.length !== toolResults.length) {
							console.warn(
								`[Chatbot Assistant] Tool calls and results count mismatch: ${toolCalls.length} calls, ${toolResults.length} results`
							);
						}

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
			}
		}

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
