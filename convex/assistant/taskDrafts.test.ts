import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import {
	buildTaskDraftFailureMessage,
	formatPendingTaskDraftConfirmation,
	isPendingTaskCancellation,
	isPendingTaskConfirmation,
	mergePendingTaskDraftUpdate,
	type PendingTaskDraft,
} from "./taskDrafts";

describe("task draft confirmation helpers", () => {
	test("detects explicit confirmation replies", () => {
		expect(isPendingTaskConfirmation("yes")).toBe(true);
		expect(isPendingTaskConfirmation("confirm")).toBe(true);
		expect(isPendingTaskConfirmation("create it")).toBe(true);
		expect(isPendingTaskConfirmation("yes, create the task")).toBe(false);
		expect(isPendingTaskConfirmation("yes, create")).toBe(true);
		expect(isPendingTaskConfirmation("yes, create.")).toBe(true);
		expect(isPendingTaskConfirmation("yes, create but wait")).toBe(false);
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

	test("includes assignee details when present", () => {
		const message = formatPendingTaskDraftConfirmation({
			title: "Prepare onboarding deck",
			assigneeName: "Alice Johnson",
			updatedAt: Date.now(),
		});

		expect(message).toContain("- Title: Prepare onboarding deck");
		expect(message).toContain("- Assignee: Alice Johnson");
	});

	test("merges partial updates into an existing pending draft", () => {
		const assigneeMemberId = "member_1" as Id<"members">;
		const assigneeUserId = "user_1" as Id<"users">;
		const existingDraft: PendingTaskDraft = {
			title: "Mentoring",
			assigneeName: "Alice",
			assigneeMemberId,
			assigneeUserId,
			priority: "low",
			updatedAt: 100,
		};
		const merged = mergePendingTaskDraftUpdate(
			existingDraft,
			{
				dueDate: new Date("2026-10-24T00:00:00.000Z").getTime(),
				priority: "medium",
			},
			123
		);

		expect(merged).toMatchObject({
			title: "Mentoring",
			assigneeName: "Alice",
			priority: "medium",
			dueDate: new Date("2026-10-24T00:00:00.000Z").getTime(),
			updatedAt: 123,
		});
	});

	test("gives a friendly title prompt when draft creation is missing a title", () => {
		expect(buildTaskDraftFailureMessage("Task title is required")).toContain(
			"I need a task title"
		);
	});

	test("explains invite acceptance requirement for assignee failures", () => {
		expect(
			buildTaskDraftFailureMessage(
				"Tasks can only be assigned to accepted workspace members."
			)
		).toContain("after they accept the invite");
	});

	test("clearly explains owner-assignment restriction", () => {
		expect(
			buildTaskDraftFailureMessage(
				"Members cannot assign tasks directly to the workspace owner."
			)
		).toContain("workspace owner");
	});
});
