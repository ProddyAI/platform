/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiSearch from "../aiSearch.js";
import type * as analytics from "../analytics.js";
import type * as assistant_agent from "../assistant/agent.js";
import type * as assistant_channelSummaryFallback from "../assistant/channelSummaryFallback.js";
import type * as assistant_context from "../assistant/context.js";
import type * as assistant_databaseChatConversation from "../assistant/databaseChatConversation.js";
import type * as assistant_errorHandling from "../assistant/errorHandling.js";
import type * as assistant_hybridRetrieval from "../assistant/hybridRetrieval.js";
import type * as assistant_monitoring from "../assistant/monitoring.js";
import type * as assistant_preflightResolver from "../assistant/preflightResolver.js";
import type * as assistant_profile from "../assistant/profile.js";
import type * as assistant_relativeDate from "../assistant/relativeDate.js";
import type * as assistant_sendMessageFlow from "../assistant/sendMessageFlow.js";
import type * as assistant_taskAssignment from "../assistant/taskAssignment.js";
import type * as assistant_taskDrafts from "../assistant/taskDrafts.js";
import type * as assistant_titleGeneration from "../assistant/titleGeneration.js";
import type * as assistant_toolExecutor from "../assistant/toolExecutor.js";
import type * as assistant_toolLoop from "../assistant/toolLoop.js";
import type * as assistant_toolResults from "../assistant/toolResults.js";
import type * as assistant_tools_composioTools from "../assistant/tools/composioTools.js";
import type * as assistant_tools_index from "../assistant/tools/index.js";
import type * as assistant_tools_internalTools from "../assistant/tools/internalTools.js";
import type * as assistantChat from "../assistantChat.js";
import type * as assistantComposioTools from "../assistantComposioTools.js";
import type * as assistantConversations from "../assistantConversations.js";
import type * as assistantProfiles from "../assistantProfiles.js";
import type * as assistantTitles from "../assistantTitles.js";
import type * as assistantToolAudits from "../assistantToolAudits.js";
import type * as assistantTools from "../assistantTools.js";
import type * as auth from "../auth.js";
import type * as board from "../board.js";
import type * as boardDependency from "../boardDependency.js";
import type * as calendar from "../calendar.js";
import type * as channels from "../channels.js";
import type * as chatbot from "../chatbot.js";
import type * as chatbotQueries from "../chatbotQueries.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as diagnostic from "../diagnostic.js";
import type * as direct from "../direct.js";
import type * as dodo from "../dodo.js";
import type * as email from "../email.js";
import type * as emailActions from "../emailActions.js";
import type * as emailVerification from "../emailVerification.js";
import type * as http from "../http.js";
import type * as hybridRag from "../hybridRag.js";
import type * as importIntegrations from "../importIntegrations.js";
import type * as importPipeline from "../importPipeline.js";
import type * as integrations from "../integrations.js";
import type * as lib_issueBlocking from "../lib/issueBlocking.js";
import type * as lib_safeDelete from "../lib/safeDelete.js";
import type * as linearImportProvider from "../linearImportProvider.js";
import type * as meetingNotes from "../meetingNotes.js";
import type * as members from "../members.js";
import type * as mentions from "../mentions.js";
import type * as messages from "../messages.js";
import type * as migrations_cleanupDuplicateAssistantConversations from "../migrations/cleanupDuplicateAssistantConversations.js";
import type * as milestones from "../milestones.js";
import type * as notes from "../notes.js";
import type * as notifications from "../notifications.js";
import type * as onesignal from "../onesignal.js";
import type * as passwordManagement from "../passwordManagement.js";
import type * as payments from "../payments.js";
import type * as plans from "../plans.js";
import type * as preferences from "../preferences.js";
import type * as presence from "../presence.js";
import type * as projects from "../projects.js";
import type * as prosemirror from "../prosemirror.js";
import type * as ragchat from "../ragchat.js";
import type * as rateLimit from "../rateLimit.js";
import type * as reactions from "../reactions.js";
import type * as richText from "../richText.js";
import type * as search from "../search.js";
import type * as slackImportProvider from "../slackImportProvider.js";
import type * as sprints from "../sprints.js";
import type * as stress from "../stress.js";
import type * as tasks from "../tasks.js";
import type * as testDodo from "../testDodo.js";
import type * as threadTitles from "../threadTitles.js";
import type * as todoistImportProvider from "../todoistImportProvider.js";
import type * as typing from "../typing.js";
import type * as upload from "../upload.js";
import type * as usageTracking from "../usageTracking.js";
import type * as userStatus from "../userStatus.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as webhooks from "../webhooks.js";
import type * as workspaceInvites from "../workspaceInvites.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiSearch: typeof aiSearch;
  analytics: typeof analytics;
  "assistant/agent": typeof assistant_agent;
  "assistant/channelSummaryFallback": typeof assistant_channelSummaryFallback;
  "assistant/context": typeof assistant_context;
  "assistant/databaseChatConversation": typeof assistant_databaseChatConversation;
  "assistant/errorHandling": typeof assistant_errorHandling;
  "assistant/hybridRetrieval": typeof assistant_hybridRetrieval;
  "assistant/monitoring": typeof assistant_monitoring;
  "assistant/preflightResolver": typeof assistant_preflightResolver;
  "assistant/profile": typeof assistant_profile;
  "assistant/relativeDate": typeof assistant_relativeDate;
  "assistant/sendMessageFlow": typeof assistant_sendMessageFlow;
  "assistant/taskAssignment": typeof assistant_taskAssignment;
  "assistant/taskDrafts": typeof assistant_taskDrafts;
  "assistant/titleGeneration": typeof assistant_titleGeneration;
  "assistant/toolExecutor": typeof assistant_toolExecutor;
  "assistant/toolLoop": typeof assistant_toolLoop;
  "assistant/toolResults": typeof assistant_toolResults;
  "assistant/tools/composioTools": typeof assistant_tools_composioTools;
  "assistant/tools/index": typeof assistant_tools_index;
  "assistant/tools/internalTools": typeof assistant_tools_internalTools;
  assistantChat: typeof assistantChat;
  assistantComposioTools: typeof assistantComposioTools;
  assistantConversations: typeof assistantConversations;
  assistantProfiles: typeof assistantProfiles;
  assistantTitles: typeof assistantTitles;
  assistantToolAudits: typeof assistantToolAudits;
  assistantTools: typeof assistantTools;
  auth: typeof auth;
  board: typeof board;
  boardDependency: typeof boardDependency;
  calendar: typeof calendar;
  channels: typeof channels;
  chatbot: typeof chatbot;
  chatbotQueries: typeof chatbotQueries;
  conversations: typeof conversations;
  crons: typeof crons;
  diagnostic: typeof diagnostic;
  direct: typeof direct;
  dodo: typeof dodo;
  email: typeof email;
  emailActions: typeof emailActions;
  emailVerification: typeof emailVerification;
  http: typeof http;
  hybridRag: typeof hybridRag;
  importIntegrations: typeof importIntegrations;
  importPipeline: typeof importPipeline;
  integrations: typeof integrations;
  "lib/issueBlocking": typeof lib_issueBlocking;
  "lib/safeDelete": typeof lib_safeDelete;
  linearImportProvider: typeof linearImportProvider;
  meetingNotes: typeof meetingNotes;
  members: typeof members;
  mentions: typeof mentions;
  messages: typeof messages;
  "migrations/cleanupDuplicateAssistantConversations": typeof migrations_cleanupDuplicateAssistantConversations;
  milestones: typeof milestones;
  notes: typeof notes;
  notifications: typeof notifications;
  onesignal: typeof onesignal;
  passwordManagement: typeof passwordManagement;
  payments: typeof payments;
  plans: typeof plans;
  preferences: typeof preferences;
  presence: typeof presence;
  projects: typeof projects;
  prosemirror: typeof prosemirror;
  ragchat: typeof ragchat;
  rateLimit: typeof rateLimit;
  reactions: typeof reactions;
  richText: typeof richText;
  search: typeof search;
  slackImportProvider: typeof slackImportProvider;
  sprints: typeof sprints;
  stress: typeof stress;
  tasks: typeof tasks;
  testDodo: typeof testDodo;
  threadTitles: typeof threadTitles;
  todoistImportProvider: typeof todoistImportProvider;
  typing: typeof typing;
  upload: typeof upload;
  usageTracking: typeof usageTracking;
  userStatus: typeof userStatus;
  users: typeof users;
  utils: typeof utils;
  webhooks: typeof webhooks;
  workspaceInvites: typeof workspaceInvites;
  workspaces: typeof workspaces;
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
