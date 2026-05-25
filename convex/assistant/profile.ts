export type AssistantResponseStyle = "concise" | "balanced" | "detailed";
export type AssistantActionPreference = "suggestive" | "proactive";
export type AssistantPrioritizationStrategy =
	| "balanced"
	| "blockers_first"
	| "deadlines_first"
	| "meetings_first";
export type AssistantSummaryFocus = "tasks" | "channels" | "notes" | "general";
export type AssistantActiveContextKind = "release" | "project";

export type AssistantActiveContext = {
	kind: AssistantActiveContextKind;
	label: string;
	aliases?: string[];
	ownerHints?: string[];
	statusHint?: string;
	lastMentionedAt: number;
};

export type AssistantProfileRecord = {
	responseStyle?: AssistantResponseStyle;
	actionPreference?: AssistantActionPreference;
	prioritizationStrategy?: AssistantPrioritizationStrategy;
	summaryFocus?: AssistantSummaryFocus[];
	memoryBullets?: string[];
	activeContexts?: AssistantActiveContext[];
};

export type AssistantProfileUpdate = {
	responseStyle?: AssistantResponseStyle;
	actionPreference?: AssistantActionPreference;
	prioritizationStrategy?: AssistantPrioritizationStrategy;
	summaryFocus?: AssistantSummaryFocus[];
	memoryBullet?: string;
	activeContext?: AssistantActiveContext;
};

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

export function buildAssistantProfilePrompt(profile: AssistantProfileRecord) {
	const lines: string[] = [];

	if (profile.responseStyle === "concise") {
		lines.push("- Keep responses concise and high-signal.");
	} else if (profile.responseStyle === "detailed") {
		lines.push("- Provide more detailed context when answering.");
	}

	if (profile.actionPreference === "proactive") {
		lines.push("- Be proactive about suggesting next steps when useful.");
	} else if (profile.actionPreference === "suggestive") {
		lines.push("- Prefer suggestive guidance over pushy recommendations.");
	}

	if (profile.prioritizationStrategy === "blockers_first") {
		lines.push("- Prioritize blockers before other work when summarizing.");
	} else if (profile.prioritizationStrategy === "deadlines_first") {
		lines.push(
			"- Prioritize upcoming deadlines before other work when summarizing."
		);
	} else if (profile.prioritizationStrategy === "meetings_first") {
		lines.push("- Prioritize meetings and calendar commitments when relevant.");
	}

	if (profile.summaryFocus && profile.summaryFocus.length > 0) {
		lines.push(
			`- Emphasize these areas in summaries: ${profile.summaryFocus.join(", ")}.`
		);
	}

	const memoryBullets = (profile.memoryBullets ?? [])
		.map((item) => normalizeWhitespace(item))
		.filter(Boolean);
	if (memoryBullets.length > 0) {
		lines.push("Long-term memory:");
		lines.push(...memoryBullets.map((item) => `- ${item}`));
	}

	const activeContexts = (profile.activeContexts ?? []).filter(
		(context) => normalizeWhitespace(context.label).length > 0
	);
	if (activeContexts.length > 0) {
		lines.push("Active context memory:");
		lines.push(
			...activeContexts.map((context) => {
				const prefix = context.kind === "release" ? "Release" : "Project";
				const details = [
					context.statusHint ? context.statusHint : "",
					context.ownerHints?.length
						? `Owners: ${context.ownerHints.join(", ")}`
						: "",
				].filter(Boolean);
				return `- ${prefix}: ${context.label}${details.length ? ` (${details.join(" | ")})` : ""}`;
			})
		);
	}

	if (lines.length === 0) {
		return "";
	}

	return ["Personalization profile:", ...lines].join("\n");
}

function extractReleaseFocus(message: string) {
	const match = message.match(
		/\b(?:i(?:'m| am)\s+(?:working|focused)\s+on|remember\s+that\s+i(?:'m| am)\s+(?:working|focused)\s+on)\s+(.+?)(?:[.!]|$)/i
	);
	if (!match?.[1]) return null;

	const subject = normalizeWhitespace(match[1]).replace(/^the\s+/i, "");
	if (!subject) return null;
	return `User is currently focused on the ${subject}.`;
}

function inferActiveContextKind(label: string): AssistantActiveContextKind {
	return /\b(release|rollout|launch|deploy(?:ment)?)\b/i.test(label)
		? "release"
		: "project";
}

function extractActiveContext(
	message: string
): AssistantActiveContext | undefined {
	const focusMatch = message.match(
		/\b(?:i(?:'m| am)\s+(?:working|focused)\s+on|remember\s+that\s+i(?:'m| am)\s+(?:working|focused)\s+on)\s+(.+?)(?:[.!]|$)/i
	);
	if (focusMatch?.[1]) {
		const label = normalizeWhitespace(focusMatch[1]).replace(/^the\s+/i, "");
		if (label) {
			return {
				kind: inferActiveContextKind(label),
				label,
				lastMentionedAt: Date.now(),
			};
		}
	}

	const blockedMatch = message.match(
		/\bremember\s+(?:that\s+)?(?:the\s+)?(.+?)\s+is\s+blocked\s+on\s+(.+?)(?:[.!]|$)/i
	);
	if (blockedMatch?.[1] && blockedMatch?.[2]) {
		const label = normalizeWhitespace(blockedMatch[1]).replace(/^the\s+/i, "");
		const blocker = normalizeWhitespace(blockedMatch[2]);
		if (label && blocker) {
			return {
				kind: inferActiveContextKind(label),
				label,
				statusHint: `Blocked on ${blocker}.`,
				lastMentionedAt: Date.now(),
			};
		}
	}

	return undefined;
}

export function extractAssistantProfileUpdateFromMessage(
	message: string
): AssistantProfileUpdate | null {
	const normalized = normalizeWhitespace(message);
	if (
		!/\bremember\b|\bi prefer\b|\bprefer\b|\bfocus on\b|\bworking on\b|\bi want you to remember\b|\bplease keep in mind\b|\bremember that\b|\bdont forget\b|\bdon't forget\b|\bnote that\b/i.test(
			normalized
		)
	) {
		return null;
	}

	const lower = normalized.toLowerCase();
	const update: AssistantProfileUpdate = {};

	if (
		/\b(prefer|keep|want)\b.*\b(concise|brief|short)\b/i.test(lower) ||
		/\bconcise updates\b/i.test(lower)
	) {
		update.responseStyle = "concise";
	}

	if (/\b(prefer|want)\b.*\b(detailed|detail)\b/i.test(lower)) {
		update.responseStyle = "detailed";
	}

	if (/\b(be )?proactive\b|\bproactively\b/i.test(lower)) {
		update.actionPreference = "proactive";
	}

	if (/\b(blockers? first|focus on blockers first)\b/i.test(lower)) {
		update.prioritizationStrategy = "blockers_first";
	}

	if (/\b(deadlines? first|due dates? first)\b/i.test(lower)) {
		update.prioritizationStrategy = "deadlines_first";
	}

	const focusAreas: AssistantSummaryFocus[] = [];
	if (
		/\btasks?\b/i.test(lower) &&
		/\b(summary|summaries|focus)\b/i.test(lower)
	) {
		focusAreas.push("tasks");
	}
	if (
		/\bchannels?\b/i.test(lower) &&
		/\b(summary|summaries|focus)\b/i.test(lower)
	) {
		focusAreas.push("channels");
	}
	if (
		/\bnotes?\b/i.test(lower) &&
		/\b(summary|summaries|focus)\b/i.test(lower)
	) {
		focusAreas.push("notes");
	}
	if (focusAreas.length > 0) {
		update.summaryFocus = [...new Set(focusAreas)];
	}

	const memoryBullet = extractReleaseFocus(normalized);
	if (memoryBullet) {
		update.memoryBullet = memoryBullet;
	}
	const activeContext = extractActiveContext(normalized);
	if (activeContext) {
		update.activeContext = activeContext;
	}

	return Object.keys(update).length > 0 ? update : null;
}

export function mergeAssistantMemoryBullets(
	existingBullets: string[] | undefined,
	newBullet: string | undefined,
	limit = 6
) {
	const unique = new Set<string>();
	const merged: string[] = [];

	for (const item of [
		...(existingBullets ?? []),
		...(newBullet ? [newBullet] : []),
	]) {
		const cleaned = normalizeWhitespace(item);
		if (!cleaned || unique.has(cleaned)) continue;
		unique.add(cleaned);
		merged.push(cleaned);
	}

	return merged.slice(-limit);
}

export function mergeAssistantActiveContexts(
	existingContexts: AssistantActiveContext[] | undefined,
	newContext: AssistantActiveContext | undefined,
	limit = 5
) {
	const merged = new Map<string, AssistantActiveContext>();

	for (const context of existingContexts ?? []) {
		const label = normalizeWhitespace(context.label).toLowerCase();
		if (!label) continue;
		merged.set(label, {
			...context,
			label: normalizeWhitespace(context.label),
			aliases: context.aliases?.map(normalizeWhitespace).filter(Boolean),
			ownerHints: context.ownerHints?.map(normalizeWhitespace).filter(Boolean),
			statusHint: context.statusHint
				? normalizeWhitespace(context.statusHint)
				: undefined,
		});
	}

	if (newContext) {
		const label = normalizeWhitespace(newContext.label).toLowerCase();
		if (label) {
			const existing = merged.get(label);
			merged.set(label, {
				kind: newContext.kind,
				label: normalizeWhitespace(newContext.label),
				aliases:
					newContext.aliases?.map(normalizeWhitespace).filter(Boolean) ??
					existing?.aliases,
				ownerHints:
					newContext.ownerHints?.map(normalizeWhitespace).filter(Boolean) ??
					existing?.ownerHints,
				statusHint:
					"statusHint" in newContext
						? newContext.statusHint
							? normalizeWhitespace(newContext.statusHint)
							: undefined
						: existing?.statusHint,
				lastMentionedAt: newContext.lastMentionedAt,
			});
		}
	}

	return [...merged.values()]
		.sort((a, b) => b.lastMentionedAt - a.lastMentionedAt)
		.slice(0, limit);
}
