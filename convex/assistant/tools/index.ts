/**
 * Proddy assistant tools - internal workspace + external integrations.
 */

import * as internal from "./internalTools";
import * as composio from "./composioTools";

export type { AssistantCtx } from "./internalTools";

export const internalTools: Record<string, unknown> = {
	getMyCalendarToday: internal.getMyCalendarToday,
	getMyCalendarTomorrow: internal.getMyCalendarTomorrow,
	getMyCalendarThisWeek: internal.getMyCalendarThisWeek,
	getMyCalendarNextWeek: internal.getMyCalendarNextWeek,
	getMyTasksToday: internal.getMyTasksToday,
	getMyTasksTomorrow: internal.getMyTasksTomorrow,
	getMyTasksThisWeek: internal.getMyTasksThisWeek,
	getMyAllTasks: internal.getMyAllTasks,
	searchChannels: internal.searchChannels,
	getChannelSummary: internal.getChannelSummary,
	getWorkspaceOverview: internal.getWorkspaceOverview,
	getMyCards: internal.getMyCards,
	semanticSearch: internal.semanticSearch,
};

export const composioTools = {
	runGmailTool: composio.runGmailTool,
	runSlackTool: composio.runSlackTool,
	runGithubTool: composio.runGithubTool,
	runNotionTool: composio.runNotionTool,
	runClickupTool: composio.runClickupTool,
	runLinearTool: composio.runLinearTool,
};

export const allTools: Record<string, unknown> = {
	...internalTools,
	...composioTools,
};
