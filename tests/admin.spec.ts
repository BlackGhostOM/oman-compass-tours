import { expect, test, type Page } from "@playwright/test";

const OWNER = { email: "owner@omancompasstours.com", password: "OmanCompass!2026" };
const CUSTOMER = { email: "customer@example.com", password: "Traveller!2026" };

async function signIn(page: Page, account: { email: string; password: string }, redirect = "/admin") {
  await page.goto(`/en/sign-in?redirect=${encodeURIComponent(redirect)}`);
  await page.locator("#auth-email").fill(account.email);
  await page.locator("#auth-password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(new RegExp(`/en${redirect.replace(/\//g, "\/")}`));
}

test.describe("Staff dashboard", () => {
  test("owner sees the overview and the dashboard renders in Arabic (RTL)", async ({ page }) => {
    await signIn(page, OWNER);
    await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
    await expect(page.getByText("Departures today", { exact: true }).first()).toBeVisible();

    await page.goto("/ar/admin");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "اليوم بنظرة سريعة" })).toBeVisible();
  });

  test("staff creates a manual booking and changes its status through the workflow", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/en/admin/bookings?new=1");
    const dialog = page.getByRole("dialog", { name: "Create manual booking" });
    await expect(dialog).toBeVisible();

    // Tour select (Radix): open the first combobox and pick the Muscat city tour
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Experience Muscat City Tour/ }).click();

    await dialog.getByLabel("First name").fill("Walk-in");
    await dialog.getByLabel("Last name").fill("Guest");
    await dialog.getByLabel("Email", { exact: true }).fill(`walkin+${Date.now()}@example.com`);
    await dialog.locator("#mb-phone").fill("92255028");
    await dialog.getByRole("button", { name: "Create booking" }).click();

    // Redirects to the booking detail page
    await page.waitForURL(/\/en\/admin\/bookings\/[a-z0-9]+$/);
    await expect(page.getByText(/^OCT-[A-Z0-9]{6}$/)).toBeVisible();
    const workflow = page.locator("section").filter({ has: page.getByRole("heading", { name: "Status workflow" }) });
    await expect(workflow).toBeVisible();

    // Manual bookings default to "confirmed"; move to "in progress" then "completed"
    await workflow.getByRole("button", { name: "In progress" }).click();
    await expect(page.getByText("Status updated.").first()).toBeVisible();
    await expect(workflow.getByRole("button", { name: "In progress" })).toBeDisabled();

    await workflow.getByRole("button", { name: "Completed" }).click();
    await expect(workflow.getByRole("button", { name: "Completed" })).toBeDisabled();

    // Persisted: after a reload the header badge and the workflow both show the new status
    await page.reload();
    await expect(workflow.getByRole("button", { name: "Completed" })).toBeDisabled();
    expect(await page.getByText("Completed", { exact: true }).count()).toBeGreaterThanOrEqual(2);

    // The change shows up in the audit log
    await page.goto("/en/admin/audit");
    await expect(page.getByRole("cell", { name: "booking.status_change" }).first()).toBeVisible();
  });

  test("bookings list filters by status and opens a booking", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/en/admin/bookings");
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    const firstRef = page.getByRole("link", { name: /^OCT-/ }).first();
    await expect(firstRef).toBeVisible();
    const ref = await firstRef.textContent();
    await firstRef.click();
    await page.waitForURL(/\/en\/admin\/bookings\/[a-z0-9]+$/);
    await expect(page.getByText(ref!.trim())).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  });

  test("customer accounts are blocked from the dashboard", async ({ page }) => {
    await signIn(page, CUSTOMER);
    await expect(page.getByRole("heading", { name: "Staff access only" })).toBeVisible();
  });
});
