import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { assertInt, audit, requireStaff } from "../lib/access";
import { faqValidator, itineraryDayValidator, localized, localizedOptional, mediaValidator, pricingModelValidator, seoValidator } from "../schema";
import { releaseStorageRefs } from "../lib/mediaRefs";
import { isVehicleModel, MULTIDAY_VEHICLE_SEATS, priceFromOf, pricingProblem } from "../lib/pricing";
import { isRealIsoDate, normalizeStartTimes, omanTodayIso } from "../lib/dates";
import { activeBookingsBetween, activeBookingsOn, bookedUnits, overridesOn, refreshBookingEndDates, slotCapacity, startTimeChangeImpact, UNLIMITED_CAPACITY } from "../lib/capacity";

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

/** Seasons read for the tour editor, newest start first; only current and upcoming ones are shown. */
const SEASON_LIST_LIMIT = 200;

/** Upcoming availability overrides listed in the tour editor (each range apply can write one row per day). */
const AVAILABILITY_LIST_LIMIT = 400;

export const get = query({
  args: { id: v.id("tours") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const t = await ctx.db.get(id);
    if (!t) return null;
    // Overrides from today on (past rows no longer matter and would crowd out the newest ones)
    const today = omanTodayIso();
    const [media, seasons, overrides, addOns] = await Promise.all([
      ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", id)).take(50),
      // Newest seasons first (the oldest 50 would hide new ones); seasons that ended are left out below
      ctx.db.query("pricingSeasons").withIndex("by_tour", (q) => q.eq("tourId", id)).order("desc").take(SEASON_LIST_LIMIT),
      ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", id).gte("date", today)).take(AVAILABILITY_LIST_LIMIT + 1),
      ctx.db.query("addOns").withIndex("by_tour", (q) => q.eq("tourId", id)).take(50),
    ]);
    const mediaWithUrls = await Promise.all(media.map(async (m) => ({ ...m, url: m.media.url ?? (m.media.storageId ? await ctx.storage.getUrl(m.media.storageId) : null) })));
    // availability.booked is never maintained; show what is really booked, counted like the booking engine (lib/capacity)
    const shown = overrides.slice(0, AVAILABILITY_LIST_LIMIT);
    const active = shown.length > 0 ? await activeBookingsBetween(ctx, id, shown[0].date, shown[shown.length - 1].date) : [];
    const availability = shown.map((a) => ({
      ...a,
      booked: a.startTime ? bookedUnits(t, active, a.date, a.startTime) : t.startTimes.reduce((sum, time) => sum + bookedUnits(t, active, a.date, time), 0),
    }));
    const currentSeasons = seasons.filter((s) => s.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
    return { ...t, media: mediaWithUrls, seasons: currentSeasons, availability, availabilityTruncated: overrides.length > AVAILABILITY_LIST_LIMIT, addOns };
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
  /** Weekdays the tour runs, 0 = Sunday; omitted or empty = every day. */
  operatingWeekdays: v.optional(v.array(v.number())),
  /** Departure start dates (YYYY-MM-DD); when set, only these dates are bookable. */
  fixedDepartureDates: v.optional(v.array(v.string())),
  /** "shared" for group trips and tickets other guests also book; omitted = private. */
  departureType: v.optional(v.union(v.literal("private"), v.literal("shared"))),
  meetingPoint: v.optional(v.object({ label: localized, address: v.optional(v.string()), lat: v.optional(v.number()), lng: v.optional(v.number()), mapsUrl: v.optional(v.string()) })),
  pickupIncluded: v.boolean(),
  guideLanguages: v.array(v.string()),
  minGroup: v.number(),
  maxGroup: v.number(),
  defaultCapacityPerSlot: v.number(),
  /** Opt-in cap on units out at once on any day, across start times and overlapping multi-day trips; null clears it. */
  concurrentCapacity: v.optional(v.union(v.number(), v.null())),
  difficulty: v.optional(v.union(v.literal("easy"), v.literal("moderate"), v.literal("challenging"))),
  pricingModel: pricingModelValidator,
  priceGroupOmr: v.optional(v.number()),
  priceAdultOmr: v.optional(v.number()),
  priceChildOmr: v.optional(v.number()),
  /** Tiered pricing in OMR: totals for the first adult and the first two adults, then flat add-ons. */
  tieredOmr: v.optional(v.object({ firstAdult: v.number(), firstTwoAdults: v.number(), extraAdult: v.number(), extraChild: v.number() })),
  /** Per-vehicle pricing in OMR: a flat price per 4WD, with the vehicle's capacity. */
  vehicleOmr: v.optional(v.object({ pricePerVehicle: v.number(), maxAdults: v.number(), seats: v.number(), extraGuest: v.optional(v.number()), seats4: v.optional(v.array(v.number())), sharedRoom: v.optional(v.number()), singleRoom: v.optional(v.number()) })),
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

const timeRemapValidator = v.array(v.object({ from: v.string(), to: v.string() }));
type TimeRemap = { from: string; to: string }[];

/**
 * [D] The start times of a save or import row, normalised ("8:30" -> "08:30", deduped, sorted). Anything that is
 * not a time, or an empty list on a published tour, is INVALID_ARGUMENT field startTimes (the wizard could show such
 * a departure but bookings.create would refuse it at the last step).
 */
function cleanStartTimes(list: readonly string[], published: boolean): string[] {
  const { times, invalid } = normalizeStartTimes(list);
  if (invalid.length > 0 || times.length > 24 || (published && times.length === 0)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "startTimes", invalid });
  return times;
}

/**
 * Keeps upcoming bookings counted when a tour's start times change (capacity is counted per listed departure, so a
 * booking at a removed time would vanish from it and its seats or 4WDs could be sold again).
 * - Bookings with no stored time get the old first departure written on them, so a new first time cannot move them.
 * - Bookings at a removed time block the change (START_TIME_IN_USE) unless `remap` maps that time to a new one; they
 *   then move in this same mutation, with an audit row and a "booking updated" email each, and that time's upcoming
 *   availability overrides move with them (when the new time has none of its own that day).
 * - A move that leaves a receiving departure over its capacity throws REMAP_OVER_CAPACITY (rolling everything back)
 *   unless staff confirmed it (opts.override), like NEEDS_OVERRIDE for manual bookings.
 * Returns how many bookings were moved.
 */
async function applyStartTimeChange(
  ctx: MutationCtx,
  staff: Doc<"users"> | null,
  tour: Doc<"tours">,
  nextTimes: string[],
  remap: TimeRemap | undefined,
  opts: { override?: boolean; defaultCapacityPerSlot?: number } = {},
): Promise<number> {
  const unchanged = tour.startTimes.length === nextTimes.length && tour.startTimes.every((x, i) => x === nextTimes[i]);
  if (unchanged) return 0;
  const today = omanTodayIso();
  const { conflicts, blanks } = await startTimeChangeImpact(ctx, tour, nextTimes, today);
  const map = new Map<string, string>();
  for (const r of remap ?? []) {
    const [from] = normalizeStartTimes([r.from]).times;
    const [to] = normalizeStartTimes([r.to]).times;
    if (!from || !to || !nextTimes.includes(to)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "timeRemap" });
    map.set(from, to);
  }
  const unresolved = conflicts.filter((c) => !map.has(c.startTime));
  if (unresolved.length > 0) {
    throw new ConvexError({ code: "START_TIME_IN_USE", times: [...new Set(unresolved.map((c) => c.startTime))], references: unresolved.slice(0, 20).map((c) => c.reference), count: unresolved.length });
  }
  const now = Date.now();
  for (const b of blanks) await ctx.db.patch(b.bookingId, { startTime: b.startTime, updatedAt: now });
  for (const c of conflicts) {
    const to = map.get(c.startTime)!;
    await ctx.db.patch(c.bookingId, { startTime: to, updatedAt: now });
    await audit(ctx, staff, "booking.start_time_remapped", "bookings", String(c.bookingId), { startTime: c.startTime }, { startTime: to });
    await ctx.scheduler.runAfter(0, internal.bookingEmails.sendBookingChanged, { bookingId: c.bookingId });
  }
  const moved = [...map].filter(([from]) => !nextTimes.includes(from));
  if (moved.length > 0) {
    const rows = await ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", tour._id).gte("date", today)).take(5000);
    // Date/time pairs that have a row, kept current as rows move, so two removed times sent to the same new time
    // never leave two rows for one departure
    const taken = new Set(rows.map((r) => `${r.date}|${r.startTime ?? ""}`));
    for (const [from, to] of moved) {
      for (const row of rows.filter((r) => r.startTime === from)) {
        const key = `${row.date}|${to}`;
        if (taken.has(key)) continue;
        await ctx.db.patch(row._id, { startTime: to });
        taken.add(key);
      }
    }
  }
  if (!opts.override && conflicts.length > 0) {
    // Re-count every departure that received bookings, after the move (mutations read their own writes)
    const targets = new Map<string, { date: string; time: string; references: string[] }>();
    for (const c of conflicts) {
      const time = map.get(c.startTime)!;
      const key = `${c.date}|${time}`;
      const entry = targets.get(key) ?? { date: c.date, time, references: [] };
      entry.references.push(c.reference);
      targets.set(key, entry);
    }
    const capacityTour = { ...tour, defaultCapacityPerSlot: opts.defaultCapacityPerSlot ?? tour.defaultCapacityPerSlot };
    const over: { date: string; time: string; capacity: number; booked: number; references: string[] }[] = [];
    for (const g of targets.values()) {
      const capacity = slotCapacity(capacityTour, await overridesOn(ctx, tour._id, g.date), g.time);
      const booked = bookedUnits(capacityTour, await activeBookingsOn(ctx, tour._id, g.date), g.date, g.time);
      if (booked > capacity) over.push({ ...g, capacity, booked, references: g.references.slice(0, 10) });
    }
    if (over.length > 0) throw new ConvexError({ code: "REMAP_OVER_CAPACITY", departures: over.slice(0, 10), count: over.length });
  }
  return conflicts.length;
}

export const upsert = mutation({
  args: {
    id: v.optional(v.id("tours")),
    data: v.object(tourInput),
    /** Where upcoming bookings at a removed start time move (e.g. [{from: "08:00", to: "08:30"}]); see applyStartTimeChange. */
    timeRemap: v.optional(timeRemapValidator),
    /** Staff confirmed moving the bookings even though a receiving departure ends up over capacity (REMAP_OVER_CAPACITY). */
    remapOverride: v.optional(v.boolean()),
  },
  returns: v.id("tours"),
  handler: async (ctx, { id, data, timeRemap, remapOverride }) => {
    const staff = await requireStaff(ctx);
    const startTimes = cleanStartTimes(data.startTimes, data.status === "published");
    // Prices arrive in OMR; a NaN or absurd value would poison priceFrom and every quote
    const omr = (x: number | undefined, field: string) => {
      if (x === undefined) return undefined;
      if (!Number.isFinite(x) || x < 0 || x > 100_000) throw new ConvexError({ code: "INVALID_ARGUMENT", field });
      return Math.round(x * 1000);
    };
    assertInt(data.minGroup, 1, 200, "minGroup");
    assertInt(data.maxGroup, data.minGroup, 500, "maxGroup");
    assertInt(data.defaultCapacityPerSlot, 1, 500, "capacity");
    if (data.concurrentCapacity != null) assertInt(data.concurrentCapacity, 1, 5000, "concurrentCapacity");
    // Every tour takes a deposit (1-100%): 0% would promise "pay 0 now" and then charge the full price at checkout
    assertInt(data.depositPercent, 1, 100, "depositPercent");
    // Age bands follow these settings (infants 0..infantAgeMax, children ..childAgeMax, adults above), so they must not overlap
    const infantAgeMax = assertInt(data.infantAgeMax ?? 2, 0, 5, "infantAgeMax");
    if (data.childAgeMax !== undefined) assertInt(data.childAgeMax, infantAgeMax + 1, 17, "childAgeMax");
    assertInt(data.freeCancellationHours, 0, 720, "freeCancellationHours");
    assertInt(data.holdHours, 1, 168, "holdHours");
    assertInt(data.durationDays, 1, 60, "durationDays");
    // Operating rules: unique and sorted, and an empty list is stored as "not set" (runs every day)
    const operatingWeekdays = [...new Set(data.operatingWeekdays ?? [])].sort((a, b) => a - b);
    for (const d of operatingWeekdays) assertInt(d, 0, 6, "operatingWeekdays");
    const fixedDepartureDates = [...new Set((data.fixedDepartureDates ?? []).map((d) => d.trim()))].sort();
    if (fixedDepartureDates.length > 200) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "fixedDepartureDates" });
    for (const d of fixedDepartureDates) if (!isRealIsoDate(d)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "fixedDepartureDates" });
    const priceGroup = omr(data.priceGroupOmr, "priceGroupOmr");
    const priceAdult = omr(data.priceAdultOmr, "priceAdultOmr");
    const priceChild = omr(data.priceChildOmr, "priceChildOmr");
    const tieredPricing = data.tieredOmr
      ? {
          firstAdult: omr(data.tieredOmr.firstAdult, "tieredOmr")!,
          firstTwoAdults: omr(data.tieredOmr.firstTwoAdults, "tieredOmr")!,
          extraAdult: omr(data.tieredOmr.extraAdult, "tieredOmr")!,
          extraChild: omr(data.tieredOmr.extraChild, "tieredOmr")!,
        }
      : undefined;
    if (data.pricingModel === "per_vehicle_multiday") {
      if (data.durationDays < 2) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "durationDays" });
      if (data.vehicleOmr) data.vehicleOmr = { ...data.vehicleOmr, maxAdults: MULTIDAY_VEHICLE_SEATS, seats: MULTIDAY_VEHICLE_SEATS };
    }
    if (data.vehicleOmr) {
      assertInt(data.vehicleOmr.maxAdults, 1, 10, "vehicleMaxAdults");
      assertInt(data.vehicleOmr.seats, data.vehicleOmr.maxAdults, 16, "vehicleSeats");
    }
    // Multi-day 4WD: four seat prices (1st..4th guest) and the two room prices; pricePerVehicle mirrors the 1st seat
    const multiday = data.pricingModel === "per_vehicle_multiday" && data.vehicleOmr;
    const seatPrices = multiday && data.vehicleOmr!.seats4 ? data.vehicleOmr!.seats4.slice(0, MULTIDAY_VEHICLE_SEATS).map((p) => omr(p, "vehicleOmr")!) : undefined;
    if (seatPrices && seatPrices.length !== MULTIDAY_VEHICLE_SEATS) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "vehicleOmr" });
    const vehiclePricing = data.vehicleOmr
      ? {
          pricePerVehicle: seatPrices ? seatPrices[0] : omr(data.vehicleOmr.pricePerVehicle, "vehicleOmr")!,
          maxAdults: data.vehicleOmr.maxAdults,
          seats: data.vehicleOmr.seats,
          ...(multiday
            ? {
                ...(seatPrices ? { seatPrices } : {}),
                ...(data.vehicleOmr.singleRoom !== undefined ? { singleRoomPrice: omr(data.vehicleOmr.singleRoom, "vehicleOmr")! } : {}),
              }
            : {}),
        }
      : undefined;
    // Drafts may be saved before pricing is decided; a complete price is required only to publish.
    if (data.status === "published") {
      const problem = pricingProblem({ pricingModel: data.pricingModel, priceGroup, priceAdult, priceChild, tieredPricing, vehiclePricing });
      if (problem) throw new ConvexError({ code: "INVALID_ARGUMENT", field: problem });
    }
    const slug = { en: slugify(data.slug?.en || data.title.en), ar: slugify(data.slug?.ar || data.title.ar) };
    for (const l of ["en", "ar"] as const) {
      const clash = l === "en" ? await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug.en)).unique() : await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug.ar)).unique();
      if (clash && clash._id !== id) throw new ConvexError({ code: "SLUG_TAKEN", locale: l });
    }
    const codeClash = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", data.code)).unique();
    if (codeClash && codeClash._id !== id) throw new ConvexError({ code: "CODE_TAKEN" });

    const { priceGroupOmr: _a, priceAdultOmr: _b, priceChildOmr: _c, tieredOmr: _d, vehicleOmr: _e, compareAtPriceFromOmr, concurrentCapacity, ...rest } = data;
    void _a; void _b; void _c; void _d; void _e;
    const doc = {
      ...rest,
      slug,
      startTimes,
      operatingWeekdays: operatingWeekdays.length > 0 ? operatingWeekdays : undefined,
      fixedDepartureDates: fixedDepartureDates.length > 0 ? fixedDepartureDates : undefined,
      // Left as is when the caller does not send it; null (or nothing typed in the editor) turns it off
      ...(concurrentCapacity !== undefined ? { concurrentCapacity: concurrentCapacity ?? undefined } : {}),
      priceGroup,
      priceAdult,
      priceChild,
      tieredPricing,
      vehiclePricing,
      // 0 only for drafts without a price yet
      priceFrom: priceFromOf({ pricingModel: data.pricingModel, priceGroup, priceAdult, tieredPricing, vehiclePricing }),
      compareAtPriceFrom: omr(compareAtPriceFromOmr, "compareAt"),
      searchText: `${data.title.en} ${data.title.ar} ${data.summary.en} ${data.summary.ar} ${data.tags.join(" ")}`,
      updatedAt: Date.now(),
    };
    if (id) {
      const before = await ctx.db.get(id);
      if (!before) throw new ConvexError({ code: "NOT_FOUND" });
      const remapped = await applyStartTimeChange(ctx, staff, before, startTimes, timeRemap, { override: remapOverride, defaultCapacityPerSlot: data.defaultCapacityPerSlot });
      // A new length re-dates the end of running and upcoming trips (bookings.endDate)
      await refreshBookingEndDates(ctx, before, data.durationDays, omanTodayIso());
      await ctx.db.patch(id, doc);
      await audit(ctx, staff, "tour.update", "tours", String(id), { title: before.title, priceFrom: before.priceFrom, status: before.status, startTimes: before.startTimes }, { title: doc.title, priceFrom: doc.priceFrom, status: doc.status, startTimes, remapped: remapped || undefined });
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
    // The editor enforces this on save; the list's status switch must not be a way around it
    if (status === "published") {
      const problem = pricingProblem(t);
      if (problem) throw new ConvexError({ code: "PRICE_MISSING", field: problem });
    }
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
    await audit(ctx, staff, "tour.status", "tours", String(id), { status: t.status }, { status });
    return null;
  },
});

/** Bulk visibility: hide (draft), show (published) or archive several products at once. */
export const setStatusMany = mutation({
  args: { ids: v.array(v.id("tours")), status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")) },
  returns: v.object({ changed: v.number(), unpriced: v.array(v.string()) }),
  handler: async (ctx, { ids, status }) => {
    const staff = await requireStaff(ctx);
    let changed = 0;
    const unpriced: string[] = [];
    for (const id of ids.slice(0, 200)) {
      const t = await ctx.db.get(id);
      if (!t || t.status === status) continue;
      // Showing a tour with no complete price would let visitors book it for 0 OMR; leave it hidden and say so
      if (status === "published" && pricingProblem(t)) {
        unpriced.push(t.code);
        continue;
      }
      await ctx.db.patch(id, { status, updatedAt: Date.now() });
      await audit(ctx, staff, "tour.status", "tours", String(id), { status: t.status }, { status });
      changed += 1;
    }
    return { changed, unpriced };
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
    // A destination card, blog cover, tour cover or site setting may point at this same file,
    // by id or — for anything uploaded from the admin screens — by URL
    await releaseStorageRefs(ctx, [m.media]);
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
    // A season price replaces the tour price, so 0, negative or absurd values would sell tours free or broken
    for (const [field, x] of [["priceGroupOmr", args.priceGroupOmr], ["priceAdultOmr", args.priceAdultOmr], ["priceChildOmr", args.priceChildOmr]] as const) {
      if (x !== undefined && !(Number.isFinite(x) && x > 0 && x <= 100_000)) throw new ConvexError({ code: "INVALID_ARGUMENT", field });
    }
    if (args.priceGroupOmr === undefined && args.priceAdultOmr === undefined && args.priceChildOmr === undefined) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "price" });
    if (!isRealIsoDate(args.startDate) || !isRealIsoDate(args.endDate) || args.startDate > args.endDate) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "dates" });
    // Tiered and per-vehicle prices ignore seasons, so a season there would say "Saved" and never apply
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new ConvexError({ code: "NOT_FOUND" });
    if (tour.pricingModel === "tiered" || isVehicleModel(tour.pricingModel)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "pricingModel" });
    if (args.id) {
      const current = await ctx.db.get(args.id);
      if (!current || current.tourId !== args.tourId) throw new ConvexError({ code: "NOT_FOUND" });
    }
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
  args: {
    tourId: v.id("tours"),
    date: v.string(),
    /** Inclusive end of a date range (YYYY-MM-DD); omitted = single date. */
    toDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    capacity: v.optional(v.number()),
    isBlackout: v.boolean(),
    note: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new ConvexError({ code: "NOT_FOUND" });
    if (!isRealIsoDate(args.date)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
    if (args.toDate && !isRealIsoDate(args.toDate)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "toDate" });
    // Capacity is per start time: a row for an unknown time would never apply, and a fraction or negative would corrupt every count
    if (args.startTime !== undefined && !tour.startTimes.includes(args.startTime)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "startTime" });
    if (args.capacity !== undefined) assertInt(args.capacity, 0, 10_000, "capacity");
    const last = args.toDate && args.toDate > args.date ? args.toDate : args.date;
    const dates: string[] = [];
    for (let d = new Date(`${args.date}T00:00:00Z`); dates.length < 366; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > last) break;
      dates.push(iso);
    }
    for (const date of dates) {
      const rows = await ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", args.tourId).eq("date", date)).collect();
      const existing = rows.find((r) => (r.startTime ?? null) === (args.startTime ?? null));
      const doc = { tourId: args.tourId, date, startTime: args.startTime, capacity: args.capacity ?? UNLIMITED_CAPACITY, booked: existing?.booked ?? 0, isBlackout: args.isBlackout, note: args.note };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("availability", doc);
    }
    await audit(ctx, staff, "tour.availability", "tours", String(args.tourId), undefined, { date: args.date, toDate: last, startTime: args.startTime, isBlackout: args.isBlackout, capacity: args.capacity ?? tour.defaultCapacityPerSlot, days: dates.length });
    return dates.length;
  },
});

export const clearAvailability = mutation({
  args: { id: v.id("availability") },
  returns: v.null(),
  handler: async (ctx, { id }) => { await requireStaff(ctx); await ctx.db.delete(id); return null; },
});

export const upsertAddOn = mutation({
  args: {
    id: v.optional(v.id("addOns")),
    tourId: v.optional(v.id("tours")),
    key: v.string(),
    name: localized,
    description: localizedOptional,
    priceOmr: v.number(),
    priceType: v.union(v.literal("per_booking"), v.literal("per_person")),
    isActive: v.boolean(),
    order: v.number(),
    /** Product kinds the extra suits (omit or empty = every kind). */
    appliesToKinds: v.optional(v.array(v.union(v.literal("tour"), v.literal("service")))),
  },
  returns: v.id("addOns"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const kinds = args.appliesToKinds?.length ? [...new Set(args.appliesToKinds)] : undefined;
    const doc = { tourId: args.tourId, key: args.key, name: args.name, description: args.description, price: Math.round(Math.max(0, args.priceOmr) * 1000), priceType: args.priceType, isActive: args.isActive, order: args.order, appliesToKinds: kinds };
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
  args: { id: v.optional(v.id("destinations")), key: v.string(), name: localized, slug: localizedOptional, tagline: localizedOptional, description: localizedOptional, region: localizedOptional, image: v.optional(mediaValidator), lat: v.optional(v.number()), lng: v.optional(v.number()), order: v.number(), isActive: v.boolean() },
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

const PRICING_MODELS = ["per_group", "per_person", "tiered", "per_vehicle", "per_vehicle_multiday"] as const;
const PRICING_KEYS = ["pricing_model", "price_group_omr", "price_adult_omr", "price_child_omr", "tier_first_adult_omr", "tier_first_two_adults_omr", "tier_extra_adult_omr", "tier_extra_child_omr", "vehicle_price_omr", "vehicle_max_adults", "vehicle_seats", "seat1_omr", "seat2_omr", "seat3_omr", "seat4_omr", "single_room_omr"];
/** The template's sample row uses this prefix so trying the template can never overwrite a real product. */
const SAMPLE_CODE_RE = /^SAMPLE-/i;

/**
 * Bulk import from the JSON template (or CSV converted to JSON with the template's columns).
 * - Rows are matched by code. A new code creates a draft with the template defaults. An existing code is patched
 *   with the columns present in the row only (an empty cell counts as missing), so ratings, featured status, hold
 *   hours, pay-later, itinerary, FAQs, status and slug stay as they are unless the row sets them.
 * - Numbers are validated with the same limits as the editor (upsert); start times are normalised (normalizeStartTimes)
 *   and may not drop a time that still has upcoming bookings.
 * - SAMPLE-* codes (the template's sample row) are refused.
 * - dryRun validates every row and reports which codes would be created or updated, without writing.
 */
export const importTours = mutation({
  args: { tours: v.array(v.any()), dryRun: v.optional(v.boolean()) },
  returns: v.object({ created: v.number(), updated: v.number(), errors: v.array(v.string()), creates: v.array(v.string()), updates: v.array(v.string()), dryRun: v.boolean() }),
  handler: async (ctx, { tours, dryRun }) => {
    const staff = await requireStaff(ctx);
    const categories = await ctx.db.query("categories").take(100);
    const destinations = await ctx.db.query("destinations").take(100);
    const creates: string[] = [];
    const updates: string[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();
    const L = (x: unknown, fallback = ""): { en: string; ar: string } => (x && typeof x === "object" && "en" in (x as object) ? { en: String((x as { en?: string }).en ?? fallback), ar: String((x as { ar?: string }).ar ?? (x as { en?: string }).en ?? fallback) } : { en: String(x ?? fallback), ar: String(x ?? fallback) });
    const LArr = (x: unknown): { en: string; ar: string }[] => (Array.isArray(x) ? x.map((i) => L(i)) : typeof x === "string" ? x.split("|").filter(Boolean).map((s) => L(s)) : []);
    for (const [i, raw] of tours.slice(0, 200).entries()) {
      try {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
        const r = raw as Record<string, unknown>;
        const has = (k: string) => r[k] !== undefined && r[k] !== null && !(typeof r[k] === "string" && (r[k] as string).trim() === "");
        const str = (k: string) => String(r[k]).trim();
        const code = has("code") ? str("code") : "";
        if (!code) throw new Error("missing code");
        if (SAMPLE_CODE_RE.test(code)) throw new Error(`${code} is the template's sample row; give it a real product code`);
        if (seen.has(code)) throw new Error(`${code} appears more than once`);
        seen.add(code);
        const existing = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();

        // Readers: undefined when the row does not set the column (an empty cell included)
        const loc = (k: string): { en: string; ar: string } | undefined => {
          if (has(k)) return L(r[k]);
          if (!has(`${k}_en`) && !has(`${k}_ar`)) return undefined;
          const en = has(`${k}_en`) ? str(`${k}_en`) : str(`${k}_ar`);
          return { en, ar: has(`${k}_ar`) ? str(`${k}_ar`) : en };
        };
        const split = (x: unknown) => (Array.isArray(x) ? x.map(String) : String(x).split("|")).map((s) => s.trim()).filter(Boolean);
        const locList = (k: string): { en: string; ar: string }[] | undefined => {
          if (has(k)) return LArr(r[k]);
          if (!has(`${k}_en`) && !has(`${k}_ar`)) return undefined;
          const en = has(`${k}_en`) ? split(r[`${k}_en`]) : [];
          const ar = has(`${k}_ar`) ? split(r[`${k}_ar`]) : [];
          return (en.length ? en : ar).map((e, j) => ({ en: e, ar: ar[j] ?? e }));
        };
        const list = (k: string) => (has(k) ? split(r[k]) : undefined);
        const int = (k: string, lo: number, hi: number) => {
          if (!has(k)) return undefined;
          const n = Number(r[k]);
          if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`invalid ${k} (whole number ${lo}-${hi})`);
          return n;
        };
        const bool = (k: string) => {
          if (!has(k)) return undefined;
          const x = str(k).toLowerCase();
          if (["true", "1", "yes"].includes(x)) return true;
          if (["false", "0", "no"].includes(x)) return false;
          throw new Error(`invalid ${k} (true or false)`);
        };
        const omr = (k: string) => {
          if (!has(k)) return undefined;
          const n = Number(r[k]);
          if (!Number.isFinite(n) || n < 0 || n > 100_000) throw new Error(`invalid ${k}`);
          return Math.round(n * 1000);
        };
        const oneOf = <T extends string>(k: string, allowed: readonly T[]): T | undefined => {
          if (!has(k)) return undefined;
          const x = str(k);
          if (!allowed.includes(x as T)) throw new Error(`invalid ${k} (${allowed.join(", ")})`);
          return x as T;
        };

        const patch: Partial<Doc<"tours">> = {};
        const kind = oneOf("kind", ["tour", "service"] as const);
        if (kind) patch.kind = kind;
        const title = loc("title");
        if (title) patch.title = title;
        else if (!existing) throw new Error("missing title");
        for (const [k, field] of [["summary", "summary"], ["description", "description"], ["duration_label", "durationLabel"]] as const) {
          const value = loc(k);
          if (value) patch[field] = value;
        }
        for (const [k, field] of [["highlights", "highlights"], ["inclusions", "inclusions"], ["exclusions", "exclusions"]] as const) {
          const value = locList(k);
          if (value) patch[field] = value;
        }
        if (has("itinerary")) {
          if (!Array.isArray(r.itinerary)) throw new Error("itinerary must be a list");
          patch.itinerary = (r.itinerary as { time?: string; title: unknown; body: unknown }[]).map((d) => ({ time: d.time, title: L(d.title), body: L(d.body) }));
        }
        if (has("faqs")) {
          if (!Array.isArray(r.faqs)) throw new Error("faqs must be a list");
          patch.faqs = (r.faqs as { question: unknown; answer: unknown }[]).map((f) => ({ question: L(f.question), answer: L(f.answer) }));
        }
        if (has("category_key")) {
          const category = categories.find((c) => c.key === str("category_key"));
          if (!category) throw new Error(`unknown category_key ${str("category_key")}`);
          patch.categoryId = category._id;
        } else if (!existing) throw new Error("missing category_key");
        const destKeys = list("destination_keys");
        if (destKeys) {
          const unknown = destKeys.filter((k) => !destinations.some((d) => d.key === k));
          if (unknown.length) throw new Error(`unknown destination_keys ${unknown.join(", ")}`);
          patch.destinationIds = destKeys.map((k) => destinations.find((d) => d.key === k)!._id);
        }
        const durationMinutes = int("duration_minutes", 1, 60 * 24 * 60);
        if (durationMinutes !== undefined) patch.durationMinutes = durationMinutes;
        const durationDays = int("duration_days", 1, 60);
        if (durationDays !== undefined) patch.durationDays = durationDays;
        const status = oneOf("status", ["draft", "published", "archived"] as const);
        if (status) patch.status = status;
        const finalStatus = status ?? existing?.status ?? "draft";
        const startTimeList = list("start_times");
        if (startTimeList) patch.startTimes = cleanStartTimes(startTimeList, finalStatus === "published");
        else if (existing && finalStatus === "published" && existing.startTimes.length === 0) throw new Error("a published row needs start_times");
        const pickupIncluded = bool("pickup_included");
        if (pickupIncluded !== undefined) patch.pickupIncluded = pickupIncluded;
        const guideLanguages = list("guide_languages");
        if (guideLanguages) patch.guideLanguages = guideLanguages;
        // Group sizes and capacity: same limits as the editor, checked against the tour's current values
        const minGroup = int("min_group", 1, 200);
        const maxGroup = int("max_group", 1, 500);
        const capacity = int("capacity_per_slot", 1, 500);
        const min = minGroup ?? existing?.minGroup ?? 1;
        const max = maxGroup ?? existing?.maxGroup ?? 6;
        if (max < min) throw new Error("max_group must be at least min_group");
        if (minGroup !== undefined) patch.minGroup = minGroup;
        if (maxGroup !== undefined) patch.maxGroup = maxGroup;
        if (capacity !== undefined) patch.defaultCapacityPerSlot = capacity;
        const difficulty = oneOf("difficulty", ["easy", "moderate", "challenging"] as const);
        if (difficulty) patch.difficulty = difficulty;
        const childAgeMax = int("child_age_max", (existing?.infantAgeMax ?? 2) + 1, 17);
        if (childAgeMax !== undefined) patch.childAgeMax = childAgeMax;
        // Every tour takes a deposit (1-100%), as in the editor
        const depositPercent = int("deposit_percent", 1, 100);
        if (depositPercent !== undefined) patch.depositPercent = depositPercent;
        const freeCancellationHours = int("free_cancellation_hours", 0, 720);
        if (freeCancellationHours !== undefined) patch.freeCancellationHours = freeCancellationHours;
        const holdHours = int("hold_hours", 1, 168);
        if (holdHours !== undefined) patch.holdHours = holdHours;
        const payLater = bool("allow_reserve_now_pay_later");
        if (payLater !== undefined) patch.allowReserveNowPayLater = payLater;
        if (has("cover_image_url")) patch.coverImage = { kind: "image", url: str("cover_image_url"), alt: title ?? existing!.title };
        const tags = list("tags");
        if (tags) patch.tags = tags;
        // Slug: from the row when given, from the title for a new product, otherwise unchanged
        const slugObj = has("slug") && typeof r.slug === "object" ? (r.slug as { en?: string; ar?: string }) : undefined;
        const slugEn = slugObj?.en ?? (has("slug_en") ? str("slug_en") : undefined);
        const slugAr = slugObj?.ar ?? (has("slug_ar") ? str("slug_ar") : undefined);
        if (slugEn || slugAr || !existing) {
          const t = title ?? existing!.title;
          const slug = { en: slugify(slugEn || existing?.slug.en || t.en), ar: slugify(slugAr || existing?.slug.ar || t.ar) };
          if (!slug.en || !slug.ar) throw new Error("missing slug or title");
          const clashEn = await ctx.db.query("tours").withIndex("by_slug_en", (q) => q.eq("slug.en", slug.en)).unique();
          const clashAr = await ctx.db.query("tours").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug.ar)).unique();
          const clash = clashEn && clashEn.code !== code ? clashEn : clashAr && clashAr.code !== code ? clashAr : null;
          if (clash) throw new Error(`slug already used by ${clash.code}`);
          patch.slug = slug;
        }
        // Pricing is one block: when any pricing column is present, the model and prices are rebuilt from the row on
        // top of the current values (keys of models the tour no longer uses are cleared)
        if (!existing || PRICING_KEYS.some(has)) {
          const pricingModel = oneOf("pricing_model", PRICING_MODELS) ?? existing?.pricingModel ?? "per_person";
          const priceGroup = has("price_group_omr") ? omr("price_group_omr") : existing?.priceGroup;
          const priceAdult = has("price_adult_omr") ? omr("price_adult_omr") : existing?.priceAdult;
          const priceChild = has("price_child_omr") ? omr("price_child_omr") : existing?.priceChild;
          const tier = existing?.tieredPricing;
          const tieredPricing =
            pricingModel === "tiered"
              ? {
                  firstAdult: omr("tier_first_adult_omr") ?? tier?.firstAdult ?? 0,
                  firstTwoAdults: omr("tier_first_two_adults_omr") ?? tier?.firstTwoAdults ?? 0,
                  extraAdult: omr("tier_extra_adult_omr") ?? tier?.extraAdult ?? 0,
                  extraChild: omr("tier_extra_child_omr") ?? tier?.extraChild ?? 0,
                }
              : undefined;
          const vehicle = existing?.vehiclePricing;
          const multiday = pricingModel === "per_vehicle_multiday";
          const vehicleMaxAdults = multiday ? MULTIDAY_VEHICLE_SEATS : isVehicleModel(pricingModel) ? (int("vehicle_max_adults", 1, 10) ?? vehicle?.maxAdults ?? 4) : 0;
          const vehiclePricing =
            isVehicleModel(pricingModel)
              ? multiday
                ? (() => {
                    const seatPrices = [1, 2, 3, 4].map((n, i) => omr(`seat${n}_omr`) ?? vehicle?.seatPrices?.[i] ?? 0);
                    return { pricePerVehicle: seatPrices[0], maxAdults: MULTIDAY_VEHICLE_SEATS, seats: MULTIDAY_VEHICLE_SEATS, seatPrices, singleRoomPrice: omr("single_room_omr") ?? vehicle?.singleRoomPrice ?? undefined };
                  })()
                : { pricePerVehicle: omr("vehicle_price_omr") ?? vehicle?.pricePerVehicle ?? 0, maxAdults: vehicleMaxAdults, seats: int("vehicle_seats", vehicleMaxAdults, 16) ?? Math.max(vehicleMaxAdults, vehicle?.seats ?? 6) }
              : undefined;
          Object.assign(patch, { pricingModel, priceGroup, priceAdult, priceChild, tieredPricing, vehiclePricing, priceFrom: priceFromOf({ pricingModel, priceGroup, priceAdult, tieredPricing, vehiclePricing }) });
        }
        if (finalStatus === "published") {
          const problem = pricingProblem({ ...existing, ...patch } as Doc<"tours">);
          if (problem) throw new Error(`a published row needs a complete price (${problem})`);
        }

        const now = Date.now();
        if (existing) {
          if (patch.startTimes) {
            const { conflicts } = await startTimeChangeImpact(ctx, existing, patch.startTimes, omanTodayIso());
            if (conflicts.length) throw new Error(`start time ${[...new Set(conflicts.map((c) => c.startTime))].join(", ")} still has upcoming bookings (${conflicts.slice(0, 5).map((c) => c.reference).join(", ")}); move them in the tour editor`);
          }
          updates.push(code);
          if (dryRun) continue;
          if (patch.startTimes) await applyStartTimeChange(ctx, staff, existing, patch.startTimes, undefined);
          if (patch.durationDays !== undefined) await refreshBookingEndDates(ctx, existing, patch.durationDays, omanTodayIso());
          const merged = { ...existing, ...patch };
          await ctx.db.patch(existing._id, { ...patch, searchText: `${merged.title.en} ${merged.title.ar} ${merged.summary.en} ${merged.summary.ar} ${merged.tags.join(" ")}`, updatedAt: now });
        } else {
          creates.push(code);
          if (dryRun) continue;
          const doc = {
            code,
            kind: "tour" as const,
            summary: L(undefined),
            description: L(undefined),
            highlights: [],
            itinerary: [],
            inclusions: [],
            exclusions: [],
            faqs: [],
            destinationIds: [],
            durationLabel: L("1 day"),
            durationMinutes: 480,
            durationDays: 1,
            startTimes: ["08:00"],
            pickupIncluded: true,
            guideLanguages: ["en", "ar"],
            minGroup: min,
            maxGroup: max,
            defaultCapacityPerSlot: capacity ?? max,
            infantAgeMax: 2,
            // A blank deposit means full payment; 0% is refused (see upsert)
            depositPercent: 100,
            freeCancellationHours: 24,
            allowReserveNowPayLater: true,
            holdHours: 24,
            ratingAverage: 0,
            ratingCount: 0,
            status: "draft" as const,
            isFeatured: false,
            tags: [] as string[],
            ...patch,
            title: patch.title!,
            categoryId: patch.categoryId!,
            slug: patch.slug!,
            pricingModel: patch.pricingModel!,
            priceFrom: patch.priceFrom ?? 0,
            updatedAt: now,
          };
          await ctx.db.insert("tours", { ...doc, searchText: `${doc.title.en} ${doc.title.ar} ${doc.summary.en} ${doc.summary.ar} ${doc.tags.join(" ")}` });
        }
      } catch (err) {
        const data = err instanceof ConvexError ? (err.data as { code?: string; field?: string }) : undefined;
        errors.push(`row ${i + 1}: ${data?.code ? `${data.code}${data.field ? ` (${data.field})` : ""}` : (err as Error).message}`);
      }
    }
    if (!dryRun) await audit(ctx, staff, "tour.import", "tours", undefined, undefined, { created: creates.length, updated: updates.length, errors: errors.length, codes: [...creates, ...updates].slice(0, 50) });
    return { created: dryRun ? 0 : creates.length, updated: dryRun ? 0 : updates.length, errors, creates, updates, dryRun: !!dryRun };
  },
});

export type AdminTour = Doc<"tours">;
