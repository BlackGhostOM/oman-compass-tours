import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { escapeHtml, layout, row, sendEmail, STAFF_EMAIL, table } from "./lib/email";
import { localeValidator } from "./schema";

/* ------------------------------------------------------------------ */
/* Notification log helpers                                            */
/* ------------------------------------------------------------------ */

export const log = internalMutation({
  args: {
    channel: v.union(v.literal("email"), v.literal("whatsapp"), v.literal("sms")),
    template: v.string(),
    to: v.string(),
    locale: localeValidator,
    bookingId: v.optional(v.id("bookings")),
    userId: v.optional(v.id("users")),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    payload: v.optional(v.any()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      ...args,
      sentAt: args.status === "sent" ? Date.now() : undefined,
    });
  },
});

export const getLead = internalQuery({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return null;
    const tour = lead.tourId ? await ctx.db.get(lead.tourId) : null;
    return { ...lead, tourTitle: tour?.title.en ?? null };
  },
});

/* ------------------------------------------------------------------ */
/* Staff: new lead                                                     */
/* ------------------------------------------------------------------ */

export const notifyStaffNewLead = internalAction({
  args: { leadId: v.id("leads") },
  returns: v.null(),
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.runQuery(internal.notifications.getLead, { leadId });
    if (!lead) return null;
    const details = table(
      [
        row("Name", escapeHtml(lead.name)),
        row("Email", lead.email ? `<a href="mailto:${escapeHtml(lead.email)}" style="color:#DDB97A">${escapeHtml(lead.email)}</a>` : "—"),
        row("Phone", lead.phone ? `<a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}" style="color:#DDB97A">${escapeHtml(lead.phone)}</a>` : "—"),
        row("Source", lead.source),
        row("Language", lead.locale.toUpperCase()),
        lead.tourTitle ? row("Tour", escapeHtml(lead.tourTitle)) : "",
        lead.tripDetails?.startDate ? row("Dates", `${lead.tripDetails.startDate} → ${lead.tripDetails.endDate ?? "?"}`) : "",
        lead.tripDetails?.travellers ? row("Travellers", String(lead.tripDetails.travellers)) : "",
        lead.tripDetails?.budget ? row("Budget", escapeHtml(lead.tripDetails.budget)) : "",
        lead.tripDetails?.interests?.length ? row("Interests", escapeHtml(lead.tripDetails.interests.join(", "))) : "",
      ].join(""),
    );
    const html = layout(
      "en",
      `New ${lead.source.replace("_", " ")} lead: ${escapeHtml(lead.name)}`,
      `${details}<p style="white-space:pre-wrap">${escapeHtml(lead.message)}</p><p style="color:#9C99AE;font-size:13px">SLA: respond by ${new Date(lead.slaDueAt).toLocaleString("en-GB", { timeZone: "Asia/Muscat" })} (Oman time).</p>`,
    );
    const result = await sendEmail({
      to: STAFF_EMAIL,
      subject: `[Lead] ${lead.name} · ${lead.source}`,
      html,
      replyTo: lead.email,
    });
    await ctx.runMutation(internal.notifications.log, {
      channel: "email",
      template: "staff_new_lead",
      to: STAFF_EMAIL,
      locale: "en",
      status: result.status,
      providerMessageId: result.id,
      error: result.error,
      payload: { leadId },
    });
    return null;
  },
});
