/**
 * Customer side of the Wave 2 booking fixes (no sign-in, nothing is booked): the browser Back and Forward buttons
 * move between wizard steps, and the Review step shows the party, the line items and the totals the server quotes.
 */
import { expect, test } from "./fixtures";
import { convexHttp, testTraveller } from "./helpers";
import { addDaysIso, bookingWindow } from "../convex/lib/dates";
import type { BookingTour } from "../src/components/booking/types";

type Slot = { time: string; remaining: number; bookable: boolean };
type Day = { date: string; isBlackout: boolean; operating?: boolean; slots: Slot[] };
type Quote = { total: number; depositDue: number; balanceDue: number; items: { kind: string; total: number }[] } | null;

const SLUG = "wadi-shab-bimmah-sinkhole-private";
const omr = (baisa: number) => new Intl.NumberFormat("en", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(baisa / 1000);

async function openDay(tour: BookingTour, needed: number): Promise<{ date: string; startTime: string }> {
  const { from, to } = bookingWindow();
  const start = addDaysIso(from, 30 + Math.floor(Math.random() * 60));
  const days = (await convexHttp<{ dates: Day[] }>("query", "availability:forTour", { tourId: tour._id, from: start, to })).dates;
  for (const d of days) {
    if (d.isBlackout || d.operating === false) continue;
    const slot = d.slots.find((s) => s.bookable && s.remaining >= needed);
    if (slot) return { date: d.date, startTime: slot.time };
  }
  throw new Error(`No open day for ${tour.code}`);
}

test.describe("Booking wizard: history and review", () => {
  test("browser Back and Forward move between steps; Review shows the party and the quoted totals", async ({ page }) => {
    test.setTimeout(120_000);
    const tour = await convexHttp<BookingTour>("query", "tours:forBooking", { slug: SLUG, locale: "en" });
    const { date, startTime } = await openDay(tour, 3);
    await page.goto(`/en/book/${SLUG}?date=${date}`);
    await expect(page.getByRole("heading", { name: /Choose your date/ })).toBeVisible();
    await page.locator("button:not([disabled])", { hasText: new RegExp(`^${startTime}`) }).first().click();
    await page.getByRole("button", { name: "Add one child", exact: true }).click();
    await expect(page.locator("#children")).toHaveValue("1");
    const adults = Number(await page.locator("#adults").inputValue());
    await page.getByRole("button", { name: "Continue" }).click();

    // Step 2 has its own history entry
    await expect(page.getByRole("heading", { name: "Lead traveller" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]step=2/);
    await page.goBack();
    await expect(page.getByRole("heading", { name: /Choose your date/ })).toBeVisible();
    await expect(page).not.toHaveURL(/step=/);
    await expect(page.locator("#children")).toHaveValue("1"); // the selection survives
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Lead traveller" })).toBeVisible();

    await page.getByLabel("First name").fill(testTraveller.firstName);
    await page.getByLabel("Last name").fill(testTraveller.lastName);
    await page.getByRole("combobox").filter({ hasText: /Select…/ }).click();
    await page.getByRole("option", { name: "United Kingdom" }).click();
    await page.locator("#phone").fill(testTraveller.phoneNational);
    await page.getByLabel("Email").fill(testTraveller.email);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    await expect(page).toHaveURL(/[?&]step=3/);

    // The review card itself shows the guests and the price the server quotes
    const q = (await convexHttp<Quote>("query", "bookings:quote", { tourId: tour._id, date, startTime, adults, children: 1, infants: 0, addOns: [] }))!;
    const card = page.locator("dl").filter({ hasText: "Lead traveller" });
    await expect(card).toContainText(`${adults} adult`);
    await expect(card).toContainText("1 child");
    const price = card.locator("div").filter({ has: page.locator("dt", { hasText: /^Price$/ }) }).last();
    await expect(price.getByText("Total", { exact: true })).toBeVisible();
    await expect(price).toContainText(omr(q.total));
    if (q.depositDue < q.total) {
      await expect(price).toContainText(omr(q.depositDue));
      await expect(price).toContainText(omr(q.balanceDue));
      await expect(price).toContainText("Balance paid to your guide");
    }

    // Back from Review returns to the traveller step, then to step 1
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Lead traveller" })).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue(testTraveller.firstName);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: /Choose your date/ })).toBeVisible();
  });
});
