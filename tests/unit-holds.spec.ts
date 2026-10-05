/**
 * Pure tests of the hold and pricing rules (convex/lib/holds.ts, convex/lib/pricing.ts). No browser and no server.
 */
import { expect, test } from "@playwright/test";
import { CHECKOUT_SESSION_COVER_MS, holdCeiling, unpayableReason } from "../convex/lib/holds";
import { addOnAppliesTo, computeQuote } from "../convex/lib/pricing";

const NOW = Date.UTC(2026, 9, 5, 8, 0); // 2026-10-05 12:00 Oman
const LATER_DATE = "2026-10-20";

test.describe("unpayableReason", () => {
  test("an unpaid hold past its deadline is expired", () => {
    expect(unpayableReason({ status: "pending_payment", holdExpiresAt: NOW - 1, date: LATER_DATE, startTime: "08:00", amountPaid: 0 }, NOW)).toBe("hold_expired");
  });

  test("a partly paid hold stays payable after its deadline (expiry never cancels it)", () => {
    expect(unpayableReason({ status: "inquiry", holdExpiresAt: NOW - 1, date: LATER_DATE, startTime: "08:00", amountPaid: 5_000 }, NOW)).toBeNull();
  });

  test("a legacy unpaid booking without a hold stays payable until departure", () => {
    expect(unpayableReason({ status: "pending_payment", holdExpiresAt: null, date: LATER_DATE, startTime: "08:00", amountPaid: 0 }, NOW)).toBeNull();
    expect(unpayableReason({ status: "pending_payment", holdExpiresAt: null, date: "2026-10-04", startTime: "08:00", amountPaid: 0 }, NOW)).toBe("departed");
  });

  test("cancelled and refunded bookings are not payable", () => {
    expect(unpayableReason({ status: "cancelled", holdExpiresAt: NOW + 1, date: LATER_DATE }, NOW)).toBe("status");
    expect(unpayableReason({ status: "confirmed", date: LATER_DATE }, NOW)).toBeNull();
  });
});

test.describe("holdCeiling", () => {
  test("defaults to the current hold plus one checkout window, then stays fixed", () => {
    expect(holdCeiling({ holdExpiresAt: NOW + 10_000 }, NOW)).toBe(NOW + 10_000 + CHECKOUT_SESSION_COVER_MS);
    expect(holdCeiling({ holdExpiresAt: NOW + 99_000_000, holdCeilingAt: NOW + 5_000 }, NOW)).toBe(NOW + 5_000);
  });
});

test.describe("add-on scope and season prices", () => {
  test("tour-only extras are not offered on services; unscoped extras apply everywhere", () => {
    expect(addOnAppliesTo({ appliesToKinds: ["tour"] }, { kind: "service" })).toBe(false);
    expect(addOnAppliesTo({ appliesToKinds: ["tour"] }, { kind: "tour" })).toBe(true);
    expect(addOnAppliesTo({}, { kind: "service" })).toBe(true);
    expect(addOnAppliesTo({ appliesToKinds: [] }, { kind: "service" })).toBe(true);
  });

  test("a 0 or negative season price falls back to the tour price", () => {
    const tour = { pricingModel: "per_person" as const, priceAdult: 30_000, priceChild: 15_000, minGroup: 1, maxGroup: 10, depositPercent: 35 };
    for (const priceAdult of [0, -5_000]) {
      const q = computeQuote({ tour, tourId: "t", season: { priceAdult }, adults: 2, children: 0, infants: 0, addOns: [], date: LATER_DATE, now: NOW });
      expect(q.total).toBe(60_000);
    }
  });
});
