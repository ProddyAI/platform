import { buildChannelSummaryFallback } from "./channelSummaryFallback";

type TaskItem = {
	title?: string;
	status?: string;
	priority?: string;
};

type CalendarEventItem = {
	title?: string;
};

type CardItem = {
	title?: string;
	channelName?: string;
	listName?: string;
};

type NoteItem = {
	title?: string;
	channelName?: string;
	snippet?: string;
	sourceRefs?: string[];
};

type ChannelItem = {
	name?: string;
};

type MessageItem = {
	channelName?: string;
	body?: string;
	id?: string;
	authorName?: string;
	creationTime?: number;
};

type SemanticSearchItem = {
	sourceRefs?: string[];
	text?: string;
};

export type TasksResult = { tasks?: TaskItem[] };
export type CalendarResult = { events?: CalendarEventItem[] };
export type CardsResult = { cards?: CardItem[] };
export type NotesResult = { notes?: NoteItem[] };
export type ChannelSearchResult = { channels?: ChannelItem[] };
export type ChannelSummaryResult = {
	channelName?: string;
	messageCount?: number;
	recentMessages?: MessageItem[];
};
export type SemanticSearchResult = { results?: SemanticSearchItem[] };
export type WorkspaceGeneralSummaryResult = {
	recentMessages?: MessageItem[];
	highPriorityTasks?: TaskItem[];
	recentNotes?: NoteItem[];
};
export type WorkspaceMembersResult = Array<{
	role?: string;
	user?: { name?: string };
}>;
export type DraftTaskResult = { confirmationMessage?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getArray<T>(obj: Record<string, unknown>, key: string): T[] {
	const val = obj[key];
	return Array.isArray(val) ? (val as T[]) : [];
}

function getString(obj: Record<string, unknown>, key: string): string {
	return String(obj[key] ?? "").trim();
}

function createLabeledRef(label: string, value: unknown): string | null {
	const normalized = String(value ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (!normalized) return null;
	return `${label}: ${normalized}`;
}

function dedupeRefs(refs: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const ref of refs) {
		const cleaned = ref.trim();
		if (!cleaned || seen.has(cleaned)) continue;
		seen.add(cleaned);
		unique.push(cleaned);
	}
	return unique;
}

type SourceRefExtractor = (r: Record<string, unknown>) => string[];

const sourceRefExtractors: Record<string, SourceRefExtractor> = {
	semanticSearch: (r) => {
		const results = getArray<SemanticSearchItem>(r, "results");
		return dedupeRefs(
			results.flatMap((item) =>
				Array.isArray(item?.sourceRefs) ? item.sourceRefs : []
			)
		);
	},

	getMyTasksToday: taskSourceRefs,
	getMyTasksTomorrow: taskSourceRefs,
	getMyTasksThisWeek: taskSourceRefs,
	getMyTasksNextWeek: taskSourceRefs,
	getMyAllTasks: taskSourceRefs,
	searchTasks: taskSourceRefs,

	getMyCalendarToday: calendarSourceRefs,
	getMyCalendarTomorrow: calendarSourceRefs,
	getMyCalendarNextWeek: calendarSourceRefs,

	getMyCards: (r) => {
		const cards = getArray<CardItem>(r, "cards");
		return dedupeRefs(
			cards
				.map((card) => {
					const location =
						card?.channelName && card?.listName
							? ` (${card.channelName} / ${card.listName})`
							: "";
					return createLabeledRef(
						"Board Card",
						`${card?.title ?? ""}${location}`
					);
				})
				.filter((s): s is string => s !== null)
		);
	},

	getChannelSummary: (r) => {
		const channelName = getString(r, "channelName");
		return channelName ? [`Channel Messages: #${channelName}`] : [];
	},

	getRecentNotes: noteSourceRefs,
	searchNotes: noteSourceRefs,

	searchChannels: (r) => {
		const channels = getArray<ChannelItem>(r, "channels");
		return dedupeRefs(
			channels
				.map((channel) => {
					const trimmed = String(channel?.name ?? "").trim();
					return trimmed.length > 0
						? createLabeledRef("Channel", `#${trimmed}`)
						: null;
				})
				.filter((s): s is string => s !== null)
		);
	},

	getWorkspaceOverview: () => ["Workspace Overview"],
	getWorkspaceGeneralSummary: () => ["Workspace Activity Summary"],
};

function taskSourceRefs(r: Record<string, unknown>): string[] {
	const tasks = getArray<TaskItem>(r, "tasks");
	return dedupeRefs(
		tasks
			.map((task) => createLabeledRef("Task", task?.title))
			.filter((s): s is string => s !== null)
	);
}

function calendarSourceRefs(r: Record<string, unknown>): string[] {
	const events = getArray<CalendarEventItem>(r, "events");
	return dedupeRefs(
		events
			.map((event) => createLabeledRef("Calendar Event", event?.title))
			.filter((s): s is string => s !== null)
	);
}

function noteSourceRefs(r: Record<string, unknown>): string[] {
	const notes = getArray<NoteItem>(r, "notes");
	return dedupeRefs(
		notes.flatMap((note) => {
			if (Array.isArray(note?.sourceRefs)) return note.sourceRefs;
			const refs: string[] = [];
			const titleRef = createLabeledRef("Note", note?.title);
			if (titleRef) refs.push(titleRef);
			const trimmedChannelName = String(note?.channelName ?? "").trim();
			if (trimmedChannelName) {
				refs.push(`Channel: #${trimmedChannelName}`);
			}
			return refs;
		})
	);
}

type FallbackFormatter = (r: Record<string, unknown>) => string | null;

const fallbackFormatters: Record<string, FallbackFormatter> = {
	getChannelSummary: formatChannelSummary,
	getChannelDebug: formatChannelDebug,
	getRecentNotes: (r) => formatNotes(r, "getRecentNotes"),
	searchNotes: (r) => formatNotes(r, "searchNotes"),
	getMyAllTasks: formatTaskList,
	searchTasks: formatTaskList,
	getWorkspaceGeneralSummary: formatWorkspaceSummary,
	draftTaskForConfirmation: (r) =>
		String(r.confirmationMessage ?? "").trim() || null,
	getWorkspaceMembers: formatWorkspaceMembers,
};

function formatChannelSummary(r: Record<string, unknown>): string | null {
	const channelName = getString(r, "channelName");
	const messageCount = Number(r.messageCount ?? 0);
	if (!channelName) return null;
	const recentMessages = getArray<MessageItem>(r, "recentMessages");
	return buildChannelSummaryFallback({
		channelName,
		messageCount,
		recentMessages: recentMessages.map((message) => ({
			id: String(message?.id ?? ""),
			body: String(message?.body ?? ""),
			authorName: message?.authorName ? String(message.authorName) : undefined,
			creationTime: Number(message?.creationTime ?? 0),
		})),
	});
}

function formatChannelDebug(r: Record<string, unknown>): string | null {
	const channelName = getString(r, "channelName") || "unknown";
	const recentMessages = getArray<MessageItem>(r, "recentMessages");
	if (recentMessages.length === 0) {
		return `Debug view: the assistant sees no recent messages in #${channelName}.`;
	}
	return [
		`Debug view for #${channelName}`,
		...recentMessages.slice(-8).map((message) => {
			const author = String(message?.authorName ?? "").trim();
			const body = String(message?.body ?? "").trim();
			return `- ${author ? `${author}: ` : ""}${body}`;
		}),
	].join("\n");
}

function formatNotes(
	r: Record<string, unknown>,
	toolName: "getRecentNotes" | "searchNotes"
): string | null {
	const notes = getArray<NoteItem>(r, "notes");
	if (notes.length === 0) {
		return toolName === "getRecentNotes"
			? "I couldn't find any notes in this workspace yet."
			: "I couldn't find any notes matching that query.";
	}
	const header =
		toolName === "getRecentNotes" ? "Recent notes" : "Matching notes";
	return [
		header,
		...notes.slice(0, 6).map((note) => {
			const channelSuffix = note?.channelName ? ` (#${note.channelName})` : "";
			const snippet =
				toolName === "searchNotes" ? String(note?.snippet ?? "").trim() : "";
			const title = String(note?.title ?? "Untitled note").trim();
			return `- ${title}${channelSuffix}${snippet ? `: ${snippet}` : ""}`;
		}),
	].join("\n");
}

function formatTaskList(r: Record<string, unknown>): string | null {
	const tasks = getArray<TaskItem>(r, "tasks");
	if (tasks.length === 0) return "I couldn't find anything relevant yet.";
	return [
		"Top tasks",
		...tasks.slice(0, 6).map((task) => {
			const flags = [task?.status, task?.priority].filter(Boolean).join(" • ");
			return `- ${String(task?.title ?? "Untitled task").trim()}${flags ? ` (${flags})` : ""}`;
		}),
	].join("\n");
}

function formatWorkspaceSummary(r: Record<string, unknown>): string | null {
	const messages = getArray<MessageItem>(r, "recentMessages").slice(0, 3);
	const tasks = getArray<TaskItem>(r, "highPriorityTasks").slice(0, 3);
	const notes = getArray<NoteItem>(r, "recentNotes").slice(0, 2);
	const lines = ["Workspace catch-up"];

	if (messages.length > 0) {
		lines.push(
			...messages.map(
				(message) =>
					`- #${message.channelName}: ${String(message.body ?? "").trim()}`
			)
		);
	}
	if (tasks.length > 0) {
		lines.push(
			...tasks.map((task) => {
				const flags = [task?.status, task?.priority]
					.filter(Boolean)
					.join(" • ");
				return `- Task: ${String(task?.title ?? "").trim()}${flags ? ` (${flags})` : ""}`;
			})
		);
	}
	if (notes.length > 0) {
		lines.push(
			...notes.map((note) => {
				const channelSuffix = note?.channelName
					? ` (#${note.channelName})`
					: "";
				return `- Note: ${String(note?.title ?? "").trim()}${channelSuffix}`;
			})
		);
	}

	return lines.length > 1
		? lines.join("\n")
		: "I couldn't find anything relevant yet.";
}

function formatWorkspaceMembers(r: Record<string, unknown>): string | null {
	if (!Array.isArray(r)) return null;
	const members = (r as WorkspaceMembersResult).slice(0, 8);
	if (members.length === 0) {
		return "There are no accepted workspace members available yet.";
	}
	return [
		"Accepted workspace members",
		...members.map((member) => {
			const userName = String(member?.user?.name ?? "").trim() || "Unknown";
			const role = String(member?.role ?? "member").trim();
			return `- ${userName} (${role})`;
		}),
	].join("\n");
}

export { dedupeRefs as dedupeSourceRefs };

export function collectSourceRefsFromToolResult(
	toolName: string,
	result: unknown
): string[] {
	if (toolName === "getWorkspaceMembers" && Array.isArray(result)) {
		return [];
	}
	if (!isRecord(result)) return [];
	const extractor = sourceRefExtractors[toolName];
	return extractor ? extractor(result) : [];
}

export function createFallbackResponseFromToolResult(
	toolName: string,
	result: unknown
): string | null {
	if (toolName === "getWorkspaceMembers" && Array.isArray(result)) {
		return formatWorkspaceMembers(result as unknown as Record<string, unknown>);
	}
	if (!isRecord(result)) return null;
	const formatter = fallbackFormatters[toolName];
	return formatter ? formatter(result) : null;
}
