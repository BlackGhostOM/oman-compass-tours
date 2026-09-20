import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type ActionCtx } from "./_generated/server";
import { sendBatch, sendEmail, type Locale } from "./lib/email";
import { emailTourValidator, loadEmailTour, loadEmailTours } from "./lib/emailTours";
import { codesInBlocks, renderCampaignEmail, renderWelcomeEmail, WELCOME_DEFAULTS, WELCOME_HERO_CODE, WELCOME_RECOMMENDED_CODES, type EmailTour } from "./lib/newsletterEmail";
import { localeValidator, localized } from "./schema";

const SITE_URL = () => process.env.SITE_URL ?? "http://localhost:3000";

type Rendered = { subject: string; html: string };

/** Tours referenced by the campaign's blocks, loaded once per send. */
async function campaignTours(ctx: ActionCtx, campaign: Doc<"newsletterCampaigns">): Promise<Record<string, EmailTour>> {
  const codes = codesInBlocks(campaign.blocks ?? []);
  if (codes.length === 0) return {};
  const tours = (await ctx.runQuery(internal.newsletterSend.toursByCodes, { codes })) as EmailTour[];
  return Object.fromEntries(tours.map((t) => [t.code, t]));
}

function render(campaign: Doc<"newsletterCampaigns">, locale: Locale, unsubscribeUrl: string, tours: Record<string, EmailTour>): Rendered {
  const subject = campaign.subject[locale] || campaign.subject.en || campaign.subject.ar;
  // Older campaigns hold Markdown only; it renders as a single text block
  const blocks = campaign.blocks?.length ? campaign.blocks : [{ type: "text" as const, body: campaign.body }];
  return { subject, html: renderCampaignEmail({ locale, siteUrl: SITE_URL(), subject, blocks, tours, unsubscribeUrl }) };
}

export const toursByCodes = internalQuery({
  args: { codes: v.array(v.string()) },
  returns: v.array(emailTourValidator),
  handler: async (ctx, { codes }) => loadEmailTours(ctx, codes),
});

export const getCampaign = internalQuery({
  args: { campaignId: v.id("newsletterCampaigns") },
  handler: async (ctx, { campaignId }): Promise<Doc<"newsletterCampaigns"> | null> => ctx.db.get(campaignId),
});

export const activeSubscribers = internalQuery({
  args: {},
  returns: v.array(v.object({ email: v.string(), locale: localeValidator, token: v.string() })),
  handler: async (ctx) => {
    const rows = await ctx.db.query("newsletterSubscribers").take(5000);
    return rows.filter((s) => !s.unsubscribedAt).map((s) => ({ email: s.email, locale: s.locale, token: s.token }));
  },
});

export const finish = internalMutation({
  args: { campaignId: v.id("newsletterCampaigns"), targeted: v.number(), sent: v.number(), failed: v.number(), status: v.union(v.literal("sent"), v.literal("failed")), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { campaignId, targeted, sent, failed, status, error }) => {
    await ctx.db.patch(campaignId, { status, sentAt: Date.now(), stats: { targeted, sent, failed }, error, updatedAt: Date.now() });
    return null;
  },
});

export const getSubscriber = internalQuery({
  args: { subscriberId: v.id("newsletterSubscribers") },
  handler: async (ctx, { subscriberId }): Promise<Doc<"newsletterSubscribers"> | null> => ctx.db.get(subscriberId),
});

export const welcomeContext = internalQuery({
  args: {},
  returns: v.object({
    welcome: v.union(v.object({ subject: localized, body: localized }), v.null()),
    hero: v.union(emailTourValidator, v.null()),
    tours: v.array(emailTourValidator),
  }),
  handler: async (ctx) => {
    const setting = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "newsletter.welcome")).unique();
    const value = setting?.value as { subject?: { en: string; ar: string }; body?: { en: string; ar: string }; heroCode?: string; recommendedCodes?: string[] } | undefined;
    const welcome = value?.subject && value?.body ? { subject: value.subject, body: value.body } : null;
    const heroCode = value?.heroCode ?? WELCOME_HERO_CODE;
    const hero = await loadEmailTour(ctx, heroCode);
    const tours = await loadEmailTours(ctx, (value?.recommendedCodes ?? WELCOME_RECOMMENDED_CODES).filter((c) => c !== heroCode));
    // Top up from the featured list if a recommended tour is unpublished
    if (tours.length < 3) {
      const featured = await ctx.db.query("tours").withIndex("by_featured", (q) => q.eq("status", "published").eq("isFeatured", true)).take(12);
      for (const f of featured) {
        if (tours.length >= 3) break;
        if (f.code === heroCode || tours.some((t) => t.code === f.code)) continue;
        const t = await loadEmailTour(ctx, f.code);
        if (t) tours.push(t);
      }
    }
    return { welcome, hero, tours: tours.slice(0, 3) };
  },
});

/** Welcome newsletter for a new subscriber (or a test copy when `to` is given). */
export const sendWelcome = internalAction({
  args: { subscriberId: v.optional(v.id("newsletterSubscribers")), to: v.optional(v.string()), locale: v.optional(localeValidator) },
  returns: v.null(),
  handler: async (ctx, { subscriberId, to, locale: localeArg }): Promise<null> => {
    const sub = subscriberId ? ((await ctx.runQuery(internal.newsletterSend.getSubscriber, { subscriberId })) as Doc<"newsletterSubscribers"> | null) : null;
    const recipient = to ?? sub?.email;
    const locale: Locale = localeArg ?? sub?.locale ?? "en";
    if (!recipient) return null;
    const { welcome, hero, tours } = (await ctx.runQuery(internal.newsletterSend.welcomeContext, {})) as {
      welcome: { subject: { en: string; ar: string }; body: { en: string; ar: string } } | null;
      hero: EmailTour | null;
      tours: EmailTour[];
    };
    const text = welcome ?? WELCOME_DEFAULTS;
    const subject = text.subject[locale] || text.subject.en;
    const unsubscribeUrl = `${SITE_URL()}/${locale}/newsletter/unsubscribe?token=${sub?.token ?? "test"}`;
    const html = renderWelcomeEmail({
      locale,
      siteUrl: SITE_URL(),
      subject,
      intro: text.body[locale] || text.body.en,
      hero,
      tours,
      unsubscribeUrl,
    });
    const result = await sendEmail({ to: recipient, subject: to ? `[TEST] ${subject}` : subject, html, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } });
    await ctx.runMutation(internal.notifications.log, { channel: "email", template: "newsletter_welcome", to: recipient, locale, status: result.status, providerMessageId: result.id, error: result.error, payload: { subscriberId } });
    return null;
  },
});

export const sendTest = internalAction({
  args: { campaignId: v.id("newsletterCampaigns"), to: v.string(), locale: localeValidator },
  returns: v.null(),
  handler: async (ctx, { campaignId, to, locale }): Promise<null> => {
    const campaign = (await ctx.runQuery(internal.newsletterSend.getCampaign, { campaignId })) as Doc<"newsletterCampaigns"> | null;
    if (!campaign) return null;
    const tours = await campaignTours(ctx, campaign);
    const { subject, html } = render(campaign, locale, `${SITE_URL()}/${locale}/newsletter/unsubscribe?token=test`, tours);
    const result = await sendEmail({ to, subject: `[TEST] ${subject}`, html });
    await ctx.runMutation(internal.notifications.log, { channel: "email", template: "newsletter_test", to, locale, status: result.status, providerMessageId: result.id, error: result.error, payload: { campaignId } });
    return null;
  },
});

export const run = internalAction({
  args: { campaignId: v.id("newsletterCampaigns") },
  returns: v.null(),
  handler: async (ctx, { campaignId }): Promise<null> => {
    const campaign = (await ctx.runQuery(internal.newsletterSend.getCampaign, { campaignId })) as Doc<"newsletterCampaigns"> | null;
    if (!campaign || campaign.status !== "sending") return null;
    const subs = (await ctx.runQuery(internal.newsletterSend.activeSubscribers, {})) as { email: string; locale: Locale; token: string }[];
    let sent = 0;
    let failed = 0;
    let lastError: string | undefined;
    const tours = await campaignTours(ctx, campaign);
    const rendered: Record<Locale, Rendered | null> = { en: null, ar: null };
    const messages = subs.map((s) => {
      const unsubscribeUrl = `${SITE_URL()}/${s.locale}/newsletter/unsubscribe?token=${s.token}`;
      const base = rendered[s.locale] ?? (rendered[s.locale] = render(campaign, s.locale, "__UNSUB__", tours));
      return { to: s.email, subject: base.subject, html: base.html.replace("__UNSUB__", unsubscribeUrl), headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` } };
    });
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const result = await sendBatch(chunk);
      if (result.status === "sent") sent += chunk.length;
      else if (result.status === "skipped") failed += chunk.length;
      else {
        failed += chunk.length;
        lastError = result.error;
      }
    }
    const status = subs.length > 0 && sent === 0 ? "failed" : "sent";
    await ctx.runMutation(internal.newsletterSend.finish, { campaignId, targeted: subs.length, sent, failed, status, error: lastError });
    await ctx.runMutation(internal.notifications.log, { channel: "email", template: "newsletter_campaign", to: `${subs.length} subscribers`, locale: "en", status: status === "sent" ? "sent" : "failed", error: lastError, payload: { campaignId, targeted: subs.length, sent, failed } });
    return null;
  },
});
