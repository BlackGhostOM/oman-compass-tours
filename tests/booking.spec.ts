import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { convexRun, convexSiteUrl, envLocal, stripeCheckoutCompletedEvent, stripeSignature, testTraveller } from "./helpers";

const STRIPE_WEBHOOK_SECRET = envLocal("STRIPE_WEBHOOK_SECRET") ?? process.env.TEST_STRIPE_WEBHOOK_SECRET ?? "whsec_test_local_secret";

async function fillWizardToPayment(page: Page) {
  // A date a few weeks out keeps repeated runs from exhausting the slot capacity of "tomorrow"
  const date = new Date(Date.now() + (20 + Math.floor(Math.random() * 60)) * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/en/book/experience-muscat-city-tour?date=${date}`);
  await expect(page.getByRole("heading", { name: /Choose your date/ })).toBeVisible();

  // Step 1: pick the first time slot that still has capacity and continue
  const timeButtons = page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}/ });
  await timeButtons.first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: traveller details
  await expect(page.getByRole("heading", { name: "Lead traveller" })).toBeVisible();
  await page.getByLabel("First name").fill(testTraveller.firstName);
  await page.getByLabel("Last name").fill(testTraveller.lastName);
  await page.getByRole("combobox").filter({ hasText: /Select…/ }).click();
  await page.getByRole("option", { name: "United Kingdom" }).click();
  await page.locator("#phone").fill(testTraveller.phoneNational);
  await page.getByLabel("Email").fill(testTraveller.email);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: review + policies
  await expect(page.getByRole("heading", { name: "Review your booking" })).toBeVisible();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page.getByRole("heading", { name: "Payment", exact: true })).toBeVisible();
}

test.describe("Booking flow", () => {
  test("wizard → reserve now, pay later → confirmation page with reference", async ({ page }) => {
    await fillWizardToPayment(page);
    await page.getByRole("button", { name: /Reserve now, pay later/ }).click();
    await page.getByRole("button", { name: "Reserve my place" }).click();

    await page.waitForURL(/\/en\/booking\/OCT-[A-Z0-9]{6}\?t=/);
    await expect(page.getByRole("heading", { name: /Your place is reserved/ })).toBeVisible();
    const reference = page.url().match(/OCT-[A-Z0-9]{6}/)![0];
    expect(reference).toMatch(/^OCT-/);
    await expect(page.getByRole("link", { name: /Add to calendar/ })).toBeVisible();
  });

  test("verified Stripe webhook confirms the booking and unlocks the voucher", async ({ page, request }) => {
    test.setTimeout(120_000);
    await fillWizardToPayment(page);
    await page.getByRole("button", { name: /Reserve now, pay later/ }).click();
    await page.getByRole("button", { name: "Reserve my place" }).click();
    await page.waitForURL(/\/en\/booking\/OCT-[A-Z0-9]{6}\?t=/);
    const url = new URL(page.url());
    const reference = url.pathname.match(/OCT-[A-Z0-9]{6}/)![0];
    const token = url.searchParams.get("t")!;

    // Voucher is locked until payment is confirmed
    const locked = await request.get(`/api/voucher/${token}`);
    expect(locked.status()).toBe(409);

    // A pending Stripe checkout session exists for this booking (created by startCheckout in real life)
    const sessionId = `cs_test_${Date.now()}`;
    const payment = convexRun<{ amount: number; currency: string }>("testing:createPendingPayment", { reference, provider: "stripe", providerSessionId: sessionId });

    // Stripe posts a signed event to the Convex HTTP endpoint
    const body = JSON.stringify(stripeCheckoutCompletedEvent(sessionId, payment.amount, payment.currency));
    const res = await request.post(`${convexSiteUrl()}/webhooks/stripe`, {
      data: body,
      headers: { "content-type": "application/json", "stripe-signature": stripeSignature(body, STRIPE_WEBHOOK_SECRET) },
    });
    expect(res.status(), await res.text()).toBe(200);

    // An unsigned/forged event is rejected
    const forged = await request.post(`${convexSiteUrl()}/webhooks/stripe`, { data: body, headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" } });
    expect(forged.status()).toBe(400);

    // Booking flips to confirmed (reactive UI)
    await page.reload();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible({ timeout: 20_000 });
    const status = convexRun<{ status: string; amountPaid: number }>("testing:bookingStatus", { reference });
    expect(status.status).toBe("confirmed");
    expect(status.amountPaid).toBeGreaterThan(0);

    // Voucher PDF + calendar file
    const pdf = await request.get(`/api/voucher/${token}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

    const ics = await request.get(`/api/calendar/${token}`);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VEVENT");
  });

  test("Stripe hosted checkout (test mode)", async ({ page }) => {
    test.skip(!envLocal("STRIPE_SECRET_KEY"), "STRIPE_SECRET_KEY not configured — hosted checkout test skipped");
    await fillWizardToPayment(page);
    await page.getByRole("radio", { name: /Card/ }).click();
    await page.getByRole("button", { name: /Continue to secure payment/ }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
    await expect(page.locator("body")).toContainText(/Oman Compass|OCT-/);
  });
});
