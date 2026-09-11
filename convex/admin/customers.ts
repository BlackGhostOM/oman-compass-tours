import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertString, audit, requireStaff } from "../lib/access";

export const list = query({
  args: { search: v.optional(v.string()), tag: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { search, tag, limit }) => {
    await requireStaff(ctx);
    const users = await ctx.db.query("users").order("desc").take(Math.min(limit ?? 300, 1000));
    const bookings = await ctx.db.query("bookings").order("desc").take(2000);
    const s = search?.trim().toLowerCase();
    return users
      .filter((u) => !u.deletedAt && (u.role ?? "customer") === "customer")
      .filter((u) => !tag || (u.tags ?? []).includes(tag))
      .filter((u) => !s || `${u.name ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(s))
      .map((u) => {
        const mine = bookings.filter((b) => b.userId === u._id || (u.email && b.traveller.email === u.email));
        return {
          _id: u._id,
          name: u.name ?? null,
          email: u.email ?? null,
          phone: u.phone ?? null,
          nationality: u.nationality ?? null,
          tags: u.tags ?? [],
          leadSource: u.leadSource ?? null,
          loyaltyPoints: u.loyaltyPoints ?? 0,
          bookings: mine.length,
          spentOmr: mine.reduce((a, b) => a + b.amountPaid - b.amountRefunded, 0),
          lastBookingDate: mine[0]?.date ?? null,
          createdAt: u._creationTime,
        };
      });
  },
});

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const u = await ctx.db.get(id);
    if (!u) return null;
    const byUser = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", id)).order("desc").take(100);
    const byEmail = u.email ? await ctx.db.query("bookings").withIndex("by_email", (q) => q.eq("traveller.email", u.email!)).take(100) : [];
    const seen = new Set<string>();
    const bookings = [...byUser, ...byEmail].filter((b) => (seen.has(String(b._id)) ? false : (seen.add(String(b._id)), true))).sort((a, b) => b._creationTime - a._creationTime);
    const [reviews, conversations, leads, dataRequests] = await Promise.all([
      ctx.db.query("reviews").withIndex("by_user", (q) => q.eq("userId", id)).take(50),
      ctx.db.query("conversations").withIndex("by_user", (q) => q.eq("userId", id)).order("desc").take(20),
      u.email ? ctx.db.query("leads").withIndex("by_email", (q) => q.eq("email", u.email!)).take(20) : Promise.resolve([]),
      ctx.db.query("dataRequests").withIndex("by_user", (q) => q.eq("userId", id)).take(10),
    ]);
    return {
      _id: u._id,
      name: u.name ?? null,
      email: u.email ?? null,
      phone: u.phone ?? null,
      nationality: u.nationality ?? null,
      locale: u.locale ?? "en",
      tags: u.tags ?? [],
      notes: u.notes ?? null,
      leadSource: u.leadSource ?? null,
      loyaltyPoints: u.loyaltyPoints ?? 0,
      referralCode: u.referralCode ?? null,
      marketingOptIn: u.marketingOptIn ?? false,
      createdAt: u._creationTime,
      bookings: bookings.map((b) => ({ _id: b._id, reference: b.reference, tourTitle: b.tourTitle, date: b.date, status: b.status, total: b.total, amountPaid: b.amountPaid })),
      reviews: reviews.map((r) => ({ _id: r._id, rating: r.rating, body: r.body, status: r.status })),
      conversations: conversations.map((c) => ({ _id: c._id, status: c.status, lastMessageAt: c.lastMessageAt, subject: c.subject ?? null })),
      leads: leads.map((l) => ({ _id: l._id, source: l.source, status: l.status, createdAt: l._creationTime })),
      dataRequests,
    };
  },
});

export const update = mutation({
  args: { id: v.id("users"), tags: v.optional(v.array(v.string())), notes: v.optional(v.string()), leadSource: v.optional(v.string()), loyaltyPointsDelta: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const u = await ctx.db.get(args.id);
    if (!u) throw new ConvexError({ code: "NOT_FOUND" });
    const patch: Record<string, unknown> = {};
    if (args.tags) patch.tags = args.tags.map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 20);
    if (args.notes !== undefined) patch.notes = assertString(args.notes, 4000, "notes");
    if (args.leadSource !== undefined) patch.leadSource = assertString(args.leadSource, 60, "leadSource");
    if (args.loyaltyPointsDelta !== undefined) {
      const delta = Math.round(args.loyaltyPointsDelta);
      if (!Number.isFinite(delta) || Math.abs(delta) > 100_000) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "loyaltyPointsDelta" });
      patch.loyaltyPoints = Math.max(0, (u.loyaltyPoints ?? 0) + delta);
    }
    await ctx.db.patch(args.id, patch);
    await audit(ctx, staff, "customer.update", "users", String(args.id), { tags: u.tags, loyaltyPoints: u.loyaltyPoints }, patch);
    return null;
  },
});

/** Rows for CSV export (client builds the file). */
export const exportRows = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const users = await ctx.db.query("users").take(5000);
    const bookings = await ctx.db.query("bookings").take(5000);
    return users
      .filter((u) => !u.deletedAt && (u.role ?? "customer") === "customer")
      .map((u) => {
        const mine = bookings.filter((b) => b.userId === u._id);
        return { name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "", nationality: u.nationality ?? "", locale: u.locale ?? "", tags: (u.tags ?? []).join("|"), leadSource: u.leadSource ?? "", loyaltyPoints: u.loyaltyPoints ?? 0, bookings: mine.length, spentOmr: mine.reduce((a, b) => a + b.amountPaid - b.amountRefunded, 0) / 1000, marketingOptIn: u.marketingOptIn ? "yes" : "no", createdAt: new Date(u._creationTime).toISOString() };
      });
  },
});
