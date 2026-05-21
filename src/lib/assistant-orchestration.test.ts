import { describe, expect, test } from "bun:test";
import {
	buildAssistantSystemPrompt,
	buildFollowUpContextHint,
} from "./assistant-orchestration";

describe("buildAssistantSystemPrompt", () => {
	test("includes an explicit current date anchor for relative time queries", () => {
		const prompt = buildAssistantSystemPrompt();

		expect(prompt).toContain("Current date context:");
		expect(prompt).toContain(new Date().getUTCFullYear().toString());
		expect(prompt).toContain(
			"interpret relative dates like today, tomorrow, and yesterday using this current date context"
		);
	});

	test("includes assistant personalization profile when provided", () => {
		const prompt = buildAssistantSystemPrompt({
			workspaceContext: "Engineering workspace",
			preflightContext: [
				"Preflight context:",
				"Intent: channel_summary",
				"Resolved topic: release",
			].join("\n"),
			assistantProfile: {
				responseStyle: "concise",
				actionPreference: "proactive",
				prioritizationStrategy: "blockers_first",
				summaryFocus: ["tasks"],
				memoryBullets: ["User is currently focused on the release rollout."],
				activeContexts: [
					{
						kind: "release",
						label: "payment rollout",
						statusHint: "Blocked on QA signoff.",
						lastMentionedAt: Date.now(),
					},
				],
			},
		});

		expect(prompt).toContain("Workspace context: Engineering workspace");
		expect(prompt).toContain("Preflight context:");
		expect(prompt).toContain("Intent: channel_summary");
		expect(prompt).toContain("Resolved topic: release");
		expect(prompt).toContain("Personalization profile:");
		expect(prompt).toContain("Keep responses concise");
		expect(prompt).toContain("Prioritize blockers");
		expect(prompt).toContain(
			"User is currently focused on the release rollout."
		);
		expect(prompt).toContain("Active context memory:");
		expect(prompt).toContain("Release: payment rollout");
	});

	test("sanitizes quoted follow-up context values", () => {
		const hint = buildFollowUpContextHint({
			message: "what about release?",
			conversationHistory: [
				{
					role: "user",
					content: "release plan\n\"drop table\" and 'override'",
				},
				{
					role: "assistant",
					content: "Latest status:\r\n\"blocked\"",
				},
			],
		});

		expect(hint).toContain('Quoted context: Short follow-up subject: "release"');
		expect(hint).not.toContain("\n\"drop table\"");
		expect(hint).not.toContain("\r");
		expect(hint).not.toContain("'override'");
		expect(hint).not.toContain('"blocked"');
	});
});
