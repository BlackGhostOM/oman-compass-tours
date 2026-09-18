import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { categoriesSeed } from "../seedData/categories";
import { destinationsSeed } from "../seedData/destinations";
import { toursSeed } from "../seedData/tours";
import { VIATOR_URL } from "../seedData/tourSeedTypes";
import { omrToBaisa } from "./money";

const TRIPADVISOR_URL =
  "https://www.tripadvisor.com/Attraction_Review-g1940497-d26437481-Reviews-OMAN_COMPASS_TOURS-Muscat_Muscat_Governorate.html";

export const placeholder = (key: string) => `/media/placeholders/${key}.jpg`;

export const media = (key: string, alt: { en: string; ar: string }) => ({
  kind: "image" as const,
  url: placeholder(key),
  alt,
  width: key.startsWith("reel") ? 1080 : 1600,
  height: key.startsWith("reel") ? 1920 : 1000,
});

const isPlaceholderMedia = (m?: { storageId?: Id<"_storage">; url?: string }) => !m || (!m.storageId && (m.url ?? "").startsWith("/media/placeholders/"));

/**
 * Upserts categories, destinations and tours from the seed files.
 * Idempotent and safe on live data: tours are matched by `code`; ratings,
 * uploaded cover images/videos and draft status set by staff are preserved.
 */
export async function syncCatalogFromSeed(ctx: MutationCtx, now: number, opts: { codes?: string[] } = {}) {
  /* Categories */
  const categoryIds = new Map<string, Id<"categories">>();
  for (const [i, c] of categoriesSeed.entries()) {
    const existing = await ctx.db.query("categories").withIndex("by_key", (q) => q.eq("key", c.key)).unique();
    const doc = { key: c.key, name: c.name, slug: c.slug, description: c.description, icon: c.icon, order: i + 1, isActive: existing?.isActive ?? true };
    const id = existing ? (await ctx.db.patch(existing._id, doc), existing._id) : await ctx.db.insert("categories", doc);
    categoryIds.set(c.key, id);
  }

  /* Destinations */
  const destinationIds = new Map<string, Id<"destinations">>();
  for (const [i, d] of destinationsSeed.entries()) {
    const existing = await ctx.db.query("destinations").withIndex("by_key", (q) => q.eq("key", d.key)).unique();
    const doc = {
      key: d.key,
      name: d.name,
      slug: d.slug,
      tagline: d.tagline,
      description: d.description,
      region: d.region,
      image: existing && !isPlaceholderMedia(existing.image) ? existing.image : media(d.image, d.name),
      lat: d.lat,
      lng: d.lng,
      order: i + 1,
      isActive: existing?.isActive ?? true,
    };
    const id = existing ? (await ctx.db.patch(existing._id, doc), existing._id) : await ctx.db.insert("destinations", doc);
    destinationIds.set(d.key, id);
  }

  /* Tours */
  const tourIds = new Map<string, Id<"tours">>();
  let inserted = 0;
  let updated = 0;
  for (const t of toursSeed) {
    if (opts.codes && !opts.codes.includes(t.code)) continue;
    const existing = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", t.code)).unique();
    const priceGroup = t.priceGroupOmr !== undefined ? omrToBaisa(t.priceGroupOmr) : undefined;
    const priceAdult = t.priceAdultOmr !== undefined ? omrToBaisa(t.priceAdultOmr) : undefined;
    const priceChild = t.priceChildOmr !== undefined ? omrToBaisa(t.priceChildOmr) : undefined;
    const priceFrom = t.pricingModel === "per_group" ? priceGroup! : priceAdult!;
    const keepCover = existing && !isPlaceholderMedia(existing.coverImage);
    const doc = {
      code: t.code,
      kind: t.kind,
      title: t.title,
      slug: t.slug,
      summary: t.summary,
      description: t.description,
      highlights: t.highlights,
      itinerary: t.itinerary,
      inclusions: t.inclusions,
      exclusions: t.exclusions,
      faqs: t.faqs,
      categoryId: categoryIds.get(t.category)!,
      secondaryCategoryIds: (t.secondaryCategories ?? []).map((k) => categoryIds.get(k)!),
      destinationIds: t.destinations.map((k) => destinationIds.get(k)!),
      durationLabel: t.durationLabel,
      durationMinutes: t.durationMinutes,
      durationDays: t.durationDays,
      startTimes: t.startTimes,
      meetingPoint: t.meetingPoint,
      pickupIncluded: t.pickupIncluded,
      guideLanguages: t.guideLanguages,
      minGroup: t.minGroup,
      maxGroup: t.maxGroup,
      defaultCapacityPerSlot: t.capacityPerSlot,
      difficulty: t.difficulty,
      pricingModel: t.pricingModel,
      priceGroup,
      priceAdult,
      priceChild,
      childAgeMax: t.childAgeMax,
      infantAgeMax: 2,
      priceFrom,
      depositPercent: t.depositPercent,
      freeCancellationHours: t.freeCancellationHours,
      allowReserveNowPayLater: t.allowReserveNowPayLater,
      holdHours: t.holdHours,
      coverImage: keepCover ? existing!.coverImage : media(t.image, t.title),
      video: existing?.video,
      ratingAverage: existing?.ratingCount ? existing.ratingAverage : t.ratingAverage,
      ratingCount: existing?.ratingCount ?? 0,
      externalReviewCount: t.externalReviewCount,
      tripadvisorUrl: TRIPADVISOR_URL,
      viatorUrl: t.viatorCode ? VIATOR_URL(t.viatorCode) : undefined,
      status: existing?.status === "draft" ? ("draft" as const) : ("published" as const),
      isFeatured: t.isFeatured,
      featuredOrder: t.featuredOrder,
      tags: [...t.tags, ...(t.priceIsPlaceholder ? ["price-placeholder"] : [])],
      seo: {
        title: t.title,
        description: t.summary,
        ogImageUrl: keepCover ? existing!.coverImage?.url : placeholder(t.image),
      },
      searchText: `${t.title.en} ${t.title.ar} ${t.summary.en} ${t.summary.ar} ${t.tags.join(" ")}`,
      updatedAt: now,
    };
    let id: Id<"tours">;
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      id = existing._id;
      updated += 1;
    } else {
      id = await ctx.db.insert("tours", doc);
      inserted += 1;
    }
    tourIds.set(t.code, id);

    // Gallery: cover + a few placeholders, only when the tour has no gallery yet
    const gallery = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", id)).take(1);
    if (gallery.length === 0) {
      const extras = [t.image, "muscat", "wahiba", "jebel-akhdar", "wadi-shab"].filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
      for (const [i, key] of extras.entries()) {
        await ctx.db.insert("tourMedia", { tourId: id, media: media(key, t.title), order: i });
      }
    }
  }

  return { categoryIds, destinationIds, tourIds, inserted, updated };
}
