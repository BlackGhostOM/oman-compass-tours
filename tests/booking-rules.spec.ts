/**
 * Booking rules: guest counters per pricing model, operating-day tours, draft restore sanitising,
 * server quote reasons and capacity holds. Server checks go straight to the DEV deployment's HTTP API.
 */
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convexHttp, testSessionKey } from "./helpers";
import { addDaysIso, bookingWindow, omanTodayIso, weekdayOfIso } from "../convex/lib/dates";
import { PARTY_MAX } from "../convex/lib/pricing";
import { sanitizeSelection } from "../src/components/booking/selection";
import type { BookingTour } from "../src/components/booking/types";

type Slot = { time: string; remaining: number; capacity: number; bookable: boolean };
type Day = { date: string; isBlackout: boolean; operating?: boolean; slots: Slot[] };
type Quote = { available: boolean; unavailableReason: string | null; remaining: number; needed: number } | null;

const tourCache = new Map<string, BookingTour>();
async function tourBySlug(slug: string): Promise<BookingTour> {
  if (!tourCache.has(slug)) tourCache.set(slug, await convexHttp<BookingTour>("query", "tours:forBooking", { slug, locale: "en" }));
  return tourCache.get(slug)!;
}
async function forTour(tourId: string, from: string, to: string): Promise<Day[]> {
  return (await convexHttp<{ dates: Day[] }>("query", "availability:forTour", { tourId, from, to })).dates;
}
function quote(tourId: string, a: { date: string; startTime?: string; adults?: number; children?: number; infants?: number }): Promise<Quote> {
  return convexHttp<Quote>("query", "bookings:quote", { tourId, date: a.date, startTime: a.startTime, adults: a.adults ?? 2, children: a.children ?? 0, infants: a.infants ?? 0, addOns: [] });
}
/** A random day in the far part of the window (spreads test holds so repeated runs never exhaust one slot). */
function farRandomDay(): string {
  const { from } = bookingWindow();
  return addDaysIso(from, 40 + Math.floor(Math.random() * 70));
}
/** A day (and a start time) at least `days` out where the slot still fits `needed` places. */
async function openSlot(tour: BookingTour, needed: number, start = farRandomDay()): Promise<{ date: string; startTime: string; remaining: number }> {
  const { to } = bookingWindow();
  const dates = await forTour(tour._id, start, to);
  const shuffled = [...dates].sort(() => Math.random() - 0.5);
  for (const d of shuffled) {
    if (d.isBlackout) continue;
    const slot = d.slots.find((s) => s.bookable && s.remaining >= needed);
    if (slot) return { date: d.date, startTime: slot.time, remaining: slot.remaining };
  }
  throw new Error(`No open slot for ${tour.code} from ${start}`);
}

const counter = (page: Page, id: "adults" | "children" | "infants") => page.locator(`#${id}`);
const plus = (page: Page, who: string) => page.getByRole("button", { name: `Add one ${who}`, exact: true });
const minus = (page: Page, who: string) => page.getByRole("button", { name: `Remove one ${who}`, exact: true });

async function openWizard(page: Page, slug: string, query = "") {
  await page.goto(`/en/book/${slug}${query}`);
  await expect(page.getByRole("heading", { name: /Choose your date/ })).toBeVisible();
  // Availability loaded (and any draft restored) once a start time is enabled
  await expect(page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}/ }).first()).toBeVisible({ timeout: 30_000 });
}

/* ------------------------------------------------------------------ */
/* Guest counters                                                      */
/* ------------------------------------------------------------------ */

test.describe("guest counters per pricing model", () => {
  const cases = [
    { slug: "wadi-shab-bimmah-sinkhole-private", model: "per_person" },
    { slug: "experience-muscat-city-tour", model: "tiered" },
    { slug: "wakan-village-nakhal-fort-4wd", model: "per_group" },
    { slug: "jabal-akhdar-2-day-overnight", model: "per_vehicle" },
    { slug: "oman-nature-culture-3-day", model: "per_person, minimum 2" },
  ];

  for (const c of cases) {
    test(`${c.model} (${c.slug}): group bounds, infants per adult and the reasons shown`, async ({ page }) => {
      test.setTimeout(120_000);
      const tour = await tourBySlug(c.slug);
      await openWizard(page, c.slug);

      // Starts at the tour's minimum, which cannot be undercut without a reason shown
      await expect(counter(page, "adults")).toHaveValue(String(Math.max(1, tour.minGroup)));
      await expect(counter(page, "children")).toHaveValue("0");
      await expect(counter(page, "infants")).toHaveValue("0");

      // No tour caps the group: adults go past the old maximum and "+" stays enabled, with no "larger groups" note
      const beyond = tour.maxGroup + 2;
      while (Number(await counter(page, "adults").inputValue()) < beyond) await plus(page, "adult").click();
      await expect(counter(page, "adults")).toHaveValue(String(beyond));
      await expect(plus(page, "adult")).toBeEnabled();
      await expect(plus(page, "child")).toBeEnabled();
      await expect(page.getByText(/guests per online booking/)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();

      // Down to one adult: children may now fill the group up to the maximum
      while (await minus(page, "adult").isEnabled()) await minus(page, "adult").click();
      await expect(counter(page, "adults")).toHaveValue("1");
      if (tour.minGroup > 1) {
        await expect(page.getByText(new RegExp(`at least ${tour.minGroup} guests aged \\d+\\+ \\(infants are not counted\\)`)).first()).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
        await plus(page, "adult").click();
      }

      // Infants: one per adult (lap infants), and they follow the adults down
      const adultsNow = Number(await counter(page, "adults").inputValue());
      for (let i = 0; i < adultsNow; i++) await plus(page, "infant").click();
      await expect(counter(page, "infants")).toHaveValue(String(adultsNow));
      await expect(plus(page, "infant")).toBeDisabled();
      await expect(page.getByText(/^One infant per adult/)).toBeVisible();

      if (tour.maxGroup >= 3) {
        // Three adults allow three infants ...
        while (Number(await counter(page, "adults").inputValue()) < 3) await plus(page, "adult").click();
        while (await plus(page, "infant").isEnabled()) await plus(page, "infant").click();
        await expect(counter(page, "infants")).toHaveValue("3");
        // ... and dropping to one adult clamps infants to one
        while (await minus(page, "adult").isEnabled()) await minus(page, "adult").click();
        await expect(counter(page, "adults")).toHaveValue("1");
        await expect(counter(page, "infants")).toHaveValue("1");
      }

      // Children are not capped either: they can take the party past the old maximum
      const adults = Number(await counter(page, "adults").inputValue());
      const kids = tour.maxGroup - adults + 2;
      while (Number(await counter(page, "children").inputValue()) < kids) await plus(page, "child").click();
      await expect(counter(page, "children")).toHaveValue(String(kids));
      await expect(plus(page, "adult")).toBeEnabled();
      await expect(plus(page, "child")).toBeEnabled();
    });
  }

  test("server refuses more infants than adults, and quote explains why", async () => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const { date, startTime } = await openSlot(tour, 1);
    const q = await quote(tour._id, { date, startTime, adults: 1, infants: 2 });
    expect(q?.available).toBe(false);
    expect(q?.unavailableReason).toBe("too_many_infants");
    // The create check runs before any write (and before the e-mail/phone checks)
    const err = await convexHttp("mutation", "bookings:create", {
      sessionKey: testSessionKey(),
      tourId: tour._id,
      date,
      startTime,
      adults: 1,
      children: 0,
      infants: 2,
      addOns: [],
      traveller: { firstName: "Test", lastName: "Infants", nationality: "GB", phone: "not-a-phone", email: "not-an-email", preferredLanguage: "en" },
      locale: "en",
      acceptedPolicyVersionIds: [],
      payLater: true,
    }).catch((e: Error & { data?: { code?: string } }) => e);
    expect((err as Error & { data?: { code?: string } }).data?.code).toBe("TOO_MANY_INFANTS");
  });
});

/* ------------------------------------------------------------------ */
/* Operating days                                                      */
/* ------------------------------------------------------------------ */

test.describe("operating-day tours", () => {
  const SLUG = "nizwa-friday-market-tour"; // OCT-014, Fridays only

  test("the wizard opens on a Friday and greys out the other days", async ({ page }) => {
    const tour = await tourBySlug(SLUG);
    expect(tour.operatingWeekdays).toEqual([5]);
    const { from, to } = bookingWindow();
    const firstFriday = (await forTour(tour._id, from, to)).find((d) => !d.isBlackout && d.slots.some((s) => s.bookable))!.date;
    expect(weekdayOfIso(firstFriday)).toBe(5);

    await openWizard(page, SLUG);
    await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", firstFriday);
    await expect(page.getByText(/Runs every Friday only/)).toBeVisible();
    // Every enabled day in view is a Friday
    const enabled = await page.locator("td[data-day]:not([data-outside]):not([data-disabled])").evaluateAll((cells) => cells.map((c) => c.getAttribute("data-day")!));
    expect(enabled.length).toBeGreaterThan(0);
    for (const d of enabled) expect(weekdayOfIso(d), d).toBe(5);
  });

  test("a ?date= deep link to a Tuesday falls back to the first Friday", async ({ page }) => {
    const tour = await tourBySlug(SLUG);
    const { from } = bookingWindow();
    let tuesday = addDaysIso(from, 7);
    while (weekdayOfIso(tuesday) !== 2) tuesday = addDaysIso(tuesday, 1);
    await openWizard(page, SLUG, `?date=${tuesday}`);
    const selected = await page.locator("td[data-selected]:not([data-outside])").getAttribute("data-day");
    expect(weekdayOfIso(selected!)).toBe(5);
    expect(tour.code).toBe("OCT-014");
  });

  test("quote: a Tuesday is not_operating, a Friday is not", async () => {
    const tour = await tourBySlug(SLUG);
    const { from } = bookingWindow();
    let day = addDaysIso(from, 14);
    while (weekdayOfIso(day) !== 2) day = addDaysIso(day, 1);
    const tue = await quote(tour._id, { date: day, startTime: "05:30" });
    expect(tue).toMatchObject({ available: false, unavailableReason: "not_operating" });
    const fri = await quote(tour._id, { date: addDaysIso(day, 3), startTime: "05:30" });
    expect(fri?.unavailableReason).not.toBe("not_operating");
  });
});

/* ------------------------------------------------------------------ */
/* Quote reasons                                                       */
/* ------------------------------------------------------------------ */

test.describe("bookings:quote unavailableReason", () => {
  test("invalid, past, too far, start time and group reasons; never an error", async () => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const { from, to } = bookingWindow();
    const cases: [Parameters<typeof quote>[1], string | null][] = [
      [{ date: "2027-02-30" }, "invalid_date"],
      [{ date: "2027-13-45" }, "invalid_date"],
      [{ date: "not-a-date" }, "invalid_date"],
      [{ date: omanTodayIso() }, "past"], // same-day bookings are closed
      [{ date: addDaysIso(omanTodayIso(), -3) }, "past"],
      [{ date: addDaysIso(to, 1) }, "too_far"],
      [{ date: "2099-12-31" }, "too_far"],
      [{ date: addDaysIso(from, 30), startTime: "8:30" }, "invalid_start_time"],
      [{ date: addDaysIso(from, 30), startTime: "23:55" }, "invalid_start_time"],
      [{ date: addDaysIso(from, 30), startTime: "07:30", adults: PARTY_MAX + 1 }, "above_max_group"], // only absurd requests
      [{ date: addDaysIso(from, 30), startTime: "07:30", adults: 0, children: 0 }, "below_min_group"],
      [{ date: addDaysIso(from, 30), startTime: "07:30", adults: 2, infants: 3 }, "too_many_infants"],
    ];
    for (const [args, reason] of cases) {
      const q = await quote(tour._id, { startTime: "07:30", ...args });
      expect(q, JSON.stringify(args)).not.toBeNull();
      expect(q!.available, JSON.stringify(args)).toBe(false);
      expect(q!.unavailableReason, JSON.stringify(args)).toBe(reason);
    }
    // A normal far-future day is available with no reason
    const { date, startTime } = await openSlot(tour, 2);
    const ok = await quote(tour._id, { date, startTime });
    expect(ok).toMatchObject({ available: true, unavailableReason: null });
    // A party well past the tour's old maximum is bookable: no tour caps the group
    const big = await quote(tour._id, { date, startTime, adults: tour.maxGroup + 5 });
    expect(big).toMatchObject({ available: true, unavailableReason: null });
  });

  test("bookings:create refuses past and too-far dates with their own codes", async () => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const { to } = bookingWindow();
    const base = {
      tourId: tour._id,
      startTime: "07:30",
      adults: 2,
      children: 0,
      infants: 0,
      addOns: [],
      traveller: { firstName: "Test", lastName: "Dates", nationality: "GB", phone: "+96892255028", email: "qa+dates@example.com", preferredLanguage: "en" },
      locale: "en",
      acceptedPolicyVersionIds: [],
      payLater: true,
    };
    const code = (date: string) =>
      convexHttp("mutation", "bookings:create", { ...base, sessionKey: testSessionKey(), date }).then(
        () => "CREATED",
        (e: Error & { data?: { code?: string; field?: string } }) => `${e.data?.code}${e.data?.field ? ":" + e.data.field : ""}`,
      );
    expect(await code(omanTodayIso())).toBe("DATE_IN_PAST");
    expect(await code(addDaysIso(to, 1))).toBe("DATE_OUT_OF_RANGE");
    expect(await code("2027-02-30")).toBe("INVALID_ARGUMENT:date");
  });
});

/* ------------------------------------------------------------------ */
/* Draft restore                                                       */
/* ------------------------------------------------------------------ */

test.describe("draft restore sanitising", () => {
  /** Saves a draft for `sessionKey` on DEV and makes the browser use that session. */
  async function seedDraft(page: Page, sessionKey: string, tourId: string, data: Record<string, unknown>) {
    await convexHttp("mutation", "bookings:saveDraft", { sessionKey, tourId, step: (data.step as number) ?? 1, data, locale: "en" });
    await page.addInitScript((k) => window.localStorage.setItem("oct_session", k), sessionKey);
  }
  const traveller = { firstName: "Draft", lastName: "Tester", nationality: "GB", phone: "+447700900123", email: "qa+draft@example.com", hotel: "", pickupLocation: "", specialRequests: "" };

  test("an explicit ?date= wins over the saved draft and the wizard goes back to step 1", async ({ page }) => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const draftSlot = await openSlot(tour, 2, addDaysIso(bookingWindow().from, 20));
    const linked = await openSlot(tour, 2, addDaysIso(draftSlot.date, 10));
    const key = testSessionKey();
    await seedDraft(page, key, tour._id, { step: 2, date: draftSlot.date, startTime: draftSlot.startTime, adults: 2, children: 0, infants: 0, addOns: {}, couponCode: "", traveller });

    await openWizard(page, tour.slug.en, `?date=${linked.date}`);
    await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", linked.date);
    // The cleaned draft is saved at once
    await expect.poll(async () => (await convexHttp<{ data: { date: string; step: number } } | null>("query", "bookings:getDraft", { sessionKey: key, tourId: tour._id }))?.data, { timeout: 15_000 }).toMatchObject({ date: linked.date, step: 1 });
  });

  test("a stale draft (past date, removed time, step 3) restores on step 1 with a bookable day and time", async ({ page }) => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const { from, to } = bookingWindow();
    const firstOpen = (await forTour(tour._id, from, to)).find((d) => !d.isBlackout && d.slots.some((s) => s.bookable))!.date;
    const key = testSessionKey();
    await seedDraft(page, key, tour._id, { step: 3, date: addDaysIso(omanTodayIso(), -2), startTime: "06:00", adults: 2, children: 0, infants: 0, addOns: { notAnAddOn: 1 }, couponCode: "", traveller, acceptedPolicies: true, acceptedWaiver: true });

    await openWizard(page, tour.slug.en);
    await expect(page.getByText(/updated it to match current availability/)).toBeVisible();
    await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", firstOpen);
    // The chosen time is one the tour offers, and it is enabled
    const chosen = page.locator("button.border-gold-500", { hasText: /^\d{2}:\d{2}/ });
    await expect(chosen).toHaveCount(1);
    expect(tour.startTimes).toContain((await chosen.innerText()).slice(0, 5));
    await expect(chosen).toBeEnabled();
    await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  });

  test("a draft with a large group keeps it; infants still clamp to the adults", async ({ page }) => {
    const tour = await tourBySlug("wakan-village-nakhal-fort-4wd"); // OCT-011, per group, up to 4
    const slot = await openSlot(tour, 1);
    const key = testSessionKey();
    await seedDraft(page, key, tour._id, { step: 3, date: slot.date, startTime: slot.startTime, adults: 7, children: 2, infants: 9, addOns: {}, couponCode: "", traveller });

    await openWizard(page, tour.slug.en);
    const adults = Number(await counter(page, "adults").inputValue());
    const children = Number(await counter(page, "children").inputValue());
    const infants = Number(await counter(page, "infants").inputValue());
    expect(adults).toBe(7);
    expect(children).toBe(2);
    expect(infants).toBeLessThanOrEqual(Math.min(adults, 6));
  });

  test("a valid draft restores on Review with both consent boxes unticked", async ({ page }) => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const slot = await openSlot(tour, 2);
    const key = testSessionKey();
    await seedDraft(page, key, tour._id, { step: 3, date: slot.date, startTime: slot.startTime, adults: 2, children: 0, infants: 0, addOns: {}, couponCode: "", traveller, acceptedPolicies: true, acceptedWaiver: true, payLater: false });

    await page.goto(`/en/book/${tour.slug.en}`);
    await expect(page.getByRole("heading", { name: "Review your booking" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#accept-policies")).not.toBeChecked();
    await expect(page.locator("#accept-waiver")).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Continue to payment" })).toBeDisabled();
  });

  test("sanitizeSelection (pure): explicit date, stale values, guests, add-ons and consent", async () => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const window = bookingWindow();
    const later = addDaysIso(window.from, 30);

    const explicit = sanitizeSelection(tour, { step: 2, date: addDaysIso(window.from, 10), startTime: tour.startTimes[0], adults: 2 }, { window, explicitDate: later });
    expect(explicit.state).toMatchObject({ date: later, step: 1 });
    expect(explicit.changed).toBe(true);

    for (const bad of ["2027-02-30", "2027-13-01", addDaysIso(window.to, 5), addDaysIso(window.from, -1)]) {
      expect(sanitizeSelection(tour, {}, { window, explicitDate: bad }).state.date, bad).toBe(window.from);
    }

    const stale = sanitizeSelection(tour, { step: 3, date: "2020-01-01", startTime: "06:00", adults: 99, children: 9, infants: 9, addOns: { gone: 1 } }, { window });
    expect(stale.changed).toBe(true);
    expect(stale.state.step).toBe(1);
    expect(stale.state.date).toBe(window.from);
    expect(tour.startTimes).toContain(stale.state.startTime);
    expect(stale.state.adults + stale.state.children).toBeLessThanOrEqual(PARTY_MAX);
    expect(stale.state.infants).toBeLessThanOrEqual(stale.state.adults);
    expect(stale.state.addOns).toEqual({});

    const valid = sanitizeSelection(tour, { step: 3, date: later, startTime: tour.startTimes[1], adults: 2, children: 0, infants: 0, addOns: {}, acceptedPolicies: true, acceptedWaiver: true }, { window });
    expect(valid.changed).toBe(false);
    expect(valid.state).toMatchObject({ step: 3, date: later, acceptedPolicies: false, acceptedWaiver: false });

    // A sold-out draft day moves to the next open day
    const soldOut = { dates: [{ date: later, isBlackout: false, slots: tour.startTimes.map((time) => ({ time, remaining: 0, capacity: 10, bookable: false })) }] };
    const moved = sanitizeSelection(tour, { step: 2, date: later, startTime: tour.startTimes[0], adults: 2 }, { window, availability: soldOut });
    expect(moved.state.date).not.toBe(later);
    expect(moved.state.step).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Capacity                                                            */
/* ------------------------------------------------------------------ */

test.describe("capacity", () => {
  test("a pay-later hold takes its places off availability:forTour and quote", async () => {
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const { date, startTime, remaining } = await openSlot(tour, 3);
    const before = await quote(tour._id, { date, startTime, adults: 2 });
    expect(before?.remaining).toBe(remaining);

    const created = await convexHttp<{ reference: string; status: string }>("mutation", "bookings:create", {
      sessionKey: testSessionKey(),
      tourId: tour._id,
      date,
      startTime,
      adults: 2,
      children: 0,
      infants: 1, // lap infants take no seat
      addOns: [],
      traveller: { firstName: "Test", lastName: "Capacity", nationality: "GB", phone: "+96892255028", email: `qa+cap${Date.now()}@example.com`, preferredLanguage: "en" },
      locale: "en",
      acceptedPolicyVersionIds: tour.requiredPolicies.map((p) => p.versionId),
      payLater: true,
    });
    expect(created.reference).toMatch(/^OCT-/);
    expect(created.status).toBe("inquiry");

    const after = (await forTour(tour._id, date, date))[0].slots.find((s) => s.time === startTime)!;
    expect(after.remaining).toBe(remaining - 2);
    const q = await quote(tour._id, { date, startTime, adults: 2 });
    expect(q?.remaining).toBe(remaining - 2);
  });
});
