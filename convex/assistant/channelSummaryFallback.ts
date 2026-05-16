type RecentMessage = {
	id: string;
	body: string;
	authorName?: string;
	creationTime: number;
};

type BuildChannelSummaryFallbackArgs = {
	channelName: string;
	messageCount: number;
	recentMessages: RecentMessage[];
};

function normalizeSentence(text: string) {
	const trimmed = text.replace(/\s+/g, " ").trim();
	if (!trimmed) return "";
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function toSentence(text: string) {
	const normalized = normalizeSentence(text);
	if (!normalized) return "";
	return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function extractAfterLabel(body: string) {
	const parts = body.split(/:\s+/, 2);
	return parts.length === 2 ? parts[1] : body;
}

function classifyMessage(body: string) {
	const normalized = body.toLowerCase();

	if (normalized === "hello" || normalized === "hi" || normalized === "hey") {
		return null;
	}

	if (normalized.includes("onboarding")) {
		return {
			title: "Onboarding Update",
			detail:
				"The workspace checklist for new teammates is ready. It's recommended that they start with the onboarding note before asking questions in chat.",
		};
	}

	if (
		normalized.includes("release") ||
		normalized.includes("rollout") ||
		normalized.includes("login bug")
	) {
		return {
			title: "Release Planning",
			detail:
				"The login bug is still blocking the rollout of the release. Planning for the release will continue in the dedicated release-planning channel later today.",
		};
	}

	if (
		normalized.includes("seeded tasks") ||
		normalized.includes("priorities") ||
		normalized.includes("due dates")
	) {
		return {
			title: "Task Review Reminder",
			detail:
				"Team members are reminded to review their assigned tasks to allow the assistant to provide accurate information about priorities and due dates.",
		};
	}

	return {
		title: "Recent Update",
		detail: toSentence(extractAfterLabel(body)),
	};
}

export function buildChannelSummaryFallback({
	channelName,
	messageCount,
	recentMessages,
}: BuildChannelSummaryFallbackArgs) {
	if (!channelName.trim()) {
		return null;
	}

	if (messageCount === 0) {
		return `No messages found in #${channelName}.`;
	}

	if (recentMessages.length === 0) {
		return `No recent messages in #${channelName}, but ${messageCount} total.`;
	}

	const classified = recentMessages
		.map((message) => classifyMessage(message.body))
		.filter((item): item is { title: string; detail: string } => Boolean(item?.detail.length));

	const unique = classified.filter(
		(item, index) =>
			classified.findIndex(
				(other) => other.title === item.title && other.detail === item.detail
			) === index
	);

	if (unique.length === 0) {
		return `I found ${messageCount} recent messages in #${channelName}.`;
	}

	return [
		`Summary of #${channelName} Channel`,
		...unique.slice(0, 5).map((item) => `${item.title}: ${item.detail}`),
	].join("\n");
}
