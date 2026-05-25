const WEEKDAY_NAMES = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

type WeekdayName = (typeof WEEKDAY_NAMES)[number];

function normalizeMessage(message: string) {
	return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatAbsoluteDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

function getNextWeekdayOccurrence(
	now: Date,
	targetWeekday: number,
	skipCurrentWeek = false
) {
	const start = new Date(now);
	start.setUTCHours(0, 0, 0, 0);

	const currentWeekday = start.getUTCDay();
	let offset = (targetWeekday - currentWeekday + 7) % 7;
	if (offset === 0) {
		offset = 7;
	}
	if (skipCurrentWeek) {
		offset += 7;
	}

	start.setUTCDate(start.getUTCDate() + offset);
	return start;
}

function extractWeekdayReference(message: string): {
	qualifier: "next" | "this" | null;
	weekday: WeekdayName;
} | null {
	const normalized = normalizeMessage(message);
	const match = normalized.match(
		/\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
	);
	if (!match) return null;

	return {
		qualifier:
			match[1] === "next" || match[1] === "this"
				? (match[1] as "next" | "this")
				: null,
		weekday: match[2] as WeekdayName,
	};
}

export function validateRelativeDueDateSelection(options: {
	message: string;
	dueDate?: number;
	now?: Date;
}) {
	if (typeof options.dueDate !== "number") {
		return null;
	}

	const reference = extractWeekdayReference(options.message);
	if (!reference) {
		return null;
	}

	const dueDate = new Date(options.dueDate);
	const dueWeekday = WEEKDAY_NAMES[dueDate.getUTCDay()];
	if (dueWeekday !== reference.weekday) {
		return `The request refers to ${reference.weekday}, but the selected due date is ${formatAbsoluteDate(dueDate)}. Re-check the weekday and date before drafting the update.`;
	}

	if (reference.qualifier === "next") {
		const now = options.now ?? new Date();
		const targetWeekday = WEEKDAY_NAMES.indexOf(reference.weekday);
		const upcoming = getNextWeekdayOccurrence(now, targetWeekday, false);
		const following = getNextWeekdayOccurrence(now, targetWeekday, true);

		return `The phrase "next ${reference.weekday}" is ambiguous. Ask whether the user means ${formatAbsoluteDate(upcoming)} or ${formatAbsoluteDate(following)} before setting the due date.`;
	}

	return null;
}
