import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Zod schema for multi-step plan
 */
const MultiStepPlanSchema = z.object({
	requiresMultiStep: z
		.boolean()
		.describe(
			"Whether this query requires multiple sequential steps to complete"
		),
	steps: z
		.array(
			z.object({
				stepNumber: z
					.number()
					.describe("Step number in sequence (1, 2, 3, ...)"),
				action: z.string().describe("What needs to be done in this step"),
				toolsNeeded: z
					.array(z.string())
					.describe("Tools that will be used in this step"),
				reasoning: z.string().describe("Why this step is necessary"),
				dependsOn: z
					.array(z.number())
					.describe(
						"Which previous steps must complete before this one (empty for step 1)"
					),
			})
		)
		.describe("List of steps in execution order"),
	overallGoal: z
		.string()
		.describe("The final goal of this multi-step operation"),
	estimatedComplexity: z
		.enum(["simple", "moderate", "complex"])
		.describe("Complexity of the overall operation"),
});

/**
 * AI-powered multi-step planner
 *
 * Analyzes complex queries and breaks them down into sequential steps
 * that can be executed in order.
 *
 * @param query - The user's query
 * @param availableTools - List of available tool names
 * @returns Promise with multi-step plan
 */
export async function createMultiStepPlan(
	query: string,
	availableTools: string[]
): Promise<{
	requiresMultiStep: boolean;
	steps: Array<{
		stepNumber: number;
		action: string;
		toolsNeeded: string[];
		reasoning: string;
		dependsOn: number[];
	}>;
	overallGoal: string;
	estimatedComplexity: "simple" | "moderate" | "complex";
}> {
	try {
		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: MultiStepPlanSchema,
			prompt: `You are an intelligent task planner for Proddy, an AI work management assistant. Your job is to analyze user requests and determine if they require multiple sequential steps.

**User Request:** "${query}"

**Available Tools:** ${availableTools.slice(0, 50).join(", ")}${availableTools.length > 50 ? "..." : ""}

**Multi-Step Detection:**

✅ **Requires Multi-Step Planning When:**

1. **Sequential Dependencies:**
   - "Send my tasks to Slack" → Step 1: Get tasks, Step 2: Send to Slack
   - "Create GitHub issue from this task" → Step 1: Get task details, Step 2: Create issue
   - "Email my calendar for tomorrow" → Step 1: Get calendar, Step 2: Send email

2. **Data Transformation:**
   - "Summarize channel activity and post to Slack"
   - "Aggregate tasks and create report"
   - "Fetch issues and categorize them"

3. **Multiple Operations:**
   - "Schedule meeting and send email to attendees"
   - "Create task and assign to team member"
   - "Update issue and notify via Slack"

4. **Cross-Platform Workflows:**
   - Moving data between systems (Proddy → Slack, Task → GitHub, etc.)
   - Syncing information across platforms

❌ **Single-Step Operations:**

1. **Direct Queries:**
   - "What's on my calendar?"
   - "List my tasks"
   - "Show GitHub repositories"

2. **Simple Actions:**
   - "Send email to X"
   - "Create a task"
   - "Update issue description"

**Planning Guidelines:**

1. **Identify Dependencies:**
   - Which steps must happen first?
   - What data is needed by later steps?
   - Can any steps run in parallel? (mark dependsOn as empty)

2. **Be Specific:**
   - Each step should have a clear, actionable objective
   - Identify exact tools needed
   - Explain why each step is necessary

3. **Minimize Steps:**
   - Don't over-engineer simple queries
   - Combine steps when possible
   - Typical multi-step: 2-4 steps, rarely more

**Example Plans:**

Example 1: "Send my today's tasks to Slack #engineering channel"
→ Multi-step: YES
→ Steps:
   1. Get user's tasks for today (getMyTasksToday)
      - Reasoning: Need task data to send
      - Depends on: []
   2. Format tasks into readable message
      - Reasoning: Make tasks presentable for Slack
      - Depends on: [1]
   3. Send message to Slack channel (SLACK_SEND_MESSAGE)
      - Reasoning: Deliver tasks to team
      - Depends on: [2]
→ Goal: "Share today's tasks with engineering team on Slack"
→ Complexity: moderate

Example 2: "What's on my calendar today?"
→ Multi-step: NO
→ Steps:
   1. Get calendar events for today (getMyCalendarToday)
      - Reasoning: Direct query, no further processing
      - Depends on: []
→ Goal: "Show user's calendar for today"
→ Complexity: simple

Example 3: "Create a GitHub issue from my highest priority task and notify the team on Slack"
→ Multi-step: YES
→ Steps:
   1. Get all user's tasks (getMyAllTasks)
      - Reasoning: Need to find highest priority task
      - Depends on: []
   2. Identify highest priority task
      - Reasoning: Determine which task to convert
      - Depends on: [1]
   3. Create GitHub issue with task details (GITHUB_CREATE_ISSUE)
      - Reasoning: Convert task to GitHub issue
      - Depends on: [2]
   4. Send notification to Slack (SLACK_SEND_MESSAGE)
      - Reasoning: Inform team of new issue
      - Depends on: [3]
→ Goal: "Convert priority task to GitHub issue and notify team"
→ Complexity: complex

Example 4: "List my GitHub repositories"
→ Multi-step: NO
→ Steps:
   1. Fetch GitHub repositories (GITHUB_LIST_REPOSITORIES)
      - Reasoning: Direct API call
      - Depends on: []
→ Goal: "Show user's GitHub repositories"
→ Complexity: simple

**Your Task:**
Analyze the user request and create a multi-step plan if needed. Remember:
- Only create multi-step plans when genuinely necessary
- Keep steps clear and actionable
- Identify all dependencies
- Match tools to available tools when possible

Provide your plan:`,
		});

		return {
			requiresMultiStep: result.object.requiresMultiStep,
			steps: result.object.steps,
			overallGoal: result.object.overallGoal,
			estimatedComplexity: result.object.estimatedComplexity,
		};
	} catch (error) {
		console.error(
			"Multi-step planning failed, defaulting to single step:",
			error
		);
		// Fallback: treat as single step
		return {
			requiresMultiStep: false,
			steps: [
				{
					stepNumber: 1,
					action: query,
					toolsNeeded: [],
					reasoning: "Planning failed, executing as single step",
					dependsOn: [],
				},
			],
			overallGoal: query,
			estimatedComplexity: "simple",
		};
	}
}

/**
 * Execute a multi-step plan
 *
 * This is a simplified execution model. In production, you'd want to:
 * - Track step completion
 * - Handle errors and retries
 * - Support parallel execution of independent steps
 * - Provide progress feedback to user
 */
export interface StepExecutionContext {
	stepNumber: number;
	action: string;
	previousResults: Record<number, any>;
	execute: (action: string, context: any) => Promise<any>;
}

export async function executeMultiStepPlan(
	plan: Awaited<ReturnType<typeof createMultiStepPlan>>,
	executeStep: (context: StepExecutionContext) => Promise<any>
): Promise<{
	success: boolean;
	results: Array<{ stepNumber: number; result: any; error?: string }>;
	finalResult: any;
}> {
	const results: Array<{ stepNumber: number; result: any; error?: string }> =
		[];
	const completedSteps: Record<number, any> = {};

	try {
		for (const step of plan.steps) {
			// Check dependencies
			const dependenciesMet = step.dependsOn.every(
				(depStep) => completedSteps[depStep] !== undefined
			);

			if (!dependenciesMet) {
				console.error(
					`Step ${step.stepNumber} dependencies not met:`,
					step.dependsOn
				);
				results.push({
					stepNumber: step.stepNumber,
					result: null,
					error: "Dependencies not met",
				});
				continue;
			}

			console.log(
				`[Multi-Step] Executing step ${step.stepNumber}: ${step.action}`
			);

			try {
				const result = await executeStep({
					stepNumber: step.stepNumber,
					action: step.action,
					previousResults: completedSteps,
					execute: async (_action, context) => {
						// This will be implemented by the caller
						return { success: true, data: context };
					},
				});

				completedSteps[step.stepNumber] = result;
				results.push({
					stepNumber: step.stepNumber,
					result,
				});
			} catch (error: any) {
				console.error(`Step ${step.stepNumber} failed:`, error);
				results.push({
					stepNumber: step.stepNumber,
					result: null,
					error: error.message || "Step execution failed",
				});
				// Continue to next step even if this one fails
			}
		}

		// Final result is the last step's result
		const finalResult = results[results.length - 1]?.result;

		return {
			success: results.every((r) => !r.error),
			results,
			finalResult,
		};
	} catch (error: any) {
		console.error("Multi-step execution failed:", error);
		return {
			success: false,
			results,
			finalResult: null,
		};
	}
}
