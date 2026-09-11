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
