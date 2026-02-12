import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
	buildActionableErrorPayload,
	buildComposioFailureGuidance,
	logRouteError,
	sanitizeErrorMessage,
} from "@/lib/assistant-error-utils";
import { createComposioClient } from "@/lib/composio-config";

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

// Get Composio tools for OpenAI
export async function POST(req: NextRequest) {
	try {
		// Check for required environment variable early
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "OPENAI_API_KEY is not configured" },
				{ status: 500 }
			);
		}

		const { entityId, appNames, message } = await req.json();

		if (!entityId || !appNames || !message) {
			return NextResponse.json(
				{ error: "entityId, appNames, and message are required" },
				{ status: 400 }
			);
		}

		const composio = createComposioClient();

		// Get tools for the specified apps using the Composio SDK
		let tools: any[] = [];
		try {
			// Get all available tools for the entity with specific apps
			for (const appName of appNames) {
				try {
					const appTools = await composio.tools.get(entityId, appName);
					if (Array.isArray(appTools)) {
						tools.push(...appTools);
					} else if (appTools) {
						tools.push(appTools);
					}
				} catch (error) {
					logRouteError({
						route: "Composio Tools",
						stage: "app_tools_missing",
						error,
						level: "warn",
						context: { appName },
					});
				}
			}
		} catch (error) {
			logRouteError({
				route: "Composio Tools",
				stage: "tools_fetch_failed",
				error,
			});
			tools = [];
		}

		// Convert Composio tools to OpenAI format
		const openaiTools = tools.map((tool: any) => ({
			type: "function" as const,
			function: {
				name: tool.name || tool.slug,
				description: tool.description,
				parameters: tool.parameters || tool.schema || {},
			},
		}));

		// Use the tools with OpenAI directly
		const completion = await openai.chat.completions.create({
			model: "gpt-5-mini",
			tools: openaiTools.length > 0 ? openaiTools : undefined,
			messages: [
				{
					role: "system",
					content: `You are a helpful assistant with access to ${appNames.join(", ")} tools. Help the user accomplish their tasks using these tools.`,
				},
				{
					role: "user",
					content: message,
				},
			],
			temperature: 0.7,
			max_tokens: 1000,
		});

		let responseText =
			completion.choices[0]?.message?.content || "No response generated";
		const toolResults: any[] = [];

		// Execute any tool calls with Composio
		if (
			completion.choices[0]?.message?.tool_calls &&
			completion.choices[0].message.tool_calls.length > 0
		) {
			for (const toolCall of completion.choices[0].message.tool_calls) {
				if (toolCall.type === "function") {
					try {
						const result = await composio.tools.execute(
							toolCall.function.name,
							JSON.parse(toolCall.function.arguments)
						);

						toolResults.push({
							toolCallId: toolCall.id,
							result: result,
							toolName: toolCall.function.name,
						});
					} catch (error) {
						logRouteError({
							route: "Composio Tools",
							stage: "tool_execution_error",
							error,
							context: { toolName: toolCall.function.name },
						});
						toolResults.push({
							toolCallId: toolCall.id,
							error: sanitizeErrorMessage(
								error instanceof Error ? error.message : "Unknown error"
							),
							toolName: toolCall.function.name,
						});
					}
				}
			}

			// If we have tool results, create a follow-up completion
			if (toolResults.length > 0) {
				const followUpMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
					{
						role: "system",
						content: `You are a helpful assistant with access to ${appNames.join(", ")} tools. Help the user accomplish their tasks using these tools.`,
					},
					{
						role: "user",
						content: message,
					},
					completion.choices[0].message,
					...toolResults.map((result) => ({
						role: "tool" as const,
						tool_call_id: result.toolCallId,
						content: result.error
							? `Error: ${result.error}`
							: JSON.stringify(result.result),
					})),
				];

				const followUpCompletion = await openai.chat.completions.create({
					model: "gpt-5-mini",
					messages: followUpMessages,
					temperature: 0.7,
					max_tokens: 1000,
				});

				responseText =
					followUpCompletion.choices[0]?.message?.content || responseText;
			}
		}

		return NextResponse.json({
			success: true,
			response: responseText,
			toolCalls: completion.choices[0]?.message?.tool_calls || [],
			toolResults,
			availableTools: tools.length,
		});
	} catch (error) {
		logRouteError({
			route: "Composio Tools",
			stage: "tools_post_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Composio tools request failed.",
				nextStep: buildComposioFailureGuidance(),
				code: "COMPOSIO_TOOLS_POST_FAILED",
				recoverable: true,
			}),
			{ status: 500 }
		);
	}
}

// Get available tools for an entity
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const entityId = searchParams.get("entityId");
		const appNames = searchParams.get("appNames")?.split(",") || [];

		if (!entityId) {
			return NextResponse.json(
				{ error: "entityId is required" },
				{ status: 400 }
			);
		}

		const composio = createComposioClient();

		// Get tools for the specified apps
		let tools: any[] = [];

		if (appNames.length > 0) {
			// Get tools for specific apps
			for (const appName of appNames) {
				try {
					const appTools = await composio.tools.get(entityId, appName);
					if (Array.isArray(appTools)) {
						tools.push(...appTools);
					} else if (appTools) {
						tools.push(appTools);
					}
				} catch (error) {
					logRouteError({
						route: "Composio Tools",
						stage: "app_tools_missing_get",
						error,
						level: "warn",
						context: { appName },
					});
				}
			}
		} else {
			// Get all available tools for the entity
			try {
				const allTools = await composio.tools.get(entityId, {} as any);
				tools = Array.isArray(allTools) ? allTools : [allTools];
			} catch (error) {
				logRouteError({
					route: "Composio Tools",
					stage: "entity_tools_missing_get",
					error,
					level: "warn",
					context: { entityId },
				});
				tools = [];
			}
		}

		return NextResponse.json({
			success: true,
			tools: tools.map((tool: any) => ({
				name: tool.name || tool.slug,
				description: tool.description,
				parameters: tool.parameters || tool.schema || {},
				appName: tool.appName || tool.app_name,
			})),
			count: tools.length,
		});
	} catch (error) {
		logRouteError({
			route: "Composio Tools",
			stage: "tools_get_failed",
			error,
		});
		return NextResponse.json(
			buildActionableErrorPayload({
				message: "Unable to fetch available Composio tools.",
				nextStep:
					"Confirm the account is connected, then retry the tools request.",
				code: "COMPOSIO_TOOLS_GET_FAILED",
				recoverable: true,
			}),
			{ status: 500 }
		);
	}
}
