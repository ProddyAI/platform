import { describe, expect, test } from "bun:test";
import { collectSourceRefsFromToolResult } from "./toolResults";

describe("collectSourceRefsFromToolResult", () => {
	test("skips blank channel names in search results", () => {
		const refs = collectSourceRefsFromToolResult("searchChannels", {
			channels: [{ name: " general " }, { name: "   " }, { name: "" }],
		});

		expect(refs).toEqual(["Channel: #general"]);
	});

	test("skips blank note channel labels", () => {
		const refs = collectSourceRefsFromToolResult("searchNotes", {
			notes: [
				{ title: "Release notes", channelName: "   " },
				{ title: "Launch plan", channelName: " product " },
			],
		});

		expect(refs).toEqual([
			"Note: Release notes",
			"Note: Launch plan",
			"Channel: #product",
		]);
	});
});
