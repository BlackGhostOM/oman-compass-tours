import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertString, audit, requireAdmin, requireOwner, requireStaff, requireUser } from "../lib/access";
import { generateToken } from "../lib/ids";
import { localized, roleValidator } from "../schema";

/* ------------------------------------------------------------------ */
/* Site settings (key/value)                                           */
/* ------------------------------------------------------------------ */

export const all = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("siteSettings").take(200);
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return {
      settings: out,
      providers: {
        thawani: !!process.env.THAWANI_SECRET_KEY && !!process.env.THAWANI_PUBLISHABLE_KEY,
        stripe: !!process.env.STRIPE_SECRET_KEY,
        paypal: !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET,
        stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
        paypalWebhook: !!process.env.PAYPAL_WEBHOOK_ID,
        thawaniMode: process.env.THAWANI_MODE ?? "uat",
        paypalMode: process.env.PAYPAL_MODE ?? "sandbox",
        resend: !!(process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY),
        google: !!process.env.AUTH_GOOGLE_ID,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        turnstile: !!process.env.TURNSTILE_SECRET_KEY,
        apiVerification: process.env.PAYMENTS_TRUST_API_VERIFICATION === "true",
      },
    };
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.any() },
  returns: v.null(),
  handler: async (ctx, { key, value }) => {
    const staff = await requireAdmin(ctx);
    const k = assertString(key, 80, "key", 1);
    const serialized = JSON.stringify(value);
    if (serialized.length > 20_000) throw new ConvexError({ code: "TOO_LARGE" });
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", k)).unique();
    if (existing) await ctx.db.patch(existing._id, { value, updatedBy: staff._id, updatedAt: Date.now() });
    else await ctx.db.insert("siteSettings", { key: k, value, updatedBy: staff._id, updatedAt: Date.now() });
    await audit(ctx, staff, "settings.set", "siteSettings", k, existing?.value, value);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Policies (versioned)                                                */
/* ------------------------------------------------------------------ */

export const policies = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("policies").take(50);
    return Promise.all(
      rows.sort((a, b) => a.order - b.order).map(async (p) => {
        const versions = await ctx.db.query("policyVersions").withIndex("by_policy_version", (q) => q.eq("policyId", p._id)).order("desc").take(20);
        return { ...p, versions: versions.map((x) => ({ _id: x._id, version: x.version, effectiveAt: x.effectiveAt, changeNote: x.changeNote ?? null, body: x.body })) };
      }),
    );
  },
});

export const publishPolicyVersion = mutation({
  args: { policyId: v.id("policies"), body: localized, changeNote: v.optional(v.string()), title: v.optional(localized), requiredAtCheckout: v.optional(v.boolean()) },
  returns: v.id("policyVersions"),
  handler: async (ctx, args) => {
    const staff = await requireAdmin(ctx);
    const p = await ctx.db.get(args.policyId);
    if (!p) throw new ConvexError({ code: "NOT_FOUND" });
    const latest = await ctx.db.query("policyVersions").withIndex("by_policy_version", (q) => q.eq("policyId", p._id)).order("desc").take(1);
    const version = (latest[0]?.version ?? 0) + 1;
    const vid = await ctx.db.insert("policyVersions", { policyId: p._id, version, body: args.body, effectiveAt: Date.now(), createdBy: staff._id, changeNote: args.changeNote?.slice(0, 300) });
    await ctx.db.patch(p._id, { currentVersionId: vid, title: args.title ?? p.title, requiredAtCheckout: args.requiredAtCheckout ?? p.requiredAtCheckout });
    await audit(ctx, staff, "policy.publish", "policies", String(p._id), { version: latest[0]?.version ?? 0 }, { version });
    return vid;
  },
});

/* ------------------------------------------------------------------ */
/* Staff users & invites                                               */
/* ------------------------------------------------------------------ */

export const staffUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const out = [];
    for (const role of ["staff", "admin", "owner"] as const) {
      const rows = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).take(100);
      out.push(...rows.map((u) => ({ _id: u._id, name: u.name ?? null, email: u.email ?? null, role, createdAt: u._creationTime })));
    }
    const invites = await ctx.db.query("staffInvites").take(100);
    return { users: out, invites: invites.filter((i) => !i.acceptedAt && i.expiresAt > Date.now()).map((i) => ({ _id: i._id, email: i.email, role: i.role, expiresAt: i.expiresAt })) };
  },
});

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const actor = role === "owner" || role === "admin" ? await requireOwner(ctx) : await requireAdmin(ctx);
    const u = await ctx.db.get(userId);
    if (!u) throw new ConvexError({ code: "NOT_FOUND" });
    if (u._id === actor._id) throw new ConvexError({ code: "CANNOT_CHANGE_OWN_ROLE" });
    if (u.role === "owner") throw new ConvexError({ code: "CANNOT_DEMOTE_OWNER" });
    await ctx.db.patch(userId, { role });
    await audit(ctx, actor, "user.role", "users", String(userId), { role: u.role }, { role });
    return null;
  },
});

export const invite = mutation({
  args: { email: v.string(), role: v.union(v.literal("staff"), v.literal("admin")) },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, { email, role }) => {
    const actor = role === "admin" ? await requireOwner(ctx) : await requireAdmin(ctx);
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    const existingUser = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", e)).first();
    if (existingUser) {
      await ctx.db.patch(existingUser._id, { role });
      await audit(ctx, actor, "user.role", "users", String(existingUser._id), { role: existingUser.role }, { role, viaInvite: true });
      return { token: "" };
    }
    const token = generateToken(32);
    await ctx.db.insert("staffInvites", { email: e, role, token, invitedBy: actor._id, expiresAt: Date.now() + 7 * 86_400_000 });
    await audit(ctx, actor, "staff.invite", "staffInvites", e, undefined, { role });
    return { token };
  },
});

/** Called after a newly signed-up user visits their invite link. */
export const acceptInvite = mutation({
  args: { token: v.string() },
  returns: v.object({ role: v.string() }),
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx);
    const inv = await ctx.db.query("staffInvites").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!inv || inv.acceptedAt || inv.expiresAt < Date.now()) throw new ConvexError({ code: "INVITE_INVALID" });
    if (!user.email || user.email.toLowerCase() !== inv.email) throw new ConvexError({ code: "INVITE_EMAIL_MISMATCH" });
    await ctx.db.patch(user._id, { role: inv.role });
    await ctx.db.patch(inv._id, { acceptedAt: Date.now() });
    await audit(ctx, user, "staff.invite_accepted", "users", String(user._id), undefined, { role: inv.role });
    return { role: inv.role };
  },
});

/* ------------------------------------------------------------------ */
/* Notification templates (stored as settings)                         */
/* ------------------------------------------------------------------ */

export const notificationTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "notifications.templates")).unique();
    const defaults = {
      whatsapp_confirmation: { en: "Hello {name}, your booking {reference} for {tour} on {date} at {time} is confirmed. Voucher: {voucher}", ar: "مرحبًا {name}، تم تأكيد حجزك {reference} لجولة {tour} بتاريخ {date} الساعة {time}. القسيمة: {voucher}" },
      whatsapp_reminder: { en: "Reminder from Oman Compass Tours: {tour} tomorrow at {time}. Pickup: {pickup}. See you soon!", ar: "تذكير من بوصلة عُمان: {tour} غدًا الساعة {time}. الاستلام: {pickup}. نراك قريبًا!" },
      whatsapp_payment_link: { en: "Hello {name}, please complete your payment for {reference}: {link}", ar: "مرحبًا {name}، يرجى إتمام الدفع للحجز {reference}: {link}" },
      whatsapp_review: { en: "Thank you for travelling with us, {name}! We would love a review: {link}", ar: "شكرًا لسفرك معنا يا {name}! يسعدنا تقييمك: {link}" },
    };
    return { ...(defaults as Record<string, { en: string; ar: string }>), ...((row?.value as Record<string, { en: string; ar: string }>) ?? {}) };
  },
});
