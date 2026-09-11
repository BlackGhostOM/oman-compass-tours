import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { assertString, requireUser } from "./lib/access";
import { isFreeCancellation } from "./lib/pricing";

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

function summarize(b: Doc<"bookings">, tour: Doc<"tours"> | null) {
  return {
    _id: b._id,
    reference: b.reference,
    tourTitle: b.tourTitle,
    tourSlug: tour?.slug ?? null,
    coverImage: tour?.coverImage ?? null,
    date: b.date,
    startTime: b.startTime ?? null,
    durationLabel: tour?.durationLabel ?? null,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    total: b.total,
    amountPaid: b.amountPaid,
    amountRefunded: b.amountRefunded,
    depositDue: b.depositDue,
    status: b.status,
    voucherToken: b.voucherToken,
    pickup: b.traveller.pickupLocation ?? b.traveller.hotel ?? tour?.meetingPoint?.label ?? null,
    freeCancellationHours: tour?.freeCancellationHours ?? 0,
    canCancelFree: tour ? isFreeCancellation(b.date, b.startTime, tour.freeCancellationHours) : false,
    holdExpiresAt: b.holdExpiresAt ?? null,
    createdAt: b._creationTime,
    customerNotes: b.customerNotes ?? null,
  };
}

export const myBookings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(200);
    const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
    const out = await Promise.all(rows.map(async (b) => summarize(b, await ctx.db.get(b.tourId))));
    const upcoming = out.filter((b) => b.date >= today && !["cancelled", "refunded", "completed"].includes(b.status)).sort((a, b) => a.date.localeCompare(b.date));
    const past = out.filter((b) => b.date < today || ["cancelled", "refunded", "completed"].includes(b.status));
    return { upcoming, past };
  },
});

export const myPayments = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const bookings = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(200);
    const result = [];
    for (const b of bookings) {
      const payments = await ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(20);
      for (const p of payments) {
        if (p.status === "created") continue;
        result.push({
          _id: p._id,
          bookingReference: b.reference,
          voucherToken: b.voucherToken,
          tourTitle: b.tourTitle,
          date: b.date,
          provider: p.provider,
          kind: p.kind,
          amount: p.amount,
          currency: p.currency,
          amountOmr: p.amountOmr,
          refundedAmount: p.refundedAmount,
          status: p.status,
          paidAt: p.paidAt ?? null,
          createdAt: p._creationTime,
          providerPaymentId: p.providerPaymentId ?? null,
        });
      }
    }
    return result.sort((a, b) => (b.paidAt ?? b.createdAt) - (a.paidAt ?? a.createdAt));
  },
});

/* ------------------------------------------------------------------ */
/* Saved travellers                                                    */
/* ------------------------------------------------------------------ */

export const travellers = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("travellers").withIndex("by_user", (q) => q.eq("userId", user._id)).take(50);
    return Promise.all(
      rows.map(async (t) => ({
        _id: t._id,
        firstName: t.firstName,
        lastName: t.lastName,
        relationship: t.relationship ?? null,
        dateOfBirth: t.dateOfBirth ?? null,
        nationality: t.nationality ?? null,
        passportNumber: t.passportNumber ? `••••${t.passportNumber.slice(-3)}` : null,
        passportExpiry: t.passportExpiry ?? null,
        dietary: t.dietary ?? null,
        hasDocument: !!t.documentStorageId,
        documentUrl: t.documentStorageId ? await ctx.storage.getUrl(t.documentStorageId) : null,
        updatedAt: t.updatedAt,
      })),
    );
  },
});

export const upsertTraveller = mutation({
  args: {
    id: v.optional(v.id("travellers")),
    firstName: v.string(),
    lastName: v.string(),
    relationship: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    nationality: v.optional(v.string()),
    passportNumber: v.optional(v.string()),
    passportExpiry: v.optional(v.string()),
    dietary: v.optional(v.string()),
    documentStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("travellers"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = {
      userId: user._id,
      firstName: assertString(args.firstName, 80, "firstName", 1),
      lastName: assertString(args.lastName, 80, "lastName", 1),
      relationship: args.relationship ? assertString(args.relationship, 40, "relationship") : undefined,
      dateOfBirth: args.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(args.dateOfBirth) ? args.dateOfBirth : undefined,
      nationality: args.nationality ? assertString(args.nationality, 2, "nationality").toUpperCase() : undefined,
      passportNumber: args.passportNumber ? assertString(args.passportNumber, 20, "passportNumber") : undefined,
      passportExpiry: args.passportExpiry && /^\d{4}-\d{2}-\d{2}$/.test(args.passportExpiry) ? args.passportExpiry : undefined,
      dietary: args.dietary ? assertString(args.dietary, 200, "dietary") : undefined,
      documentStorageId: args.documentStorageId,
      documentEncrypted: args.documentStorageId ? true : undefined,
      updatedAt: Date.now(),
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.userId !== user._id) throw new ConvexError({ code: "FORBIDDEN" });
      if (existing.documentStorageId && args.documentStorageId && existing.documentStorageId !== args.documentStorageId) {
        await ctx.storage.delete(existing.documentStorageId);
      }
      await ctx.db.patch(args.id, { ...doc, documentStorageId: args.documentStorageId ?? existing.documentStorageId, passportNumber: doc.passportNumber ?? existing.passportNumber });
      return args.id;
    }
    const count = (await ctx.db.query("travellers").withIndex("by_user", (q) => q.eq("userId", user._id)).take(51)).length;
    if (count >= 50) throw new ConvexError({ code: "LIMIT_REACHED" });
    return await ctx.db.insert("travellers", doc);
  },
});

export const removeTraveller = mutation({
  args: { id: v.id("travellers") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const t = await ctx.db.get(id);
    if (!t || t.userId !== user._id) throw new ConvexError({ code: "FORBIDDEN" });
    if (t.documentStorageId) await ctx.storage.delete(t.documentStorageId);
    await ctx.db.delete(id);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Wishlist                                                            */
/* ------------------------------------------------------------------ */

export const wishlist = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("wishlists").withIndex("by_user", (q) => q.eq("userId", user._id)).take(100);
    const tours = await Promise.all(rows.map((r) => ctx.db.get(r.tourId)));
    return tours
      .filter((t): t is Doc<"tours"> => !!t && t.status === "published")
      .map((t) => ({ _id: t._id, title: t.title, slug: t.slug, summary: t.summary, coverImage: t.coverImage ?? null, priceFrom: t.priceFrom, pricingModel: t.pricingModel, durationLabel: t.durationLabel, ratingAverage: t.ratingAverage, ratingCount: t.ratingCount, externalReviewCount: t.externalReviewCount ?? null }));
  },
});

export const wishlistIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx).catch(() => null);
    if (!user) return [] as string[];
    const rows = await ctx.db.query("wishlists").withIndex("by_user", (q) => q.eq("userId", user._id)).take(100);
    return rows.map((r) => String(r.tourId));
  },
});

export const toggleWishlist = mutation({
  args: { tourId: v.id("tours") },
  returns: v.object({ saved: v.boolean() }),
  handler: async (ctx, { tourId }) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.query("wishlists").withIndex("by_user_tour", (q) => q.eq("userId", user._id).eq("tourId", tourId)).unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("wishlists", { userId: user._id, tourId });
    return { saved: true };
  },
});

/* ------------------------------------------------------------------ */
/* Loyalty & referrals                                                 */
/* ------------------------------------------------------------------ */

export const loyalty = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const referred = await ctx.db.query("users").withIndex("by_role").take(1); // placeholder to keep API shape stable
    void referred;
    const bookings = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", user._id)).take(200);
    const spentOmr = bookings.reduce((a, b) => a + b.amountPaid - b.amountRefunded, 0);
    return {
      points: user.loyaltyPoints ?? 0,
      referralCode: user.referralCode ?? null,
      spentOmr,
      completedTours: bookings.filter((b) => b.status === "completed").length,
      tier: spentOmr >= 1_000_000 ? "gold" : spentOmr >= 300_000 ? "silver" : "compass",
    };
  },
});

/* ------------------------------------------------------------------ */
/* Privacy: export & deletion requests                                 */
/* ------------------------------------------------------------------ */

export const dataRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("dataRequests").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(20);
    return Promise.all(rows.map(async (r) => ({ _id: r._id, type: r.type, status: r.status, createdAt: r._creationTime, updatedAt: r.updatedAt, exportUrl: r.exportStorageId ? await ctx.storage.getUrl(r.exportStorageId) : null })));
  },
});

export const requestData = mutation({
  args: { type: v.union(v.literal("export"), v.literal("deletion")), note: v.optional(v.string()) },
  returns: v.id("dataRequests"),
  handler: async (ctx, { type, note }) => {
    const user = await requireUser(ctx);
    const open = (await ctx.db.query("dataRequests").withIndex("by_user", (q) => q.eq("userId", user._id)).take(20)).find((r) => r.type === type && (r.status === "pending" || r.status === "processing"));
    if (open) return open._id;
    const id = await ctx.db.insert("dataRequests", { userId: user._id, type, status: "pending", note: note?.slice(0, 500), updatedAt: Date.now() });
    await ctx.db.insert("auditLogs", { actorId: user._id, actorEmail: user.email, action: `data_request.${type}`, entityType: "dataRequests", entityId: id, createdAt: Date.now() });
    return id;
  },
});

/** Immediate self-service export (JSON) of the customer's own data. */
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const bookings = await ctx.db.query("bookings").withIndex("by_user", (q) => q.eq("userId", user._id)).take(500);
    const reviews = await ctx.db.query("reviews").withIndex("by_user", (q) => q.eq("userId", user._id)).take(200);
    const travellers = await ctx.db.query("travellers").withIndex("by_user", (q) => q.eq("userId", user._id)).take(50);
    const conversations = await ctx.db.query("conversations").withIndex("by_user", (q) => q.eq("userId", user._id)).take(100);
    return {
      exportedAt: new Date().toISOString(),
      profile: { name: user.name, email: user.email, phone: user.phone, nationality: user.nationality, locale: user.locale, loyaltyPoints: user.loyaltyPoints, referralCode: user.referralCode, marketingOptIn: user.marketingOptIn },
      bookings: bookings.map((b) => { const copy: Record<string, unknown> = { ...b }; delete copy.voucherToken; delete copy.internalNotes; return copy; }),
      reviews,
      travellers: travellers.map((t) => { const copy: Record<string, unknown> = { ...t }; delete copy.documentStorageId; return copy; }),
      conversations: conversations.map((c) => ({ _id: c._id, status: c.status, subject: c.subject, lastMessageAt: c.lastMessageAt })),
    };
  },
});
