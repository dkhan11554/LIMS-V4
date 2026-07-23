/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as analytics from "../analytics.js";
import type * as audits from "../audits.js";
import type * as billing from "../billing.js";
import type * as calculations from "../calculations.js";
import type * as catalogue from "../catalogue.js";
import type * as coa from "../coa.js";
import type * as config from "../config.js";
import type * as customers from "../customers.js";
import type * as documents from "../documents.js";
import type * as errorLogs from "../errorLogs.js";
import type * as instrumentIntegration from "../instrumentIntegration.js";
import type * as instruments from "../instruments.js";
import type * as inventory from "../inventory.js";
import type * as lib_roles from "../lib/roles.js";
import type * as notifications from "../notifications.js";
import type * as organization from "../organization.js";
import type * as quality from "../quality.js";
import type * as revenue from "../revenue.js";
import type * as samples from "../samples.js";
import type * as scheduling from "../scheduling.js";
import type * as storage from "../storage.js";
import type * as suppliers from "../suppliers.js";
import type * as training from "../training.js";
import type * as users from "../users.js";
import type * as validation from "../validation.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  analytics: typeof analytics;
  audits: typeof audits;
  billing: typeof billing;
  calculations: typeof calculations;
  catalogue: typeof catalogue;
  coa: typeof coa;
  config: typeof config;
  customers: typeof customers;
  documents: typeof documents;
  errorLogs: typeof errorLogs;
  instrumentIntegration: typeof instrumentIntegration;
  instruments: typeof instruments;
  inventory: typeof inventory;
  "lib/roles": typeof lib_roles;
  notifications: typeof notifications;
  organization: typeof organization;
  quality: typeof quality;
  revenue: typeof revenue;
  samples: typeof samples;
  scheduling: typeof scheduling;
  storage: typeof storage;
  suppliers: typeof suppliers;
  training: typeof training;
  users: typeof users;
  validation: typeof validation;
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
