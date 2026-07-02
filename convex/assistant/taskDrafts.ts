import type { Id } from "../_generated/dataModel";

type PendingTaskDraft = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high";
	dueDate?: number;
	assigneeMemberId?: Id<"members">;
	assigneeUserId?: Id<"users">;
	assigneeName?: string;
	updatedAt: number;
};

const CONFIRMATION_PATTERNS = [
	/^yes[.!?\s]*$/i,
	/^yes,\s*create[.!?\s]*$/i,
	/^confirm[.!?\s]*$/i,
	/^create it[.!?\s]*$/i,
	/^create the task[.!?\s]*$/i,
	/^go ahead[.!?\s]*$/i,
	/^looks good[.!?\s]*$/i,
];

const CANCELLATION_PATTERNS = [
	/^cancel[.!?\s]*$/i,
	/^never mind[.!?\s]*$/i,
	/^dont create it[.!?\s]*$/i,
	/^don't create it[.!?\s]*$/i,
	/^stop[.!?\s]*$/i,
];

function formatDueDate(dueDate: number) {
	try {
		return new Date(dueDate).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return String(dueDate);
	}
}

export function isPendingTaskConfirmation(message: string) {
	const normalized = message.trim();
	return CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isPendingTaskCancellation(message: string) {
	const normalized = message.trim();
	return CANCELLATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function formatPendingTaskDraftConfirmation(
	draft: Omit<PendingTaskDraft, "updatedAt"> & { updatedAt?: number },
) {
	const lines = [
		"Please review this task before I create it:",
		`- Title: ${draft.title}`,
	];

	if (draft.description?.trim()) {
		lines.push(`- Description: ${draft.description.trim()}`);
	}

	if (draft.assigneeName?.trim()) {
		lines.push(`- Assignee: ${draft.assigneeName.trim()}`);
	}

	if (draft.priority) {
		lines.push(`- Priority: ${draft.priority}`);
	}

	if (draft.dueDate) {
		lines.push(`- Due date: ${formatDueDate(draft.dueDate)}`);
	}

	lines.push(
		"",
		"Reply with `confirm` to create it, tell me what to change, or say `cancel`."
	);

	return lines.join("\n");
}

export function mergePendingTaskDraftUpdate(
	existingDraft: PendingTaskDraft | undefined,
	update: Partial<PendingTaskDraft>,
	updatedAt: number
) {
	const merged: PendingTaskDraft = {
		title: update.title?.trim() || existingDraft?.title?.trim() || "",
		description:
			update.description !== undefined
				? update.description?.trim() || undefined
				: existingDraft?.description,
		priority:
			update.priority !== undefined ? update.priority : existingDraft?.priority,
		dueDate:
			update.dueDate !== undefined ? update.dueDate : existingDraft?.dueDate,
		assigneeMemberId:
			update.assigneeMemberId !== undefined
				? update.assigneeMemberId
				: existingDraft?.assigneeMemberId,
		assigneeUserId:
			update.assigneeUserId !== undefined
				? update.assigneeUserId
				: existingDraft?.assigneeUserId,
		assigneeName:
			update.assigneeName !== undefined
				? update.assigneeName?.trim() || undefined
				: existingDraft?.assigneeName,
		updatedAt,
	};

	if (!merged.title) {
		throw new Error("Task title is required");
	}

	return merged;
}

export function buildTaskDraftFailureMessage(errorMessage: string) {
	const normalized = errorMessage.trim();

	if (/task title is required/i.test(normalized)) {
		return "I need a task title before I can draft it. Tell me the title you want and I’ll prepare the draft.";
	}

	if (/accepted workspace members/i.test(normalized)) {
		return "I can only assign tasks after they accept the invite and become a workspace member.";
	}

	if (/workspace owner/i.test(normalized)) {
		return "I can't assign that task because the target user is the workspace owner. Only an owner or admin should assign tasks to the workspace owner directly.";
	}

	if (/original inviter|owners, admins/i.test(normalized)) {
		return "I can only assign that task if you're an owner, an admin, or the original inviter of that member.";
	}

	return "I couldn't update the task draft just yet. Please try again with the task title and assignee details.";
}

export type { PendingTaskDraft };
