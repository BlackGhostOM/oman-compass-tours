import { expect, test } from "@playwright/test";

test.describe("Language switch", () => {
  test("keeps the visitor on the same page when switching EN ⇄ AR", async ({ page }) => {
    await page.goto("/en/tours/experience-muscat-city-tour");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Experience Muscat City Tour");

    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByRole("menuitem", { name: /العربية/ }).click();

    await page.waitForURL(/\/ar\/tours\//);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("جولة مسقط");

    // and back
    await page.getByRole("button", { name: "تغيير اللغة" }).click();
    await page.getByRole("menuitem", { name: /English/ }).click();
    await page.waitForURL(/\/en\/tours\/experience-muscat-city-tour/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("root redirects to a locale and remembers the choice", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|ar)$/);
    await page.goto("/ar");
    await page.goto("/");
    await expect(page).toHaveURL(/\/ar$/);
  });
});
