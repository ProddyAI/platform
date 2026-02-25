"use node";

import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { v } from "convex/values";
import { parseAndSanitizeArguments } from "../src/lib/assistant-tool-audit";
import { getAnyConnectedApps } from "../src/lib/composio-config";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

function filterToolSetForOpenAI(tools: Record<string, any>): Record<string, any> {
	const entries = Object.entries(tools).filter(([name]) => {
		if (!name || name.length > 64) return false;
		if (!/^[a-zA-Z0-9_-]+$/.test(name)) return false;
		return true;
	});
	return Object.fromEntries(entries);
}

function selectRelevantTools(
	tools: Record<string, any>,
	instruction: string,
	maxTools: number
): Record<string, any> {
	const entries = Object.entries(tools);
	const normalized = instruction.toLowerCase();

	const scored = entries.map(([name, tool]) => {
		const lowerName = name.toLowerCase();
		let score = 0;

		// Score based on instruction keywords matching tool name
		if (normalized.includes("github") && lowerName.includes("github"))
			score += 10;
		if (normalized.includes("slack") && lowerName.includes("slack")) score += 10;
		if (normalized.includes("message") && lowerName.includes("message"))
			score += 5;
		if (normalized.includes("post") && lowerName.includes("post")) score += 5;
		if (normalized.includes("send") && lowerName.includes("post"))
			score += 5;
		if (normalized.includes("list") && lowerName.includes("list")) score += 3;
		if (normalized.includes("rep") && lowerName.includes("repo")) score += 5;
		if (normalized.includes("issue") && lowerName.includes("issue"))
			score += 3;
		if (normalized.includes("channel") && lowerName.includes("channel"))
			score += 5;
		if (normalized.includes("user") && lowerName.includes("user"))
			score += 3;
		if (normalized.includes("commit") && lowerName.includes("commit"))
			score += 3;
		if (normalized.includes("branch") && lowerName.includes("branch"))
			score += 3;

		// Bonus for common action words that are typically executable
		if (lowerName.includes("list")) score += 1;
		if (lowerName.includes("get")) score += 1;
		if (lowerName.includes("create")) score += 1;
		if (lowerName.includes("post")) score += 2;
		if (lowerName.includes("send")) score += 2;

		return { name, tool, score };
	});

	const filtered = scored
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, maxTools);

	if (filtered.length > 0) {
		return Object.fromEntries(filtered.map((item) => [item.name, item.tool]));
	}
	return Object.fromEntries(entries.slice(0, maxTools));
}

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

		const composio = new Composio({
			apiKey: process.env.COMPOSIO_API_KEY,
			provider: new VercelProvider(),
		});

		const isActiveConnectionForApp = (connection: any, appName: string) => {
			const target = appName.toUpperCase();
			const slug = String(connection?.toolkit?.slug ?? "").toUpperCase();
			const app = String(connection?.appName ?? "").toUpperCase();
			const integrationId = String(connection?.integrationId ?? "").toUpperCase();
			const status = String(connection?.status ?? "").toUpperCase();
			return (
				status === "ACTIVE" &&
				(slug === target || app === target || integrationId === target)
			);
		};

		const connectedApps: string[] = [];
		const authConfigIdsByApp: Record<string, string> = {};
		let entityIdForTools = entityId;
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
					console.warn(
						"[executeComposioAction] Missing composioAuthConfigId for toolkit:",
						toolkit
					);
				} else {
					authConfigIdsByApp[appName] = authConfig.composioAuthConfigId;
				}

				const resolvedEntityId =
					connectedAccount.userId && connectedAccount.userId.length > 0
						? connectedAccount.userId
						: entityId;
				entityIdForTools = resolvedEntityId;
				connectedApps.push(appName);
			} catch {
				// Skip app if tools cannot be resolved
			}
		}

		if (connectedApps.length === 0) {
			console.warn(
				"[executeComposioAction] No connected accounts in DB. Checking Composio directly..."
			);
			const fallbackEntityIds = Array.from(
				new Set([entityId, `workspace_${workspaceId}`])
			);
			for (const appName of appNames) {
				let found = false;
				for (const candidateEntityId of fallbackEntityIds) {
					try {
						const connectionsResponse = await (composio as any).connectedAccounts.list({
							userIds: [candidateEntityId],
						});
						const connections = connectionsResponse?.items ?? [];
						const activeConnection = connections.find((connection: any) =>
							isActiveConnectionForApp(connection, appName)
						);
						if (activeConnection) {
							connectedApps.push(appName);
							entityIdForTools = candidateEntityId;
							found = true;
							break;
						}
					} catch (error) {
						console.warn(
							"[executeComposioAction] Failed to check Composio connections:",
							error
						);
					}
				}
				if (!found) {
					const fallbackConnections = await getAnyConnectedApps(
						composio as any,
						String(workspaceId),
						entityId
					);
					const matchedApp = fallbackConnections.find(
						(app) => app.connected && app.app === appName
					);
					if (matchedApp) {
						connectedApps.push(appName);
						entityIdForTools = matchedApp.entityId || entityId;
					}
				}
			}
		}

		if (connectedApps.length === 0) {
			return {
				success: false,
				error: `No tools available for ${appNames.join(", ")}. Please connect the app first.`,
			};
		}

		console.log(
			"[executeComposioAction] Preparing to execute for:",
			connectedApps.join(",")
		);

		const toolsByApp: Record<string, any> = {};
		for (const appName of connectedApps) {
			try {
				const authConfigId = authConfigIdsByApp[appName];
				const appTools = authConfigId
					? await composio.tools.get(entityIdForTools, {
							authConfigIds: [authConfigId],
							limit: 1000,
						})
					: await composio.tools.get(entityIdForTools, {
							toolkits: [appName.toLowerCase()],
							limit: 1000,
						});
				Object.assign(toolsByApp, appTools || {});
			} catch (error) {
				console.warn(
					"[executeComposioAction] Failed to fetch tools for",
					appName
				);
			}
		}

		const filteredTools = filterToolSetForOpenAI(toolsByApp);
		const tools = selectRelevantTools(filteredTools, message, 60);

		if (!tools || Object.keys(tools).length === 0) {
			return {
				success: false,
				error: "No tools could be resolved for connected apps.",
			};
		}

		// DON'T pass tools to generateText - we'll execute manually
		// This is because VercelProvider's automatic execute functions
		// may not work properly in the Convex environment
		const initialResult = await generateText({
			model: openai("gpt-4o-mini"),
			system: `You are a helpful assistant with access to ${connectedApps.join(", ")} tools. 

Available tools: ${Object.keys(tools).slice(0, 20).join(", ")}${Object.keys(tools).length > 20 ? ` and ${Object.keys(tools).length - 20} more...` : ""}

IMPORTANT: You MUST select the most appropriate tool to accomplish the user's request.
- For GitHub "list repositories": use GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER
- For GitHub  "get user info": use GITHUB_GET_THE_AUTHENTICATED_USER  
- For Slack "send message": use SLACK_CHAT_POST_MESSAGE

Respond with ONLY the tool name and parameters in this exact JSON format:
{"tool": "TOOL_NAME", "parameters": {}}

Example: {"tool": "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", "parameters": {}}`,
			messages: [{ role: "user", content: message }],
			temperature: 0.3,
		});

		// Parse the tool selection
		let toolSelection: { tool: string; parameters: any } | null = null;
		try {
			// Try to find and parse JSON in the response
			const jsonStart = initialResult.text.indexOf('{');
			const jsonEnd = initialResult.text.lastIndexOf('}');
			if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
				const jsonStr = initialResult.text.substring(jsonStart, jsonEnd + 1);
				toolSelection = JSON.parse(jsonStr);
			}
		} catch (e) {
			console.warn(
				"[executeComposioAction] Failed to parse tool selection"
			);
		}

		if (!toolSelection || !toolSelection.tool) {
			return {
				success: false,
				error: `Could not determine which tool to use. AI response: ${initialResult.text}`,
			};
		}

		// Execute the tool directly from the tools object
		let toolExecutionResult: any;
		const selectedTool = tools[toolSelection.tool];
		
		if (selectedTool && typeof (selectedTool as any).execute === "function") {
			try {
				toolExecutionResult = await (selectedTool as any).execute(
					toolSelection.parameters || {}
				);
			} catch (execError: any) {
				console.error(
					"[executeComposioAction] Tool execute failed:",
					execError.message
				);
				throw execError;
			}
		} else {
			const availableToolNames = Object.keys(tools)
				.slice(0, 5)
				.join(", ");
			console.error(
				"[executeComposioAction] Tool not found:",
				toolSelection.tool,
				"Available:",
				availableToolNames
			);
			return {
				success: false,
				error: `Tool ${toolSelection.tool} not found or not executable`,
			};
		}

		// Generate final response with the tool result
		const result = await generateText({
			model: openai("gpt-4o-mini"),
			system: `You are a helpful assistant. Present the tool execution result to the user in a clear, friendly way.`,
			messages: [
				{ role: "user", content: message },
				{
					role: "assistant",
					content: `Tool result: ${JSON.stringify(toolExecutionResult)}`,
				},
				{
					role: "user",
					content: "Please format this result in a user-friendly way.",
				},
			],
			temperature: 0.7,
		});

		// Log the tool audit
		await ctx.runMutation(
			internal.assistantToolAudits.logExternalToolAttemptInternal,
			{
				workspaceId,
				memberId,
				userId,
				toolName: toolSelection.tool,
				toolkit: connectedApps[0]?.toUpperCase(),
				argumentsSnapshot: parseAndSanitizeArguments(
					JSON.stringify(toolSelection.parameters ?? {})
				),
				outcome: toolExecutionResult?.error ? "error" : "success",
				error: toolExecutionResult?.error
					? String(toolExecutionResult.error)
					: undefined,
				executionPath: "convex-assistant",
				toolCallId: `manual_${Date.now()}`,
			}
		);

		return { success: true, response: result.text };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.error("[executeComposioAction] Error:", errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const getConnectedAppNamesFromComposio = action({
	args: {
		workspaceId: v.id("workspaces"),
		userId: v.id("users"),
	},
	returns: v.array(v.string()),
	handler: async (ctx, args) => {
		const memberId = await getMemberId(ctx, args.workspaceId, args.userId);
		if (!memberId) {
			return [];
		}
		const composio = new Composio({
			apiKey: process.env.COMPOSIO_API_KEY ?? "",
			provider: new VercelProvider(),
		});
		const connectedApps = await getAnyConnectedApps(
			composio as any,
			String(args.workspaceId),
			`member_${memberId}`
		);
		return connectedApps.filter((app) => app.connected).map((app) => app.app);
	},
});

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
