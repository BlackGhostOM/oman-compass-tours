import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { localeValidator } from "./schema";

/** Card projection used by lists, carousels and related-tour rails. */
function toCard(t: Doc<"tours">) {
  return {
    _id: t._id,
    code: t.code,
    kind: t.kind,
    title: t.title,
    slug: t.slug,
    summary: t.summary,
    categoryId: t.categoryId,
    destinationIds: t.destinationIds,
    durationLabel: t.durationLabel,
    durationMinutes: t.durationMinutes,
    durationDays: t.durationDays,
    pricingModel: t.pricingModel,
    priceFrom: t.priceFrom,
    compareAtPriceFrom: t.compareAtPriceFrom ?? null,
    priceGroup: t.priceGroup ?? null,
    priceAdult: t.priceAdult ?? null,
    priceChild: t.priceChild ?? null,
    freeCancellationHours: t.freeCancellationHours,
    ratingAverage: t.ratingAverage,
    ratingCount: t.ratingCount,
    externalReviewCount: t.externalReviewCount ?? null,
    coverImage: t.coverImage ?? null,
    difficulty: t.difficulty ?? null,
    maxGroup: t.maxGroup,
    guideLanguages: t.guideLanguages,
    tags: t.tags,
    isFeatured: t.isFeatured,
  };
}

export type TourCard = ReturnType<typeof toCard>;

export const featured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("tours")
      .withIndex("by_featured", (q) => q.eq("status", "published").eq("isFeatured", true))
      .take(Math.min(limit ?? 8, 24));
    return rows.sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99)).map(toCard);
  },
});

export const list = query({
  args: {
    kind: v.optional(v.union(v.literal("tour"), v.literal("service"))),
    categoryKey: v.optional(v.string()),
    destinationKey: v.optional(v.string()),
    minDurationMinutes: v.optional(v.number()),
    maxDurationMinutes: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    minPrice: v.optional(v.number()),
    guideLanguage: v.optional(v.string()),
    minGroupSize: v.optional(v.number()),
    search: v.optional(v.string()),
    sort: v.optional(
      v.union(v.literal("popular"), v.literal("price_asc"), v.literal("price_desc"), v.literal("duration"), v.literal("rating")),
    ),
  },
  handler: async (ctx, args) => {
    let rows: Doc<"tours">[];
    const search = args.search?.trim();
    if (search && search.length >= 2) {
      rows = await ctx.db
        .query("tours")
        .withSearchIndex("search_text", (q) => q.search("searchText", search).eq("status", "published"))
        .take(100);
    } else {
      rows = await ctx.db
        .query("tours")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .take(500);
    }

    let categoryId: Id<"categories"> | undefined;
    if (args.categoryKey) {
      const c = await ctx.db.query("categories").withIndex("by_key", (q) => q.eq("key", args.categoryKey!)).unique();
      categoryId = c?._id;
      if (!categoryId) return [];
    }
    let destinationId: Id<"destinations"> | undefined;
    if (args.destinationKey) {
      const d = await ctx.db.query("destinations").withIndex("by_key", (q) => q.eq("key", args.destinationKey!)).unique();
      destinationId = d?._id;
      if (!destinationId) return [];
    }

    rows = rows.filter((t) => {
      if (args.kind && t.kind !== args.kind) return false;
      if (categoryId && t.categoryId !== categoryId && !(t.secondaryCategoryIds ?? []).includes(categoryId)) return false;
      if (destinationId && !t.destinationIds.includes(destinationId)) return false;
      if (args.minDurationMinutes !== undefined && t.durationMinutes < args.minDurationMinutes) return false;
      if (args.maxDurationMinutes !== undefined && t.durationMinutes > args.maxDurationMinutes) return false;
      if (args.minPrice !== undefined && t.priceFrom < args.minPrice) return false;
      if (args.maxPrice !== undefined && t.priceFrom > args.maxPrice) return false;
      if (args.guideLanguage && !t.guideLanguages.includes(args.guideLanguage)) return false;
      if (args.minGroupSize !== undefined && t.maxGroup < args.minGroupSize) return false;
      return true;
    });

    const sort = args.sort ?? "popular";
    rows.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return a.priceFrom - b.priceFrom;
        case "price_desc":
          return b.priceFrom - a.priceFrom;
        case "duration":
          return a.durationMinutes - b.durationMinutes;
        case "rating":
          return b.ratingAverage - a.ratingAverage || (b.externalReviewCount ?? 0) - (a.externalReviewCount ?? 0);
        default: {
          const fa = a.isFeatured ? a.featuredOrder ?? 50 : 100;
          const fb = b.isFeatured ? b.featuredOrder ?? 50 : 100;
          return fa - fb || (b.externalReviewCount ?? 0) - (a.externalReviewCount ?? 0);
        }
      }
    });
    return rows.map(toCard);
  },
});

/** Full tour document for the detail page, resolved by slug in either locale. */
export const bySlug = query({
  args: { slug: v.string(), locale: localeValidator },
  handler: async (ctx, { slug, locale }) => {
    let tour =
      locale === "ar"
        ? await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug)).unique()
        : await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique();
    // Fallback: allow the other locale's slug (e.g. shared links)
    if (!tour) {
      tour =
        locale === "ar"
          ? await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique()
          : await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug)).unique();
    }
    if (!tour || tour.status !== "published") return null;

    const [category, gallery, destinations, addOns, reviews] = await Promise.all([
      ctx.db.get(tour.categoryId),
      ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", tour._id)).take(30),
      Promise.all(tour.destinationIds.map((id) => ctx.db.get(id))),
      ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", undefined)).take(20),
      ctx.db.query("reviews").withIndex("by_tour", (q) => q.eq("tourId", tour._id).eq("status", "approved")).order("desc").take(12),
    ]);
    const tourAddOns = await ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", tour._id)).take(20);

    // Related: same category, published, not self
    const related = (
      await ctx.db
        .query("tours")
        .withIndex("by_category", (q) => q.eq("categoryId", tour.categoryId).eq("status", "published"))
        .take(8)
    )
      .filter((t) => t._id !== tour._id)
      .slice(0, 4)
      .map(toCard);

    return {
      ...tour,
      category: category ? { key: category.key, name: category.name, slug: category.slug } : null,
      // Resolve storage-backed media to URLs so uploads without a cached `url` still render.
      gallery: await Promise.all(gallery.map(async (g) => ({ ...g.media, url: g.media.url ?? (g.media.storageId ? (await ctx.storage.getUrl(g.media.storageId)) ?? undefined : undefined) }))),
      destinations: destinations.filter((d): d is Doc<"destinations"> => !!d).map((d) => ({ key: d.key, name: d.name, slug: d.slug })),
      addOns: [...addOns, ...tourAddOns].filter((a) => a.isActive),
      reviews: reviews.map((r) => ({
        _id: r._id,
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
      })),
      related,
    };
  },
});

/** All published slugs, for sitemap + static params. */
export const slugs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(1000);
    return rows.map((t) => ({ slug: t.slug, updatedAt: t.updatedAt, kind: t.kind }));
  },
});

/** Minimal projection for the booking wizard. */
export const forBooking = query({
  args: { slug: v.string(), locale: localeValidator },
  handler: async (ctx, { slug, locale }) => {
    const tour =
      (locale === "ar"
        ? await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug)).unique()
        : await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique()) ??
      (await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique());
    if (!tour || tour.status !== "published") return null;
    const globalAddOns = await ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", undefined)).take(20);
    const tourAddOns = await ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", tour._id)).take(20);
    const policies = await ctx.db.query("policies").take(20);
    const required = policies.filter((p) => p.requiredAtCheckout && p.currentVersionId);
    return {
      _id: tour._id,
      code: tour.code,
      title: tour.title,
      slug: tour.slug,
      summary: tour.summary,
      coverImage: tour.coverImage ?? null,
      durationLabel: tour.durationLabel,
      durationDays: tour.durationDays,
      startTimes: tour.startTimes,
      pricingModel: tour.pricingModel,
      priceGroup: tour.priceGroup ?? null,
      priceAdult: tour.priceAdult ?? null,
      priceChild: tour.priceChild ?? null,
      childAgeMax: tour.childAgeMax ?? null,
      infantAgeMax: tour.infantAgeMax ?? 2,
      minGroup: tour.minGroup,
      maxGroup: tour.maxGroup,
      depositPercent: tour.depositPercent,
      freeCancellationHours: tour.freeCancellationHours,
      allowReserveNowPayLater: tour.allowReserveNowPayLater,
      holdHours: tour.holdHours,
      pickupIncluded: tour.pickupIncluded,
      addOns: [...globalAddOns, ...tourAddOns].filter((a) => a.isActive).map((a) => ({ _id: a._id, key: a.key, name: a.name, description: a.description ?? null, price: a.price, priceType: a.priceType })),
      requiredPolicies: required.map((p) => ({ _id: p._id, key: p.key, title: p.title, versionId: p.currentVersionId! })),
    };
  },
});
