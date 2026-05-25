import { describe, expect, test } from "bun:test";
import { filterItemsInRelativeDayWindow } from "../assistantTools";

describe("filterItemsInRelativeDayWindow", () => {
	test("returns only items due within the next-week window", () => {
		const now = new Date("2026-05-21T08:00:00.000Z");
		const items = [
			{ id: "past", dueDate: new Date("2026-05-20T12:00:00.000Z").getTime() },
			{ id: "today", dueDate: new Date("2026-05-21T12:00:00.000Z").getTime() },
			{
				id: "next-week-start",
				dueDate: new Date("2026-05-28T00:00:00.000Z").getTime(),
			},
			{
				id: "next-week-middle",
				dueDate: new Date("2026-06-01T09:30:00.000Z").getTime(),
			},
			{
				id: "next-week-end",
				dueDate: new Date("2026-06-04T23:59:59.000Z").getTime(),
			},
			{
				id: "after-window",
				dueDate: new Date("2026-06-05T00:00:00.000Z").getTime(),
			},
			{ id: "undated" },
		];

		const filtered = filterItemsInRelativeDayWindow(items, now, 7, 14);

		expect(filtered.map((item) => item.id)).toEqual([
			"next-week-start",
			"next-week-middle",
			"next-week-end",
		]);
	});
});
