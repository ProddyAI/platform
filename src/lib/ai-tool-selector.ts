import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { toolSelectionCache } from "./ai-cache";

/**
 * Zod schema for AI-powered tool selection
 */
const ToolSelectionSchema = z.object({
	selectedToolNames: z.array(z.string()).describe(
		"Array of tool names that are most relevant for the user's query. Select tools that directly help accomplish the task. Be selective - only choose tools that are clearly needed."
	),
	reasoning: z.string().describe(
		"Brief explanation of why these specific tools were selected and how they'll help accomplish the task"
	),
	primaryAction: z.enum([
		"create", "read", "update", "delete", "send", "list", "search", "get"
	]).describe(
		"The primary action the user wants to perform"
	),
});

/**
 * AI-powered tool selector using GPT-4o-mini with structured output
 *
 * Replaces the deterministic scoring system with AI-powered tool selection
 * that better understands context, user intent, and tool capabilities.
 *
 * @param tools - Array of available tools with their metadata
 * @param query - The user's query message
 * @param options - Configuration options
 * @returns Promise with selected tools and reasoning
 */
export async function selectToolsWithAI(
	tools: Array<{
		name: string;
		description?: string;
		app?: string;
		toolkit?: string;
		[key: string]: any;
	}>,
	query: string,
	options: {
		maxTools?: number;
		requiredApps?: string[];
	} = {}
): Promise<{
	selectedTools: Array<any>;
	reasoning: string;
	primaryAction: string;
}> {
	const { maxTools = 20, requiredApps = [] } = options;

	// Generate cache key (query + tool names hash)
	const toolNamesHash = tools.map(t => t.name).sort().join(",").slice(0, 100);
	const cacheKey = `${query}:${toolNamesHash}:${requiredApps.join(",")}`;

	// Check cache first
	const cached = toolSelectionCache.get(cacheKey);
	if (cached) {
		console.log("[Cache Hit] Tool selection");
		// Map cached tool names back to actual tool objects
		const selectedToolNames = new Set(cached.selectedToolNames);
		const selectedTools = tools.filter(t => selectedToolNames.has(t.name));
		return {
			selectedTools,
			reasoning: cached.reasoning,
			primaryAction: cached.primaryAction,
		};
	}

	// Pre-filter by required apps if specified
	let availableTools = tools;
	if (requiredApps.length > 0) {
		const requiredAppsLower = requiredApps.map(app => app.toLowerCase());
		availableTools = tools.filter(tool =>
			requiredAppsLower.includes(tool.app?.toLowerCase() || "")
		);
	}

	// If too many tools, do a simple pre-filtering to reduce context size
	if (availableTools.length > 100) {
		// Extract keywords from query for basic filtering
		const queryLower = query.toLowerCase();
		const keywords = extractBasicKeywords(queryLower);

		availableTools = availableTools.filter(tool => {
			const toolName = tool.name.toLowerCase();
			const toolDesc = (tool.description || "").toLowerCase();
			return keywords.some(keyword =>
				toolName.includes(keyword) || toolDesc.includes(keyword)
			);
		});

		// If still too many, just take first 100
		if (availableTools.length > 100) {
			availableTools = availableTools.slice(0, 100);
		}
	}

	// Create a concise tool catalog for the AI
	const toolCatalog = availableTools.map(tool => ({
		name: tool.name,
		description: tool.description || "No description available",
		app: tool.app || "Unknown",
	}));

	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: ToolSelectionSchema,
			prompt: `You are a tool selection expert. Given a user query and a list of available tools, select the most relevant tools that will help accomplish the task.

User Query: "${query}"

Available Tools (${toolCatalog.length} tools):
${toolCatalog.map(t => `- ${t.name} (${t.app}): ${t.description}`).join('\n')}

Selection Guidelines:
1. Be highly selective - only choose tools that are directly needed for the task
2. Prefer tools with clear, specific actions over generic ones
3. Consider the primary action (create, read, update, delete, send, list, etc.)
4. For "send email" queries, select email sending tools
5. For "create issue" queries, select issue creation tools
6. For "list" or "show" queries, select listing/fetching tools
7. Select a maximum of ${maxTools} tools, but prefer fewer if possible
8. If multiple tools seem similar, choose the most specific one
9. Dashboard tools are generally well-tested and preferred
10. Consider the app in the tool name (GMAIL_, GITHUB_, SLACK_, etc.)

Provide your selection:`,
		});

		// Filter tools based on AI selection
		const selectedToolNamesSet = new Set(result.object.selectedToolNames);
		const selectedTools = availableTools.filter(tool =>
			selectedToolNamesSet.has(tool.name)
		);

		// Ensure we don't exceed maxTools
		const finalSelectedTools = selectedTools.slice(0, maxTools);

		const response = {
			selectedTools: finalSelectedTools,
			reasoning: result.object.reasoning,
			primaryAction: result.object.primaryAction,
		};

		// Cache the result (store tool names for cache efficiency)
		toolSelectionCache.set(cacheKey, {
			selectedToolNames: finalSelectedTools.map(t => t.name),
			reasoning: result.object.reasoning,
			primaryAction: result.object.primaryAction,
		});

		return response;
	} catch (error) {
		console.error("AI tool selection failed, falling back to simple filtering:", error);

		// Fallback: simple keyword-based filtering
		const queryLower = query.toLowerCase();
		const keywords = extractBasicKeywords(queryLower);

		const scoredTools = availableTools.map(tool => {
			let score = 0;
			const toolName = tool.name.toLowerCase();
			const toolDesc = (tool.description || "").toLowerCase();

			keywords.forEach(keyword => {
				if (toolName.includes(keyword)) score += 30;
				else if (toolDesc.includes(keyword)) score += 15;
			});

			// Action matching
			const actions = ["create", "list", "get", "update", "delete", "send", "search"];
			actions.forEach(action => {
				if (queryLower.includes(action) && toolName.includes(action)) {
					score += 40;
				}
			});

			return { ...tool, _score: score };
		});

		const fallbackTools = scoredTools
			.filter(t => t._score > 0)
			.sort((a, b) => b._score - a._score)
			.slice(0, maxTools);

		return {
			selectedTools: fallbackTools.length > 0 ? fallbackTools : availableTools.slice(0, maxTools),
			reasoning: "AI selection failed, used fallback keyword matching",
			primaryAction: "get",
		};
	}
}

/**
 * Extract basic keywords from query for fallback filtering
 */
function extractBasicKeywords(query: string): string[] {
	const keywords: string[] = [];

	// App keywords
	const apps = ["gmail", "github", "slack", "notion", "clickup", "linear"];
	apps.forEach(app => {
		if (query.includes(app)) keywords.push(app);
	});

	// Action keywords
	const actions = ["create", "send", "list", "get", "update", "delete", "search", "find", "show"];
	actions.forEach(action => {
		if (query.includes(action)) keywords.push(action);
	});

	// Entity keywords
	const entities = [
		"email", "mail", "inbox", "message",
		"issue", "pr", "pull", "commit", "repo", "repository", "branch",
		"channel", "dm", "conversation", "workspace",
		"page", "database", "block", "note", "doc",
		"task", "project", "list", "folder", "goal",
		"ticket", "bug", "feature", "cycle", "sprint"
	];
	entities.forEach(entity => {
		if (query.includes(entity)) keywords.push(entity);
	});

	return [...new Set(keywords)];
}

/**
 * Batch select tools for multiple queries in parallel
 */
export async function selectToolsForQueriesBatch(
	queries: Array<{ query: string; tools: Array<any>; options?: any }>
): Promise<Array<{
	selectedTools: Array<any>;
	reasoning: string;
	primaryAction: string;
}>> {
	return Promise.all(
		queries.map(({ query, tools, options }) =>
			selectToolsWithAI(tools, query, options)
		)
	);
}
