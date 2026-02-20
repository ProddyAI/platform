#!/usr/bin/env tsx

/**
 * Comprehensive Test Script for AI-Powered Assistant
 *
 * Tests:
 * 1. Query Classification (with caching)
 * 2. Tool Selection (with caching)
 * 3. Confirmation Logic
 * 4. Multi-Step Planning
 * 5. Cache Performance
 *
 * Usage:
 *   npx tsx test-assistant.ts
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { getCacheStats } from "../src/lib/ai-cache";
import {
	analyzeActionForConfirmation,
	parseUserConfirmationResponse,
} from "../src/lib/ai-confirmation-logic";
import { createMultiStepPlan } from "../src/lib/ai-multi-step-planner";
import { classifyAssistantQueryWithAI } from "../src/lib/ai-query-classifier";
import { selectToolsWithAI } from "../src/lib/ai-tool-selector";

// Test queries
const TEST_QUERIES = {
	internal: [
		"What's on my calendar today?",
		"Show my tasks for tomorrow",
		"Search for the engineering channel",
		"Get my workspace overview",
	],
	external: [
		"Send an email to john@example.com",
		"List my GitHub repositories",
		"Post to Slack #engineering",
		"Create a Notion page",
	],
	hybrid: [
		"Send my today's tasks to Slack",
		"Create a GitHub issue from this task",
		"Email my calendar for tomorrow",
		"Post workspace summary to Slack",
	],
};

// Mock tools for testing
const MOCK_TOOLS = [
	{
		name: "getMyCalendarToday",
		description: "Get calendar events for today",
		app: "internal",
	},
	{
		name: "getMyTasksToday",
		description: "Get tasks due today",
		app: "internal",
	},
	{
		name: "GMAIL_SEND_EMAIL",
		description: "Send an email via Gmail",
		app: "GMAIL",
	},
	{
		name: "GITHUB_LIST_REPOSITORIES",
		description: "List GitHub repositories",
		app: "GITHUB",
	},
	{
		name: "GITHUB_CREATE_ISSUE",
		description: "Create a GitHub issue",
		app: "GITHUB",
	},
	{
		name: "SLACK_SEND_MESSAGE",
		description: "Send a Slack message",
		app: "SLACK",
	},
];

// Colors for terminal output
const colors = {
	reset: "\x1b[0m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
};

function log(color: keyof typeof colors, message: string) {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
	console.log(`\n${"=".repeat(60)}`);
	log("cyan", `  ${title}`);
	console.log(`${"=".repeat(60)}\n`);
}

async function testQueryClassification() {
	logSection("TEST 1: Query Classification");

	for (const [category, queries] of Object.entries(TEST_QUERIES)) {
		log("blue", `\nTesting ${category.toUpperCase()} queries:`);

		for (const query of queries) {
			try {
				const result = await classifyAssistantQueryWithAI(query);

				const expected = category;
				const actual = result.mode;
				const correct =
					expected === actual ||
					(expected === "external" && actual === "external");

				if (correct) {
					log("green", `  ✓ "${query}"`);
				} else {
					log("red", `  ✗ "${query}"`);
				}

				console.log(
					`    Mode: ${result.mode}, Apps: [${result.requestedExternalApps.join(", ")}]`
				);
				console.log(`    Reasoning: ${result.reasoning}`);
			} catch (error: any) {
				log("red", `  ✗ Error: ${error.message}`);
			}
		}
	}

	log("yellow", "\nClassification test complete!");
}

async function testCaching() {
	logSection("TEST 2: Caching Performance");

	const testQuery = "Send email to test@example.com";

	// First call (cache miss)
	log("blue", "First call (should miss cache):");
	const start1 = Date.now();
	await classifyAssistantQueryWithAI(testQuery);
	const time1 = Date.now() - start1;
	log("cyan", `  Time: ${time1}ms`);

	// Second call (cache hit)
	log("blue", "\nSecond call (should hit cache):");
	const start2 = Date.now();
	await classifyAssistantQueryWithAI(testQuery);
	const time2 = Date.now() - start2;
	log("cyan", `  Time: ${time2}ms`);

	// Performance improvement
	const improvement = (((time1 - time2) / time1) * 100).toFixed(1);
	log("green", `\n  ✓ Cache speedup: ${improvement}% faster`);

	// Cache stats
	const stats = getCacheStats();
	log("yellow", "\nCache Statistics:");
	console.log(
		`  Query Classification: ${stats.queryClassification.size}/${stats.queryClassification.maxSize} entries`
	);
	console.log(
		`  Tool Selection: ${stats.toolSelection.size}/${stats.toolSelection.maxSize} entries`
	);
}

async function testToolSelection() {
	logSection("TEST 3: Tool Selection");

	const testCases = [
		{
			query: "Send an email to john@example.com",
			expectedTools: ["GMAIL_SEND_EMAIL"],
		},
		{
			query: "What's on my calendar today?",
			expectedTools: ["getMyCalendarToday"],
		},
		{
			query: "Create a GitHub issue and send to Slack",
			expectedTools: ["GITHUB_CREATE_ISSUE", "SLACK_SEND_MESSAGE"],
		},
	];

	for (const testCase of testCases) {
		try {
			log("blue", `\nQuery: "${testCase.query}"`);

			const result = await selectToolsWithAI(MOCK_TOOLS, testCase.query, {
				maxTools: 10,
			});

			log("cyan", `  Selected ${result.selectedTools.length} tools:`);
			result.selectedTools.forEach((tool) => {
				console.log(`    - ${tool.name}`);
			});

			console.log(`  Primary Action: ${result.primaryAction}`);
			console.log(`  Reasoning: ${result.reasoning}`);

			// Check if expected tools are selected
			const selectedNames = result.selectedTools.map((t) => t.name);
			const hasExpected = testCase.expectedTools.some((expected) =>
				selectedNames.includes(expected)
			);

			if (hasExpected) {
				log("green", "  ✓ Contains expected tools");
			} else {
				log("yellow", "  ⚠ Expected tools not found");
			}
		} catch (error: any) {
			log("red", `  ✗ Error: ${error.message}`);
		}
	}

	log("yellow", "\nTool selection test complete!");
}

async function testConfirmationLogic() {
	logSection("TEST 4: Confirmation Logic");

	const testCases = [
		{
			toolCalls: [
				{
					name: "GMAIL_SEND_EMAIL",
					description: "Send email",
					arguments: { to: "john@example.com", subject: "Meeting" },
				},
			],
			query: "Send email to john@example.com",
			expectedConfirmation: true,
		},
		{
			toolCalls: [
				{
					name: "GITHUB_LIST_REPOSITORIES",
					description: "List repositories",
					arguments: {},
				},
			],
			query: "List my GitHub repos",
			expectedConfirmation: false,
		},
		{
			toolCalls: [
				{
					name: "GITHUB_DELETE_REPOSITORY",
					description: "Delete repository",
					arguments: { repo: "test-repo" },
				},
			],
			query: "Delete test repository",
			expectedConfirmation: true,
		},
	];

	for (const testCase of testCases) {
		try {
			log("blue", `\nQuery: "${testCase.query}"`);

			const result = await analyzeActionForConfirmation(
				testCase.toolCalls,
				testCase.query
			);

			console.log(`  Requires Confirmation: ${result.requiresConfirmation}`);
			console.log(`  Risk Level: ${result.riskLevel}`);
			console.log(`  Impact: ${result.impactDescription}`);
			console.log(`  Reasoning: ${result.reasoning}`);

			if (result.requiresConfirmation === testCase.expectedConfirmation) {
				log("green", "  ✓ Correct confirmation decision");
			} else {
				log("red", "  ✗ Incorrect confirmation decision");
			}
		} catch (error: any) {
			log("red", `  ✗ Error: ${error.message}`);
		}
	}

	// Test user response parsing
	log("blue", "\n Testing User Response Parsing:");

	const responseTests = [
		{ message: "confirm", expected: "confirm" },
		{ message: "yes, go ahead", expected: "confirm" },
		{ message: "cancel", expected: "cancel" },
		{ message: "no, don't do it", expected: "cancel" },
		{ message: "what does this do?", expected: "unclear" },
	];

	for (const test of responseTests) {
		const result = await parseUserConfirmationResponse(test.message);
		const correct = result.decision === test.expected;

		if (correct) {
			log("green", `  ✓ "${test.message}" → ${result.decision}`);
		} else {
			log(
				"red",
				`  ✗ "${test.message}" → ${result.decision} (expected ${test.expected})`
			);
		}
	}

	log("yellow", "\nConfirmation logic test complete!");
}

async function testMultiStepPlanning() {
	logSection("TEST 5: Multi-Step Planning");

	const testCases = [
		{
			query: "Send my today's tasks to Slack",
			expectedMultiStep: true,
		},
		{
			query: "What's on my calendar?",
			expectedMultiStep: false,
		},
		{
			query: "Create GitHub issue from task and notify team on Slack",
			expectedMultiStep: true,
		},
	];

	for (const testCase of testCases) {
		try {
			log("blue", `\nQuery: "${testCase.query}"`);

			const plan = await createMultiStepPlan(
				testCase.query,
				MOCK_TOOLS.map((t) => t.name)
			);

			console.log(`  Multi-Step: ${plan.requiresMultiStep}`);
			console.log(`  Complexity: ${plan.estimatedComplexity}`);
			console.log(`  Goal: ${plan.overallGoal}`);

			if (plan.requiresMultiStep) {
				log("cyan", `  Steps (${plan.steps.length}):`);
				plan.steps.forEach((step) => {
					console.log(`    ${step.stepNumber}. ${step.action}`);
					console.log(`       Tools: [${step.toolsNeeded.join(", ")}]`);
					console.log(
						`       Depends on: [${step.dependsOn.join(", ") || "none"}]`
					);
				});
			}

			if (plan.requiresMultiStep === testCase.expectedMultiStep) {
				log("green", "  ✓ Correct multi-step detection");
			} else {
				log("yellow", "  ⚠ Unexpected multi-step detection");
			}
		} catch (error: any) {
			log("red", `  ✗ Error: ${error.message}`);
		}
	}

	log("yellow", "\nMulti-step planning test complete!");
}

// Main test runner
async function runAllTests() {
	log("green", "\n🚀 Starting AI Assistant Comprehensive Tests\n");

	try {
		await testQueryClassification();
		await testCaching();
		await testToolSelection();
		await testConfirmationLogic();
		await testMultiStepPlanning();

		logSection("TEST SUMMARY");
		log("green", "✅ All tests completed!");
		log("cyan", "\nNext steps:");
		console.log("  1. Review test results above");
		console.log(
			"  2. Test streaming endpoint: POST /api/assistant/chatbot/stream"
		);
		console.log("  3. Monitor performance in production");
		console.log("  4. Gather user feedback on classification accuracy");
	} catch (error: any) {
		log("red", `\n❌ Test suite failed: ${error.message}`);
		console.error(error);
		process.exit(1);
	}
}

// Run tests
runAllTests();
