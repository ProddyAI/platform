import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
	buildPreflightContextPlan,
	buildPreflightContextPrompt,
} from "./context";
import {
	collectSourceRefsFromToolResult,
	dedupeSourceRefs,
} from "./toolResults";

export type PreflightResolutionResult = {
	promptText: string;
	sourceRefs: string[];
	earlyResponse?: string;
};

type PreflightPlan = ReturnType<typeof buildPreflightContextPlan>;

type PreflightArgs = {
	ctx: ActionCtx;
	workspaceId: Id<"workspaces">;
	userId: Id<"users">;
	message: string;
};

type PreflightState = {
	sourceRefs: string[];
	summaryLines: string[];
	resolvedTopic: string;
};

function summarizeCount(label: string, count: number): string {
	return `${label}: ${count}`;
}

function countItems(items: unknown[] | undefined): number {
	return Array.isArray(items) ? items.length : 0;
}

function pushSourceRefs(
	state: PreflightState,
	toolName: string,
	result: unknown
): void {
	state.sourceRefs.push(...collectSourceRefsFromToolResult(toolName, result));
}

async function resolveChannelSummaryContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
): Promise<string | undefined> {
	if (!(plan.intent === "channel_summary" && plan.channelQuery)) {
		return undefined;
	}

	const channelSearch = (await args.ctx.runQuery(
		api.assistantTools.searchChannels,
		{ workspaceId: args.workspaceId, query: plan.channelQuery }
	)) as { channels?: Array<{ id: string; name?: string }> } | null;

	pushSourceRefs(state, "searchChannels", channelSearch);

	const channels: Array<{ id: string; name?: string }> = Array.isArray(
		channelSearch?.channels
	)
		? channelSearch.channels
		: [];

	const normalizedQuery = plan.channelQuery.trim().toLowerCase();
	const exactMatch =
		channels.find(
			(ch) =>
				String(ch?.name ?? "")
					.trim()
					.toLowerCase() === normalizedQuery
		) ?? null;

	if (channels.length === 0) {
		return `I couldn't find any channels matching "${plan.channelQuery}". Which channel did you mean?`;
	}

	if (!exactMatch && channels.length > 1) {
		const suggestions = channels
			.slice(0, 3)
			.map((ch) => `#${String(ch?.name ?? "").trim()}`)
			.filter(Boolean);
		return suggestions.length
			? `I found multiple channels matching "${plan.channelQuery}": ${suggestions.join(", ")}. Which one should I use?`
			: `I found multiple channels matching "${plan.channelQuery}". Which one should I use?`;
	}

	const resolvedChannel = exactMatch ?? channels[0];
	if (!resolvedChannel?.id) {
		return undefined;
	}

	const channelSummary = (await args.ctx.runQuery(
		api.assistantTools.getChannelSummary,
		{
			workspaceId: args.workspaceId,
			channelId: resolvedChannel.id as Id<"channels">,
			limit: 40,
		}
	)) as { channelName?: string; messageCount?: number } | null;

	pushSourceRefs(state, "getChannelSummary", channelSummary);
	state.resolvedTopic =
		String(
			(channelSummary as { channelName?: string } | null)?.channelName ??
				resolvedChannel.name ??
				""
		).trim() || state.resolvedTopic;
	state.summaryLines.push(
		`Resolved channel: #${state.resolvedTopic}`,
		summarizeCount(
			"Recent messages considered",
			Number(
				(channelSummary as { messageCount?: number } | null)?.messageCount ?? 0
			)
		)
	);

	return undefined;
}

async function appendWorkspaceCatchupContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
) {
	if (plan.intent === "workspace_catchup") {
		const summary = (await args.ctx.runQuery(
			api.assistantTools.getWorkspaceGeneralSummary,
			{ workspaceId: args.workspaceId, userId: args.userId }
		)) as {
			recentMessages?: unknown[];
			highPriorityTasks?: unknown[];
			recentNotes?: unknown[];
		} | null;

		pushSourceRefs(state, "getWorkspaceGeneralSummary", summary);
		state.summaryLines.push(
			summarizeCount("Recent messages", countItems(summary?.recentMessages)),
			summarizeCount(
				"High-priority tasks",
				countItems(summary?.highPriorityTasks)
			),
			summarizeCount("Recent notes", countItems(summary?.recentNotes))
		);
	}
}

async function appendNoteLookupContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
) {
	if (plan.intent === "note_lookup") {
		const toolName = plan.noteQuery ? "searchNotes" : "getRecentNotes";
		const noteResult = (await args.ctx.runQuery(
			plan.noteQuery
				? api.assistantTools.searchNotes
				: api.assistantTools.getRecentNotes,
			plan.noteQuery
				? { workspaceId: args.workspaceId, query: plan.noteQuery, limit: 6 }
				: { workspaceId: args.workspaceId, limit: 6 }
		)) as { notes?: unknown[] } | null;

		pushSourceRefs(state, toolName, noteResult);
		state.summaryLines.push(
			summarizeCount("Matching notes", countItems(noteResult?.notes))
		);
	}
}

async function appendTaskLookupContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
) {
	if (plan.intent === "task_lookup") {
		const toolName = plan.taskQuery ? "searchTasks" : "getMyAllTasks";
		const taskResult = (await args.ctx.runQuery(
			plan.taskQuery
				? api.assistantTools.searchTasks
				: api.assistantTools.getMyAllTasks,
			plan.taskQuery
				? {
						workspaceId: args.workspaceId,
						userId: args.userId,
						query: plan.taskQuery,
						limit: 8,
					}
				: {
						workspaceId: args.workspaceId,
						userId: args.userId,
						includeCompleted: false,
					}
		)) as { tasks?: unknown[] } | null;

		pushSourceRefs(state, toolName, taskResult);
		state.summaryLines.push(
			summarizeCount("Matching tasks", countItems(taskResult?.tasks))
		);
	}
}

async function appendCalendarLookupContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
) {
	if (plan.intent === "calendar_lookup" && plan.recommendedToolOrder[0]) {
		const calendarTool = plan.recommendedToolOrder[0];
		const handler =
			calendarTool === "getMyCalendarTomorrow"
				? api.assistantTools.getMyCalendarTomorrow
				: calendarTool === "getMyCalendarNextWeek"
					? api.assistantTools.getMyCalendarNextWeek
					: api.assistantTools.getMyCalendarToday;

		const calendarResult = (await args.ctx.runQuery(handler, {
			workspaceId: args.workspaceId,
			userId: args.userId,
		})) as { events?: unknown[] } | null;

		pushSourceRefs(state, calendarTool, calendarResult);
		state.summaryLines.push(
			summarizeCount(
				"Matching calendar events",
				countItems(calendarResult?.events)
			)
		);
	}
}

async function appendTaskCreateContext(
	args: PreflightArgs,
	state: PreflightState,
	plan: PreflightPlan
) {
	if (plan.intent === "task_create" && plan.needsMemberResolution) {
		const members = (await args.ctx.runQuery(api.members.get, {
			workspaceId: args.workspaceId,
		})) as unknown[];
		state.summaryLines.push(
			summarizeCount("Accepted workspace members", countItems(members))
		);
	}
}

const contextResolvers: Array<
	(
		args: PreflightArgs,
		state: PreflightState,
		plan: PreflightPlan
	) => Promise<string | undefined>
> = [resolveChannelSummaryContext];

const contextAppenders: Array<
	(
		args: PreflightArgs,
		state: PreflightState,
		plan: PreflightPlan
	) => Promise<void>
> = [
	appendWorkspaceCatchupContext,
	appendNoteLookupContext,
	appendTaskLookupContext,
	appendCalendarLookupContext,
	appendTaskCreateContext,
];

export async function resolvePreflightContext(
	args: PreflightArgs
): Promise<PreflightResolutionResult> {
	const plan = buildPreflightContextPlan({ message: args.message });
	const state: PreflightState = {
		sourceRefs: [],
		summaryLines: [...plan.summaryLines],
		resolvedTopic: plan.resolvedTopic ?? "",
	};

	for (const resolveContext of contextResolvers) {
		const earlyResponse = await resolveContext(args, state, plan);
		if (earlyResponse) {
			return {
				promptText: "",
				sourceRefs: state.sourceRefs,
				earlyResponse,
			};
		}
	}

	for (const appendContext of contextAppenders) {
		await appendContext(args, state, plan);
	}

	return {
		promptText: buildPreflightContextPrompt({
			intent: plan.intent,
			confidence: plan.confidence,
			resolvedTopic: state.resolvedTopic,
			recommendedToolOrder: plan.recommendedToolOrder,
			summaryLines: state.summaryLines,
		}),
		sourceRefs: dedupeSourceRefs(state.sourceRefs),
	};
}
