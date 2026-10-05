/**
 * Departure capacity, shared by bookings.quote, bookings.create, availability.forTour,
 * the staff status workflow and the admin overview, so they can never disagree.
 *
 * Units are those of capacityUnits(): seats for per_person tours, private departures for
 * per_group/tiered tours, and 4WDs for per_vehicle tours.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isOperatingDate } from "./dates";
import { capacityUnits } from "./pricing";

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

type CapacityTour = Pick<Doc<"tours">, "_id" | "startTimes" | "defaultCapacityPerSlot" | "pricingModel" | "vehiclePricing" | "minGroup"> & {
  operatingWeekdays?: number[];
  fixedDepartureDates?: string[];
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
export function slotCapacity(tour: Pick<Doc<"tours">, "defaultCapacityPerSlot">, overrides: readonly Override[], time: string): number {
  if (overrides.some((o) => o.isBlackout && (!o.startTime || o.startTime === time))) return 0;
  const slotRow = overrides.find((o) => o.startTime === time && !o.isBlackout);
  const dayRow = overrides.find((o) => !o.startTime && !o.isBlackout);
  const capacity = slotRow?.capacity ?? dayRow?.capacity ?? tour.defaultCapacityPerSlot;
  return Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : 0;
}

/** Units the smallest party the tour accepts would take: a slot with fewer left cannot be sold to anyone. */
export function smallestPartyUnits(tour: Pick<Doc<"tours">, "pricingModel" | "vehiclePricing" | "minGroup">): number {
  return Math.max(1, capacityUnits(tour, Math.max(1, tour.minGroup), 0));
}

export type SlotView = { time: string; remaining: number; capacity: number; bookable: boolean };

/** What the calendar shows for one start time. bookable means the smallest allowed party still fits. */
export function slotView(tour: Pick<Doc<"tours">, "pricingModel" | "vehiclePricing" | "minGroup">, time: string, capacity: number, booked: number): SlotView {
  const remaining = Math.max(0, capacity - booked);
  return { time, remaining, capacity, bookable: remaining > 0 && remaining >= smallestPartyUnits(tour) };
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
  const capacity = slotCapacity(tour, await overridesOn(ctx, tour._id, date), startTime);
  if (capacity <= 0) return 0;
  const booked = bookedUnits(tour, await activeBookingsOn(ctx, tour._id, date), date, startTime, opts.excludeBookingId);
  return Math.max(0, capacity - booked);
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
