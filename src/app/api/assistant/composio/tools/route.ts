import { type NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
	buildActionableErrorPayload,
	buildComposioFailureGuidance,
	logRouteError,
	sanitizeErrorMessage,
} from "@/lib/assistant-error-utils";
import { createComposioClient } from "@/lib/composio-config";

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
		const tools = await (composio as any).getTools({ apps: appNames }, entityId);

		if (!tools || Object.keys(tools).length === 0) {
			return NextResponse.json(
				{ error: "No tools available for the requested apps." },
				{ status: 400 }
			);
		}

		const result = await generateText({
			model: openai("gpt-4o-mini"),
			system: `You are a helpful assistant with access to ${appNames.join(", ")} tools. Help the user accomplish their tasks using these tools.`,
			messages: [{ role: "user", content: message }],
			tools,
			temperature: 0.7,
		});

		const steps = Array.isArray(result.steps) ? result.steps : [];
		const toolCalls = steps.flatMap((step) => step.toolCalls ?? []);
		const toolResults = steps.flatMap((step) => step.toolResults ?? []);

		return NextResponse.json({
			success: true,
			response: result.text || "No response generated",
			toolCalls,
			toolResults,
			availableTools: Object.keys(tools).length,
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
