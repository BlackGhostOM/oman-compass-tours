/**
 * The multi-day 4WD model with rooms, end to end on DEV (owner rules, 2026-10-08): staff set a 3-day tour to the model
 * in the editor (4 seat prices + the single-room supplement), the booking page offers single rooms and adds a
 * single room for the guest left without a partner, and the server stores the rooms on the booking. The tour is put
 * back to its own model at the end, and the booking is cancelled.
 */
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convexAuthToken, convexHttp } from "./helpers";
import type { BookingTour } from "../src/components/booking/types";

const OWNER = { email: "owner@omancompasstours.com", password: "OmanCompass!2026" };
const SLUG = "oman-nature-culture-3-day";

type Quote = { items: { label: { en: string }; quantity: number; total: number }[]; subtotal: number; rooms?: { shared: number; single: number; singleRequested: number }; available: boolean } | null;
type Tour = BookingTour & { pricingModel: string; vehiclePricing?: { seatPrices?: number[]; singleRoomPrice?: number } | null };

async function signInStaff(page: Page): Promise<string> {
  await page.goto(`/en/sign-in?redirect=${encodeURIComponent("/admin")}`);
  await page.locator("#auth-email").fill(OWNER.email);
  await page.locator("#auth-password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin/);
  return await convexAuthToken(page);
}

const tourBySlug = () => convexHttp<Tour>("query", "tours:forBooking", { slug: SLUG, locale: "en" });

async function setModel(page: Page, tourId: string, option: RegExp) {
  await page.goto(`/en/admin/products/${tourId}?tab=pricing`);
  const field = page.locator("div.space-y-1\\.5", { has: page.getByText("Pricing model", { exact: true }) });
  await field.getByRole("combobox").click();
  await page.getByRole("option", { name: option }).click();
}

test("multi-day 4WD with rooms: editor prices, single rooms on the booking page, rooms stored", async ({ page }) => {
  test.setTimeout(180_000);
  const token = await signInStaff(page);
  const before = await tourBySlug();
  expect(before.durationDays ?? 1).toBeGreaterThan(1);
  // A run that stopped half way leaves the tour on the new model: it is per-person in the seed (child 360 OMR)
  const original = before.pricingModel === "per_vehicle_multiday" ? "per_person" : before.pricingModel;
  const childBaisa = before.priceChild ?? 360_000;
  let bookingId: string | undefined;
  try {
    // Staff: 1st 100, 2nd 80, 3rd 60, 4th 50 OMR; single-room supplement 90 OMR
    await setModel(page, before._id, /^Multi-day 4WD with rooms/);
    for (const [i, v] of ["100", "80", "60", "50"].entries()) await page.locator(`#seat-${i}`).fill(v);
    await page.locator("#single-room").fill("90");
    // Hint: 4 guests, one single request = a full 4WD 290 + 2 supplements x 90 = 470 OMR
    await expect(page.getByText(/= 470 OMR\./)).toBeVisible();
    await page.getByRole("button", { name: "Save & publish" }).click();
    await expect.poll(async () => (await tourBySlug()).pricingModel, { timeout: 20_000 }).toBe("per_vehicle_multiday");
    const tour = await tourBySlug();
    expect(tour.vehiclePricing).toMatchObject({ seatPrices: [100_000, 80_000, 60_000, 50_000], singleRoomPrice: 90_000 });

    // Customer: 4 adults, one asks for a single room = 2 single rooms + 1 shared room
    await page.goto(`/en/book/${SLUG}`);
    await expect(page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}/ }).first()).toBeVisible({ timeout: 30_000 });
    while (Number(await page.locator("#adults").inputValue()) < 4) await page.getByRole("button", { name: "Add one adult", exact: true }).click();
    await expect(page.locator("#singleRooms")).toHaveValue("0");
    await expect(page.getByText("Rooms: 2 shared rooms", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add a single room", exact: true }).click();
    await expect(page.getByText("Rooms: 1 shared room, 2 single rooms", { exact: true })).toBeVisible();
    await expect(page.getByText(/left without a partner by this choice also gets a single room/)).toBeVisible();

    // Server: the same quote, and the booking keeps its rooms
    const date = await page.evaluate(() => new URL(location.href).searchParams.get("date"));
    const day = date ?? (await convexHttp<{ dates: { date: string; slots: { time: string; bookable: boolean }[] }[] }>("query", "availability:forTour", { tourId: tour._id, from: "2027-01-10", to: "2027-02-10" })).dates.find((d) => d.slots.some((s) => s.bookable))!.date;
    const q = await convexHttp<Quote>("query", "bookings:quote", { tourId: tour._id, date: day, adults: 4, children: 0, infants: 0, singleRooms: 1, addOns: [] });
    expect(q!.subtotal).toBe(290_000 + 2 * 90_000);
    await expect(page.getByText(/2 single rooms replace shared places/)).toBeVisible();
    expect(q!.rooms).toEqual({ shared: 1, single: 2, singleRequested: 1 });
    const created = await convexHttp<{ bookingId: string }>(
      "mutation",
      "admin/bookings:createManual",
      { tourId: tour._id, date: day, startTime: tour.startTimes[0], adults: 4, children: 0, infants: 0, singleRooms: 1, traveller: { firstName: "QA", lastName: "Rooms", nationality: "GB", phone: "+96892255028", email: `qa+rooms${Date.now()}@example.com`, preferredLanguage: "en" }, locale: "en", source: "staff", totalOmr: 470, status: "inquiry", override: true },
      token,
    );
    bookingId = created.bookingId;
    const b = await convexHttp<{ rooms?: { shared: number; single: number } }>("query", "admin/bookings:get", { id: bookingId }, token);
    expect(b.rooms).toMatchObject({ shared: 1, single: 2 });
    await page.goto(`/en/admin/bookings/${bookingId}`);
    await expect(page.getByText(/1 shared room · 2 single rooms/).first()).toBeVisible();
  } finally {
    if (bookingId) await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "cancelled", reason: "QA cleanup" }, token).catch(() => undefined);
    // Put the tour back on its own model (its own prices are still in the editor)
    {
      const label = { per_person: /^Per adult \/ child/, per_group: /^Per group|^Private group/, tiered: /^Tiered/, per_vehicle: /^Per 4WD|^Per vehicle/ }[original as "per_person"] ?? /^Per adult/;
      await setModel(page, before._id, label);
      // Other models do not keep a child price, so a per-person tour gets its own back
      if (original === "per_person") await page.locator("div.space-y-1\\.5", { has: page.getByText("Child price (OMR)", { exact: true }) }).first().locator("input").fill(String(childBaisa / 1000));
      await page.getByRole("button", { name: "Save & publish" }).click();
      await expect.poll(async () => (await tourBySlug()).pricingModel, { timeout: 20_000 }).toBe(original);
    }
  }
});
