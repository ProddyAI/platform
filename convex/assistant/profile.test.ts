import { describe, expect, test } from "bun:test";
import {
	type AssistantProfileRecord,
	buildAssistantProfilePrompt,
	extractAssistantProfileUpdateFromMessage,
} from "./profile";

describe("buildAssistantProfilePrompt", () => {
	test("renders bounded memory and personalization instructions", () => {
		const prompt = buildAssistantProfilePrompt({
			responseStyle: "concise",
			actionPreference: "proactive",
			prioritizationStrategy: "blockers_first",
			summaryFocus: ["tasks", "channels"],
			memoryBullets: [
				"User prefers short summaries with direct next steps.",
				"User is currently focused on release coordination.",
			],
		});

		expect(prompt).toContain("Personalization profile:");
		expect(prompt).toContain("Keep responses concise");
		expect(prompt).toContain("Be proactive about suggesting next steps");
		expect(prompt).toContain("Prioritize blockers");
		expect(prompt).toContain(
			"Emphasize these areas in summaries: tasks, channels"
		);
		expect(prompt).toContain(
			"- User prefers short summaries with direct next steps."
		);
	});

	test("renders active release and project contexts when available", () => {
		const prompt = buildAssistantProfilePrompt({
			responseStyle: "balanced",
			activeContexts: [
				{
					kind: "release",
					label: "payment rollout",
					statusHint: "Blocked on QA signoff.",
					lastMentionedAt: Date.now(),
				},
				{
					kind: "project",
					label: "onboarding redesign",
					ownerHints: ["Alice"],
					lastMentionedAt: Date.now(),
				},
			],
		});

		expect(prompt).toContain("Active context memory:");
		expect(prompt).toContain("Release: payment rollout");
		expect(prompt).toContain("Blocked on QA signoff.");
		expect(prompt).toContain("Project: onboarding redesign");
		expect(prompt).toContain("Owners: Alice");
	});

	test("returns empty string when no profile data is available", () => {
		expect(buildAssistantProfilePrompt({})).toBe("");
	});
});

describe("extractAssistantProfileUpdateFromMessage", () => {
	test("captures explicit preference and memory instructions", () => {
		const update = extractAssistantProfileUpdateFromMessage(
			"Remember that I prefer concise updates, focus on blockers first, and I'm working on the release rollout."
		);

		expect(update).toEqual({
			responseStyle: "concise",
			prioritizationStrategy: "blockers_first",
			memoryBullet: "User is currently focused on the release rollout.",
			activeContext: {
				kind: "release",
				label: "release rollout",
				lastMentionedAt: expect.any(Number),
			},
		});
	});

	test("captures blocked project context as structured memory", () => {
		const update = extractAssistantProfileUpdateFromMessage(
			"Remember that the onboarding redesign is blocked on copy review."
		);

		expect(update).toEqual({
			activeContext: {
				kind: "project",
				label: "onboarding redesign",
				statusHint: "Blocked on copy review.",
				lastMentionedAt: expect.any(Number),
			},
		});
	});

	test("ignores normal task requests that should not become long-term memory", () => {
		const update = extractAssistantProfileUpdateFromMessage(
			"Can you summarize today's tasks and tell me what changed in general?"
		);

		expect(update).toBeNull();
	});
});

describe("assistant profile memory merging", () => {
	test("keeps recent unique memory bullets and caps the list", () => {
		const existing: AssistantProfileRecord = {
			memoryBullets: [
				"User prefers brief summaries.",
				"User is focused on onboarding.",
				"User likes blockers first.",
				"User wants clear next steps.",
				"User often asks for release updates.",
				"User values concise task lists.",
			],
		};

		const prompt = buildAssistantProfilePrompt({
			...existing,
			memoryBullets: [
				...existing.memoryBullets,
				"User is currently focused on release rollout.",
			].slice(-6),
		});

		expect(prompt).toContain("User is currently focused on release rollout.");
		expect(prompt).not.toContain("User prefers brief summaries.");
	});
});
