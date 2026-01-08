/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as board from "../board.js";
import type * as calendar from "../calendar.js";
import type * as channels from "../channels.js";
import type * as chatbot from "../chatbot.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as direct from "../direct.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as integrations from "../integrations.js";
import type * as members from "../members.js";
import type * as mentions from "../mentions.js";
import type * as messages from "../messages.js";
import type * as notes from "../notes.js";
import type * as preferences from "../preferences.js";
import type * as presence from "../presence.js";
import type * as prosemirror from "../prosemirror.js";
import type * as reactions from "../reactions.js";
import type * as search from "../search.js";
import type * as tasks from "../tasks.js";
import type * as threadTitles from "../threadTitles.js";
import type * as upload from "../upload.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  board: typeof board;
  calendar: typeof calendar;
  channels: typeof channels;
  chatbot: typeof chatbot;
  conversations: typeof conversations;
  crons: typeof crons;
  direct: typeof direct;
  email: typeof email;
  http: typeof http;
  integrations: typeof integrations;
  members: typeof members;
  mentions: typeof mentions;
  messages: typeof messages;
  notes: typeof notes;
  preferences: typeof preferences;
  presence: typeof presence;
  prosemirror: typeof prosemirror;
  reactions: typeof reactions;
  search: typeof search;
  tasks: typeof tasks;
  threadTitles: typeof threadTitles;
  upload: typeof upload;
  users: typeof users;
  utils: typeof utils;
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
  presence: {};
  prosemirrorSync: {
    lib: {
      deleteDocument: FunctionReference<
        "mutation",
        "internal",
        { id: string },
        null
      >;
      deleteSnapshots: FunctionReference<
        "mutation",
        "internal",
        { afterVersion?: number; beforeVersion?: number; id: string },
        null
      >;
      deleteSteps: FunctionReference<
        "mutation",
        "internal",
        {
          afterVersion?: number;
          beforeTs: number;
          deleteNewerThanLatestSnapshot?: boolean;
          id: string;
        },
        null
      >;
      getSnapshot: FunctionReference<
        "query",
        "internal",
        { id: string; version?: number },
        { content: null } | { content: string; version: number }
      >;
      getSteps: FunctionReference<
        "query",
        "internal",
        { id: string; version: number },
        {
          clientIds: Array<string | number>;
          steps: Array<string>;
          version: number;
        }
      >;
      latestVersion: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | number
      >;
      submitSnapshot: FunctionReference<
        "mutation",
        "internal",
        {
          content: string;
          id: string;
          pruneSnapshots?: boolean;
          version: number;
        },
        null
      >;
      submitSteps: FunctionReference<
        "mutation",
        "internal",
        {
          clientId: string | number;
          id: string;
          steps: Array<string>;
          version: number;
        },
        | {
            clientIds: Array<string | number>;
            status: "needs-rebase";
            steps: Array<string>;
          }
        | { status: "synced" }
      >;
    };
  };
  rag: {};
};
