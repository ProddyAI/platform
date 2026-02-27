import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Zod schema for AI-powered confirmation decision
 */
const ConfirmationAnalysisSchema = z.object({
	requiresConfirmation: z
		.boolean()
		.describe(
			"Whether this action requires user confirmation before execution. True for high-impact, irreversible, or sensitive actions."
		),
	riskLevel: z
		.enum(["low", "medium", "high", "critical"])
		.describe(
			"Risk level of the action: low (safe, read-only), medium (creates/updates data), high (deletes/sends/changes permissions), critical (bulk operations, irreversible changes)"
		),
	impactDescription: z
		.string()
		.describe(
			"Brief description of what this action will do and its potential impact"
		),
	reasoning: z
		.string()
		.describe("Explanation of why confirmation is or isn't needed"),
	affectedResources: z
		.array(z.string())
		.describe(
			"List of resources that will be affected (e.g., 'email to john@example.com', '5 GitHub issues', 'admin permissions')"
		),
});

/**
 * Zod schema for parsing user's confirmation response
 */
const UserConfirmationResponseSchema = z.object({
	decision: z
		.enum(["confirm", "cancel", "unclear"])
		.describe(
			"The user's decision: confirm (proceed), cancel (abort), or unclear (ambiguous response)"
		),
	reasoning: z
		.string()
		.describe(
			"Brief explanation of how the decision was determined from the user's message"
		),
});

/**
 * AI-powered confirmation analyzer
 *
 * Replaces regex-based high-impact action detection with AI that understands
 * context, risk levels, and makes intelligent confirmation decisions.
 *
 * Conservative approach: confirms on sends, deletes, merges, permission changes, and bulk operations.
 *
 * @param toolCalls - Array of tool calls that will be executed
 * @param userQuery - The original user query for context
 * @returns Promise with confirmation decision and details
 */
export async function analyzeActionForConfirmation(
	toolCalls: Array<{
		name: string;
		description?: string;
		arguments?: Record<string, any>;
	}>,
	userQuery: string
): Promise<{
	requiresConfirmation: boolean;
	riskLevel: "low" | "medium" | "high" | "critical";
	impactDescription: string;
	reasoning: string;
	affectedResources: string[];
}> {
	// Quick check: if no tool calls, no confirmation needed
	if (!toolCalls || toolCalls.length === 0) {
		return {
			requiresConfirmation: false,
			riskLevel: "low",
			impactDescription: "No actions to perform",
			reasoning: "No tool calls to execute",
			affectedResources: [],
		};
	}

	// Format tool calls for AI analysis
	const toolCallsSummary = toolCalls
		.map((tc) => {
			const args = tc.arguments ? JSON.stringify(tc.arguments, null, 2) : "{}";
			return `Tool: ${tc.name}\nDescription: ${tc.description || "No description"}\nArguments: ${args}`;
		})
		.join("\n\n");

	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: ConfirmationAnalysisSchema,
			prompt: `You are a safety analyzer for Proddy, an AI-powered work management assistant. Your critical job is to protect users from unintended actions by requiring confirmation for high-risk operations.

**User's Original Request:** "${userQuery}"

**Actions About To Be Executed:**
${toolCallsSummary}

**Your Task:**
Analyze these planned actions and determine if user confirmation is required before execution.

**Conservative Confirmation Policy:**

✅ **ALWAYS REQUIRE CONFIRMATION FOR:**

1. **Sending/Posting/Publishing:**
   - Sending emails (Gmail)
   - Posting to Slack channels
   - Publishing GitHub releases
   - Any outbound communication to other people
   - Reason: Cannot be recalled once sent

2. **Deleting/Removing:**
   - Deleting any resources (issues, files, comments, repos, tasks, emails)
   - Archiving items
   - Removing collaborators
   - Reason: Often irreversible or difficult to recover

3. **Permission Changes:**
   - Granting access/permissions
   - Revoking access
   - Adding/removing collaborators
   - Changing roles (admin, write, read)
   - Reason: Security implications

4. **Merging/Deploying:**
   - Merging pull requests
   - Deploying code
   - Creating releases
   - Reason: Affects production/main codebase

5. **Bulk Operations:**
   - Actions affecting 3+ items
   - "Delete all", "archive all", "send to everyone"
   - Mass updates
   - Reason: Large impact, potential mistakes

6. **Irreversible Changes:**
   - Actions that cannot be undone
   - Data that cannot be recovered
   - Permanent state changes

7. **Sensitive Data:**
   - Operations involving credentials
   - API key changes
   - Access token modifications

❌ **NO CONFIRMATION NEEDED FOR:**

1. **Read-Only Operations:**
   - Fetching/listing/getting data
   - Searching
   - Viewing information
   - Reading emails/messages

2. **Draft Creation:**
   - Creating email drafts (not sending)
   - Creating document drafts
   - Preparing content without publishing

3. **Internal Workspace Reads:**
   - Reading calendar
   - Viewing tasks
   - Reading channels
   - Checking workspace data

4. **Safe Updates:**
   - Updating labels/tags
   - Updating descriptions
   - Updating non-sensitive metadata
   - Status changes (unless affects many items)

**Risk Level Guidelines:**

- **low:** Read-only, no side effects, completely safe
- **medium:** Creates/updates data, but easily reversible (drafts, comments, labels)
- **high:** Sends, deletes single items, changes permissions
- **critical:** Bulk operations, irreversible deletions, production changes

**Example Analyses:**

Example 1: "Send email to john@example.com about meeting"
→ Tool: GMAIL_SEND_EMAIL with to="john@example.com"
→ Analysis: Sending email (outbound communication, cannot recall)
→ Decision: **YES**, confirmation required
→ Risk: high
→ Impact: "Sending email to john@example.com"
→ Resources: ["Email to john@example.com"]

Example 2: "List my GitHub repositories"
→ Tool: GITHUB_LIST_REPOSITORIES
→ Analysis: Read-only operation, no side effects
→ Decision: **NO**, confirmation not needed
→ Risk: low
→ Impact: "Fetching list of GitHub repositories"
→ Resources: []

Example 3: "Delete all completed tasks "
→ Tool: DELETE_TASKS with filter="completed"
→ Analysis: Bulk deletion, affects multiple items, difficult to undo
→ Decision: **YES**, confirmation required
→ Risk: critical
→ Impact: "Deleting all completed tasks (bulk operation)"
→ Resources: ["All completed tasks"]

Example 4: "Update issue description to include deadline"
→ Tool: GITHUB_UPDATE_ISSUE with field="description"
→ Analysis: Safe update, easily reversible, single item
→ Decision: **NO**, confirmation not needed
→ Risk: medium
→ Impact: "Updating issue description"
→ Resources: []

Example 5: "Grant admin access to collaborator@example.com"
→ Tool: ADD_COLLABORATOR with permissions="admin"
→ Analysis: Permission change, security implications
→ Decision: **YES**, confirmation required
→ Risk: critical
→ Impact: "Granting admin access to collaborator@example.com"
→ Resources: ["Admin permissions for collaborator@example.com"]

**Your Analysis:**
Carefully examine each tool call above. Consider:
- What will happen when this executes?
- Can it be undone easily?
- Does it affect other people?
- What's the potential for mistakes?
- How severe would an unintended action be?

Provide your safety analysis:`,
		});

		return {
			requiresConfirmation: result.object.requiresConfirmation,
			riskLevel: result.object.riskLevel,
			impactDescription: result.object.impactDescription,
			reasoning: result.object.reasoning,
			affectedResources: result.object.affectedResources,
		};
	} catch (error) {
		console.error(
			"AI confirmation analysis failed, defaulting to safe behavior:",
			error
		);

		// Fallback: conservative approach - check tool names for high-impact keywords
		const toolNames = toolCalls.map((tc) => tc.name.toLowerCase()).join(" ");
		const highImpactKeywords = [
			"send",
			"delete",
			"remove",
			"archive",
			"merge",
			"deploy",
			"release",
			"grant",
			"revoke",
			"permission",
			"access",
			"collaborator",
			"admin",
		];

		const hasHighImpactKeyword = highImpactKeywords.some((keyword) =>
			toolNames.includes(keyword)
		);

		return {
			requiresConfirmation: hasHighImpactKeyword,
			riskLevel: hasHighImpactKeyword ? "high" : "medium",
			impactDescription: `Executing ${toolCalls.length} action(s): ${toolCalls.map((tc) => tc.name).join(", ")}`,
			reasoning: "AI analysis failed, used fallback keyword detection",
			affectedResources: toolCalls.map((tc) => tc.name),
		};
	}
}

/**
 * Parse user's confirmation response using AI
 *
 * Replaces regex-based confirmation parsing with AI that better understands
 * natural language responses like "yes do it", "nope", "go ahead", etc.
 *
 * @param userMessage - The user's response message
 * @returns Promise with parsed decision
 */
export async function parseUserConfirmationResponse(
	userMessage: string
): Promise<{
	decision: "confirm" | "cancel" | "unclear";
	reasoning: string;
}> {
	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: UserConfirmationResponseSchema,
			prompt: `Parse the user's message to determine if they are confirming or canceling an action.

User Message: "${userMessage}"

Decision Guidelines:

CONFIRM (user wants to proceed):
- Explicit: "confirm", "confirmed", "yes", "proceed", "go ahead", "do it", "approve", "approved"
- Implicit: "yes please", "sounds good", "ok", "okay", "sure", "yep", "yeah", "continue"

CANCEL (user wants to abort):
- Explicit: "cancel", "stop", "abort", "no", "don't", "do not proceed", "never mind"
- Implicit: "nope", "nah", "not now", "wait", "hold on", "skip", "decline"

UNCLEAR (ambiguous or unrelated):
- Questions: "what does this do?", "tell me more"
- Unrelated: completely different topic
- Ambiguous: unclear intent

Provide your decision:`,
		});

		return {
			decision: result.object.decision,
			reasoning: result.object.reasoning,
		};
	} catch (error) {
		console.error(
			"AI confirmation parsing failed, defaulting to unclear:",
			error
		);

		// Fallback: basic keyword detection
		const messageLower = userMessage.toLowerCase().trim();

		const confirmKeywords = [
			"confirm",
			"yes",
			"proceed",
			"go ahead",
			"do it",
			"approve",
			"ok",
			"okay",
		];
		const cancelKeywords = [
			"cancel",
			"stop",
			"abort",
			"no",
			"don't",
			"never mind",
			"nope",
		];

		const hasConfirm = confirmKeywords.some((keyword) =>
			messageLower.includes(keyword)
		);
		const hasCancel = cancelKeywords.some((keyword) =>
			messageLower.includes(keyword)
		);

		if (hasCancel) {
			return {
				decision: "cancel",
				reasoning: "Fallback: detected cancel keywords",
			};
		}
		if (hasConfirm) {
			return {
				decision: "confirm",
				reasoning: "Fallback: detected confirm keywords",
			};
		}

		return {
			decision: "unclear",
			reasoning: "Fallback: no clear confirmation or cancellation detected",
		};
	}
}

/**
 * Build confirmation prompt for user
 */
export function buildConfirmationPrompt(analysis: {
	riskLevel: string;
	impactDescription: string;
	affectedResources: string[];
}): string {
	const riskEmoji =
		{
			low: "ℹ️",
			medium: "⚠️",
			high: "🚨",
			critical: "⛔",
		}[analysis.riskLevel] || "⚠️";

	let prompt = `${riskEmoji} **Confirmation Required**\n\n`;
	prompt += `**Action:** ${analysis.impactDescription}\n\n`;

	if (analysis.affectedResources.length > 0) {
		prompt += `**Affected Resources:**\n`;
		analysis.affectedResources.forEach((resource) => {
			prompt += `- ${resource}\n`;
		});
		prompt += `\n`;
	}

	prompt += `Please confirm to proceed or cancel to abort:\n`;
	prompt += `- Type "**confirm**" or "**yes**" to proceed\n`;
	prompt += `- Type "**cancel**" or "**no**" to abort`;

	return prompt;
}

/**
 * Build cancellation message
 */
export function buildCancellationMessage(analysis: {
	impactDescription: string;
}): string {
	return `✅ **Action Cancelled**\n\nThe following action has been cancelled:\n${analysis.impactDescription}\n\nNo changes were made.`;
}
