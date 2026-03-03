import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { queryClassificationCache } from "./ai-cache";
import type {
	AssistantExternalApp,
	AssistantIntent,
} from "./assistant-orchestration";

/**
 * Zod schema for AI-powered query classification
 */
const QueryClassificationSchema = z.object({
	requiresExternalTools: z
		.boolean()
		.describe(
			"Whether this query requires external integrations (Gmail, GitHub, Slack, Notion, ClickUp, or Linear)"
		),
	requestedExternalApps: z
		.array(z.enum(["GMAIL", "GITHUB", "SLACK", "NOTION", "CLICKUP", "LINEAR"]))
		.describe(
			"List of external apps needed. Examples: ['GMAIL'] for email tasks, ['GITHUB'] for repository operations, ['SLACK'] for messaging, ['NOTION'] for notes, ['CLICKUP', 'LINEAR'] for project management. Empty array if no external tools needed."
		),
	requiresInternalTools: z
		.boolean()
		.describe(
			"Whether this query requires internal workspace data (calendar, tasks, channels, meetings, cards, notes, or workspace search)"
		),
	reasoning: z
		.string()
		.describe("Brief explanation of why this classification was chosen"),
});

/**
 * AI-powered query classifier using GPT-4o-mini with structured output
 *
 * Replaces the deterministic regex-based classification with AI-powered analysis
 * that better understands context and user intent.
 *
 * @param message - The user's query message
 * @returns Promise<AssistantIntent> - Classification result with mode, external apps, and reasoning
 */
export async function classifyAssistantQueryWithAI(
	message: string
): Promise<AssistantIntent & { reasoning: string }> {
	// Check cache first
	const cached = queryClassificationCache.get(message);
	if (cached) {
		console.log("[Cache Hit] Query classification");
		return cached;
	}

	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: QueryClassificationSchema,
			prompt: `You are an intelligent query classification system for a work management platform called Proddy. Your job is to analyze user queries and determine which tools and integrations are needed.

**User Query:** "${message}"

**Context About Proddy:**
Proddy is a unified workspace platform with:
- **Internal Tools:** Calendar, tasks, workspace channels, meetings, notes, cards, boards
- **External Integrations:** Gmail, GitHub, Slack, Notion, ClickUp, Linear

**Classification Task:**
Analyze this query and determine:
1. Does it need external app integrations (Gmail, GitHub, etc.)?
2. Does it need internal workspace data (calendar, tasks, channels)?
3. Which specific external apps are required?

**External App Detection Rules:**

**GMAIL** - Email operations:
- Keywords: email, gmail, send email, inbox, draft, mail, message (if clearly email)
- Examples: "send email to X", "check my inbox", "draft an email"
- NOT: "message the team" (could be Slack)

**GITHUB** - Code repository operations:
- Keywords: github, repo, repository, issue, pr, pull request, commit, branch, code
- Examples: "create a github issue", "list my repos", "merge this PR"

**SLACK** - Team messaging:
- Keywords: slack, slack channel, slack message, post to slack, dm on slack
- Examples: "send to slack", "post in #engineering", "slack the team"
- NOT: Generic "message" without slack context

**NOTION** - Documentation and notes:
- Keywords: notion, notion page, notion database, doc in notion
- Examples: "create a notion page", "update my notion doc"

**CLICKUP** - Project management:
- Keywords: clickup, clickup task, clickup project
- Examples: "create clickup task", "update clickup project"

**LINEAR** - Issue tracking:
- Keywords: linear, linear issue, linear ticket
- Examples: "create linear issue", "update linear ticket"

**Internal Tool Detection Rules:**

Keywords indicating internal data: workspace, channel, meeting, calendar, task, board, card, note, summary, search, assigned, today, tomorrow, this week, my schedule

**Important Disambiguation:**
- "message" alone → check context (email = Gmail, team chat = Slack, workspace = internal)
- "task" alone → internal (unless "clickup task" or "linear task")
- "issue" alone → check context (github issue vs linear issue)
- "send X to Y" → check destination (email = Gmail, slack = Slack, etc.)

**Example Classifications:**

1. "Send email to john@example.com about the meeting"
   → External: ["GMAIL"], Internal: true (meeting data), Mode: hybrid

2. "What's on my calendar today?"
   → External: [], Internal: true, Mode: internal

3. "Create a GitHub issue from this task"
   → External: ["GITHUB"], Internal: true (task data), Mode: hybrid

4. "Post my weekly summary to Slack"
   → External: ["SLACK"], Internal: true (summary data), Mode: hybrid

5. "Send message to the engineering team"
   → External: [], Internal: true (internal messaging), Mode: internal

6. "List my GitHub repositories"
   → External: ["GITHUB"], Internal: false, Mode: external

Provide your classification:`,
		});

		// Determine mode based on classification
		const requiresExternalTools = result.object.requiresExternalTools;
		const requiresInternalTools = result.object.requiresInternalTools;

		let mode: "internal" | "external" | "hybrid";
		if (requiresExternalTools && requiresInternalTools) {
			mode = "hybrid";
		} else if (requiresExternalTools) {
			mode = "external";
		} else {
			mode = "internal";
		}

		const response = {
			mode,
			requiresExternalTools: result.object.requiresExternalTools,
			requestedExternalApps: result.object
				.requestedExternalApps as AssistantExternalApp[],
			reasoning: result.object.reasoning,
		};

		// Cache the result
		queryClassificationCache.set(message, response);
		return response;
	} catch (error) {
		// Fallback to internal mode if AI classification fails
		console.error(
			"AI query classification failed, falling back to internal mode:",
			error
		);
		return {
			mode: "internal",
			requiresExternalTools: false,
			requestedExternalApps: [],
			reasoning: "AI classification failed, defaulted to internal mode",
		};
	}
}

/**
 * Batch classify multiple queries in parallel for better performance
 */
export async function classifyAssistantQueriesBatch(
	messages: string[]
): Promise<Array<AssistantIntent & { reasoning: string }>> {
	return Promise.all(messages.map((msg) => classifyAssistantQueryWithAI(msg)));
}
