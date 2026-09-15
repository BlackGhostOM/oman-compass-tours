import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, type MutationCtx } from "./_generated/server";
import { assertString, enforceRateLimit, getViewer } from "./lib/access";
import { localeValidator } from "./schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{7,20}$/;

async function slaMinutes(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "leads.slaMinutes")).unique();
  return typeof row?.value === "number" ? row.value : 60;
}

/** Contact form → lead + staff notification. */
const partnerProfile = v.object({
  company: v.optional(v.string()),
  country: v.string(),
  city: v.string(),
  website: v.optional(v.string()),
  businessType: v.string(),
  markets: v.array(v.string()),
  clientTypes: v.array(v.string()),
  bookingsPerYear: v.optional(v.string()),
  interests: v.array(v.string()),
  message: v.optional(v.string()),
});

/** B2B partnership registration from /partners. Stored as a lead with a structured partner profile. */
export const createPartnerRequest = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    locale: localeValidator,
    pagePath: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
    honeypot: v.optional(v.string()),
    ...partnerProfile.fields, // includes the optional free-text message
  },
  returns: v.object({ ok: v.boolean(), leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    if (args.honeypot) throw new ConvexError({ code: "SPAM" });
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    if (!PHONE_RE.test(args.phone)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "phone" });
    await enforceRateLimit(ctx, `partner:${email}`, 3, 60 * 60 * 1000);
    const clip = (value: string | undefined, max: number) => (value ? value.trim().slice(0, max) : undefined);
    const list = (values: string[]) => values.map((x) => x.slice(0, 40)).slice(0, 12);
    const viewer = await getViewer(ctx);
    const now = Date.now();
    const sla = await slaMinutes(ctx);
    const partner = {
      company: clip(args.company, 160),
      country: args.country.slice(0, 2).toUpperCase(),
      city: assertString(args.city, 120, "city", 2),
      website: clip(args.website, 200),
      businessType: args.businessType.slice(0, 40),
      markets: list(args.markets),
      clientTypes: list(args.clientTypes),
      bookingsPerYear: clip(args.bookingsPerYear, 20),
      interests: list(args.interests),
      message: clip(args.message, 4000),
    };
    const summary = `Partnership request · ${partner.businessType}${partner.company ? ` · ${partner.company}` : ""} · ${partner.city}, ${partner.country}\nInterests: ${partner.interests.join(", ") || "-"}\nMarkets: ${partner.markets.join(", ") || "-"} · Clients: ${partner.clientTypes.join(", ") || "-"} · Bookings/yr: ${partner.bookingsPerYear ?? "-"}${partner.website ? `\nWebsite: ${partner.website}` : ""}${args.message ? `\n\n${args.message.trim().slice(0, 4000)}` : ""}`;
    const leadId = await ctx.db.insert("leads", {
      name: assertString(args.name, 120, "name", 2),
      email,
      phone: args.phone.trim(),
      nationality: partner.country,
      message: summary,
      locale: args.locale,
      source: "partner",
      partner,
      status: "new",
      slaDueAt: now + sla * 60 * 1000,
      userId: viewer?._id,
      pagePath: args.pagePath?.slice(0, 200),
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.notifyStaffNewLead, { leadId });
    return { ok: true, leadId };
  },
});

export const createFromContact = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.string(),
    locale: localeValidator,
    tourId: v.optional(v.id("tours")),
    pagePath: v.optional(v.string()),
    turnstileToken: v.optional(v.string()),
    honeypot: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    if (args.honeypot) throw new ConvexError({ code: "SPAM" });
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    if (args.phone && !PHONE_RE.test(args.phone)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "phone" });
    await enforceRateLimit(ctx, `contact:${email}`, 5, 60 * 60 * 1000);

    const viewer = await getViewer(ctx);
    const now = Date.now();
    const sla = await slaMinutes(ctx);
    const leadId = await ctx.db.insert("leads", {
      name: assertString(args.name, 120, "name", 2),
      email,
      phone: args.phone?.trim(),
      message: assertString(args.message, 4000, "message", 5),
      locale: args.locale,
      source: "contact_form",
      tourId: args.tourId,
      status: "new",
      slaDueAt: now + sla * 60 * 1000,
      userId: viewer?._id,
      pagePath: args.pagePath?.slice(0, 200),
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.notifyStaffNewLead, { leadId });
    return { ok: true, leadId };
  },
});

/** "Plan my trip" form → lead with trip details. */
export const createFromTripPlanner = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    nationality: v.optional(v.string()),
    locale: localeValidator,
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    travellers: v.optional(v.number()),
    budget: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
    message: v.optional(v.string()),
    honeypot: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), leadId: v.id("leads") }),
  handler: async (ctx, args) => {
    if (args.honeypot) throw new ConvexError({ code: "SPAM" });
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    if (!PHONE_RE.test(args.phone)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "phone" });
    await enforceRateLimit(ctx, `planner:${email}`, 5, 60 * 60 * 1000);
    const travellers = args.travellers === undefined ? undefined : Math.max(1, Math.min(60, Math.round(args.travellers)));

    const viewer = await getViewer(ctx);
    const now = Date.now();
    const sla = await slaMinutes(ctx);
    const leadId = await ctx.db.insert("leads", {
      name: assertString(args.name, 120, "name", 2),
      email,
      phone: args.phone.trim(),
      nationality: args.nationality?.slice(0, 2).toUpperCase(),
      message: args.message ? assertString(args.message, 4000, "message") : "",
      locale: args.locale,
      source: "trip_planner",
      tripDetails: {
        startDate: args.startDate,
        endDate: args.endDate,
        travellers,
        budget: args.budget?.slice(0, 40),
        interests: (args.interests ?? []).slice(0, 12).map((i) => i.slice(0, 40)),
      },
      status: "new",
      slaDueAt: now + sla * 60 * 1000,
      userId: viewer?._id,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.notifyStaffNewLead, { leadId });
    return { ok: true, leadId };
  },
});
