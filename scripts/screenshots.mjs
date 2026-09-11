/**
 * Captures key pages in both locales at desktop + mobile widths.
 *   node scripts/screenshots.mjs [baseUrl]
 * Output: docs/screenshots/<locale>-<page>-<viewport>.png
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const pages = [
  ["home", "/"],
  ["tours", "/tours"],
  ["tour", "/tours/experience-muscat-city-tour"],
  ["about", "/about"],
  ["contact", "/contact"],
  ["booking-methods", "/booking-methods"],
  ["policies", "/policies/terms"],
  ["book", "/book/experience-muscat-city-tour"],
];
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
for (const locale of ["en", "ar"]) {
  for (const [vpName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const [name, path] of pages) {
      const url = `${base}/${locale}${path === "/" ? "" : path}`;
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(800);
        await page.screenshot({
          path: `docs/screenshots/${locale}-${name}-${vpName}.png`,
          fullPage: true,
        });
        console.log("✓", locale, name, vpName);
      } catch (err) {
        console.warn("✗", locale, name, vpName, String(err).split("\n")[0]);
      }
    }
    await context.close();
  }
}
await browser.close();
