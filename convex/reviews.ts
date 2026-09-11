import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, assertInt, assertString, enforceRateLimit } from "./lib/access";
import { localeValidator } from "./schema";

const publicReview = (r: {
  _id: unknown;
  _creationTime: number;
  tourId?: unknown;
  authorName: string;
  authorCountry?: string;
  rating: number;
  title?: string;
  body: string;
  language: "en" | "ar";
  source: string;
  travelDate?: string;
  staffReply?: string;
}) => ({
  _id: r._id,
  tourId: r.tourId ?? null,
  authorName: r.authorName,
  authorCountry: r.authorCountry ?? null,
  rating: r.rating,
  title: r.title ?? null,
  body: r.body,
  language: r.language,
  source: r.source,
  travelDate: r.travelDate ?? null,
  staffReply: r.staffReply ?? null,
  createdAt: r._creationTime,
});

/** Approved + featured reviews for the home page. */
export const featured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_featured", (q) => q.eq("status", "approved").eq("isFeatured", true))
      .order("desc")
      .take(Math.min(limit ?? 6, 20));
    const withTour = await Promise.all(
      rows.map(async (r) => {
        const tour = r.tourId ? await ctx.db.get(r.tourId) : null;
        return { ...publicReview(r), tourTitle: tour?.title ?? null, tourSlug: tour?.slug ?? null };
      }),
    );
    return withTour;
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("reviews").withIndex("by_status", (q) => q.eq("status", "approved")).take(1000);
    const count = rows.length;
    const average = count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0;
    return { count, average: Math.round(average * 10) / 10 };
  },
});

/** Customer submits a review after a completed booking. */
export const submit = mutation({
  args: {
    bookingId: v.id("bookings"),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.string(),
    language: localeValidator,
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking || booking.userId !== user._id) throw new ConvexError({ code: "FORBIDDEN" });
    if (booking.status !== "completed") throw new ConvexError({ code: "BOOKING_NOT_COMPLETED" });
    const existing = await ctx.db.query("reviews").withIndex("by_booking", (q) => q.eq("bookingId", booking._id)).first();
    if (existing) throw new ConvexError({ code: "ALREADY_REVIEWED" });
    await enforceRateLimit(ctx, `review:${user._id}`, 5, 24 * 60 * 60 * 1000);

    await ctx.db.insert("reviews", {
      tourId: booking.tourId,
      bookingId: booking._id,
      userId: user._id,
      authorName: user.name ?? `${booking.traveller.firstName} ${booking.traveller.lastName[0]}.`,
      authorCountry: booking.traveller.nationality,
      rating: assertInt(args.rating, 1, 5, "rating"),
      title: args.title ? assertString(args.title, 120, "title") : undefined,
      body: assertString(args.body, 2000, "body", 10),
      language: args.language,
      source: "site",
      travelDate: booking.date.slice(0, 7),
      status: "pending",
      isFeatured: false,
    });
    return { ok: true };
  },
});

/** Reviews written by the signed-in customer. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("reviews").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(50);
    return Promise.all(
      rows.map(async (r) => {
        const tour = r.tourId ? await ctx.db.get(r.tourId) : null;
        return { ...publicReview(r), status: r.status, tourTitle: tour?.title ?? null, tourSlug: tour?.slug ?? null };
      }),
    );
  },
});
