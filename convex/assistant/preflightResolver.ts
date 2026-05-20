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

function summarizeCount(label: string, count: number): string {
	return `${label}: ${count}`;
}

export async function resolvePreflightContext(args: {
	ctx: ActionCtx;
	workspaceId: Id<"workspaces">;
	userId: Id<"users">;
	message: string;
}): Promise<PreflightResolutionResult> {
	const plan = buildPreflightContextPlan({ message: args.message });
	const sourceRefs: string[] = [];
	const summaryLines = [...plan.summaryLines];
	let resolvedTopic = plan.resolvedTopic;

	if (plan.intent === "channel_summary" && plan.channelQuery) {
		const channelSearch = (await args.ctx.runQuery(
			api.assistantTools.searchChannels,
			{ workspaceId: args.workspaceId, query: plan.channelQuery }
		)) as { channels?: Array<{ id: string; name?: string }> } | null;

		sourceRefs.push(
			...collectSourceRefsFromToolResult("searchChannels", channelSearch)
		);

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

		if (!exactMatch && channels.length > 1) {
			const suggestions = channels
				.slice(0, 3)
				.map((ch) => `#${String(ch?.name ?? "").trim()}`)
				.filter(Boolean);
			return {
				promptText: "",
				sourceRefs,
				earlyResponse: suggestions.length
					? `I found multiple channels matching "${plan.channelQuery}": ${suggestions.join(", ")}. Which one should I use?`
					: `I found multiple channels matching "${plan.channelQuery}". Which one should I use?`,
			};
		}

		const resolvedChannel = exactMatch ?? channels[0];
		if (resolvedChannel?.id) {
			const channelSummary = (await args.ctx.runQuery(
				api.assistantTools.getChannelSummary,
				{
					workspaceId: args.workspaceId,
					channelId: resolvedChannel.id as Id<"channels">,
					limit: 40,
				}
			)) as { channelName?: string; messageCount?: number } | null;

			sourceRefs.push(
				...collectSourceRefsFromToolResult("getChannelSummary", channelSummary)
			);
			resolvedTopic =
				String(
					(channelSummary as { channelName?: string } | null)?.channelName ??
						resolvedChannel?.name ??
						""
				).trim() || resolvedTopic;
			summaryLines.push(
				`Resolved channel: #${resolvedTopic}`,
				summarizeCount(
					"Recent messages considered",
					Number(
						(channelSummary as { messageCount?: number } | null)
							?.messageCount ?? 0
					)
				)
			);
		}
	}

	if (plan.intent === "workspace_catchup") {
		const summary = (await args.ctx.runQuery(
			api.assistantTools.getWorkspaceGeneralSummary,
			{ workspaceId: args.workspaceId, userId: args.userId }
		)) as {
			recentMessages?: unknown[];
			highPriorityTasks?: unknown[];
			recentNotes?: unknown[];
		} | null;

		sourceRefs.push(
			...collectSourceRefsFromToolResult("getWorkspaceGeneralSummary", summary)
		);
		summaryLines.push(
			summarizeCount(
				"Recent messages",
				Array.isArray(summary?.recentMessages)
					? summary.recentMessages.length
					: 0
			),
			summarizeCount(
				"High-priority tasks",
				Array.isArray(summary?.highPriorityTasks)
					? summary.highPriorityTasks.length
					: 0
			),
			summarizeCount(
				"Recent notes",
				Array.isArray(summary?.recentNotes) ? summary.recentNotes.length : 0
			)
		);
	}

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

		sourceRefs.push(...collectSourceRefsFromToolResult(toolName, noteResult));
		summaryLines.push(
			summarizeCount(
				"Matching notes",
				Array.isArray(noteResult?.notes) ? noteResult.notes.length : 0
			)
		);
	}

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

		sourceRefs.push(...collectSourceRefsFromToolResult(toolName, taskResult));
		summaryLines.push(
			summarizeCount(
				"Matching tasks",
				Array.isArray(taskResult?.tasks) ? taskResult.tasks.length : 0
			)
		);
	}

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

		sourceRefs.push(
			...collectSourceRefsFromToolResult(calendarTool, calendarResult)
		);
		summaryLines.push(
			summarizeCount(
				"Matching calendar events",
				Array.isArray(calendarResult?.events) ? calendarResult.events.length : 0
			)
		);
	}

	if (plan.intent === "task_create" && plan.needsMemberResolution) {
		const members = (await args.ctx.runQuery(api.members.get, {
			workspaceId: args.workspaceId,
		})) as unknown[];
		summaryLines.push(
			summarizeCount(
				"Accepted workspace members",
				Array.isArray(members) ? members.length : 0
			)
		);
	}

	return {
		promptText: buildPreflightContextPrompt({
			intent: plan.intent,
			confidence: plan.confidence,
			resolvedTopic,
			recommendedToolOrder: plan.recommendedToolOrder,
			summaryLines,
		}),
		sourceRefs: dedupeSourceRefs(sourceRefs),
	};
}
