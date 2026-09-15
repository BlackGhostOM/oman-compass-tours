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
import type * as admin_audit from "../admin/audit.js";
import type * as admin_bookings from "../admin/bookings.js";
import type * as admin_content from "../admin/content.js";
import type * as admin_customers from "../admin/customers.js";
import type * as admin_finance from "../admin/finance.js";
import type * as admin_leads from "../admin/leads.js";
import type * as admin_newsletter from "../admin/newsletter.js";
import type * as admin_overview from "../admin/overview.js";
import type * as admin_products from "../admin/products.js";
import type * as admin_reels from "../admin/reels.js";
import type * as admin_reviews from "../admin/reviews.js";
import type * as admin_settings from "../admin/settings.js";
import type * as adminActions from "../adminActions.js";
import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as blog from "../blog.js";
import type * as bookingEmails from "../bookingEmails.js";
import type * as bookings from "../bookings.js";
import type * as catalog from "../catalog.js";
import type * as chat from "../chat.js";
import type * as chatAi from "../chatAi.js";
import type * as chatEmails from "../chatEmails.js";
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
import type * as lib_faq from "../lib/faq.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_markdown from "../lib/markdown.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as migrations from "../migrations.js";
import type * as newsletter from "../newsletter.js";
import type * as newsletterSend from "../newsletterSend.js";
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
import type * as seedData_policyTexts2026 from "../seedData/policyTexts2026.js";
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
  "admin/audit": typeof admin_audit;
  "admin/bookings": typeof admin_bookings;
  "admin/content": typeof admin_content;
  "admin/customers": typeof admin_customers;
  "admin/finance": typeof admin_finance;
  "admin/leads": typeof admin_leads;
  "admin/newsletter": typeof admin_newsletter;
  "admin/overview": typeof admin_overview;
  "admin/products": typeof admin_products;
  "admin/reels": typeof admin_reels;
  "admin/reviews": typeof admin_reviews;
  "admin/settings": typeof admin_settings;
  adminActions: typeof adminActions;
  auth: typeof auth;
  availability: typeof availability;
  blog: typeof blog;
  bookingEmails: typeof bookingEmails;
  bookings: typeof bookings;
  catalog: typeof catalog;
  chat: typeof chat;
  chatAi: typeof chatAi;
  chatEmails: typeof chatEmails;
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
  "lib/faq": typeof lib_faq;
  "lib/ids": typeof lib_ids;
  "lib/markdown": typeof lib_markdown;
  "lib/money": typeof lib_money;
  "lib/pricing": typeof lib_pricing;
  migrations: typeof migrations;
  newsletter: typeof newsletter;
  newsletterSend: typeof newsletterSend;
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
  "seedData/policyTexts2026": typeof seedData_policyTexts2026;
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
