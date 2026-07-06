/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistant_channelSummaryFallback from "../assistant/channelSummaryFallback.js";
import type * as assistant_chat from "../assistant/chat.js";
import type * as assistant_composioTools from "../assistant/composioTools.js";
import type * as assistant_context from "../assistant/context.js";
import type * as assistant_conversations from "../assistant/conversations.js";
import type * as assistant_databaseChatConversation from "../assistant/databaseChatConversation.js";
import type * as assistant_hybridRetrieval from "../assistant/hybridRetrieval.js";
import type * as assistant_preflightResolver from "../assistant/preflightResolver.js";
import type * as assistant_profile from "../assistant/profile.js";
import type * as assistant_profiles from "../assistant/profiles.js";
import type * as assistant_relativeDate from "../assistant/relativeDate.js";
import type * as assistant_sendMessageFlow from "../assistant/sendMessageFlow.js";
import type * as assistant_taskAssignment from "../assistant/taskAssignment.js";
import type * as assistant_taskDrafts from "../assistant/taskDrafts.js";
import type * as assistant_titleGeneration from "../assistant/titleGeneration.js";
import type * as assistant_titles from "../assistant/titles.js";
import type * as assistant_toolExecutor from "../assistant/toolExecutor.js";
import type * as assistant_toolLoop from "../assistant/toolLoop.js";
import type * as assistant_toolResults from "../assistant/toolResults.js";
import type * as assistant_tools from "../assistant/tools.js";
import type * as auth from "../auth.js";
import type * as authn_emailVerification from "../authn/emailVerification.js";
import type * as authn_passwordManagement from "../authn/passwordManagement.js";
import type * as billing_dodo from "../billing/dodo.js";
import type * as billing_payments from "../billing/payments.js";
import type * as billing_plans from "../billing/plans.js";
import type * as billing_rateLimit from "../billing/rateLimit.js";
import type * as billing_usageTracking from "../billing/usageTracking.js";
import type * as billing_webhooks from "../billing/webhooks.js";
import type * as board_board from "../board/board.js";
import type * as board_dependency from "../board/dependency.js";
import type * as content_meetingNotes from "../content/meetingNotes.js";
import type * as content_notes from "../content/notes.js";
import type * as content_prosemirror from "../content/prosemirror.js";
import type * as content_richText from "../content/richText.js";
import type * as content_upload from "../content/upload.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as imports_importIntegrations from "../imports/importIntegrations.js";
import type * as imports_importPipeline from "../imports/importPipeline.js";
import type * as imports_importTasks from "../imports/importTasks.js";
import type * as imports_integrations from "../imports/integrations.js";
import type * as imports_linearImportProvider from "../imports/linearImportProvider.js";
import type * as imports_slackImportProvider from "../imports/slackImportProvider.js";
import type * as imports_todoistImportProvider from "../imports/todoistImportProvider.js";
import type * as lib_issueBlocking from "../lib/issueBlocking.js";
import type * as lib_safeDelete from "../lib/safeDelete.js";
import type * as lib_utils from "../lib/utils.js";
import type * as messaging_channels from "../messaging/channels.js";
import type * as messaging_conversations from "../messaging/conversations.js";
import type * as messaging_direct from "../messaging/direct.js";
import type * as messaging_mentions from "../messaging/mentions.js";
import type * as messaging_messages from "../messaging/messages.js";
import type * as messaging_presence from "../messaging/presence.js";
import type * as messaging_reactions from "../messaging/reactions.js";
import type * as messaging_threadTitles from "../messaging/threadTitles.js";
import type * as messaging_typing from "../messaging/typing.js";
import type * as notify_email from "../notify/email.js";
import type * as notify_emailActions from "../notify/emailActions.js";
import type * as notify_notifications from "../notify/notifications.js";
import type * as notify_onesignal from "../notify/onesignal.js";
import type * as planning_calendar from "../planning/calendar.js";
import type * as planning_milestones from "../planning/milestones.js";
import type * as planning_projects from "../planning/projects.js";
import type * as planning_sprints from "../planning/sprints.js";
import type * as planning_stress from "../planning/stress.js";
import type * as planning_tasks from "../planning/tasks.js";
import type * as search_aiSearch from "../search/aiSearch.js";
import type * as search_ragchat from "../search/ragchat.js";
import type * as search_search from "../search/search.js";
import type * as workspace_analytics from "../workspace/analytics.js";
import type * as workspace_invites from "../workspace/invites.js";
import type * as workspace_members from "../workspace/members.js";
import type * as workspace_preferences from "../workspace/preferences.js";
import type * as workspace_userStatus from "../workspace/userStatus.js";
import type * as workspace_users from "../workspace/users.js";
import type * as workspace_workspaces from "../workspace/workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "assistant/channelSummaryFallback": typeof assistant_channelSummaryFallback;
  "assistant/chat": typeof assistant_chat;
  "assistant/composioTools": typeof assistant_composioTools;
  "assistant/context": typeof assistant_context;
  "assistant/conversations": typeof assistant_conversations;
  "assistant/databaseChatConversation": typeof assistant_databaseChatConversation;
  "assistant/hybridRetrieval": typeof assistant_hybridRetrieval;
  "assistant/preflightResolver": typeof assistant_preflightResolver;
  "assistant/profile": typeof assistant_profile;
  "assistant/profiles": typeof assistant_profiles;
  "assistant/relativeDate": typeof assistant_relativeDate;
  "assistant/sendMessageFlow": typeof assistant_sendMessageFlow;
  "assistant/taskAssignment": typeof assistant_taskAssignment;
  "assistant/taskDrafts": typeof assistant_taskDrafts;
  "assistant/titleGeneration": typeof assistant_titleGeneration;
  "assistant/titles": typeof assistant_titles;
  "assistant/toolExecutor": typeof assistant_toolExecutor;
  "assistant/toolLoop": typeof assistant_toolLoop;
  "assistant/toolResults": typeof assistant_toolResults;
  "assistant/tools": typeof assistant_tools;
  auth: typeof auth;
  "authn/emailVerification": typeof authn_emailVerification;
  "authn/passwordManagement": typeof authn_passwordManagement;
  "billing/dodo": typeof billing_dodo;
  "billing/payments": typeof billing_payments;
  "billing/plans": typeof billing_plans;
  "billing/rateLimit": typeof billing_rateLimit;
  "billing/usageTracking": typeof billing_usageTracking;
  "billing/webhooks": typeof billing_webhooks;
  "board/board": typeof board_board;
  "board/dependency": typeof board_dependency;
  "content/meetingNotes": typeof content_meetingNotes;
  "content/notes": typeof content_notes;
  "content/prosemirror": typeof content_prosemirror;
  "content/richText": typeof content_richText;
  "content/upload": typeof content_upload;
  crons: typeof crons;
  http: typeof http;
  "imports/importIntegrations": typeof imports_importIntegrations;
  "imports/importPipeline": typeof imports_importPipeline;
  "imports/importTasks": typeof imports_importTasks;
  "imports/integrations": typeof imports_integrations;
  "imports/linearImportProvider": typeof imports_linearImportProvider;
  "imports/slackImportProvider": typeof imports_slackImportProvider;
  "imports/todoistImportProvider": typeof imports_todoistImportProvider;
  "lib/issueBlocking": typeof lib_issueBlocking;
  "lib/safeDelete": typeof lib_safeDelete;
  "lib/utils": typeof lib_utils;
  "messaging/channels": typeof messaging_channels;
  "messaging/conversations": typeof messaging_conversations;
  "messaging/direct": typeof messaging_direct;
  "messaging/mentions": typeof messaging_mentions;
  "messaging/messages": typeof messaging_messages;
  "messaging/presence": typeof messaging_presence;
  "messaging/reactions": typeof messaging_reactions;
  "messaging/threadTitles": typeof messaging_threadTitles;
  "messaging/typing": typeof messaging_typing;
  "notify/email": typeof notify_email;
  "notify/emailActions": typeof notify_emailActions;
  "notify/notifications": typeof notify_notifications;
  "notify/onesignal": typeof notify_onesignal;
  "planning/calendar": typeof planning_calendar;
  "planning/milestones": typeof planning_milestones;
  "planning/projects": typeof planning_projects;
  "planning/sprints": typeof planning_sprints;
  "planning/stress": typeof planning_stress;
  "planning/tasks": typeof planning_tasks;
  "search/aiSearch": typeof search_aiSearch;
  "search/ragchat": typeof search_ragchat;
  "search/search": typeof search_search;
  "workspace/analytics": typeof workspace_analytics;
  "workspace/invites": typeof workspace_invites;
  "workspace/members": typeof workspace_members;
  "workspace/preferences": typeof workspace_preferences;
  "workspace/userStatus": typeof workspace_userStatus;
  "workspace/users": typeof workspace_users;
  "workspace/workspaces": typeof workspace_workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  databaseChat: import("@dayhaysoos/convex-database-chat/_generated/component.js").ComponentApi<"databaseChat">;
  dodopayments: import("@dodopayments/convex/_generated/component.js").ComponentApi<"dodopayments">;
};
