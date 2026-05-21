import { describe, expect, test } from "bun:test";
import { validateRelativeDueDateSelection } from "./relativeDate";

describe("validateRelativeDueDateSelection", () => {
	test("flags weekday/date mismatches", () => {
		const result = validateRelativeDueDateSelection({
			message: "reassign the due date to sunday",
			dueDate: new Date("2026-05-26T00:00:00.000Z").getTime(),
		});

		expect(result).toContain("refers to sunday");
		expect(result).toContain("Tuesday, May 26, 2026");
	});

	test("asks for clarification when next-weekday phrasing is ambiguous", () => {
		const result = validateRelativeDueDateSelection({
			message: "reassign the due date to next sunday",
			dueDate: new Date("2026-05-24T00:00:00.000Z").getTime(),
			now: new Date("2026-05-21T08:00:00.000Z"),
		});

		expect(result).toContain('"next sunday" is ambiguous');
		expect(result).toContain("Sunday, May 24, 2026");
		expect(result).toContain("Sunday, May 31, 2026");
	});

	test("allows unambiguous matching weekday phrases", () => {
		const result = validateRelativeDueDateSelection({
			message: "reassign the due date to sunday",
			dueDate: new Date("2026-05-24T00:00:00.000Z").getTime(),
		});

		expect(result).toBeNull();
	});
});
