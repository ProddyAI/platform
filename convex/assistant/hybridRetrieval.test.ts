import { describe, expect, test } from "bun:test";
import {
	buildHybridRetrievalResults,
	type DirectSearchAllResults,
	type SemanticRetrievalResult,
} from "./hybridRetrieval";

describe("buildHybridRetrievalResults", () => {
	test("ranks exact direct matches above fuzzier semantic matches", () => {
		const directResults: DirectSearchAllResults = {
			messages: [],
			notes: [],
			tasks: [
				{
					_id: "task-release-checklist",
					title: "Release checklist",
					description: "Final launch steps for the product release",
				},
			],
			cards: [],
			events: [],
		};
		const semanticResults: SemanticRetrievalResult[] = [
			{
				id: "note-launch-plan",
				type: "note",
				text: "The launch planning note covers rollout ideas and launch sequencing.",
				score: 0.94,
				sourceRefs: ["Note: Launch planning"],
			},
		];

		const results = buildHybridRetrievalResults({
			query: "release checklist",
			directResults,
			semanticResults,
			limit: 5,
		});

		expect(results[0]?.id).toBe("task-release-checklist");
		expect(results[0]?.type).toBe("task");
		expect(results[0]?.sourceRefs).toContain("Task: Release checklist");
	});

	test("dedupes overlapping direct and semantic hits while preserving both signals", () => {
		const directResults: DirectSearchAllResults = {
			messages: [],
			notes: [
				{
					_id: "note-onboarding",
					title: "Onboarding checklist",
					channelId: "channel-1",
				},
			],
			tasks: [],
			cards: [],
			events: [],
		};
		const semanticResults: SemanticRetrievalResult[] = [
			{
				id: "note-onboarding",
				type: "note",
				text: "Onboarding checklist with steps for teammates, account setup, and docs review.",
				score: 0.82,
				sourceRefs: ["Note: Onboarding checklist", "Channel: #general"],
			},
		];

		const results = buildHybridRetrievalResults({
			query: "onboarding checklist",
			directResults,
			semanticResults,
			limit: 5,
		});

		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe("note-onboarding");
		expect(results[0]?.text).toContain("Onboarding checklist");
		expect(results[0]?.sourceRefs).toContain("Note: Onboarding checklist");
		expect(results[0]?.sourceRefs).toContain("Channel: #general");
		expect(results[0]?.score).toBeGreaterThan(1);
	});

	test("keeps semantic-only related results for recall when direct search misses", () => {
		const directResults: DirectSearchAllResults = {
			messages: [],
			notes: [],
			tasks: [],
			cards: [],
			events: [],
		};
		const semanticResults: SemanticRetrievalResult[] = [
			{
				id: "message-rollout",
				type: "message",
				text: "The rollout blocker is the login bug that still needs a fix before release.",
				score: 0.78,
				sourceRefs: ["Message: rollout blocker update"],
			},
		];

		const results = buildHybridRetrievalResults({
			query: "release blocker",
			directResults,
			semanticResults,
			limit: 5,
		});

		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe("message-rollout");
		expect(results[0]?.type).toBe("message");
	});
});
