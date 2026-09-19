import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { layout, sendBatch, sendEmail, type Locale } from "./lib/email";
import { markdownToEmailHtml } from "./lib/markdown";
import { renderWelcomeEmail, type WelcomeTour } from "./lib/welcomeEmail";
import { localeValidator, localized } from "./schema";

const SITE_URL = () => process.env.SITE_URL ?? "http://localhost:3000";

function render(campaign: Doc<"newsletterCampaigns">, locale: Locale, unsubscribeUrl: string) {
  const subject = campaign.subject[locale] || campaign.subject.en || campaign.subject.ar;
  const body = campaign.body[locale] || campaign.body.en || campaign.body.ar;
  const align = locale === "ar" ? "right" : "left";
  const footer = locale === "ar"
    ? `تصلك هذه الرسالة لأنك اشتركت في نشرة بوصلة عُمان للسياحة. <a href="${unsubscribeUrl}" style="color:#DDB97A">إلغاء الاشتراك</a>`
    : `You receive this because you subscribed to Oman Compass Tours travel notes. <a href="${unsubscribeUrl}" style="color:#DDB97A">Unsubscribe</a>`;
  return { subject, html: layout(locale, subject, markdownToEmailHtml(body, align), footer) };
}

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

export const WELCOME_DEFAULTS = {
  subject: { en: "Welcome to Oman Compass Tours", ar: "أهلًا بك في بوصلة عُمان للسياحة" },
  body: {
    en: "Marhaba, and thank you for joining us.\n\nYou are now on the list for our travel notes: seasonal tips on the best time for each wadi, desert and mountain, new private tours as we launch them, and subscriber-only offers. Expect a note every few weeks, never spam.",
    ar: "مرحبًا بك، وشكرًا لانضمامك إلينا.\n\nأصبحت الآن ضمن قائمة رسائل السفر: نصائح موسمية عن أفضل وقت لكل وادٍ وصحراء وجبل، وجولات خاصة جديدة فور إطلاقها، وعروض للمشتركين فقط. تصلك رسالة كل بضعة أسابيع، ولا رسائل مزعجة.",
  },
};

export const getSubscriber = internalQuery({
  args: { subscriberId: v.id("newsletterSubscribers") },
  handler: async (ctx, { subscriberId }): Promise<Doc<"newsletterSubscribers"> | null> => ctx.db.get(subscriberId),
});

/** Featured journey and recommended tours in the welcome email; staff can override the codes in the `newsletter.welcome` setting. */
const DEFAULT_HERO_CODE = "OCT-010"; // 8-Day Oman Nature & Culture with an Omani Guide – 4WD
const DEFAULT_RECOMMENDED_CODES = ["OCT-008", "OCT-017", "OCT-019"]; // 3-day, 2-day Wahiba camp, 5-day

const welcomeTourValidator = v.object({
  code: v.string(),
  title: localized,
  slug: localized,
  summary: localized,
  highlights: v.array(localized),
  durationLabel: localized,
  durationDays: v.number(),
  maxGroup: v.number(),
  freeCancellationHours: v.number(),
  priceFrom: v.number(),
  pricingModel: v.string(),
  ratingAverage: v.number(),
  ratingCount: v.number(),
  externalReviewCount: v.optional(v.number()),
  coverUrl: v.optional(v.string()),
});

export const welcomeContext = internalQuery({
  args: {},
  returns: v.object({
    welcome: v.union(v.object({ subject: localized, body: localized }), v.null()),
    hero: v.union(welcomeTourValidator, v.null()),
    tours: v.array(welcomeTourValidator),
  }),
  handler: async (ctx) => {
    const setting = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "newsletter.welcome")).unique();
    const value = setting?.value as { subject?: { en: string; ar: string }; body?: { en: string; ar: string }; heroCode?: string; recommendedCodes?: string[] } | undefined;
    const welcome = value?.subject && value?.body ? { subject: value.subject, body: value.body } : null;
    const heroCode = value?.heroCode ?? DEFAULT_HERO_CODE;
    const recommended = (value?.recommendedCodes ?? DEFAULT_RECOMMENDED_CODES).filter((c) => c !== heroCode);

    const load = async (code: string): Promise<WelcomeTour | null> => {
      const t = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (!t || t.status !== "published") return null;
      const cover = t.coverImage;
      const coverUrl = cover?.url ?? (cover?.storageId ? await ctx.storage.getUrl(cover.storageId) : null);
      return {
        code: t.code,
        title: t.title,
        slug: t.slug,
        summary: t.summary,
        highlights: t.highlights,
        durationLabel: t.durationLabel,
        durationDays: t.durationDays,
        maxGroup: t.maxGroup,
        freeCancellationHours: t.freeCancellationHours,
        priceFrom: t.priceFrom,
        pricingModel: t.pricingModel,
        ratingAverage: t.ratingAverage,
        ratingCount: t.ratingCount,
        externalReviewCount: t.externalReviewCount,
        coverUrl: coverUrl ?? undefined,
      };
    };
    const hero = await load(heroCode);
    const tours: WelcomeTour[] = [];
    for (const code of recommended) {
      const t = await load(code);
      if (t) tours.push(t);
    }
    // Top up from the featured list if a recommended tour is unpublished
    if (tours.length < 3) {
      const featured = await ctx.db.query("tours").withIndex("by_featured", (q) => q.eq("status", "published").eq("isFeatured", true)).take(12);
      for (const f of featured) {
        if (tours.length >= 3) break;
        if (f.code === heroCode || tours.some((t) => t.code === f.code)) continue;
        const t = await load(f.code);
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
      hero: WelcomeTour | null;
      tours: WelcomeTour[];
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
      whatsapp: { display: "+968 9225 5028", e164: "+96892255028" },
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
    const { subject, html } = render(campaign, locale, `${SITE_URL()}/${locale}/newsletter/unsubscribe?token=test`);
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
    const rendered: Record<Locale, { subject: string; html: string } | null> = { en: null, ar: null };
    const messages = subs.map((s) => {
      const unsubscribeUrl = `${SITE_URL()}/${s.locale}/newsletter/unsubscribe?token=${s.token}`;
      const base = rendered[s.locale] ?? (rendered[s.locale] = render(campaign, s.locale, "__UNSUB__"));
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
