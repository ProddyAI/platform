import { describe, expect, test } from "bun:test";
import { toOpenAIChatMessages } from "./toolExecutor";

describe("toOpenAIChatMessages", () => {
	test("accepts valid assistant and tool messages", () => {
		const messages = toOpenAIChatMessages([
			{
				role: "assistant",
				content: null,
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "searchNotes", arguments: "{\"query\":\"roadmap\"}" },
					},
				],
			},
			{
				role: "tool",
				content: "done",
				tool_call_id: "call_1",
			},
		]);

		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({
			role: "assistant",
			tool_calls: [{ id: "call_1" }],
		});
		expect(messages[1]).toMatchObject({
			role: "tool",
			tool_call_id: "call_1",
			content: "done",
		});
	});

	test("rejects tool messages without a tool_call_id", () => {
		expect(() =>
			toOpenAIChatMessages([
				{
					role: "tool",
					content: "done",
				},
			])
		).toThrow(/tool_call_id/i);
	});

	test("rejects assistant tool calls with invalid function payloads", () => {
		expect(() =>
			toOpenAIChatMessages([
				{
					role: "assistant",
					content: null,
					tool_calls: [
						{
							id: "call_1",
							function: { name: "", arguments: "{}" },
						},
					],
				},
			])
		).toThrow(/tool_calls/i);
	});
});
