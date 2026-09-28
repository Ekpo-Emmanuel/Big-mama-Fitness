/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as booking from "../booking.js";
import type * as devEmailSchedule from "../devEmailSchedule.js";
import type * as emailAction from "../emailAction.js";
import type * as errors from "../errors.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as guests from "../guests.js";
import type * as holdAction from "../holdAction.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as leads from "../leads.js";
import type * as map from "../map.js";
import type * as organizers from "../organizers.js";
import type * as purchaseAction from "../purchaseAction.js";
import type * as rateLimit from "../rateLimit.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  booking: typeof booking;
  devEmailSchedule: typeof devEmailSchedule;
  emailAction: typeof emailAction;
  errors: typeof errors;
  events: typeof events;
  feedback: typeof feedback;
  guests: typeof guests;
  holdAction: typeof holdAction;
  http: typeof http;
  jobs: typeof jobs;
  leads: typeof leads;
  map: typeof map;
  organizers: typeof organizers;
  purchaseAction: typeof purchaseAction;
  rateLimit: typeof rateLimit;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
