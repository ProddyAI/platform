import { describe, expect, test } from "bun:test";
import { buildAssistantSystemPrompt } from "./assistant-orchestration";

describe("buildAssistantSystemPrompt", () => {
	test("includes assistant personalization profile when provided", () => {
		const prompt = buildAssistantSystemPrompt({
			workspaceContext: "Engineering workspace",
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
		expect(prompt).toContain("Personalization profile:");
		expect(prompt).toContain("Keep responses concise");
		expect(prompt).toContain("Prioritize blockers");
		expect(prompt).toContain("User is currently focused on the release rollout.");
		expect(prompt).toContain("Active context memory:");
		expect(prompt).toContain("Release: payment rollout");
	});
});
