import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { syncCatalogFromSeed } from "./lib/catalogSync";
import { POLICY_TEXTS } from "./seedData/policyTexts2026";
import { RETIRED_TOUR_CODES, toursSeed } from "./seedData/tours";
import { addOnsSeed } from "./seedData/misc";
import { CAPACITY_STATUSES, remainingCapacity, slotOf } from "./lib/capacity";
import { capacityUnits } from "./lib/pricing";
import { lastTourDay, omanTodayIso } from "./lib/dates";
import { roomsFaq } from "./seedData/tourSeedTypes";

/**
 * One-off data migrations, run with `npx convex run migrations:<name> [--prod]`.
 * They are idempotent: running them twice changes nothing the second time.
 */

/** Publishes the September 2026 wording of the payment, cancellation, refund and waiver policies as a new version. */
export const publishSeededPolicies = internalMutation({
  args: { changeNote: v.optional(v.string()) },
  returns: v.array(v.object({ key: v.string(), version: v.number(), changed: v.boolean() })),
  handler: async (ctx, { changeNote }) => {
    const out: { key: string; version: number; changed: boolean }[] = [];
    for (const key of Object.keys(POLICY_TEXTS) as (keyof typeof POLICY_TEXTS)[]) {
      const policy = await ctx.db.query("policies").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (!policy) continue;
      const latest = (await ctx.db.query("policyVersions").withIndex("by_policy_version", (q) => q.eq("policyId", policy._id)).order("desc").take(1))[0];
      const body = POLICY_TEXTS[key];
      if (latest && latest.body.en === body.en && latest.body.ar === body.ar) {
        out.push({ key, version: latest.version, changed: false });
        continue;
      }
      const version = (latest?.version ?? 0) + 1;
      const vid = await ctx.db.insert("policyVersions", { policyId: policy._id, version, body, effectiveAt: Date.now(), changeNote: changeNote ?? "Official terms, September 2026" });
      await ctx.db.patch(policy._id, { currentVersionId: vid });
      out.push({ key, version, changed: true });
    }
    return out;
  },
});

/** Aligns every tour with the published terms: 35% deposit, free cancellation 72 h (day tours) or 30 days (multi-day). */
export const applyPolicyTerms = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const tours = await ctx.db.query("tours").take(500);
    let updated = 0;
    for (const t of tours) {
      const freeCancellationHours = t.durationDays > 1 ? 24 * 30 : 72;
      const depositPercent = 35;
      if (t.depositPercent !== depositPercent || t.freeCancellationHours !== freeCancellationHours) {
        await ctx.db.patch(t._id, { depositPercent, freeCancellationHours, updatedAt: Date.now() });
        updated += 1;
      }
    }
    return { updated, total: tours.length };
  },
});

/**
 * Replaces the demo catalogue with the real Viator product list (September 2026):
 * upserts categories, destinations and the 24 tours/services by code, and archives
 * retired seed tours. Bookings, reviews and uploaded media on existing tours are kept.
 */
export const syncCatalog2026 = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), updated: v.number(), archived: v.number(), categories: v.number(), destinations: v.number(), startTimesKept: v.array(v.string()) }),
  handler: async (ctx) => {
    const now = Date.now();
    const { categoryIds, destinationIds, inserted, updated, startTimesKept } = await syncCatalogFromSeed(ctx, now);
    let archived = 0;
    for (const code of RETIRED_TOUR_CODES) {
      const t = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (t && t.status !== "archived") {
        await ctx.db.patch(t._id, { status: "archived", isFeatured: false, featuredOrder: undefined, updatedAt: now });
        archived += 1;
      }
    }
    return { inserted, updated, archived, categories: categoryIds.size, destinations: destinationIds.size, startTimesKept };
  },
});

/**
 * Re-syncs one tour from its seed entry (title, texts, prices, logistics) after
 * editing `convex/seedData/tours*.ts`. Photos, ratings, status and bookings are kept.
 */
export const syncTourFromSeed = internalMutation({
  args: { code: v.string() },
  returns: v.object({ inserted: v.number(), updated: v.number(), startTimesKept: v.array(v.string()) }),
  handler: async (ctx, { code }) => {
    const { inserted, updated, startTimesKept } = await syncCatalogFromSeed(ctx, Date.now(), { codes: [code] });
    return { inserted, updated, startTimesKept };
  },
});

/** Turns legacy plain-string destination regions into bilingual {en, ar} objects. */
export const localizeDestinationRegions = internalMutation({
  args: {},
  returns: v.object({ updated: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const AR: Record<string, string> = {
      "Muscat Governorate": "محافظة مسقط",
      "Ad Dakhiliyah": "محافظة الداخلية",
      "Ash Sharqiyah": "محافظة جنوب الشرقية",
      "Dhofar": "محافظة ظفار",
      "Musandam Governorate": "محافظة مسندم",
      "South Al Batinah": "محافظة جنوب الباطنة",
    };
    const rows = await ctx.db.query("destinations").take(100);
    let updated = 0;
    for (const d of rows) {
      if (typeof d.region !== "string") continue;
      await ctx.db.patch(d._id, { region: { en: d.region, ar: AR[d.region] ?? d.region } });
      updated += 1;
    }
    return { updated, total: rows.length };
  },
});

/**
 * Scopes the tour-only global extras (senior guide, restaurant lunch, photo package) to tours, and marks the shared
 * group trips and tickets as shared departures, from the seed. Only fills fields staff have not set.
 */
export const scopeAddOnsAndDepartures = internalMutation({
  args: {},
  returns: v.object({ addOns: v.number(), tours: v.number() }),
  handler: async (ctx) => {
    let addOns = 0;
    for (const a of addOnsSeed) {
      if (!a.appliesToKinds) continue;
      const row = await ctx.db.query("addOns").withIndex("by_key", (q) => q.eq("key", a.key)).unique();
      if (row && !row.appliesToKinds?.length) {
        await ctx.db.patch(row._id, { appliesToKinds: a.appliesToKinds });
        addOns += 1;
      }
    }
    let tours = 0;
    for (const t of toursSeed) {
      if (!t.departureType) continue;
      const row = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", t.code)).unique();
      if (row && !row.departureType) {
        await ctx.db.patch(row._id, { departureType: t.departureType, updatedAt: Date.now() });
        tours += 1;
      }
    }
    return { addOns, tours };
  },
});

/**
 * Writes an explicit start time on every booking that holds a place but has none (older manual bookings), using the
 * tour's current first departure, which is where capacity counts them today. Afterwards reordering or editing the
 * tour's start times can no longer move them silently. Also lists active upcoming bookings at a time the tour no
 * longer runs, for staff to move with "Change booking" (they are shown on the dashboard too).
 */
export const fillBlankBookingStartTimes = internalMutation({
  args: {},
  returns: v.object({ filled: v.array(v.string()), offSchedule: v.array(v.object({ reference: v.string(), date: v.string(), startTime: v.string() })) }),
  handler: async (ctx) => {
    const filled: string[] = [];
    const offSchedule: { reference: string; date: string; startTime: string }[] = [];
    const today = omanTodayIso();
    const tours = new Map<string, { startTimes: string[] } | null>();
    for (const status of CAPACITY_STATUSES) {
      const rows = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", status)).take(5000);
      for (const b of rows) {
        if (!tours.has(String(b.tourId))) tours.set(String(b.tourId), await ctx.db.get(b.tourId));
        const tour = tours.get(String(b.tourId));
        if (!tour) continue;
        if (!b.startTime) {
          if (!tour.startTimes[0]) continue;
          await ctx.db.patch(b._id, { startTime: tour.startTimes[0], updatedAt: Date.now() });
          filled.push(b.reference);
        } else if (b.date >= today && !tour.startTimes.includes(b.startTime)) {
          offSchedule.push({ reference: b.reference, date: b.date, startTime: b.startTime });
        }
      }
    }
    return { filled, offSchedule };
  },
});

/**
 * Puts bookings that were marked in progress or completed before their departure back to confirmed (staff could do
 * this before the status workflow checked dates, which released their place for resale). Each change is audited.
 * The booking always keeps its place; when its departure has since been sold to others and is now over capacity, it
 * is also flagged (needsAttention, "overbooked_after_revert") and returned with overbooked: true, so the owner knows
 * which departures to sort out after the run.
 */
export const revertEarlyCompletedBookings = internalMutation({
  args: {},
  returns: v.array(v.object({ reference: v.string(), date: v.string(), from: v.string(), overbooked: v.optional(v.boolean()) })),
  handler: async (ctx) => {
    const today = omanTodayIso();
    const out: { reference: string; date: string; from: string; overbooked?: boolean }[] = [];
    for (const status of ["in_progress", "completed"] as const) {
      const rows = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", status).gt("date", today)).take(500);
      for (const b of rows) {
        const tour = await ctx.db.get(b.tourId);
        // Counted before the revert, excluding itself; earlier reverted rows on the same departure already count
        const overbooked = !!tour && (await remainingCapacity(ctx, tour, b.date, slotOf(tour, b), { excludeBookingId: b._id })) < capacityUnits(tour, b.adults, b.children);
        await ctx.db.patch(b._id, { status: "confirmed", completedAt: undefined, updatedAt: Date.now(), ...(overbooked ? { needsAttention: true, attentionReason: "overbooked_after_revert" } : {}) });
        await ctx.db.insert("auditLogs", { action: "booking.early_completion_reverted", entityType: "bookings", entityId: b._id, before: { status }, after: { status: "confirmed", overbooked: overbooked || undefined }, createdAt: Date.now() });
        out.push({ reference: b.reference, date: b.date, from: status, ...(overbooked ? { overbooked: true } : {}) });
      }
    }
    return out;
  },
});

/**
 * Replaces the multi-day "family of four" FAQ, which promised a discounted per-person rate for four travellers that the
 * booking engine never charges, with the corrected seed wording (roomsFaq). Only that one FAQ entry is touched, so
 * staff edits to the rest of each tour are kept. Idempotent: run on dev, then once with --prod.
 */
export const fixRoomsFaq = internalMutation({
  args: {},
  returns: v.object({ updated: v.array(v.string()) }),
  handler: async (ctx) => {
    const updated: string[] = [];
    for (const code of ["OCT-008", "OCT-009", "OCT-010", "OCT-016", "OCT-017", "OCT-018", "OCT-019", "OCT-020", "OCT-021"]) {
      const t = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
      if (!t) continue;
      let changed = false;
      const faqs = t.faqs.map((f) => {
        const isRoomsFaq = f.question.en === roomsFaq.question.en || f.answer.en.includes("discounted per-person rate");
        if (!isRoomsFaq || (f.answer.en === roomsFaq.answer.en && f.answer.ar === roomsFaq.answer.ar)) return f;
        changed = true;
        return { ...f, question: roomsFaq.question, answer: roomsFaq.answer };
      });
      if (changed) {
        await ctx.db.patch(t._id, { faqs, updatedAt: Date.now() });
        updated.push(code);
      }
    }
    return { updated };
  },
});

/**
 * Writes bookings.endDate (the trip's last day: date + durationDays - 1) on every booking that has none, so the
 * lifecycle job and the "today" views follow multi-day trips. Paged: run again with the returned cursor until done is
 * true. Idempotent.
 */
export const backfillBookingEndDates = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ updated: v.number(), done: v.boolean(), cursor: v.string() }),
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("bookings").paginate({ cursor: cursor ?? null, numItems: 500 });
    const tours = new Map<string, Doc<"tours"> | null>();
    let updated = 0;
    for (const b of page.page) {
      if (b.endDate) continue;
      if (!tours.has(String(b.tourId))) tours.set(String(b.tourId), await ctx.db.get(b.tourId));
      await ctx.db.patch(b._id, { endDate: lastTourDay(b.date, tours.get(String(b.tourId))?.durationDays) });
      updated++;
    }
    return { updated, done: page.isDone, cursor: page.continueCursor };
  },
});
