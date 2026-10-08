/**
 * Pure tests of the owner's group rules (2026-10-07): no tour caps the group size or the day's capacity,
 * private groups repeat per maxGroup guests, and the multi-day 4WD model seats 4 guests per vehicle.
 * No browser, no server.
 */
import { expect, test } from "@playwright/test";
import { slotCapacity, UNLIMITED_CAPACITY } from "../convex/lib/capacity";
import { capacityUnits, computeQuote, groupsNeeded, isVehicleModel, multidayVehiclePrice, MULTIDAY_VEHICLE_SEATS, PARTY_MAX, priceFromOf, pricingProblem, roomsNeeded, singleRoomSupplements, vehiclesNeeded } from "../convex/lib/pricing";
import { guestsLine } from "../convex/lib/guests";
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

test.describe("multi-day 4WD: a price per seat, 4 seats per vehicle, shared and single rooms", () => {
  // Owner rules (2026-10-08): 1st 100, 2nd 80, 3rd 60, 4th 50 OMR in each 4WD; rooms included, single-room supplement 90 OMR
  const cfg = { pricePerVehicle: 100_000, maxAdults: MULTIDAY_VEHICLE_SEATS, seats: MULTIDAY_VEHICLE_SEATS, seatPrices: [100_000, 80_000, 60_000, 50_000], singleRoomPrice: 90_000 };
  const tour = { pricingModel: "per_vehicle_multiday" as const, vehiclePricing: cfg, minGroup: 1, maxGroup: 4, depositPercent: 35 };

  test("each seat has its own price, and a 5th guest starts another 4WD priced the same way", () => {
    const price = (n: number) => multidayVehiclePrice(n, cfg);
    expect(price(1)).toEqual({ vehicles: 1, seatCounts: [1, 0, 0, 0], total: 100_000 });
    expect(price(2)).toEqual({ vehicles: 1, seatCounts: [1, 1, 0, 0], total: 180_000 });
    expect(price(3)).toEqual({ vehicles: 1, seatCounts: [1, 1, 1, 0], total: 240_000 });
    expect(price(4)).toEqual({ vehicles: 1, seatCounts: [1, 1, 1, 1], total: 290_000 });
    expect(price(5)).toEqual({ vehicles: 2, seatCounts: [2, 1, 1, 1], total: 390_000 });
    expect(price(8)).toEqual({ vehicles: 2, seatCounts: [2, 2, 2, 2], total: 580_000 });
  });

  test("rooms: two per shared room; a guest left without a partner gets a single room", () => {
    // The owner's example: 4 guests, one asks for a single room = 2 single rooms + 1 shared room
    expect(roomsNeeded(4, 1)).toEqual({ shared: 1, single: 2, singleRequested: 1 });
    expect(roomsNeeded(4, 0)).toEqual({ shared: 2, single: 0, singleRequested: 0 });
    expect(roomsNeeded(3, 0)).toEqual({ shared: 1, single: 1, singleRequested: 0 });
    expect(roomsNeeded(5, 1)).toEqual({ shared: 2, single: 1, singleRequested: 1 });
    expect(roomsNeeded(4, 2)).toEqual({ shared: 1, single: 2, singleRequested: 2 });
    expect(roomsNeeded(1, 0)).toEqual({ shared: 0, single: 1, singleRequested: 0 });
    expect(roomsNeeded(2, 9)).toEqual({ shared: 0, single: 2, singleRequested: 2 });
  });

  test("the supplement applies only where a shared room became single rooms; the odd last guest's room is free", () => {
    const sup = (n: number, asked: number) => singleRoomSupplements(n, roomsNeeded(n, asked));
    expect(sup(4, 1)).toBe(2); // the owner's example: 2 single rooms charged, 1 shared
    expect(sup(4, 0)).toBe(0);
    expect(sup(3, 0)).toBe(0); // odd last guest alone: free
    expect(sup(3, 1)).toBe(0); // the requester takes the odd room
    expect(sup(5, 2)).toBe(2);
    expect(sup(1, 0)).toBe(0);
    expect(sup(2, 1)).toBe(2);
  });

  test("the quote adds seats and single-room supplements; children count like adults, infants are free", () => {
    const q = computeQuote({ tour, tourId: "t", adults: 3, children: 1, infants: 2, singleRooms: 1, addOns: [], date: DATE, now: NOW });
    // Seats 100 + 80 + 60 + 50 = 290; 2 single rooms replace a shared one = 2 x 90
    expect(q.subtotal).toBe(470_000);
    expect(q.rooms).toEqual({ shared: 1, single: 2, singleRequested: 1 });
    expect(q.items.filter((i) => i.label.en.includes("in a 4WD")).map((i) => i.total)).toEqual([100_000, 80_000, 60_000, 50_000]);
    expect(q.items.find((i) => i.label.en.startsWith("Single room supplement"))).toMatchObject({ quantity: 2, total: 180_000 });
    // 3 guests, no request: 1 shared + the odd guest alone, no supplement
    const odd = computeQuote({ tour, tourId: "t", adults: 3, children: 0, infants: 0, addOns: [], date: DATE, now: NOW });
    expect(odd.subtotal).toBe(240_000);
    expect(odd.rooms).toEqual({ shared: 1, single: 1, singleRequested: 0 });
    expect(capacityUnits(tour, 3, 2)).toBe(2);
    expect(vehiclesNeeded(3, 2, cfg)).toBe(2);
    // Without a request, 4 guests share 2 rooms at no extra cost
    expect(computeQuote({ tour, tourId: "t", adults: 4, children: 0, infants: 0, addOns: [], date: DATE, now: NOW }).subtotal).toBe(290_000);
  });

  test("publishing needs the four seat prices and the single-room supplement (0 allowed on purpose)", () => {
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: cfg })).toBeNull();
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: { ...cfg, seatPrices: undefined } })).toBe("vehiclePricing.seatPrices");
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: { ...cfg, seatPrices: [0, 80_000, 60_000, 50_000] } })).toBe("vehiclePricing.seatPrices");
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: { ...cfg, seatPrices: [100_000, 0, 0, 0] } })).toBeNull();
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: { ...cfg, singleRoomPrice: undefined } })).toBe("vehiclePricing.singleRoomPrice");
    expect(pricingProblem({ pricingModel: "per_vehicle_multiday", vehiclePricing: { ...cfg, singleRoomPrice: 0 } })).toBeNull();
    // The card's "from": one traveller = the 1st seat (a lone guest's room is included)
    expect(priceFromOf({ pricingModel: "per_vehicle_multiday", vehiclePricing: cfg })).toBe(100_000);
  });

  test("emails and the voucher name the rooms", () => {
    expect(guestsLine({ adults: 3, children: 1, infants: 0, rooms: { shared: 1, single: 2 } }, "en")).toBe("3 adults · 1 child · 1 shared room · 2 single rooms");
    expect(guestsLine({ adults: 2, children: 0, infants: 0, rooms: { shared: 1, single: 0 } }, "ar")).toBe("بالغان · غرفة مشتركة واحدة");
    expect(guestsLine({ adults: 2, children: 0, infants: 0 }, "en")).toBe("2 adults");
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
