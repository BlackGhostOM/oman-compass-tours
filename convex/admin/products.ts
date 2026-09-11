import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { assertInt, audit, requireStaff } from "../lib/access";
import { faqValidator, itineraryDayValidator, localized, localizedOptional, mediaValidator, pricingModelValidator, seoValidator } from "../schema";

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/* ------------------------------------------------------------------ */
/* Tours                                                               */
/* ------------------------------------------------------------------ */

export const list = query({
  args: { status: v.optional(v.union(v.literal("draft"), v.literal("published"), v.literal("archived"))) },
  handler: async (ctx, { status }) => {
    await requireStaff(ctx);
    const rows = status ? await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", status)).take(500) : await ctx.db.query("tours").take(500);
    const categories = await ctx.db.query("categories").take(100);
    return rows
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((t) => ({ _id: t._id, code: t.code, kind: t.kind, title: t.title, slug: t.slug, status: t.status, isFeatured: t.isFeatured, priceFrom: t.priceFrom, pricingModel: t.pricingModel, category: categories.find((c) => c._id === t.categoryId)?.name ?? null, coverImage: t.coverImage ?? null, ratingAverage: t.ratingAverage, updatedAt: t.updatedAt, tags: t.tags }));
  },
});

export const get = query({
  args: { id: v.id("tours") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const t = await ctx.db.get(id);
    if (!t) return null;
    const [media, seasons, availability, addOns] = await Promise.all([
      ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", id)).take(50),
      ctx.db.query("pricingSeasons").withIndex("by_tour", (q) => q.eq("tourId", id)).take(50),
      ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", id)).take(400),
      ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", id)).take(50),
    ]);
    const mediaWithUrls = await Promise.all(media.map(async (m) => ({ ...m, url: m.media.url ?? (m.media.storageId ? await ctx.storage.getUrl(m.media.storageId) : null) })));
    return { ...t, media: mediaWithUrls, seasons, availability, addOns };
  },
});

const tourInput = {
  code: v.string(),
  kind: v.union(v.literal("tour"), v.literal("service")),
  title: localized,
  slug: localizedOptional,
  summary: localized,
  description: localized,
  highlights: v.array(localized),
  itinerary: v.array(itineraryDayValidator),
  inclusions: v.array(localized),
  exclusions: v.array(localized),
  faqs: v.array(faqValidator),
  categoryId: v.id("categories"),
  secondaryCategoryIds: v.optional(v.array(v.id("categories"))),
  destinationIds: v.array(v.id("destinations")),
  durationLabel: localized,
  durationMinutes: v.number(),
  durationDays: v.number(),
  startTimes: v.array(v.string()),
  meetingPoint: v.optional(v.object({ label: localized, address: v.optional(v.string()), lat: v.optional(v.number()), lng: v.optional(v.number()), mapsUrl: v.optional(v.string()) })),
  pickupIncluded: v.boolean(),
  guideLanguages: v.array(v.string()),
  minGroup: v.number(),
  maxGroup: v.number(),
  defaultCapacityPerSlot: v.number(),
  difficulty: v.optional(v.union(v.literal("easy"), v.literal("moderate"), v.literal("challenging"))),
  pricingModel: pricingModelValidator,
  priceGroupOmr: v.optional(v.number()),
  priceAdultOmr: v.optional(v.number()),
  priceChildOmr: v.optional(v.number()),
  childAgeMax: v.optional(v.number()),
  infantAgeMax: v.optional(v.number()),
  compareAtPriceFromOmr: v.optional(v.number()),
  depositPercent: v.number(),
  freeCancellationHours: v.number(),
  allowReserveNowPayLater: v.boolean(),
  holdHours: v.number(),
  coverImage: v.optional(mediaValidator),
  video: v.optional(mediaValidator),
  externalReviewCount: v.optional(v.number()),
  tripadvisorUrl: v.optional(v.string()),
  viatorUrl: v.optional(v.string()),
  status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  isFeatured: v.boolean(),
  featuredOrder: v.optional(v.number()),
  tags: v.array(v.string()),
  seo: v.optional(seoValidator),
};

export const upsert = mutation({
  args: { id: v.optional(v.id("tours")), data: v.object(tourInput) },
  returns: v.id("tours"),
  handler: async (ctx, { id, data }) => {
    const staff = await requireStaff(ctx);
    const omr = (x?: number) => (x === undefined ? undefined : Math.round(Math.max(0, x) * 1000));
    assertInt(data.minGroup, 1, 200, "minGroup");
    assertInt(data.maxGroup, data.minGroup, 500, "maxGroup");
    assertInt(data.defaultCapacityPerSlot, 1, 500, "capacity");
    assertInt(data.depositPercent, 0, 100, "depositPercent");
    assertInt(data.freeCancellationHours, 0, 720, "freeCancellationHours");
    assertInt(data.holdHours, 1, 168, "holdHours");
    assertInt(data.durationDays, 1, 60, "durationDays");
    if (data.pricingModel === "per_group" && !data.priceGroupOmr) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "priceGroupOmr" });
    if (data.pricingModel === "per_person" && !data.priceAdultOmr) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "priceAdultOmr" });
    const priceGroup = omr(data.priceGroupOmr);
    const priceAdult = omr(data.priceAdultOmr);
    const priceChild = omr(data.priceChildOmr);
    const slug = { en: slugify(data.slug?.en || data.title.en), ar: slugify(data.slug?.ar || data.title.ar) };
    for (const l of ["en", "ar"] as const) {
      const clash = l === "en" ? await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug.en)).unique() : await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug.ar)).unique();
      if (clash && clash._id !== id) throw new ConvexError({ code: "SLUG_TAKEN", locale: l });
    }
    const codeClash = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", data.code)).unique();
    if (codeClash && codeClash._id !== id) throw new ConvexError({ code: "CODE_TAKEN" });

    const { priceGroupOmr: _a, priceAdultOmr: _b, priceChildOmr: _c, compareAtPriceFromOmr, ...rest } = data;
    void _a; void _b; void _c;
    const doc = {
      ...rest,
      slug,
      priceGroup,
      priceAdult,
      priceChild,
      priceFrom: data.pricingModel === "per_group" ? priceGroup! : priceAdult!,
      compareAtPriceFrom: omr(compareAtPriceFromOmr),
      searchText: `${data.title.en} ${data.title.ar} ${data.summary.en} ${data.summary.ar} ${data.tags.join(" ")}`,
      updatedAt: Date.now(),
    };
    if (id) {
      const before = await ctx.db.get(id);
      await ctx.db.patch(id, doc);
      await audit(ctx, staff, "tour.update", "tours", String(id), { title: before?.title, priceFrom: before?.priceFrom, status: before?.status }, { title: doc.title, priceFrom: doc.priceFrom, status: doc.status });
      return id;
    }
    const newId = await ctx.db.insert("tours", { ...doc, ratingAverage: 0, ratingCount: 0 });
    await audit(ctx, staff, "tour.create", "tours", String(newId), undefined, { code: data.code, title: data.title });
    return newId;
  },
});

export const setStatus = mutation({
  args: { id: v.id("tours"), status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")) },
  returns: v.null(),
  handler: async (ctx, { id, status }) => {
    const staff = await requireStaff(ctx);
    const t = await ctx.db.get(id);
    if (!t) throw new ConvexError({ code: "NOT_FOUND" });
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
    await audit(ctx, staff, "tour.status", "tours", String(id), { status: t.status }, { status });
    return null;
  },
});

export const duplicate = mutation({
  args: { id: v.id("tours") },
  returns: v.id("tours"),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const t = await ctx.db.get(id);
    if (!t) throw new ConvexError({ code: "NOT_FOUND" });
    const { _id, _creationTime, ...rest } = t;
    void _id; void _creationTime;
    const copy = { ...rest, code: `${t.code}-COPY`, slug: { en: `${t.slug.en}-copy`, ar: `${t.slug.ar}-نسخة` }, status: "draft" as const, isFeatured: false, updatedAt: Date.now() };
    const newId = await ctx.db.insert("tours", copy);
    await audit(ctx, staff, "tour.duplicate", "tours", String(newId), undefined, { from: String(id) });
    return newId;
  },
});

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export const addMedia = mutation({
  args: { tourId: v.id("tours"), media: mediaValidator },
  returns: v.id("tourMedia"),
  handler: async (ctx, { tourId, media }) => {
    await requireStaff(ctx);
    const existing = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", tourId)).take(100);
    return await ctx.db.insert("tourMedia", { tourId, media, order: existing.length });
  },
});

export const removeMedia = mutation({
  args: { id: v.id("tourMedia") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const m = await ctx.db.get(id);
    if (!m) return null;
    if (m.media.storageId) await ctx.storage.delete(m.media.storageId).catch(() => {});
    await ctx.db.delete(id);
    return null;
  },
});

export const reorderMedia = mutation({
  args: { tourId: v.id("tours"), orderedIds: v.array(v.id("tourMedia")) },
  returns: v.null(),
  handler: async (ctx, { tourId, orderedIds }) => {
    await requireStaff(ctx);
    for (const [i, id] of orderedIds.entries()) {
      const m = await ctx.db.get(id);
      if (m && m.tourId === tourId) await ctx.db.patch(id, { order: i });
    }
    return null;
  },
});

export const setCoverFromMedia = mutation({
  args: { tourId: v.id("tours"), mediaId: v.id("tourMedia") },
  returns: v.null(),
  handler: async (ctx, { tourId, mediaId }) => {
    await requireStaff(ctx);
    const m = await ctx.db.get(mediaId);
    if (!m || m.tourId !== tourId) throw new ConvexError({ code: "NOT_FOUND" });
    const url = m.media.url ?? (m.media.storageId ? await ctx.storage.getUrl(m.media.storageId) : undefined);
    await ctx.db.patch(tourId, { coverImage: { ...m.media, url: url ?? undefined }, updatedAt: Date.now() });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Seasons, availability, add-ons                                      */
/* ------------------------------------------------------------------ */

export const upsertSeason = mutation({
  args: { id: v.optional(v.id("pricingSeasons")), tourId: v.id("tours"), name: localized, startDate: v.string(), endDate: v.string(), priceGroupOmr: v.optional(v.number()), priceAdultOmr: v.optional(v.number()), priceChildOmr: v.optional(v.number()), isActive: v.boolean() },
  returns: v.id("pricingSeasons"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const omr = (x?: number) => (x === undefined ? undefined : Math.round(x * 1000));
    const doc = { tourId: args.tourId, name: args.name, startDate: args.startDate, endDate: args.endDate, priceGroup: omr(args.priceGroupOmr), priceAdult: omr(args.priceAdultOmr), priceChild: omr(args.priceChildOmr), isActive: args.isActive };
    if (args.id) { await ctx.db.patch(args.id, doc); return args.id; }
    return await ctx.db.insert("pricingSeasons", doc);
  },
});

export const removeSeason = mutation({
  args: { id: v.id("pricingSeasons") },
  returns: v.null(),
  handler: async (ctx, { id }) => { await requireStaff(ctx); await ctx.db.delete(id); return null; },
});

export const setAvailability = mutation({
  args: { tourId: v.id("tours"), date: v.string(), startTime: v.optional(v.string()), capacity: v.optional(v.number()), isBlackout: v.boolean(), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new ConvexError({ code: "NOT_FOUND" });
    const rows = await ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", args.tourId).eq("date", args.date)).take(20);
    const existing = rows.find((r) => (r.startTime ?? null) === (args.startTime ?? null));
    const doc = { tourId: args.tourId, date: args.date, startTime: args.startTime, capacity: args.capacity ?? tour.defaultCapacityPerSlot, booked: existing?.booked ?? 0, isBlackout: args.isBlackout, note: args.note };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("availability", doc);
    await audit(ctx, staff, "tour.availability", "tours", String(args.tourId), undefined, { date: args.date, startTime: args.startTime, isBlackout: args.isBlackout, capacity: doc.capacity });
    return null;
  },
});

export const clearAvailability = mutation({
  args: { id: v.id("availability") },
  returns: v.null(),
  handler: async (ctx, { id }) => { await requireStaff(ctx); await ctx.db.delete(id); return null; },
});

export const upsertAddOn = mutation({
  args: { id: v.optional(v.id("addOns")), tourId: v.optional(v.id("tours")), key: v.string(), name: localized, description: localizedOptional, priceOmr: v.number(), priceType: v.union(v.literal("per_booking"), v.literal("per_person")), isActive: v.boolean(), order: v.number() },
  returns: v.id("addOns"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = { tourId: args.tourId, key: args.key, name: args.name, description: args.description, price: Math.round(Math.max(0, args.priceOmr) * 1000), priceType: args.priceType, isActive: args.isActive, order: args.order };
    if (args.id) { await ctx.db.patch(args.id, doc); return args.id; }
    return await ctx.db.insert("addOns", doc);
  },
});

export const listAddOns = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return await ctx.db.query("addOns").take(200); },
});

/* ------------------------------------------------------------------ */
/* Categories & destinations                                           */
/* ------------------------------------------------------------------ */

export const taxonomies = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [categories, destinations] = await Promise.all([ctx.db.query("categories").withIndex("by_order").take(100), ctx.db.query("destinations").withIndex("by_order").take(100)]);
    return { categories, destinations };
  },
});

export const upsertCategory = mutation({
  args: { id: v.optional(v.id("categories")), key: v.string(), name: localized, slug: localizedOptional, description: localizedOptional, icon: v.optional(v.string()), order: v.number(), isActive: v.boolean() },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = { key: args.key, name: args.name, slug: { en: slugify(args.slug?.en || args.name.en), ar: slugify(args.slug?.ar || args.name.ar) }, description: args.description, icon: args.icon, order: args.order, isActive: args.isActive };
    if (args.id) { await ctx.db.patch(args.id, doc); return args.id; }
    return await ctx.db.insert("categories", doc);
  },
});

export const upsertDestination = mutation({
  args: { id: v.optional(v.id("destinations")), key: v.string(), name: localized, slug: localizedOptional, tagline: localizedOptional, description: localizedOptional, region: v.optional(v.string()), image: v.optional(mediaValidator), lat: v.optional(v.number()), lng: v.optional(v.number()), order: v.number(), isActive: v.boolean() },
  returns: v.id("destinations"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const doc = { key: args.key, name: args.name, slug: { en: slugify(args.slug?.en || args.name.en), ar: slugify(args.slug?.ar || args.name.ar) }, tagline: args.tagline, description: args.description, region: args.region, image: args.image, lat: args.lat, lng: args.lng, order: args.order, isActive: args.isActive };
    if (args.id) { await ctx.db.patch(args.id, doc); return args.id; }
    return await ctx.db.insert("destinations", doc);
  },
});

/* ------------------------------------------------------------------ */
/* Bulk import (JSON template)                                         */
/* ------------------------------------------------------------------ */

export const importTours = mutation({
  args: { tours: v.array(v.any()) },
  returns: v.object({ created: v.number(), updated: v.number(), errors: v.array(v.string()) }),
  handler: async (ctx, { tours }) => {
    const staff = await requireStaff(ctx);
    const categories = await ctx.db.query("categories").take(100);
    const destinations = await ctx.db.query("destinations").take(100);
    let created = 0, updated = 0;
    const errors: string[] = [];
    const L = (x: unknown, fallback = ""): { en: string; ar: string } => (x && typeof x === "object" && "en" in (x as object) ? { en: String((x as { en?: string }).en ?? fallback), ar: String((x as { ar?: string }).ar ?? (x as { en?: string }).en ?? fallback) } : { en: String(x ?? fallback), ar: String(x ?? fallback) });
    const LArr = (x: unknown): { en: string; ar: string }[] => (Array.isArray(x) ? x.map((i) => L(i)) : typeof x === "string" ? x.split("|").filter(Boolean).map((s) => L(s)) : []);
    for (const [i, raw] of tours.slice(0, 200).entries()) {
      try {
        const r = raw as Record<string, unknown>;
        const code = String(r.code ?? "").trim();
        if (!code) throw new Error("missing code");
        const category = categories.find((c) => c.key === r.category_key);
        if (!category) throw new Error(`unknown category_key ${String(r.category_key)}`);
        const destKeys = Array.isArray(r.destination_keys) ? r.destination_keys : String(r.destination_keys ?? "").split("|").filter(Boolean);
        const destinationIds = destKeys.map((k) => destinations.find((d) => d.key === k)?._id).filter((x): x is Id<"destinations"> => !!x);
        const pricingModel: "per_group" | "per_person" = r.pricing_model === "per_group" ? "per_group" : "per_person";
        const omr = (x: unknown) => (x === undefined || x === null || x === "" ? undefined : Math.round(Number(x) * 1000));
        const title = L(r.title);
        const priceGroup = omr(r.price_group_omr);
        const priceAdult = omr(r.price_adult_omr);
        const doc = {
          code,
          kind: r.kind === "service" ? ("service" as const) : ("tour" as const),
          title,
          slug: { en: slugify(String((r.slug as { en?: string })?.en ?? r.slug_en ?? title.en)), ar: slugify(String((r.slug as { ar?: string })?.ar ?? r.slug_ar ?? title.ar)) },
          summary: L(r.summary),
          description: L(r.description),
          highlights: LArr(r.highlights),
          itinerary: Array.isArray(r.itinerary) ? (r.itinerary as { time?: string; title: unknown; body: unknown }[]).map((d) => ({ time: d.time, title: L(d.title), body: L(d.body) })) : [],
          inclusions: LArr(r.inclusions),
          exclusions: LArr(r.exclusions),
          faqs: Array.isArray(r.faqs) ? (r.faqs as { question: unknown; answer: unknown }[]).map((f) => ({ question: L(f.question), answer: L(f.answer) })) : [],
          categoryId: category._id,
          destinationIds,
          durationLabel: L(r.duration_label, "1 day"),
          durationMinutes: Number(r.duration_minutes ?? 480),
          durationDays: Number(r.duration_days ?? 1),
          startTimes: Array.isArray(r.start_times) ? (r.start_times as string[]) : String(r.start_times ?? "08:00").split("|"),
          pickupIncluded: String(r.pickup_included ?? "true") === "true",
          guideLanguages: Array.isArray(r.guide_languages) ? (r.guide_languages as string[]) : String(r.guide_languages ?? "en|ar").split("|"),
          minGroup: Number(r.min_group ?? 1),
          maxGroup: Number(r.max_group ?? 6),
          defaultCapacityPerSlot: Number(r.capacity_per_slot ?? r.max_group ?? 6),
          difficulty: (["easy", "moderate", "challenging"] as const).find((d) => d === r.difficulty),
          pricingModel: pricingModel as "per_group" | "per_person",
          priceGroup,
          priceAdult,
          priceChild: omr(r.price_child_omr),
          childAgeMax: r.child_age_max ? Number(r.child_age_max) : undefined,
          infantAgeMax: 2,
          priceFrom: pricingModel === "per_group" ? priceGroup ?? 0 : priceAdult ?? 0,
          depositPercent: Number(r.deposit_percent ?? 100),
          freeCancellationHours: Number(r.free_cancellation_hours ?? 24),
          allowReserveNowPayLater: true,
          holdHours: 24,
          coverImage: r.cover_image_url ? { kind: "image" as const, url: String(r.cover_image_url), alt: title } : undefined,
          ratingAverage: 0,
          ratingCount: 0,
          status: r.status === "published" ? ("published" as const) : ("draft" as const),
          isFeatured: false,
          tags: Array.isArray(r.tags) ? (r.tags as string[]) : String(r.tags ?? "").split("|").filter(Boolean),
          searchText: `${title.en} ${title.ar}`,
          updatedAt: Date.now(),
        };
        const existing = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
        if (existing) { await ctx.db.patch(existing._id, doc); updated++; }
        else { await ctx.db.insert("tours", doc); created++; }
      } catch (err) {
        errors.push(`row ${i + 1}: ${(err as Error).message}`);
      }
    }
    await audit(ctx, staff, "tour.import", "tours", undefined, undefined, { created, updated, errors: errors.length });
    return { created, updated, errors };
  },
});

export type AdminTour = Doc<"tours">;
