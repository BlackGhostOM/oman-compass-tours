/**
 * Departure capacity, shared by bookings.quote, bookings.create, availability.forTour,
 * the staff status workflow and the admin overview, so they can never disagree.
 *
 * Units are those of capacityUnits(): seats for per_person tours, private departures for
 * per_group/tiered tours, and 4WDs for per_vehicle tours.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { addDaysIso, isOperatingDate, lastTourDay } from "./dates";
import { capacityUnits } from "./pricing";

/**
 * Owner rule: no departure is capped by default (vehicles and guides are added as needed). Only an availability
 * row staff add for a date limits or closes it; defaultCapacityPerSlot is kept as the dashboard's reference number.
 */
export const UNLIMITED_CAPACITY = 10_000;

/**
 * Statuses whose bookings occupy a place. An unexpired "inquiry" (reserve now, pay later) holds its place
 * exactly like an unpaid pay-now checkout; expireHold cancels either at holdExpiresAt.
 */
export const CAPACITY_STATUSES = ["inquiry", "pending_payment", "confirmed", "in_progress"] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];

export function countsForCapacity(status: Doc<"bookings">["status"]): status is CapacityStatus {
  return (CAPACITY_STATUSES as readonly string[]).includes(status);
}

/** Unpaid holds created on the website, capped per departure (siteSettings booking.maxUnpaidHoldsPerSlot). */
export const DEFAULT_MAX_UNPAID_HOLDS_PER_SLOT = 2;

type CapacityTour = Pick<Doc<"tours">, "_id" | "startTimes" | "defaultCapacityPerSlot" | "pricingModel" | "vehiclePricing" | "minGroup" | "maxGroup" | "durationDays"> & {
  operatingWeekdays?: number[];
  fixedDepartureDates?: string[];
  concurrentCapacity?: number;
};
type Override = Pick<Doc<"availability">, "startTime" | "capacity" | "isBlackout">;

/** The departure a booking belongs to (bookings without a time count against the first one). */
export const slotOf = (tour: Pick<Doc<"tours">, "startTimes">, b: Pick<Doc<"bookings">, "startTime">) => b.startTime || tour.startTimes[0];

/**
 * Capacity of one start time on one date, from that date's availability rows.
 * - A blackout row for the whole day ("All slots") or for this time closes it (0).
 * - Otherwise a row for this time wins, then an "All slots" row (its capacity applies to each start time),
 *   then the tour default.
 */
export function slotCapacity(tour: Pick<Doc<"tours">, "defaultCapacityPerSlot">, overrides: readonly Override[], time: string, fallback = UNLIMITED_CAPACITY): number {
  if (overrides.some((o) => o.isBlackout && (!o.startTime || o.startTime === time))) return 0;
  const slotRow = overrides.find((o) => o.startTime === time && !o.isBlackout);
  const dayRow = overrides.find((o) => !o.startTime && !o.isBlackout);
  const capacity = slotRow?.capacity ?? dayRow?.capacity ?? fallback;
  return Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : 0;
}

/** Units the smallest party the tour accepts would take: a slot with fewer left cannot be sold to anyone. */
export function smallestPartyUnits(tour: Pick<Doc<"tours">, "pricingModel" | "vehiclePricing" | "minGroup">): number {
  return Math.max(1, capacityUnits(tour, Math.max(1, tour.minGroup), 0));
}

export type SlotView = { time: string; remaining: number; capacity: number; bookable: boolean };

/**
 * What the calendar shows for one start time. bookable means the smallest allowed party still fits.
 * `limit` is what the tour's concurrent cap still allows that day (concurrentRemaining), when it has one.
 */
export function slotView(tour: Pick<Doc<"tours">, "pricingModel" | "vehiclePricing" | "minGroup">, time: string, capacity: number, booked: number, limit = Infinity): SlotView {
  const remaining = Math.max(0, Math.min(capacity - booked, limit));
  return { time, remaining, capacity, bookable: remaining > 0 && remaining >= smallestPartyUnits(tour) };
}

/** Days one departure spans (1 for day tours). */
export function tourSpanDays(tour: { durationDays?: number }): number {
  return Number.isFinite(tour.durationDays) ? Math.max(1, Math.floor(tour.durationDays!)) : 1;
}

/** The tour's opt-in concurrent cap (tours.concurrentCapacity), or null when departures are counted on their own. */
export function concurrentCap(tour: { concurrentCapacity?: number }): number | null {
  const c = tour.concurrentCapacity;
  return typeof c === "number" && Number.isFinite(c) && c >= 0 ? Math.floor(c) : null;
}

/**
 * [C] Units the tour's concurrent cap still allows for a trip starting on `date` (Infinity when the tour has none).
 * Every day the trip spans (date .. date + durationDays - 1) must have room: on day x the cap is that day's
 * "All slots" capacity row, else concurrentCapacity, minus every active booking out on x (any start time, and
 * multi-day bookings on each day they cover). A whole-day blackout on any spanned day gives 0.
 * `bookings` must cover date - (durationDays - 1) .. date + durationDays - 1; `overridesFor(day)` returns that day's rows.
 */
export function concurrentRemaining(
  tour: CapacityTour,
  bookings: readonly Doc<"bookings">[],
  overridesFor: (day: string) => readonly Override[],
  date: string,
  excludeBookingId?: Id<"bookings">,
): number {
  const cap = concurrentCap(tour);
  if (cap === null) return Infinity;
  const span = tourSpanDays(tour);
  const counted = bookings
    .filter((b) => b._id !== excludeBookingId && countsForCapacity(b.status))
    .map((b) => ({ from: b.date, to: lastTourDay(b.date, span), units: capacityUnits(tour, b.adults, b.children) }));
  let left = Infinity;
  for (let k = 0; k < span; k++) {
    const day = addDaysIso(date, k);
    const rows = overridesFor(day);
    if (rows.some((o) => o.isBlackout && !o.startTime)) return 0;
    const dayRow = rows.find((o) => !o.startTime && !o.isBlackout);
    const dayCap = dayRow && Number.isFinite(dayRow.capacity) ? Math.max(0, Math.floor(dayRow.capacity)) : cap;
    const out = counted.filter((b) => b.from <= day && day <= b.to).reduce((a, b) => a + b.units, 0);
    left = Math.min(left, dayCap - out);
  }
  return Math.max(0, left);
}

/** Every availability row of one date (bounded by startTimes + 1 per date, so collect is safe). */
export async function overridesOn(ctx: QueryCtx | MutationCtx, tourId: Id<"tours">, date: string) {
  return await ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", tourId).eq("date", date)).collect();
}

/** Bookings that occupy a place on one date, read per status through the index (cancelled rows are never read). */
export async function activeBookingsOn(ctx: QueryCtx | MutationCtx, tourId: Id<"tours">, date: string): Promise<Doc<"bookings">[]> {
  const perStatus = await Promise.all(
    CAPACITY_STATUSES.map((status) =>
      ctx.db.query("bookings").withIndex("by_tour_status_date", (q) => q.eq("tourId", tourId).eq("status", status).eq("date", date)).collect(),
    ),
  );
  return perStatus.flat();
}

/** Same as activeBookingsOn over an inclusive date range (for the calendar). */
export async function activeBookingsBetween(ctx: QueryCtx | MutationCtx, tourId: Id<"tours">, from: string, to: string): Promise<Doc<"bookings">[]> {
  const perStatus = await Promise.all(
    CAPACITY_STATUSES.map((status) =>
      ctx.db.query("bookings").withIndex("by_tour_status_date", (q) => q.eq("tourId", tourId).eq("status", status).gte("date", from).lte("date", to)).collect(),
    ),
  );
  return perStatus.flat();
}

/** Bookings that occupy a place on or after one date (a tour's upcoming departures). */
export async function activeBookingsFrom(ctx: QueryCtx | MutationCtx, tourId: Id<"tours">, from: string, limitPerStatus = 1000): Promise<Doc<"bookings">[]> {
  const perStatus = await Promise.all(
    CAPACITY_STATUSES.map((status) =>
      ctx.db.query("bookings").withIndex("by_tour_status_date", (q) => q.eq("tourId", tourId).eq("status", status).gte("date", from)).take(limitPerStatus),
    ),
  );
  return perStatus.flat();
}

/**
 * [C] After a tour's length changes, re-dates bookings.endDate (lastTourDay) on its running and upcoming active
 * bookings, so the hourly status job, the account's upcoming/past split and the dashboard's "on trip" list follow the
 * new length like capacity and the calendar file already do. Returns how many bookings changed.
 */
export async function refreshBookingEndDates(ctx: MutationCtx, tour: Pick<Doc<"tours">, "_id" | "durationDays">, nextDurationDays: number | undefined, today: string): Promise<number> {
  const oldSpan = tourSpanDays(tour);
  const newSpan = tourSpanDays({ durationDays: nextDurationDays });
  if (oldSpan === newSpan) return 0;
  let changed = 0;
  for (const b of await activeBookingsFrom(ctx, tour._id, addDaysIso(today, -(Math.max(oldSpan, newSpan) - 1)))) {
    const endDate = lastTourDay(b.date, newSpan);
    if (b.endDate === endDate) continue;
    await ctx.db.patch(b._id, { endDate });
    changed += 1;
  }
  return changed;
}

export type StartTimeConflict = { bookingId: Id<"bookings">; reference: string; date: string; startTime: string };

/**
 * [C] What a change of a tour's start times does to its upcoming bookings (date >= `from`), so an edit can never hide
 * a booked party from capacity:
 * - `conflicts`: bookings at a time that is not in `nextTimes` (a blank time counts as the old first departure);
 *   they must be moved (remapped) before the change is saved.
 * - `blanks`: bookings with no stored time whose old first departure is still listed; callers write that time on
 *   them so a new first departure can never silently move them.
 */
export async function startTimeChangeImpact(
  ctx: QueryCtx | MutationCtx,
  tour: Pick<Doc<"tours">, "_id" | "startTimes">,
  nextTimes: readonly string[],
  from: string,
): Promise<{ conflicts: StartTimeConflict[]; blanks: { bookingId: Id<"bookings">; startTime: string }[] }> {
  const conflicts: StartTimeConflict[] = [];
  const blanks: { bookingId: Id<"bookings">; startTime: string }[] = [];
  const first = tour.startTimes[0];
  for (const b of await activeBookingsFrom(ctx, tour._id, from)) {
    const time = slotOf(tour, b);
    if (time && nextTimes.includes(time)) {
      if (!b.startTime) blanks.push({ bookingId: b._id, startTime: time });
    } else {
      conflicts.push({ bookingId: b._id, reference: b.reference, date: b.date, startTime: time || first || "" });
    }
  }
  conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return { conflicts, blanks };
}

/** Units already taken on one departure. */
export function bookedUnits(tour: CapacityTour, bookings: readonly Doc<"bookings">[], date: string, time: string, excludeBookingId?: Id<"bookings">): number {
  return bookings
    .filter((b) => b.date === date && slotOf(tour, b) === time && b._id !== excludeBookingId && countsForCapacity(b.status))
    .reduce((a, b) => a + capacityUnits(tour, b.adults, b.children), 0);
}

/**
 * Units still free on one departure. 0 on a date the tour does not run (operating weekdays / fixed departures).
 * Pass excludeBookingId when re-checking a booking that may already be counted (e.g. a status change).
 */
export async function remainingCapacity(
  ctx: QueryCtx | MutationCtx,
  tour: CapacityTour,
  date: string,
  startTime: string,
  opts: { excludeBookingId?: Id<"bookings"> } = {},
): Promise<number> {
  if (!isOperatingDate(tour, date)) return 0;
  if (concurrentCap(tour) === null) {
    const capacity = slotCapacity(tour, await overridesOn(ctx, tour._id, date), startTime);
    if (capacity <= 0) return 0;
    const booked = bookedUnits(tour, await activeBookingsOn(ctx, tour._id, date), date, startTime, opts.excludeBookingId);
    return Math.max(0, capacity - booked);
  }
  // Opt-in concurrent cap: the departure's own slot capacity, and room on every day the trip spans
  const span = tourSpanDays(tour);
  const last = addDaysIso(date, span - 1);
  const [rows, active] = await Promise.all([
    ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", tour._id).gte("date", date).lte("date", last)).collect(),
    activeBookingsBetween(ctx, tour._id, addDaysIso(date, -(span - 1)), last),
  ]);
  const capacity = slotCapacity(tour, rows.filter((r) => r.date === date), startTime);
  if (capacity <= 0) return 0;
  const slotLeft = capacity - bookedUnits(tour, active, date, startTime, opts.excludeBookingId);
  const dayLeft = concurrentRemaining(tour, active, (day) => rows.filter((r) => r.date === day), date, opts.excludeBookingId);
  return Math.max(0, Math.min(slotLeft, dayLeft));
}

/** The per-departure cap on unpaid website holds (siteSettings booking.maxUnpaidHoldsPerSlot, default 2). */
export async function maxUnpaidHoldsPerSlot(ctx: QueryCtx | MutationCtx): Promise<number> {
  const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "booking.maxUnpaidHoldsPerSlot")).unique();
  const value = typeof row?.value === "string" ? Number(row.value) : row?.value;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : DEFAULT_MAX_UNPAID_HOLDS_PER_SLOT;
}

/** Unpaid holds created on the website for one departure (inquiry or pending_payment with nothing paid). */
export async function unpaidWebHoldsOn(ctx: QueryCtx | MutationCtx, tour: CapacityTour, date: string, time: string): Promise<number> {
  const rows = await Promise.all(
    (["inquiry", "pending_payment"] as const).map((status) =>
      ctx.db.query("bookings").withIndex("by_tour_status_date", (q) => q.eq("tourId", tour._id).eq("status", status).eq("date", date)).collect(),
    ),
  );
  return rows.flat().filter((b) => b.source === "web" && b.amountPaid <= 0 && slotOf(tour, b) === time).length;
}
