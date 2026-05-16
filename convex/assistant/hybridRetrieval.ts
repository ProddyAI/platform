type DirectMessageResult = {
	_id: string;
	channelId?: string;
	channelName: string;
	_creationTime: number;
	text: string;
};

type DirectNoteResult = {
	_id: string;
	title: string;
	channelId: string;
};

type DirectTaskResult = {
	_id: string;
	title: string;
	description?: string;
};

type DirectCardResult = {
	_id: string;
	title: string;
	description?: string;
	listId: string;
	channelId: string;
};

type DirectEventResult = {
	_id: string;
	title: string;
	date: number;
	time?: string;
};

export type DirectSearchAllResults = {
	messages: DirectMessageResult[];
	notes: DirectNoteResult[];
	tasks: DirectTaskResult[];
	cards: DirectCardResult[];
	events: DirectEventResult[];
};

export type SemanticRetrievalResult = {
	id: string;
	type: string;
	text: string;
	score: number;
	sourceRefs: string[];
};

type RetrievalSource = "direct" | "semantic";

type HybridCandidate = {
	id: string;
	type: string;
	text: string;
	title: string;
	score: number;
	sourceRefs: string[];
	sources: Set<RetrievalSource>;
	timestamp?: number;
};

function normalizeText(value: string) {
	return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenizeQuery(query: string) {
	return normalizeText(query)
		.split(/[^a-z0-9#]+/i)
		.map((token) => token.trim())
		.filter(Boolean);
}

function compactText(text: string, maxLength = 220) {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return "";
	return normalized.length > maxLength
		? `${normalized.slice(0, maxLength - 3).trimEnd()}...`
		: normalized;
}

function dedupeStrings(items: string[]) {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const item of items) {
		const cleaned = item.trim();
		if (!cleaned || seen.has(cleaned)) continue;
		seen.add(cleaned);
		unique.push(cleaned);
	}
	return unique;
}

function buildSourceRef(label: string, value: string) {
	const cleaned = value.replace(/\s+/g, " ").trim();
	return cleaned ? `${label}: ${cleaned}` : "";
}

function buildDirectCandidates(input: DirectSearchAllResults): HybridCandidate[] {
	return [
		...input.messages.map((message) => ({
			id: message._id,
			type: "message",
			title: compactText(message.text, 80),
			text: compactText(message.text),
			score: 0,
			timestamp: message._creationTime,
			sourceRefs: dedupeStrings([
				buildSourceRef("Message", compactText(message.text, 80)),
				message.channelName
					? buildSourceRef("Channel", `#${message.channelName}`)
					: "",
			]),
			sources: new Set<RetrievalSource>(["direct"]),
		})),
		...input.notes.map((note) => ({
			id: note._id,
			type: "note",
			title: note.title,
			text: note.title,
			score: 0,
			sourceRefs: dedupeStrings([buildSourceRef("Note", note.title)]),
			sources: new Set<RetrievalSource>(["direct"]),
		})),
		...input.tasks.map((task) => ({
			id: task._id,
			type: "task",
			title: task.title,
			text: compactText(
				[task.title, task.description].filter(Boolean).join(": "),
				220
			),
			score: 0,
			sourceRefs: dedupeStrings([buildSourceRef("Task", task.title)]),
			sources: new Set<RetrievalSource>(["direct"]),
		})),
		...input.cards.map((card) => ({
			id: card._id,
			type: "card",
			title: card.title,
			text: compactText(
				[card.title, card.description].filter(Boolean).join(": "),
				220
			),
			score: 0,
			sourceRefs: dedupeStrings([buildSourceRef("Board Card", card.title)]),
			sources: new Set<RetrievalSource>(["direct"]),
		})),
		...input.events.map((event) => ({
			id: event._id,
			type: "event",
			title: event.title,
			text: compactText(
				[event.title, event.time].filter(Boolean).join(" "),
				220
			),
			score: 0,
			timestamp: event.date,
			sourceRefs: dedupeStrings([
				buildSourceRef("Calendar Event", event.title),
			]),
			sources: new Set<RetrievalSource>(["direct"]),
		})),
	];
}

function buildSemanticCandidates(
	input: SemanticRetrievalResult[]
): HybridCandidate[] {
	return input.map((result) => ({
		id: result.id,
		type: result.type,
		title: compactText(result.text, 80),
		text: compactText(result.text),
		score: result.score,
		sourceRefs: dedupeStrings(result.sourceRefs),
		sources: new Set<RetrievalSource>(["semantic"]),
	}));
}

function mergeCandidates(candidates: HybridCandidate[]) {
	const merged = new Map<string, HybridCandidate>();

	for (const candidate of candidates) {
		const key = `${candidate.type}:${candidate.id}`;
		const existing = merged.get(key);
		if (!existing) {
			merged.set(key, candidate);
			continue;
		}

		for (const source of candidate.sources) {
			existing.sources.add(source);
		}
		existing.sourceRefs = dedupeStrings([
			...existing.sourceRefs,
			...candidate.sourceRefs,
		]);
		if (candidate.text.length > existing.text.length) {
			existing.text = candidate.text;
		}
		if (candidate.title.length > existing.title.length) {
			existing.title = candidate.title;
		}
		existing.score = Math.max(existing.score, candidate.score);
		existing.timestamp = Math.max(existing.timestamp ?? 0, candidate.timestamp ?? 0);
	}

	return [...merged.values()];
}

function calculateHybridScore(candidate: HybridCandidate, query: string) {
	const normalizedQuery = normalizeText(query);
	const tokens = tokenizeQuery(query);
	const normalizedTitle = normalizeText(candidate.title);
	const normalizedText = normalizeText(candidate.text);

	const titleTokenMatches = tokens.filter((token) =>
		normalizedTitle.includes(token)
	).length;
	const textTokenMatches = tokens.filter((token) =>
		normalizedText.includes(token)
	).length;

	let score = candidate.score;

	if (candidate.sources.has("direct")) score += 0.75;
	if (candidate.sources.has("semantic")) score += 0.4;
	if (candidate.sources.size > 1) score += 0.35;

	if (normalizedQuery.length > 0) {
		if (normalizedTitle === normalizedQuery) {
			score += 1.5;
		} else if (normalizedTitle.includes(normalizedQuery)) {
			score += 0.9;
		}

		if (normalizedText.includes(normalizedQuery)) {
			score += 0.45;
		}
	}

	if (tokens.length > 0) {
		score += (titleTokenMatches / tokens.length) * 0.8;
		score += (textTokenMatches / tokens.length) * 0.45;
	}

	if (candidate.timestamp) {
		const ageMs = Math.max(Date.now() - candidate.timestamp, 0);
		const ageDays = ageMs / (1000 * 60 * 60 * 24);
		if (ageDays <= 3) {
			score += 0.15;
		} else if (ageDays <= 14) {
			score += 0.08;
		} else if (ageDays <= 30) {
			score += 0.03;
		}
	}

	return Number(score.toFixed(4));
}

export function buildHybridRetrievalResults(args: {
	query: string;
	directResults: DirectSearchAllResults;
	semanticResults: SemanticRetrievalResult[];
	limit?: number;
}) {
	const mergedCandidates = mergeCandidates([
		...buildDirectCandidates(args.directResults),
		...buildSemanticCandidates(args.semanticResults),
	]);

	return mergedCandidates
		.map((candidate) => ({
			id: candidate.id,
			type: candidate.type,
			text: candidate.text,
			score: calculateHybridScore(candidate, args.query),
			sourceRefs: candidate.sourceRefs,
		}))
		.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
		.slice(0, args.limit ?? 10);
}
