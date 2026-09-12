import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { layout, sendBatch, sendEmail, type Locale } from "./lib/email";
import { markdownToEmailHtml } from "./lib/markdown";
import { localeValidator } from "./schema";

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
