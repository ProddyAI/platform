import { describe, expect, test } from "bun:test";
import { buildChannelSummaryFallback } from "./channelSummaryFallback";

describe("buildChannelSummaryFallback", () => {
	test("turns recent channel messages into a synthesized summary instead of echoing raw chat", () => {
		const summary = buildChannelSummaryFallback({
			channelName: "general",
			messageCount: 4,
			recentMessages: [
				{
					id: "m1",
					authorName: "Christy Saji",
					body: "Onboarding update: the workspace checklist is ready, and new teammates should start with the onboarding note before asking in chat.",
					creationTime: 1,
				},
				{
					id: "m2",
					authorName: "Christy Saji",
					body: "Release note: the login bug is still blocking rollout, and release planning will continue in the release-planning channel this afternoon.",
					creationTime: 2,
				},
				{
					id: "m3",
					authorName: "Christy Saji",
					body: "Reminder: please review your seeded tasks today so the assistant can answer questions about priorities and due dates.",
					creationTime: 3,
				},
				{
					id: "m4",
					authorName: "Christy Saji",
					body: "hello",
					creationTime: 4,
				},
			],
		});

		expect(summary).toContain("Summary of #general Channel");
		expect(summary).toContain(
			"Onboarding Update: The workspace checklist for new teammates is ready."
		);
		expect(summary).toContain(
			"Release Planning: The login bug is still blocking the rollout of the release."
		);
		expect(summary).toContain(
			"Task Review Reminder: Team members are reminded to review their assigned tasks"
		);
		expect(summary).not.toContain('"Onboarding update:');
		expect(summary).not.toContain("Christy Saji:");
	});
});
