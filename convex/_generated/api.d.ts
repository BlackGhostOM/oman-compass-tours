/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as blog from "../blog.js";
import type * as bookingEmails from "../bookingEmails.js";
import type * as bookings from "../bookings.js";
import type * as catalog from "../catalog.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as fx from "../fx.js";
import type * as gateways_paypal from "../gateways/paypal.js";
import type * as gateways_provider from "../gateways/provider.js";
import type * as gateways_registry from "../gateways/registry.js";
import type * as gateways_stripe from "../gateways/stripe.js";
import type * as gateways_thawani from "../gateways/thawani.js";
import type * as http from "../http.js";
import type * as leads from "../leads.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as newsletter from "../newsletter.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as policies from "../policies.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as seedAuth from "../seedAuth.js";
import type * as seedData_blog from "../seedData/blog.js";
import type * as seedData_categories from "../seedData/categories.js";
import type * as seedData_destinations from "../seedData/destinations.js";
import type * as seedData_misc from "../seedData/misc.js";
import type * as seedData_policies from "../seedData/policies.js";
import type * as seedData_reviews from "../seedData/reviews.js";
import type * as seedData_tours from "../seedData/tours.js";
import type * as testing from "../testing.js";
import type * as tours from "../tours.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  availability: typeof availability;
  blog: typeof blog;
  bookingEmails: typeof bookingEmails;
  bookings: typeof bookings;
  catalog: typeof catalog;
  content: typeof content;
  crons: typeof crons;
  files: typeof files;
  fx: typeof fx;
  "gateways/paypal": typeof gateways_paypal;
  "gateways/provider": typeof gateways_provider;
  "gateways/registry": typeof gateways_registry;
  "gateways/stripe": typeof gateways_stripe;
  "gateways/thawani": typeof gateways_thawani;
  http: typeof http;
  leads: typeof leads;
  "lib/access": typeof lib_access;
  "lib/email": typeof lib_email;
  "lib/ids": typeof lib_ids;
  "lib/money": typeof lib_money;
  "lib/pricing": typeof lib_pricing;
  newsletter: typeof newsletter;
  notifications: typeof notifications;
  payments: typeof payments;
  policies: typeof policies;
  reviews: typeof reviews;
  seed: typeof seed;
  seedAuth: typeof seedAuth;
  "seedData/blog": typeof seedData_blog;
  "seedData/categories": typeof seedData_categories;
  "seedData/destinations": typeof seedData_destinations;
  "seedData/misc": typeof seedData_misc;
  "seedData/policies": typeof seedData_policies;
  "seedData/reviews": typeof seedData_reviews;
  "seedData/tours": typeof seedData_tours;
  testing: typeof testing;
  tours: typeof tours;
  users: typeof users;
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
