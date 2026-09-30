/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as documents from "../documents.js";
import type * as files from "../files.js";
import type * as grievances from "../grievances.js";
import type * as http from "../http.js";
import type * as kb from "../kb.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as roles from "../roles.js";
import type * as streams from "../streams.js";
import type * as suggestions from "../suggestions.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  analytics: typeof analytics;
  auth: typeof auth;
  chats: typeof chats;
  crons: typeof crons;
  demo: typeof demo;
  documents: typeof documents;
  files: typeof files;
  grievances: typeof grievances;
  http: typeof http;
  kb: typeof kb;
  memories: typeof memories;
  messages: typeof messages;
  roles: typeof roles;
  streams: typeof streams;
  suggestions: typeof suggestions;
  users: typeof users;
  voice: typeof voice;
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

export declare const components: {};
