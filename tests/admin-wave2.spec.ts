/**
 * Staff flows of the Wave 2 booking fixes (DEV only): changing a booking's date and party with capacity warnings and
 * an override confirmation, season selection and child prices on the website quote, and the calendar file of a
 * multi-day booking through its statuses. The owner test login signs in once per test; staff mutations then go
 * straight to the DEV HTTP API with that session's token. Every booking made here is cancelled again.
 */
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convexAuthToken, convexHttp, convexRun, convexSiteUrl, envLocal, stripeCheckoutCompletedEvent, stripeSignature } from "./helpers";
import { addDaysIso, bookingWindow, lastTourDay, omanTodayIso } from "../convex/lib/dates";
import type { BookingTour } from "../src/components/booking/types";

const OWNER = { email: "owner@omancompasstours.com", password: "OmanCompass!2026" };

type Slot = { time: string; remaining: number; capacity: number; bookable: boolean };
type Day = { date: string; isBlackout: boolean; operating?: boolean; slots: Slot[] };
type QuoteItem = { kind: string; label: { en: string; ar: string }; quantity: number; unitPrice: number; total: number };
type Quote = { items: QuoteItem[]; total: number; depositDue: number; balanceDue: number; seasonal?: boolean; available: boolean } | null;
type StaffBooking = {
  _id: string;
  reference: string;
  status: string;
  date: string;
  endDate?: string;
  startTime?: string;
  adults: number;
  children: number;
  infants: number;
  total: number;
  depositDue: number;
  amountPaid: number;
  needsAttention?: boolean;
  attentionReason?: string;
  voucherToken: string;
  audit: { action: string; after?: Record<string, unknown> }[];
};

async function signInStaff(page: Page): Promise<string> {
  await page.goto(`/en/sign-in?redirect=${encodeURIComponent("/admin")}`);
  await page.locator("#auth-email").fill(OWNER.email);
  await page.locator("#auth-password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/admin/);
  return await convexAuthToken(page);
}

const tourBySlug = (slug: string) => convexHttp<BookingTour>("query", "tours:forBooking", { slug, locale: "en" });
const forTour = async (tourId: string, from: string, to: string) => (await convexHttp<{ dates: Day[] }>("query", "availability:forTour", { tourId, from, to })).dates;
const quote = (tourId: string, a: { date: string; startTime?: string; adults: number; children?: number; infants?: number }) =>
  convexHttp<Quote>("query", "bookings:quote", { tourId, date: a.date, startTime: a.startTime, adults: a.adults, children: a.children ?? 0, infants: a.infants ?? 0, addOns: [] });

/** Open departures (date + time) far out in the window with room for `needed`, in random order (spreads repeated runs). */
async function openSlots(tour: BookingTour, needed: number, count: number): Promise<{ date: string; startTime: string; remaining: number }[]> {
  const { from, to } = bookingWindow();
  const start = addDaysIso(from, 40 + Math.floor(Math.random() * 50));
  const days = (await forTour(tour._id, start, to)).filter((d) => !d.isBlackout && d.operating !== false);
  const found: { date: string; startTime: string; remaining: number }[] = [];
  for (const d of [...days].sort(() => Math.random() - 0.5)) {
    const slot = d.slots.find((s) => s.bookable && s.remaining >= needed && s.time === tour.startTimes[0]) ?? d.slots.find((s) => s.bookable && s.remaining >= needed);
    if (slot) found.push({ date: d.date, startTime: slot.time, remaining: slot.remaining });
    if (found.length === count) return found;
  }
  throw new Error(`Not enough open departures for ${tour.code}`);
}

const traveller = (tag: string) => ({ firstName: "QA", lastName: tag, nationality: "GB", phone: "+96892255028", email: `qa+${tag.toLowerCase()}${Date.now()}@example.com`, preferredLanguage: "en" as const });

/** Reads an .ics body with folded lines joined back (RFC 5545 folds at 75 octets) and the "\," "\;" text escapes undone. */
async function icsOf(page: Page, token: string): Promise<string> {
  const res = await page.request.get(`/api/calendar/${token}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  return (await res.text()).replace(/\r?\n[ \t]/g, "").replace(/\\([,;\\])/g, "$1");
}

test.describe("Staff: Wave 2 booking changes", () => {
  test("Change booking: capacity warning, override confirmation, re-price, then a clean date move", async ({ page }) => {
    test.setTimeout(180_000);
    const token = await signInStaff(page);
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const [first, second] = await openSlots(tour, 2, 2);
    // No departure is capped by default any more; staff limit a day with an availability row, as here (removed below)
    const dayCapacity = 4;
    await convexHttp("mutation", "admin/products:setAvailability", { tourId: tour._id, date: first.date, startTime: first.startTime, capacity: dayCapacity, isBlackout: false, note: "QA capacity" }, token);
    first.remaining = dayCapacity;

    const { bookingId } = await convexHttp<{ bookingId: string }>(
      "mutation",
      "admin/bookings:createManual",
      { tourId: tour._id, date: first.date, startTime: first.startTime, adults: 2, children: 0, infants: 0, traveller: traveller("Amend"), locale: "en", source: "staff", totalOmr: 60, status: "inquiry" },
      token,
    );
    try {
      // A past date is refused by the preview the dialog shows
      const past = await convexHttp<{ ok: boolean; error?: { code: string } }>("query", "admin/bookings:amendPreview", { id: bookingId, date: addDaysIso(omanTodayIso(), -3) }, token);
      expect(past).toMatchObject({ ok: false, error: { code: "DATE_IN_PAST" } });

      await page.goto(`/en/admin/bookings/${bookingId}`);
      await page.getByRole("button", { name: "Change booking" }).click();
      const dialog = page.getByRole("dialog", { name: "Change booking" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("#cb-date")).toHaveValue(first.date);

      // More adults than the departure has room for (its own 2 places count as free): a warning and the rules in the preview
      const tooMany = first.remaining + 1;
      await dialog.locator("#cb-adults").fill(String(tooMany));
      await expect(dialog.getByRole("status")).toContainText(/Not enough room|group size/i);
      await expect(dialog.getByText("New total")).toBeVisible();
      await expect(dialog.locator("ul.text-warning li").first()).toBeVisible();
      await dialog.locator("#cb-reason").fill("QA: customer asked for more places");
      await dialog.getByRole("checkbox").click(); // do not email the test customer
      await dialog.getByRole("button", { name: "Save changes" }).click();

      // The server asks for an explicit override, listing the reasons
      const confirm = page.getByRole("alertdialog");
      await expect(confirm).toContainText("This booking breaks the departure's rules:");
      await expect(confirm.getByRole("listitem").first()).toBeVisible();
      await confirm.getByRole("button", { name: "Save anyway" }).click();
      await expect(page.getByText("Booking updated.").first()).toBeVisible();

      const expected = await quote(tour._id, { date: first.date, startTime: first.startTime, adults: tooMany });
      let b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      expect(b.adults).toBe(tooMany);
      expect(b.total).toBe(expected!.total);
      const amended = b.audit.find((a) => a.action === "booking.amend");
      expect(amended?.after?.overrideReasons).toBeTruthy();

      // Back to 2 adults on another open date: no rule is broken, so it saves without asking
      await page.getByRole("button", { name: "Change booking" }).click();
      await expect(dialog).toBeVisible();
      await dialog.locator("#cb-date").fill(second.date);
      await dialog.locator("#cb-adults").fill("2");
      if (second.startTime !== first.startTime) {
        await dialog.locator("#cb-time").click();
        await page.getByRole("option", { name: new RegExp(`^${second.startTime}`) }).click();
      }
      await expect(dialog.getByRole("status")).toHaveCount(0);
      await dialog.locator("#cb-reason").fill("QA: moved to another day");
      await dialog.getByRole("checkbox").click();
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);

      b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      expect(b).toMatchObject({ date: second.date, endDate: second.date, startTime: second.startTime, adults: 2 });
      expect(b.total).toBe((await quote(tour._id, { date: second.date, startTime: second.startTime, adults: 2 }))!.total);
    } finally {
      await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "cancelled", reason: "QA cleanup" }, token);
      const full = await convexHttp<{ availability: { _id: string; date: string; startTime?: string; note?: string }[] }>("query", "admin/products:get", { id: tour._id }, token);
      for (const row of full.availability.filter((a) => a.date === first.date && a.note === "QA capacity")) {
        await convexHttp("mutation", "admin/products:clearAvailability", { id: row._id }, token);
      }
    }
  });

  test("seasons: the narrower season wins, the child price follows the adult price, lines carry the season name", async ({ page }) => {
    test.setTimeout(120_000);
    const token = await signInStaff(page);
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    expect(tour.pricingModel).toBe("per_person");
    const baseAdult = tour.priceAdult!;
    const baseChild = tour.priceChild ?? Math.round(baseAdult / 2);
    const { from } = bookingWindow();
    const day = addDaysIso(from, 60 + Math.floor(Math.random() * 40));
    const party = { date: day, adults: 2, children: 1 };

    const plain = await quote(tour._id, party);
    expect(plain!.seasonal).toBeFalsy();

    const omr = (baisa: number) => baisa / 1000;
    const peakAdult = baseAdult * 2;
    const wideAdult = Math.round(baseAdult * 1.5);
    const seasons: string[] = [];
    try {
      // A wide season (x1.5) around the day, and a one-day peak (x2) inside it created first: the latest-starting season wins, not the first created
      seasons.push(await convexHttp<string>("mutation", "admin/products:upsertSeason", { tourId: tour._id, name: { en: "QA peak", ar: "ذروة اختبار" }, startDate: day, endDate: day, priceAdultOmr: omr(peakAdult), isActive: true }, token));
      seasons.push(await convexHttp<string>("mutation", "admin/products:upsertSeason", { tourId: tour._id, name: { en: "QA wide", ar: "موسم اختبار" }, startDate: addDaysIso(day, -10), endDate: addDaysIso(day, 10), priceAdultOmr: omr(wideAdult), isActive: true }, token));

      const peak = await quote(tour._id, party);
      const peakChild = Math.round((baseChild * peakAdult) / baseAdult);
      expect(peak!.seasonal).toBe(true);
      expect(peak!.total).toBe(2 * peakAdult + peakChild);
      const adultLine = peak!.items.find((i) => i.kind === "adult")!;
      expect(adultLine.unitPrice).toBe(peakAdult);
      expect(adultLine.label.en).toContain("QA peak");
      expect(peak!.items.find((i) => i.kind === "child")!.unitPrice).toBe(peakChild);

      const wide = await quote(tour._id, { ...party, date: addDaysIso(day, -5) });
      expect(wide!.items.find((i) => i.kind === "adult")!.label.en).toContain("QA wide");
      expect(wide!.items.find((i) => i.kind === "child")!.unitPrice).toBe(Math.round((baseChild * wideAdult) / baseAdult));

      // The staff manual-booking suggestion uses the same season
      const suggested = await convexHttp<{ total: number; seasonal: boolean }>("query", "admin/bookings:suggestedTotal", { tourId: tour._id, date: day, adults: 2, children: 1, infants: 0 }, token);
      expect(suggested).toEqual({ total: peak!.total, seasonal: true });

      // Outside both seasons the tour price applies
      const after = await quote(tour._id, { ...party, date: addDaysIso(day, 11) });
      expect(after!.seasonal).toBeFalsy();
      expect(after!.items.find((i) => i.kind === "adult")!.unitPrice).toBe(baseAdult);
    } finally {
      for (const id of seasons) await convexHttp("mutation", "admin/products:removeSeason", { id }, token);
    }
  });

  test("payment link below the deposit needs staff consent; an overpayment is flagged; Arabic commas separate start times", async ({ page }) => {
    test.setTimeout(150_000);
    const token = await signInStaff(page);
    const tour = await tourBySlug("wadi-shab-bimmah-sinkhole-private");
    const [slot] = await openSlots(tour, 2, 1);
    const { bookingId } = await convexHttp<{ bookingId: string }>(
      "mutation",
      "admin/bookings:createManual",
      { tourId: tour._id, date: slot.date, startTime: slot.startTime, adults: 2, children: 0, infants: 0, traveller: traveller("Link"), locale: "en", source: "staff", totalOmr: 60, status: "inquiry" },
      token,
    );
    try {
      let b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      // Half the deposit: paying it would not confirm the booking, so the link is refused unless staff lower the deposit
      const half = Math.max(1, Math.floor(b.depositDue / 2));
      const refused = await convexHttp("mutation", "admin/bookings:issuePaymentLink", { id: bookingId, amountOmr: half / 1000 }, token).catch((e: { data?: unknown }) => e.data);
      expect(refused).toMatchObject({ code: "LINK_BELOW_DEPOSIT", minimum: b.depositDue });
      await convexHttp("mutation", "admin/bookings:issuePaymentLink", { id: bookingId, amountOmr: half / 1000, lowerDeposit: true }, token);
      b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      expect(b.depositDue).toBe(half);
      expect(b.audit.some((a) => a.action === "booking.deposit_lowered")).toBe(true);

      // A provider payment of more than the total confirms the booking but flags it for a refund of the excess
      const secret = envLocal("STRIPE_WEBHOOK_SECRET") ?? process.env.TEST_STRIPE_WEBHOOK_SECRET ?? "whsec_test_local_secret";
      const sessionId = `cs_test_over_${Date.now()}`;
      const payment = convexRun<{ amount: number; currency: string }>("testing:createPendingPayment", { reference: b.reference, provider: "stripe", providerSessionId: sessionId, currency: "OMR", amountOmr: b.total + 5000 });
      const body = JSON.stringify(stripeCheckoutCompletedEvent(sessionId, payment.amount, payment.currency));
      const res = await page.request.post(`${convexSiteUrl()}/webhooks/stripe`, { data: body, headers: { "content-type": "application/json", "stripe-signature": stripeSignature(body, secret) } });
      expect(res.status(), await res.text()).toBe(200);
      b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      expect(b).toMatchObject({ status: "confirmed", amountPaid: b.total + 5000, needsAttention: true, attentionReason: "overpaid" });
      await page.goto(`/en/admin/bookings/${bookingId}`);
      await expect(page.getByRole("alert").filter({ hasText: "paid more than the booking total" })).toBeVisible();

      // Start times typed with the Arabic comma are read as a list
      await page.goto(`/en/admin/products/${tour._id}?tab=details`);
      const times = page.locator("#te-start-times");
      await times.fill("08:00، 14:30");
      await expect(times).toHaveAttribute("aria-invalid", "false");
      await times.blur();
      await expect(times).toHaveValue("08:00, 14:30");
    } finally {
      await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "cancelled", reason: "QA cleanup" }, token).catch(() => undefined);
    }
  });

  test("calendar file of a multi-day booking: UTC start, last-day end, status follows the booking", async ({ page }) => {
    test.setTimeout(120_000);
    const token = await signInStaff(page);
    const tour = await tourBySlug("jabal-akhdar-2-day-overnight");
    expect(tour.durationDays ?? 1).toBeGreaterThan(1);
    const [slot] = await openSlots(tour, 1, 1);

    const { bookingId } = await convexHttp<{ bookingId: string }>(
      "mutation",
      "admin/bookings:createManual",
      { tourId: tour._id, date: slot.date, startTime: slot.startTime, adults: 2, children: 1, infants: 0, traveller: traveller("Ics"), locale: "en", source: "staff", totalOmr: 150, status: "inquiry" },
      token,
    );
    try {
      const b = await convexHttp<StaffBooking>("query", "admin/bookings:get", { id: bookingId }, token);
      const last = lastTourDay(slot.date, tour.durationDays);
      expect(b.endDate).toBe(last);
      const [hh, mm] = slot.startTime.split(":").map(Number);
      const startUtc = new Date(Date.UTC(+slot.date.slice(0, 4), +slot.date.slice(5, 7) - 1, +slot.date.slice(8, 10), hh - 4, mm));
      const dtStart = `DTSTART:${startUtc.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
      const dtEnd = `DTEND:${last.replace(/-/g, "")}T140000Z`; // 18:00 Oman on the last day

      // Unpaid hold: tentative, marked unpaid, no reminder and no voucher link
      let ics = await icsOf(page, b.voucherToken);
      expect(ics).toContain(dtStart);
      expect(ics).toContain(dtEnd);
      expect(ics).toContain("STATUS:TENTATIVE");
      expect(ics).toContain("Reserved, unpaid:");
      expect(ics).toContain("Oman time (GMT+4)");
      expect(ics).toContain("2 adults · 1 child");
      expect(ics).not.toContain("X-WR-TIMEZONE");
      expect(ics).not.toContain("BEGIN:VALARM");
      expect(ics).not.toContain("/api/voucher/");

      await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "confirmed" }, token);
      ics = await icsOf(page, b.voucherToken);
      expect(ics).toContain("STATUS:CONFIRMED");
      expect(ics).toContain(dtEnd);
      expect(ics).toContain("BEGIN:VALARM");
      expect(ics).toContain("/api/voucher/");
      expect(ics).not.toContain("Reserved, unpaid:");

      // A confirmed future trip cannot be marked in progress or completed without forcing it
      const early = await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "in_progress" }, token).catch((e: { data?: { code?: string } }) => e.data);
      expect(early).toMatchObject({ code: "STATUS_TOO_EARLY" });

      await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "cancelled", reason: "QA cleanup" }, token);
      ics = await icsOf(page, b.voucherToken);
      expect(ics).toContain("STATUS:CANCELLED");
      expect(ics).not.toContain("BEGIN:VALARM");
    } finally {
      await convexHttp("mutation", "admin/bookings:updateStatus", { id: bookingId, status: "cancelled", reason: "QA cleanup" }, token).catch(() => undefined);
    }
  });
});
