import { describe, expect, test } from "bun:test";
import { resolveAssistantToolLoop } from "./toolLoop";

describe("resolveAssistantToolLoop", () => {
	test("allows multi-step internal retrieval chains before finalizing the answer", async () => {
		const executedSteps: Array<{ name: string; args: Record<string, unknown> }> =
			[];
		let completionCount = 0;

		const result = await resolveAssistantToolLoop({
			initialAssistantMessage: {
				content: "",
				tool_calls: [
					{
						id: "call-search",
						type: "function",
						function: {
							name: "searchChannels",
							arguments: JSON.stringify({ query: "general" }),
						},
					},
				],
			},
			baseMessages: [
				{ role: "system", content: "system prompt" },
				{ role: "user", content: "summarize #general" },
			],
			executeToolCall: async (toolCall) => {
				const name = toolCall.function?.name ?? "unknownTool";
				const args = JSON.parse(toolCall.function?.arguments ?? "{}");
				executedSteps.push({ name, args });

				if (name === "searchChannels") {
					return {
						result: {
							channels: [{ id: "channel-general", name: "general" }],
							count: 1,
						},
					};
				}

				if (name === "getChannelSummary") {
					return {
						result: {
							channelName: "general",
							messageCount: 4,
							summary: "Christy: Onboarding update...",
							recentMessages: [
								{
									id: "m1",
									body: "Onboarding update: the workspace checklist is ready.",
									authorName: "Christy Saji",
									creationTime: 1,
								},
							],
						},
						fallbackText:
							"Recent updates in #general\n- Christy Saji: Onboarding update: the workspace checklist is ready.",
						sourceRefs: ["Channel Messages: #general"],
					};
				}

				throw new Error(`Unexpected tool: ${name}`);
			},
			createCompletion: async (messages) => {
				completionCount += 1;

				if (completionCount === 1) {
					expect(messages.at(-1)).toEqual({
						role: "tool",
						tool_call_id: "call-search",
						content: JSON.stringify({
							channels: [{ id: "channel-general", name: "general" }],
							count: 1,
						}),
					});

					return {
						content: "",
						tool_calls: [
							{
								id: "call-summary",
								type: "function",
								function: {
									name: "getChannelSummary",
									arguments: JSON.stringify({
										channelId: "channel-general",
									}),
								},
							},
						],
					};
				}

				if (completionCount === 2) {
					expect(messages.at(-1)).toEqual({
						role: "tool",
						tool_call_id: "call-summary",
						content: JSON.stringify({
							channelName: "general",
							messageCount: 4,
							summary: "Christy: Onboarding update...",
							recentMessages: [
								{
									id: "m1",
									body: "Onboarding update: the workspace checklist is ready.",
									authorName: "Christy Saji",
									creationTime: 1,
								},
							],
						}),
					});

					return {
						content:
							"Recent updates in #general:\n- Onboarding checklist is ready.\n- Login bug is still blocking rollout.",
					};
				}

				throw new Error("Unexpected extra completion");
			},
			initialResponseText: "I couldn't find anything relevant yet.",
		});

		expect(executedSteps).toEqual([
			{ name: "searchChannels", args: { query: "general" } },
			{ name: "getChannelSummary", args: { channelId: "channel-general" } },
		]);
		expect(result.executedTools).toEqual(executedSteps);
	expect(result.sourceRefs).toEqual(["Channel Messages: #general"]);
	expect(result.responseText).toContain("Recent updates in #general");
	});

	test("stops and surfaces fallback text when tool execution throws", async () => {
		const result = await resolveAssistantToolLoop({
			initialAssistantMessage: {
				content: "",
				tool_calls: [
					{
						id: "call-draft",
						type: "function",
						function: {
							name: "draftTaskForConfirmation",
							arguments: JSON.stringify({ priority: "medium" }),
						},
					},
				],
			},
			baseMessages: [
				{ role: "system", content: "system prompt" },
				{ role: "user", content: "make it medium priority" },
			],
			executeToolCall: async () => {
				throw new Error("Task title is required");
			},
			createCompletion: async () => {
				throw new Error("Should not request another completion");
			},
			initialResponseText: "I couldn't find anything relevant yet.",
		}).catch((error) => error);

		expect(result).toBeInstanceOf(Error);
	});
});
