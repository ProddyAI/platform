type PendingTaskDraft = {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high";
	dueDate?: number;
};

const CONFIRMATION_PATTERNS = [
	/^yes\b/i,
	/^confirm\b/i,
	/^create it\b/i,
	/^create the task\b/i,
	/^go ahead\b/i,
	/^looks good\b/i,
];

const CANCELLATION_PATTERNS = [
	/^cancel\b/i,
	/^never mind\b/i,
	/^dont create it\b/i,
	/^don't create it\b/i,
	/^stop\b/i,
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

export function formatPendingTaskDraftConfirmation(draft: PendingTaskDraft) {
	const lines = [
		"Please review this task before I create it:",
		`- Title: ${draft.title}`,
	];

	if (draft.description?.trim()) {
		lines.push(`- Description: ${draft.description.trim()}`);
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

export type { PendingTaskDraft };
