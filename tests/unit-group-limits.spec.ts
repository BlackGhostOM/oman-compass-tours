/**
 * Pure tests of the owner's group rules (2026-10-07): no tour caps the group size or the day's capacity,
 * private groups repeat per maxGroup guests, and the multi-day 4WD model seats 4 guests per vehicle.
 * No browser, no server.
 */
import { expect, test } from "@playwright/test";
import { slotCapacity, UNLIMITED_CAPACITY } from "../convex/lib/capacity";
import { capacityUnits, computeQuote, groupsNeeded, isVehicleModel, MULTIDAY_VEHICLE_SEATS, PARTY_MAX, vehiclesNeeded } from "../convex/lib/pricing";
import { sanitizeSelection } from "../src/components/booking/selection";
import type { BookingTour } from "../src/components/booking/types";

const NOW = Date.UTC(2026, 9, 7, 8, 0);
const DATE = "2026-11-20";

test.describe("private groups repeat instead of refusing", () => {
  const perGroup = { pricingModel: "per_group" as const, priceGroup: 80_000, minGroup: 1, maxGroup: 4, depositPercent: 35 };

  test("groupsNeeded counts adults and children, never infants", () => {
    expect(groupsNeeded(0, 0, 4)).toBe(0);
    expect(groupsNeeded(4, 0, 4)).toBe(1);
    expect(groupsNeeded(4, 1, 4)).toBe(2);
    expect(groupsNeeded(9, 0, 4)).toBe(3);
    expect(groupsNeeded(3, 0, undefined)).toBe(1);
  });

  test("a party of 9 on a 4-guest private tour pays three groups", () => {
    const q = computeQuote({ tour: perGroup, tourId: "t", adults: 7, children: 2, infants: 1, addOns: [], date: DATE, now: NOW });
    expect(q.subtotal).toBe(240_000);
    expect(q.items[0]).toMatchObject({ kind: "group", quantity: 3, unitPrice: 80_000, total: 240_000 });
    expect(capacityUnits(perGroup, 7, 2)).toBe(3);
  });

  test("a party within one group still pays one group", () => {
    const q = computeQuote({ tour: perGroup, tourId: "t", adults: 2, children: 2, infants: 0, addOns: [], date: DATE, now: NOW });
    expect(q.subtotal).toBe(80_000);
  });
});

test.describe("multi-day 4WD: at most 4 guests per vehicle", () => {
  const cfg = { pricePerVehicle: 150_000, maxAdults: MULTIDAY_VEHICLE_SEATS, seats: MULTIDAY_VEHICLE_SEATS };
  const tour = { pricingModel: "per_vehicle_multiday" as const, vehiclePricing: cfg, minGroup: 1, maxGroup: 4, depositPercent: 35 };

  test("adults and children both take one of the 4 seats; infants ride on laps", () => {
    expect(vehiclesNeeded(4, 0, cfg)).toBe(1);
    expect(vehiclesNeeded(2, 2, cfg)).toBe(1);
    expect(vehiclesNeeded(1, 4, cfg)).toBe(2);
    expect(vehiclesNeeded(5, 2, cfg)).toBe(2);
    expect(vehiclesNeeded(13, 0, cfg)).toBe(4);
    const q = computeQuote({ tour, tourId: "t", adults: 5, children: 2, infants: 2, addOns: [], date: DATE, now: NOW });
    expect(q.subtotal).toBe(300_000);
    expect(capacityUnits(tour, 5, 2)).toBe(2);
  });

  test("both 4WD models are vehicle models", () => {
    expect(isVehicleModel("per_vehicle")).toBe(true);
    expect(isVehicleModel("per_vehicle_multiday")).toBe(true);
    expect(isVehicleModel("per_group")).toBe(false);
  });
});

test.describe("no default capacity cap", () => {
  test("a day without staff rows is unlimited; a staff row still limits or closes it", () => {
    const tour = { defaultCapacityPerSlot: 6 };
    expect(slotCapacity(tour, [], "07:00")).toBe(UNLIMITED_CAPACITY);
    expect(slotCapacity(tour, [{ startTime: "07:00", capacity: 2, isBlackout: false }], "07:00")).toBe(2);
    expect(slotCapacity(tour, [{ capacity: 3, isBlackout: false }], "07:00")).toBe(3);
    expect(slotCapacity(tour, [{ isBlackout: true, capacity: 0 }], "07:00")).toBe(0);
    // The dashboard's occupancy keeps using the tour's reference number
    expect(slotCapacity(tour, [], "07:00", tour.defaultCapacityPerSlot)).toBe(6);
  });

  test("the wizard keeps a party past the tour's old maximum", () => {
    const tour = { pricingModel: "per_person", maxGroup: 6, minGroup: 1, startTimes: ["07:00"], addOns: [], slug: { en: "t", ar: "t" }, operatingWeekdays: undefined, fixedDepartureDates: undefined } as unknown as BookingTour;
    const window = { from: "2026-11-01", to: "2027-02-28" };
    const { state } = sanitizeSelection(tour, { date: DATE, startTime: "07:00", adults: 10, children: 5, infants: 0 }, { window });
    expect(state.adults).toBe(10);
    expect(state.children).toBe(5);
    expect(sanitizeSelection(tour, { adults: PARTY_MAX + 50, children: 0 }, { window }).state.adults).toBe(PARTY_MAX);
  });
});
