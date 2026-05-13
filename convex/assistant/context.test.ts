import { describe, expect, test } from "bun:test";
import {
	buildPreflightContextPlan,
	buildPreflightContextPrompt,
} from "./context";

describe("buildPreflightContextPlan", () => {
	test("plans channel resolution for explicit channel questions", () => {
		const plan = buildPreflightContextPlan({
			message: "What happened in #release?",
		});

		expect(plan.intent).toBe("channel_summary");
		expect(plan.channelQuery).toBe("release");
		expect(plan.recommendedToolOrder).toEqual([
			"searchChannels",
			"getChannelSummary",
		]);
	});

	test("plans broad catch-up queries around workspace summary", () => {
		const plan = buildPreflightContextPlan({
			message: "what happened in general today?",
		});

		expect(plan.intent).toBe("workspace_catchup");
		expect(plan.recommendedToolOrder).toEqual(["getWorkspaceGeneralSummary"]);
	});

	test("extracts note topic queries before semantic fallback", () => {
		const plan = buildPreflightContextPlan({
			message: "find notes about onboarding handoff",
		});

		expect(plan.intent).toBe("note_lookup");
		expect(plan.noteQuery).toBe("onboarding handoff");
		expect(plan.recommendedToolOrder).toEqual(["searchNotes"]);
	});

	test("marks task creation requests as action-oriented and member-aware", () => {
		const plan = buildPreflightContextPlan({
			message: "create a task for Alice to follow up on onboarding blockers",
		});

		expect(plan.intent).toBe("task_create");
		expect(plan.needsMemberResolution).toBe(true);
		expect(plan.recommendedToolOrder).toEqual(["getWorkspaceMembers"]);
	});

	test("treats 'my repos' as a GitHub external action", () => {
		const plan = buildPreflightContextPlan({
			message: "list out my repos",
		});

		expect(plan.intent).toBe("external_action");
		expect(plan.recommendedToolOrder).toEqual(["runGithubTool"]);
		expect(plan.summaryLines).toContain(
			"Treat repository listing as an authenticated GitHub request."
		);
	});

	test("recognizes common GitHub misspellings for repo listing", () => {
		const plan = buildPreflightContextPlan({
			message: "list out my gothub repos",
		});

		expect(plan.intent).toBe("external_action");
		expect(plan.recommendedToolOrder).toEqual(["runGithubTool"]);
	});

	test("treats starred repositories as a GitHub external action", () => {
		const plan = buildPreflightContextPlan({
			message: "what about my starred repositories",
		});

		expect(plan.intent).toBe("external_action");
		expect(plan.recommendedToolOrder).toEqual(["runGithubTool"]);
		expect(plan.summaryLines).toContain(
			"Treat starred repository listing as an authenticated GitHub request."
		);
	});
});

describe("buildPreflightContextPrompt", () => {
	test("renders a compact trusted context block", () => {
		const prompt = buildPreflightContextPrompt({
			intent: "channel_summary",
			confidence: "high",
			resolvedTopic: "release",
			recommendedToolOrder: ["searchChannels", "getChannelSummary"],
			summaryLines: [
				"Matched channel topic: release",
				"Prefer direct channel retrieval before semantic fallback.",
			],
		});

		expect(prompt).toContain("Preflight context:");
		expect(prompt).toContain("Intent: channel_summary");
		expect(prompt).toContain("Confidence: high");
		expect(prompt).toContain("Resolved topic: release");
		expect(prompt).toContain(
			"Recommended tools: searchChannels -> getChannelSummary"
		);
	});
});
