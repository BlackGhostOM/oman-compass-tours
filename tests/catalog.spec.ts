import { expect, test } from "@playwright/test";

test.describe("Tour search & filters", () => {
  test("search finds the Wadi Shab tour", async ({ page }) => {
    await page.goto("/en/tours");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tours & experiences");
    const search = page.getByPlaceholder(/Search tours/);
    await search.fill("wadi shab");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=wadi\+shab|q=wadi%20shab/);
    await expect(page.getByRole("heading", { name: /Wadi Shab/ }).first()).toBeVisible();
    await expect(page.getByText(/No tours found/)).toHaveCount(0);
  });

  test("category filter narrows results via URL", async ({ page }) => {
    await page.goto("/en/tours?category=desert_4x4");
    await expect(page.getByRole("heading", { name: /Wahiba Sands/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Muscat City Tour/ })).toHaveCount(0);
  });

  test("tour detail shows pricing, itinerary and a Book button", async ({ page }) => {
    await page.goto("/en/tours/experience-muscat-city-tour");
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Itinerary" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Check availability/ })).toHaveAttribute("href", /\/en\/book\/experience-muscat-city-tour/);
  });
});
