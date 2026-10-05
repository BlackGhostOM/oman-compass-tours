/**
 * The booking calendar picks the day the customer clicked, in every browser time zone and both languages.
 *
 * Regression for: clicking a day saved the day before east of UTC (toISOString on a local-midnight cell),
 * the client's "today" being the UTC date, and the first bookable day not being Oman's tomorrow.
 */
import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convexHttp } from "./helpers";
import { addDaysIso, bookingWindow, omanTodayIso } from "../convex/lib/dates";

const SLUG = "wadi-shab-bimmah-sinkhole-private"; // OCT-002, per person, runs every day
const ZONES = ["Asia/Muscat", "Europe/Berlin", "Europe/London", "Asia/Kolkata", "America/New_York"] as const;
const LOCALES = ["en", "ar"] as const;

type Slot = { time: string; remaining: number; bookable: boolean };
type Day = { date: string; isBlackout: boolean; slots: Slot[] };

let tourId = "";
let days: Day[] = [];

test.beforeAll(async () => {
  const tour = await convexHttp<{ _id: string }>("query", "tours:forBooking", { slug: SLUG, locale: "en" });
  tourId = tour._id;
  const { from, to } = bookingWindow();
  days = (await convexHttp<{ dates: Day[] }>("query", "availability:forTour", { tourId, from, to })).dates;
});

const soldOut = (d: Day | undefined) => !d || d.isBlackout || d.slots.every((s) => !s.bookable);
/** First date on or after `start` that the calendar offers (not sold out). */
function firstOpenFrom(start: string): string {
  const day = days.find((d) => d.date >= start && !soldOut(d));
  if (!day) throw new Error(`No open day from ${start} on DEV for ${SLUG}`);
  return day.date;
}
const isBst = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "short" }).format(new Date(iso + "T12:00:00Z")).includes("BST");

/** The day each run clicks: two to six weeks out; for London a day still in British Summer Time when there is one. */
function targetDay(zone: string): string {
  const { from } = bookingWindow();
  if (zone === "Europe/London") {
    for (let d = addDaysIso(from, 3); d <= addDaysIso(from, 60); d = addDaysIso(d, 1)) if (isBst(d) && !soldOut(days.find((x) => x.date === d))) return d;
  }
  return firstOpenFrom(addDaysIso(from, 15 + ZONES.indexOf(zone as (typeof ZONES)[number]) * 7));
}

/** Waits until availability has loaded (a start time is enabled), which is also when the wizard has restored its draft. */
async function waitForWizard(page: Page) {
  await expect(page.locator("td[data-day]:not([data-outside])").first()).toBeVisible();
  await expect(page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}/ }).first()).toBeVisible({ timeout: 30_000 });
  // The wizard marks the draft as restored in the effect that follows; edits before that are not saved
  await page.waitForTimeout(500);
}

/** Moves the calendar forward until the day's own cell (not an outside day) is shown. */
async function showMonthOf(page: Page, iso: string) {
  const cell = page.locator(`td[data-day="${iso}"]:not([data-outside])`);
  for (let i = 0; i < 8 && !(await cell.isVisible()); i++) await page.locator(".rdp-button_next").click();
  await expect(cell).toBeVisible();
  return cell;
}

/** The summary's date line, formatted by the browser exactly as the app does (Oman day, short style). */
async function expectedSummaryDate(page: Page, iso: string, locale: string): Promise<string> {
  return page.evaluate(
    ([d, l]) => new Intl.DateTimeFormat(l === "ar" ? "ar-OM" : "en-GB", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric" }).format(new Date(d + "T12:00:00+04:00")),
    [iso, locale] as const,
  );
}

for (const zone of ZONES) {
  for (const locale of LOCALES) {
    test.describe(`calendar ${zone} ${locale}`, () => {
      test.use({ timezoneId: zone, locale: locale === "ar" ? "ar-OM" : "en-GB" });

      test(`clicking a day selects, shows and saves that same day`, async ({ page }) => {
        test.setTimeout(120_000);
        const today = omanTodayIso();
        const { from } = bookingWindow();
        const firstOpen = firstOpenFrom(from);

        await page.goto(`/${locale}/book/${SLUG}`);
        await waitForWizard(page);

        // Oman's today can never be booked; the first enabled day is Oman's tomorrow (unless that is sold out)
        for (const cell of await page.locator(`td[data-day="${today}"]`).all()) await expect(cell).toHaveAttribute("data-disabled", "true");
        const firstEnabled = page.locator("td[data-day]:not([data-outside]):not([data-disabled])").first();
        await expect(firstEnabled).toHaveAttribute("data-day", firstOpen);
        if (!soldOut(days.find((d) => d.date === from))) expect(firstOpen).toBe(from);
        // ... and it is the day the wizard starts on
        await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", firstOpen);

        // Click a real calendar cell
        const target = targetDay(zone);
        const cell = await showMonthOf(page, target);
        await cell.locator("button").click();

        await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", target);
        await expect(page.locator("aside dl dd").first()).toContainText(await expectedSummaryDate(page, target, locale));

        // The saved draft (debounced 600 ms) holds the same ISO day
        const sessionKey = await page.evaluate(() => window.localStorage.getItem("oct_session"));
        expect(sessionKey).toBeTruthy();
        await expect
          .poll(async () => (await convexHttp<{ data: { date: string } } | null>("query", "bookings:getDraft", { sessionKey, tourId }))?.data?.date, { timeout: 15_000 })
          .toBe(target);
      });
    });
  }
}

test.describe("calendar just after midnight in Oman", () => {
  for (const zone of ["Asia/Muscat", "Europe/London"] as const) {
    test.describe(zone, () => {
      test.use({ timezoneId: zone });

      test(`at 01:30 Oman time (still yesterday in UTC) today stays closed and tomorrow opens`, async ({ page }) => {
        test.setTimeout(120_000);
        // The next 01:30 in Oman, when the UTC date is still the previous day
        const omanToday = omanTodayIso();
        const fakeNow = Date.parse(`${addDaysIso(omanToday, 1)}T01:30:00+04:00`);
        const fakeOmanToday = addDaysIso(omanToday, 1);
        const fakeTomorrow = addDaysIso(omanToday, 2);
        expect(new Date(fakeNow).toISOString().slice(0, 10)).toBe(omanToday); // UTC is a day behind

        await page.clock.setFixedTime(fakeNow);
        await page.goto(`/en/book/${SLUG}`);
        await waitForWizard(page);

        for (const cell of await page.locator(`td[data-day="${fakeOmanToday}"]`).all()) await expect(cell).toHaveAttribute("data-disabled", "true");
        const fakeDays = (await convexHttp<{ dates: Day[] }>("query", "availability:forTour", { tourId, from: fakeTomorrow, to: addDaysIso(fakeTomorrow, 30) })).dates;
        const expectedFirst = fakeDays.find((d) => !soldOut(d))!.date;
        await expect(page.locator("td[data-day]:not([data-outside]):not([data-disabled])").first()).toHaveAttribute("data-day", expectedFirst);
        await expect(page.locator("td[data-selected]:not([data-outside])")).toHaveAttribute("data-day", expectedFirst);
        await expect(page.locator("aside dl dd").first()).toContainText(await expectedSummaryDate(page, expectedFirst, "en"));
      });
    });
  }
});
