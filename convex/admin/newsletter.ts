import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { audit, requireStaff } from "../lib/access";
import { generateToken } from "../lib/ids";
import { localeValidator, localized } from "../schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Subscribers                                                         */
/* ------------------------------------------------------------------ */

export const subscribers = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("newsletterSubscribers"), email: v.string(), locale: localeValidator, source: v.union(v.string(), v.null()), subscribedAt: v.number(), unsubscribedAt: v.union(v.number(), v.null()) })),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("newsletterSubscribers").order("desc").take(5000);
    return rows.map((s) => ({ _id: s._id, email: s.email, locale: s.locale, source: s.source ?? null, subscribedAt: s._creationTime, unsubscribedAt: s.unsubscribedAt ?? null }));
  },
});

export const addSubscriber = mutation({
  args: { email: v.string(), locale: localeValidator },
  returns: v.id("newsletterSubscribers"),
  handler: async (ctx, { email, locale }) => {
    const staff = await requireStaff(ctx);
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean) || clean.length > 254) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    const existing = await ctx.db.query("newsletterSubscribers").withIndex("by_email", (q) => q.eq("email", clean)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { unsubscribedAt: undefined, locale });
      return existing._id;
    }
    const id = await ctx.db.insert("newsletterSubscribers", { email: clean, locale, source: "manual", token: generateToken() });
    await audit(ctx, staff, "newsletter.subscriber_add", "newsletterSubscribers", String(id));
    return id;
  },
});

export const setSubscriberActive = mutation({
  args: { id: v.id("newsletterSubscribers"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, active }) => {
    const staff = await requireStaff(ctx);
    await ctx.db.patch(id, { unsubscribedAt: active ? undefined : Date.now() });
    await audit(ctx, staff, active ? "newsletter.resubscribe" : "newsletter.unsubscribe", "newsletterSubscribers", String(id));
    return null;
  },
});

export const removeSubscriber = mutation({
  args: { id: v.id("newsletterSubscribers") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    await ctx.db.delete(id);
    await audit(ctx, staff, "newsletter.subscriber_delete", "newsletterSubscribers", String(id));
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export const campaigns = query({
  args: {},
  handler: async (ctx): Promise<Doc<"newsletterCampaigns">[]> => {
    await requireStaff(ctx);
    return await ctx.db.query("newsletterCampaigns").order("desc").take(100);
  },
});

export const upsertCampaign = mutation({
  args: { id: v.optional(v.id("newsletterCampaigns")), subject: localized, body: localized },
  returns: v.id("newsletterCampaigns"),
  handler: async (ctx, { id, subject, body }) => {
    const staff = await requireStaff(ctx);
    if (!subject.en.trim() && !subject.ar.trim()) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "subject" });
    if (id) {
      const c = await ctx.db.get(id);
      if (!c) throw new ConvexError({ code: "NOT_FOUND" });
      if (c.status !== "draft") throw new ConvexError({ code: "INVALID_STATE" });
      await ctx.db.patch(id, { subject, body, updatedAt: Date.now() });
      await audit(ctx, staff, "newsletter.campaign_update", "newsletterCampaigns", String(id));
      return id;
    }
    const newId = await ctx.db.insert("newsletterCampaigns", { subject, body, status: "draft", createdBy: staff._id, updatedAt: Date.now() });
    await audit(ctx, staff, "newsletter.campaign_create", "newsletterCampaigns", String(newId));
    return newId;
  },
});

export const removeCampaign = mutation({
  args: { id: v.id("newsletterCampaigns") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const c = await ctx.db.get(id);
    if (!c) return null;
    if (c.status === "sending") throw new ConvexError({ code: "INVALID_STATE" });
    await ctx.db.delete(id);
    await audit(ctx, staff, "newsletter.campaign_delete", "newsletterCampaigns", String(id));
    return null;
  },
});

/** Sends the campaign to the signed-in staff member only, for proofreading. */
export const sendTest = mutation({
  args: { id: v.id("newsletterCampaigns"), locale: localeValidator },
  returns: v.null(),
  handler: async (ctx, { id, locale }) => {
    const staff = await requireStaff(ctx);
    if (!staff.email) throw new ConvexError({ code: "INVALID_STATE", reason: "staff email missing" });
    await ctx.scheduler.runAfter(0, internal.newsletterSend.sendTest, { campaignId: id, to: staff.email, locale });
    return null;
  },
});

/** Sends the campaign to every active subscriber, in their own language. */
export const send = mutation({
  args: { id: v.id("newsletterCampaigns") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const c = await ctx.db.get(id);
    if (!c) throw new ConvexError({ code: "NOT_FOUND" });
    if (c.status !== "draft") throw new ConvexError({ code: "INVALID_STATE" });
    await ctx.db.patch(id, { status: "sending", updatedAt: Date.now() });
    await audit(ctx, staff, "newsletter.campaign_send", "newsletterCampaigns", String(id));
    await ctx.scheduler.runAfter(0, internal.newsletterSend.run, { campaignId: id });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Welcome email                                                       */
/* ------------------------------------------------------------------ */

export const welcome = query({
  args: {},
  returns: v.union(v.object({ subject: localized, body: localized }), v.null()),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const setting = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "newsletter.welcome")).unique();
    const value = setting?.value as { subject?: { en: string; ar: string }; body?: { en: string; ar: string } } | undefined;
    return value?.subject && value?.body ? { subject: value.subject, body: value.body } : null;
  },
});

export const setWelcome = mutation({
  args: { subject: localized, body: localized },
  returns: v.null(),
  handler: async (ctx, { subject, body }) => {
    const staff = await requireStaff(ctx);
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "newsletter.welcome")).unique();
    const value = { subject, body };
    if (existing) await ctx.db.patch(existing._id, { value, updatedBy: staff._id, updatedAt: Date.now() });
    else await ctx.db.insert("siteSettings", { key: "newsletter.welcome", value, updatedBy: staff._id, updatedAt: Date.now() });
    await audit(ctx, staff, "newsletter.welcome_update", "siteSettings", "newsletter.welcome");
    return null;
  },
});

export const sendWelcomeTest = mutation({
  args: { locale: localeValidator },
  returns: v.null(),
  handler: async (ctx, { locale }) => {
    const staff = await requireStaff(ctx);
    if (!staff.email) throw new ConvexError({ code: "INVALID_STATE", reason: "staff email missing" });
    await ctx.scheduler.runAfter(0, internal.newsletterSend.sendWelcome, { to: staff.email, locale });
    return null;
  },
});

export type Campaign = Doc<"newsletterCampaigns">;
