/**
 * Pure tests of the Wave 2 booking rules: shared capacity across overlapping multi-day trips (convex/lib/capacity.ts),
 * multi-day dates and start-time normalising (convex/lib/dates.ts), per-person and season prices (convex/lib/pricing.ts),
 * guest wording (convex/lib/guests.ts), lapsed holds (convex/lib/holds.ts) and the "Book again" link. No browser, no server.
 */
import { expect, test } from "@playwright/test";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { concurrentCap, concurrentRemaining, slotView, tourSpanDays } from "../convex/lib/capacity";
import { addDaysIso, departureMs, isStartTime, lastTourDay, normalizeStartTime, normalizeStartTimes } from "../convex/lib/dates";
import { guestsLine } from "../convex/lib/guests";
import { isLapsedHold } from "../convex/lib/holds";
import { computeQuote, perPersonPrices, pricingProblem, validateCoupon } from "../convex/lib/pricing";
import { rebookHref } from "../src/components/booking/selection";

const NOW = Date.UTC(2026, 9, 5, 8, 0); // 2026-10-05 12:00 Oman

/* ------------------------------------------------------------------ */
/* concurrentCapacity                                                  */
/* ------------------------------------------------------------------ */

type Tour = Parameters<typeof concurrentRemaining>[0];
type Override = { startTime?: string; capacity: number; isBlackout: boolean };

const twoDay = (concurrentCapacity?: number): Tour =>
  ({
    _id: "tour1" as Id<"tours">,
    startTimes: ["07:00", "09:00"],
    defaultCapacityPerSlot: 3,
    pricingModel: "per_vehicle",
    vehiclePricing: { pricePerVehicle: 100_000, maxAdults: 4, seats: 6 },
    minGroup: 1,
    durationDays: 2,
    concurrentCapacity,
  }) as unknown as Tour;

let seq = 0;
function booking(date: string, adults: number, status: Doc<"bookings">["status"] = "confirmed", startTime = "07:00"): Doc<"bookings"> {
  return { _id: `b${++seq}` as Id<"bookings">, date, startTime, adults, children: 0, infants: 0, status } as unknown as Doc<"bookings">;
}
const noOverrides = () => [] as Override[];

test.describe("concurrentRemaining (shared fleet across overlapping multi-day trips)", () => {
  test("without concurrentCapacity departures are counted on their own (no limit)", () => {
    expect(concurrentCap(twoDay())).toBeNull();
    expect(concurrentRemaining(twoDay(), [booking("2027-01-26", 4)], noOverrides, "2027-01-26")).toBe(Infinity);
  });

  test("a 2-day trip needs room on both days, counting every start time and trips still out", () => {
    const tour = twoDay(3);
    // 1 vehicle out 25-26 Jan, 1 vehicle 26-27 Jan (other start time), 1 vehicle 27-28 Jan
    const rows = [booking("2027-01-25", 4), booking("2027-01-26", 3, "pending_payment", "09:00"), booking("2027-01-27", 2, "inquiry")];
    // A start on the 26th spans 26 (2 out) and 27 (2 out): 1 left
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-01-26")).toBe(1);
    // A start on the 24th spans 24 (0 out) and 25 (1 out): 2 left
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-01-24")).toBe(2);
    // A start on the 28th spans 28 (1 out) and 29 (0 out): 2 left
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-01-28")).toBe(2);
    // Far from every booking the whole fleet is free
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-02-10")).toBe(3);
  });

  test("cancelled bookings and the booking being changed are not counted", () => {
    const tour = twoDay(2);
    const own = booking("2027-03-10", 4);
    const rows = [own, booking("2027-03-10", 4, "cancelled"), booking("2027-03-11", 4, "completed")];
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-03-10")).toBe(1);
    expect(concurrentRemaining(tour, rows, noOverrides, "2027-03-10", own._id)).toBe(2);
  });

  test("an 'All slots' capacity row caps that day; a whole-day blackout on any spanned day closes the date", () => {
    const tour = twoDay(3);
    const rows = [booking("2027-04-01", 4)];
    const dayCap = (day: string): Override[] => (day === "2027-04-02" ? [{ capacity: 1, isBlackout: false }] : []);
    // Start on 1 Apr: day 1 has 3 - 1 = 2, day 2 has 1 - 1 = 0
    expect(concurrentRemaining(tour, rows, dayCap, "2027-04-01")).toBe(0);
    // Start on 2 Apr: day 2 is capped at 1 with the trip from the 1st still out
    expect(concurrentRemaining(tour, rows, dayCap, "2027-04-02")).toBe(0);
    expect(concurrentRemaining(tour, [], dayCap, "2027-04-02")).toBe(1);
    const blackout = (day: string): Override[] => (day === "2027-04-06" ? [{ capacity: 0, isBlackout: true }] : []);
    expect(concurrentRemaining(tour, [], blackout, "2027-04-05")).toBe(0);
    // A blackout of one start time only is not a whole-day blackout
    const oneTime = (day: string): Override[] => (day === "2027-04-06" ? [{ startTime: "07:00", capacity: 0, isBlackout: true }] : []);
    expect(concurrentRemaining(tour, [], oneTime, "2027-04-05")).toBe(3);
  });

  test("slotView applies the concurrent limit to what a slot shows", () => {
    const tour = twoDay(3);
    expect(slotView(tour, "07:00", 3, 0, 1)).toMatchObject({ remaining: 1, bookable: true });
    expect(slotView(tour, "07:00", 3, 0, 0)).toMatchObject({ remaining: 0, bookable: false });
    expect(slotView(tour, "07:00", 3, 1)).toMatchObject({ remaining: 2, bookable: true });
    expect(tourSpanDays({ durationDays: 3 })).toBe(3);
    expect(tourSpanDays({})).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Multi-day dates and start times                                     */
/* ------------------------------------------------------------------ */

test.describe("multi-day lifecycle dates", () => {
  test("lastTourDay rolls over months and years; day tours end on their start date", () => {
    expect(lastTourDay("2026-10-31", 2)).toBe("2026-11-01");
    expect(lastTourDay("2026-12-30", 3)).toBe("2027-01-01");
    expect(lastTourDay("2028-02-28", 2)).toBe("2028-02-29");
    expect(lastTourDay("2026-11-15", 1)).toBe("2026-11-15");
    expect(lastTourDay("2026-11-15", undefined)).toBe("2026-11-15");
    expect(lastTourDay("2026-11-15", 0)).toBe("2026-11-15");
  });

  test("a departure is an exact instant in Oman time (UTC+4)", () => {
    expect(new Date(departureMs("2026-11-15", "08:30")).toISOString()).toBe("2026-11-15T04:30:00.000Z");
    expect(new Date(departureMs(lastTourDay("2026-12-30", 3), "18:00")).toISOString()).toBe("2027-01-01T14:00:00.000Z");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  test("start times typed by staff are normalised to HH:MM, invalid ones reported", () => {
    expect(normalizeStartTime("8:30")).toBe("08:30");
    expect(normalizeStartTime("8.30")).toBe("08:30");
    expect(normalizeStartTime(" 14:05 ")).toBe("14:05");
    expect(normalizeStartTime("٨:٣٠")).toBe("08:30");
    expect(normalizeStartTime("25:00")).toBeNull();
    expect(normalizeStartTime("8h")).toBeNull();
    expect(isStartTime("08:30")).toBe(true);
    expect(isStartTime("8:30")).toBe(false);
    expect(normalizeStartTimes(["14:00", "8:30", "08:30", "", "25:00"])).toEqual({ times: ["08:30", "14:00"], invalid: ["25:00"] });
  });
});

/* ------------------------------------------------------------------ */
/* Prices                                                              */
/* ------------------------------------------------------------------ */

const perPerson = { pricingModel: "per_person" as const, priceAdult: 30_000, priceChild: 15_000, minGroup: 1, maxGroup: 10, depositPercent: 35 };
const winter = { en: "Winter peak", ar: "ذروة الشتاء" };

test.describe("per-person and season prices", () => {
  test("a child price of 0 means children go free; a per-person tour needs a child price to publish", () => {
    expect(perPersonPrices({ priceAdult: 30_000, priceChild: 0 })).toEqual({ adult: 30_000, child: 0, seasonal: false });
    const q = computeQuote({ tour: { ...perPerson, priceChild: 0 }, tourId: "t", adults: 2, children: 2, infants: 0, addOns: [], date: "2026-11-20", now: NOW });
    expect(q.total).toBe(60_000);
    expect(pricingProblem({ pricingModel: "per_person", priceAdult: 30_000 })).toBe("priceChild");
    expect(pricingProblem({ pricingModel: "per_person", priceAdult: 30_000, priceChild: 0 })).toBeNull();
  });

  test("a season with only an adult price moves the child price in proportion and labels the lines", () => {
    const season = { name: winter, priceAdult: 40_000 };
    expect(perPersonPrices(perPerson, season)).toEqual({ adult: 40_000, child: 20_000, seasonal: true });
    // A low season never leaves a child paying more than an adult
    expect(perPersonPrices(perPerson, { priceAdult: 10_000 })).toEqual({ adult: 10_000, child: 5_000, seasonal: true });
    const q = computeQuote({ tour: perPerson, tourId: "t", season, adults: 2, children: 1, infants: 0, addOns: [], date: "2026-12-20", now: NOW });
    expect(q.total).toBe(100_000);
    expect(q.seasonal).toBe(true);
    const adult = q.items.find((i) => i.kind === "adult")!;
    expect(adult.label.en).toBe("Adult · Winter peak");
    expect(adult.label.ar).toContain("ذروة الشتاء");
    expect(q.depositDue).toBe(35_000);
    expect(q.balanceDue).toBe(65_000);
  });

  test("a season child price is used as given", () => {
    expect(perPersonPrices(perPerson, { priceAdult: 40_000, priceChild: 12_000 })).toEqual({ adult: 40_000, child: 12_000, seasonal: true });
    expect(perPersonPrices(perPerson, { priceChild: 12_000 })).toEqual({ adult: 30_000, child: 12_000, seasonal: true });
  });

  test("an early-bird coupon counts whole Oman calendar days", () => {
    const coupon = { code: "EARLY", type: "percent" as const, value: 10, earlyBirdDays: 30, usedCount: 0, isActive: true };
    const ctx = { subtotal: 50_000, groupSize: 2, tourId: "t", now: NOW };
    expect(validateCoupon(coupon, { ...ctx, date: "2026-11-04" })).toBeUndefined();
    expect(validateCoupon(coupon, { ...ctx, date: "2026-11-03" })).toBe("early_bird");
  });
});

/* ------------------------------------------------------------------ */
/* Wording, holds and links                                            */
/* ------------------------------------------------------------------ */

test.describe("guest wording, lapsed holds and Book again", () => {
  test("guestsLine uses plural forms and leaves out zero counts", () => {
    expect(guestsLine({ adults: 2, children: 3, infants: 0 }, "en")).toBe("2 adults · 3 children");
    expect(guestsLine({ adults: 1, children: 1, infants: 1 }, "en")).toBe("1 adult · 1 child · 1 infant");
    expect(guestsLine({ adults: 2, children: 3, infants: 0 }, "ar")).toBe("بالغان · 3 أطفال");
    expect(guestsLine({ adults: 1, children: 0, infants: 2 }, "ar")).toBe("بالغ واحد · رضيعان");
    expect(guestsLine({ adults: 11, children: 0, infants: 0 }, "ar")).toBe("11 بالغًا");
  });

  test("only an expired or superseded hold can be re-confirmed by a late payment", () => {
    expect(isLapsedHold({ status: "cancelled", cancellationReason: "hold_expired" })).toBe(true);
    expect(isLapsedHold({ status: "cancelled", cancellationReason: "superseded" })).toBe(true);
    expect(isLapsedHold({ status: "cancelled", cancellationReason: "staff" })).toBe(false);
    expect(isLapsedHold({ status: "pending_payment" })).toBe(false);
  });

  test("rebookHref carries the date, start time and party", () => {
    const href = rebookHref("jabal-akhdar-2-day-overnight", { date: "2026-12-01", startTime: "09:00", adults: 2, children: 2, infants: 1 });
    expect(href).toBe("/book/jabal-akhdar-2-day-overnight?date=2026-12-01&time=09%3A00&adults=2&children=2&infants=1");
    expect(rebookHref("x", { date: "2026-12-01", startTime: null, adults: 1, children: 0, infants: 0 })).not.toContain("time=");
  });
});
