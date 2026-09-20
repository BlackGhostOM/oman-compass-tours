import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { audit, requireStaff } from "../lib/access";
import { generateToken } from "../lib/ids";
import { loadEmailTour, loadEmailTours } from "../lib/emailTours";
import { codesInBlocks, renderCampaignEmail, renderWelcomeEmail, siteUrl, WELCOME_DEFAULTS, WELCOME_HERO_CODE, WELCOME_RECOMMENDED_CODES, type NewsletterBlock } from "../lib/newsletterEmail";
import { localeValidator, localized, newsletterBlockValidator } from "../schema";

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
  args: { id: v.optional(v.id("newsletterCampaigns")), subject: localized, body: localized, blocks: v.optional(v.array(newsletterBlockValidator)) },
  returns: v.id("newsletterCampaigns"),
  handler: async (ctx, { id, subject, body, blocks }) => {
    const staff = await requireStaff(ctx);
    if (!subject.en.trim() && !subject.ar.trim()) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "subject" });
    if (id) {
      const c = await ctx.db.get(id);
      if (!c) throw new ConvexError({ code: "NOT_FOUND" });
      if (c.status !== "draft") throw new ConvexError({ code: "INVALID_STATE" });
      await ctx.db.patch(id, { subject, body, blocks, updatedAt: Date.now() });
      await audit(ctx, staff, "newsletter.campaign_update", "newsletterCampaigns", String(id));
      return id;
    }
    const newId = await ctx.db.insert("newsletterCampaigns", { subject, body, blocks, status: "draft", createdBy: staff._id, updatedAt: Date.now() });
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

const WELCOME_SETTING = "newsletter.welcome";
type WelcomeSetting = { subject?: { en: string; ar: string }; body?: { en: string; ar: string }; heroCode?: string; recommendedCodes?: string[] };

/** Current welcome email text and tour choices (defaults when staff never saved them). */
export const welcome = query({
  args: {},
  returns: v.object({ subject: localized, body: localized, heroCode: v.string(), recommendedCodes: v.array(v.string()), custom: v.boolean() }),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const setting = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", WELCOME_SETTING)).unique();
    const value = (setting?.value ?? {}) as WelcomeSetting;
    return {
      subject: value.subject ?? WELCOME_DEFAULTS.subject,
      body: value.body ?? WELCOME_DEFAULTS.body,
      heroCode: value.heroCode ?? WELCOME_HERO_CODE,
      recommendedCodes: value.recommendedCodes ?? WELCOME_RECOMMENDED_CODES,
      custom: !!(value.subject && value.body),
    };
  },
});

export const setWelcome = mutation({
  args: { subject: localized, body: localized, heroCode: v.optional(v.string()), recommendedCodes: v.optional(v.array(v.string())) },
  returns: v.null(),
  handler: async (ctx, { subject, body, heroCode, recommendedCodes }) => {
    const staff = await requireStaff(ctx);
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", WELCOME_SETTING)).unique();
    const value = { subject, body, heroCode: heroCode || undefined, recommendedCodes: recommendedCodes?.filter(Boolean).slice(0, 3) };
    if (existing) await ctx.db.patch(existing._id, { value, updatedBy: staff._id, updatedAt: Date.now() });
    else await ctx.db.insert("siteSettings", { key: WELCOME_SETTING, value, updatedBy: staff._id, updatedAt: Date.now() });
    await audit(ctx, staff, "newsletter.welcome_update", "siteSettings", WELCOME_SETTING);
    return null;
  },
});

/** Published tours staff can place in emails, featured ones first. */
export const tourOptions = query({
  args: {},
  returns: v.array(v.object({ code: v.string(), title: localized, durationLabel: localized, kind: v.string() })),
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(200);
    rows.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99) || a.code.localeCompare(b.code));
    return rows.map((t) => ({ code: t.code, title: t.title, durationLabel: t.durationLabel, kind: t.kind }));
  },
});

/** The welcome email exactly as it will be sent, for the editor's live preview (unsaved values allowed). */
export const previewWelcome = query({
  args: { locale: localeValidator, subject: localized, body: localized, heroCode: v.string(), recommendedCodes: v.array(v.string()) },
  returns: v.string(),
  handler: async (ctx, { locale, subject, body, heroCode, recommendedCodes }) => {
    await requireStaff(ctx);
    const hero = heroCode ? await loadEmailTour(ctx, heroCode) : null;
    const tours = await loadEmailTours(ctx, recommendedCodes.filter((c) => c && c !== heroCode).slice(0, 3));
    return renderWelcomeEmail({
      locale,
      siteUrl: siteUrl(),
      subject: subject[locale] || subject.en || WELCOME_DEFAULTS.subject[locale],
      intro: body[locale] || body.en || WELCOME_DEFAULTS.body[locale],
      hero,
      tours,
      unsubscribeUrl: `${siteUrl()}/${locale}/newsletter/unsubscribe?token=preview`,
    });
  },
});

/** A campaign draft exactly as it will be sent, for the editor's live preview. */
export const previewCampaign = query({
  args: { locale: localeValidator, subject: localized, body: localized, blocks: v.array(newsletterBlockValidator) },
  returns: v.string(),
  handler: async (ctx, { locale, subject, body, blocks: given }) => {
    await requireStaff(ctx);
    const blocks: NewsletterBlock[] = given.length ? given : [{ type: "text", body }];
    const tours = await loadEmailTours(ctx, codesInBlocks(blocks));
    return renderCampaignEmail({
      locale,
      siteUrl: siteUrl(),
      subject: subject[locale] || subject.en || subject.ar || "…",
      blocks,
      tours: Object.fromEntries(tours.map((t) => [t.code, t])),
      unsubscribeUrl: `${siteUrl()}/${locale}/newsletter/unsubscribe?token=preview`,
    });
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
