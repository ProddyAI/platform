import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { resolvePreflightContext } from "./preflightResolver";

function createCtx(responses: unknown[]) {
	let index = 0;
	return {
		runQuery: async () => {
			if (index >= responses.length) {
				throw new Error("Unexpected query handler");
			}
			const response = responses[index];
			index += 1;
			return response;
		},
	} as unknown as ActionCtx;
}

describe("resolvePreflightContext", () => {
	test("returns an early clarification when multiple channels match", async () => {
		const ctx = createCtx([
			{
				channels: [
					{ id: "channel_1", name: "release" },
					{ id: "channel_2", name: "release-plan" },
				],
			},
		]);

		const result = await resolvePreflightContext({
			ctx,
			workspaceId: "workspace_1" as Id<"workspaces">,
			userId: "user_1" as Id<"users">,
			message: "What happened in #rel?",
		});

		expect(result.promptText).toBe("");
		expect(result.earlyResponse).toContain(
			'I found multiple channels matching "rel"'
		);
		expect(result.sourceRefs).toEqual([
			"Channel: #release",
			"Channel: #release-plan",
		]);
	});

	test("builds workspace catch-up context with summary counts and deduped refs", async () => {
		const ctx = createCtx([
			{
				recentMessages: [{ id: "m1" }, { id: "m2" }],
				highPriorityTasks: [{ title: "Unblock release" }],
				recentNotes: [{ title: "Launch notes" }],
			},
		]);

		const result = await resolvePreflightContext({
			ctx,
			workspaceId: "workspace_1" as Id<"workspaces">,
			userId: "user_1" as Id<"users">,
			message: "what happened in general today?",
		});

		expect(result.earlyResponse).toBeUndefined();
		expect(result.promptText).toContain("Intent: workspace_catchup");
		expect(result.promptText).toContain("- Recent messages: 2");
		expect(result.promptText).toContain("- High-priority tasks: 1");
		expect(result.promptText).toContain("- Recent notes: 1");
		expect(result.sourceRefs).toEqual(["Workspace Activity Summary"]);
	});
});
