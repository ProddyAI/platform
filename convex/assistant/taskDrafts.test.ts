import { describe, expect, test } from "bun:test";
import {
	formatPendingTaskDraftConfirmation,
	isPendingTaskCancellation,
	isPendingTaskConfirmation,
} from "./taskDrafts";

describe("task draft confirmation helpers", () => {
	test("detects explicit confirmation replies", () => {
		expect(isPendingTaskConfirmation("yes")).toBe(true);
		expect(isPendingTaskConfirmation("confirm")).toBe(true);
		expect(isPendingTaskConfirmation("create it")).toBe(true);
		expect(isPendingTaskConfirmation("yes, create the task")).toBe(true);
		expect(isPendingTaskConfirmation("change the due date to Friday")).toBe(
			false
		);
	});

	test("detects cancellation replies", () => {
		expect(isPendingTaskCancellation("cancel")).toBe(true);
		expect(isPendingTaskCancellation("never mind")).toBe(true);
		expect(isPendingTaskCancellation("don't create it")).toBe(true);
		expect(isPendingTaskCancellation("yes, create it")).toBe(false);
	});

	test("formats a confirmation summary with optional fields", () => {
		const message = formatPendingTaskDraftConfirmation({
			title: "Finish onboarding checklist",
			description: "Include docs review",
			priority: "high",
			dueDate: new Date("2026-05-09T00:00:00.000Z").getTime(),
		});

		expect(message).toContain("Please review this task before I create it:");
		expect(message).toContain("- Title: Finish onboarding checklist");
		expect(message).toContain("- Description: Include docs review");
		expect(message).toContain("- Priority: high");
		expect(message).toContain("- Due date:");
		expect(message).toContain("Reply with");
		expect(message).toContain("confirm");
		expect(message).toContain("change");
	});

	test("omits unset optional fields from the summary", () => {
		const message = formatPendingTaskDraftConfirmation({
			title: "Plan sprint kickoff",
		});

		expect(message).toContain("- Title: Plan sprint kickoff");
		expect(message).not.toContain("- Description:");
		expect(message).not.toContain("- Priority:");
		expect(message).not.toContain("- Due date:");
	});
});
