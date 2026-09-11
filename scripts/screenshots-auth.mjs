/**
 * Captures authenticated dashboard pages (customer + staff) in both locales.
 *   node scripts/screenshots-auth.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const accounts = {
  customer: { email: "customer@example.com", password: "Traveller!2026", pages: [["account", "/account"], ["account-payments", "/account/payments"], ["account-travellers", "/account/travellers"], ["account-loyalty", "/account/loyalty"]] },
  staff: { email: "owner@omancompasstours.com", password: "OmanCompass!2026", pages: [["admin", "/admin"], ["admin-bookings", "/admin/bookings"], ["admin-products", "/admin/products"], ["admin-inbox", "/admin/inbox"]] },
};

mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
for (const [role, acc] of Object.entries(accounts)) {
  for (const locale of ["en", "ar"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${base}/${locale}/sign-in`, { waitUntil: "networkidle" });
      await page.locator("#auth-email").fill(acc.email);
      await page.locator("#auth-password").fill(acc.password);
      await page.locator("#auth-password").press("Enter");
      await page.waitForURL(/\/(account|admin)/, { timeout: 30_000 });
      for (const [name, path] of acc.pages) {
        try {
          await page.goto(`${base}/${locale}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
          await page.waitForTimeout(1200);
          await page.screenshot({ path: `docs/screenshots/${locale}-${name}-desktop.png`, fullPage: true });
          console.log("✓", locale, name);
        } catch (err) {
          console.warn("✗", locale, name, String(err).split("\n")[0]);
        }
      }
      if (role === "customer" && locale === "en") {
        // Dark mode variant of the dashboard
        await page.goto(`${base}/en/account`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: /Dark mode/ }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `docs/screenshots/en-account-dark-desktop.png`, fullPage: true });
        console.log("✓ en account dark");
      }
    } catch (err) {
      console.warn("✗ sign-in", role, locale, String(err).split("\n")[0]);
    }
    await context.close();
  }
}
await browser.close();
