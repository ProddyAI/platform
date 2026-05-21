/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */
import type * as chat from "../chat.js";
import type * as client from "../client.js";
import type * as conversations from "../conversations.js";
import type * as messages from "../messages.js";
import type * as schemaTools from "../schemaTools.js";
import type * as stream from "../stream.js";
import type * as tools from "../tools.js";
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
declare const fullApi: ApiFromModules<{
    chat: typeof chat;
    client: typeof client;
    conversations: typeof conversations;
    messages: typeof messages;
    schemaTools: typeof schemaTools;
    stream: typeof stream;
    tools: typeof tools;
}>;
/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
export declare const components: {};
export {};
//# sourceMappingURL=api.d.ts.map