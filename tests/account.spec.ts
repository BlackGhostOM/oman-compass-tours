import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const CUSTOMER = { email: "customer@example.com", password: "Traveller!2026" };

async function signIn(page: Page) {
  await page.goto("/en/sign-in");
  await page.locator("#auth-email").fill(CUSTOMER.email);
  await page.locator("#auth-password").fill(CUSTOMER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/en\/account/);
}

test.describe("Customer account", () => {
  test("protected route redirects guests to sign-in", async ({ page }) => {
    await page.goto("/en/account");
    // The redirect target is locale-less: the locale-aware router adds the prefix on the way back.
    await expect(page).toHaveURL(/\/en\/sign-in\?redirect=%2Faccount$/);
  });

  test("deep link survives sign-in without doubling the locale prefix", async ({ page }) => {
    await page.goto("/ar/account/wishlist");
    await expect(page).toHaveURL(/\/ar\/sign-in\?redirect=%2Faccount%2Fwishlist$/);
    await page.locator("#auth-email").fill(CUSTOMER.email);
    await page.locator("#auth-password").fill(CUSTOMER.password);
    await page.locator("#auth-password").press("Enter");
    await page.waitForURL(/\/ar\/account\/wishlist$/);
    await expect(page.getByText("404")).toHaveCount(0);
  });

  test("customer signs in, sees seeded bookings and downloads the voucher", async ({ page, request, context }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Upcoming trips" })).toBeVisible();
    const card = page.locator("article").filter({ hasText: "Experience Muscat City Tour" }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Confirmed")).toBeVisible();

    const voucherLink = card.getByRole("link", { name: /Voucher/ });
    const href = await voucherLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/voucher\//);

    // Download through the authenticated browser context (cookies carried over)
    const res = await request.get(href!, { headers: { cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
  });

  test("wishlist toggle and profile save", async ({ page }) => {
    await signIn(page);
    await page.goto("/en/tours/wadi-shab-bimmah-sinkhole-private");
    const heart = page.getByRole("button", { name: /Save to wishlist|Remove from wishlist/ });
    await expect(heart).toHaveAttribute("aria-busy", "false"); // auth + saved list resolved
    const wasSaved = (await heart.getAttribute("aria-pressed")) === "true";
    await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", wasSaved ? "false" : "true");

    await page.goto("/en/account/profile");
    await page.getByLabel("Full name").fill("Sara Traveller");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
  });

  test("account pages render in Arabic (RTL)", async ({ page }) => {
    await signIn(page);
    await page.goto("/ar/account");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "الرحلات القادمة" })).toBeVisible();
  });
});
