import { expect, test } from "@playwright/test";
import { HIDE_DEV_OVERLAY } from "./fixtures";

test.describe("Live chat & consent", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(HIDE_DEV_OVERLAY);
    await context.addInitScript(() => { try { window.sessionStorage.setItem("oct_preview_notice_v1", String(Date.now())); } catch { /* ignore */ } });
  });

  test("cookie banner: essential-only choice is remembered", async ({ page }) => {
    await page.goto("/en");
    const banner = page.getByRole("dialog", { name: "Cookies & privacy" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Cookies & privacy" })).toHaveCount(0);
    // Footer link reopens the banner in manage mode
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.getByRole("dialog", { name: "Cookies & privacy" })).toBeVisible();
    await expect(page.getByRole("switch", { name: /Analytics/ })).toBeVisible();
  });

  test("visitor chats with the assistant and asks for a human", async ({ page }) => {
    await page.goto("/en/tours");
    await page.getByRole("dialog", { name: "Cookies & privacy" }).getByRole("button", { name: "Essential only" }).click();

    await page.getByRole("button", { name: "Contact us" }).click();
    await page.getByRole("button", { name: /Live chat/ }).click();
    const sheet = page.getByRole("dialog", { name: "Live chat" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/Marhaba/)).toBeVisible();

    // Quick prompt sends a message; the AI concierge (or its offline fallback) replies
    await sheet.getByRole("button", { name: "Price for Wadi Shab" }).click();
    await expect(sheet.getByText("Price for Wadi Shab", { exact: true })).toBeVisible();
    await expect(sheet.getByText(/Oman Compass assistant · /)).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "docs/screenshots/en-chat-desktop.png" });

    // Human handoff asks for contact details first, then posts the system notice
    await sheet.getByRole("button", { name: "Talk to a team member" }).first().click();
    await sheet.getByLabel("Name").fill("Playwright Visitor");
    await sheet.locator("#chat-phone").fill("92255028");
    await sheet.getByRole("button", { name: "Connect me" }).click();
    await expect(sheet.getByText(/Handing you over to a team member/)).toBeVisible();
    await expect(sheet.getByText(/A team member will join shortly/)).toBeVisible();

    // While waiting for a person, the assistant keeps answering new questions
    await sheet.getByPlaceholder("Type your message…").fill("How much is the Muscat city tour price for two?");
    await sheet.getByRole("button", { name: "Send" }).click();
    await expect(sheet.getByText(/Oman Compass assistant · /).nth(1)).toBeVisible({ timeout: 20_000 });

    // The conversation survives a reload for the same anonymous session
    await page.reload();
    await page.getByRole("button", { name: "Contact us" }).click();
    await page.getByRole("button", { name: /Live chat/ }).click();
    await expect(page.getByRole("dialog", { name: "Live chat" }).getByText("Price for Wadi Shab", { exact: true })).toBeVisible();
  });

  test("staff sees the handed-off conversation in the inbox and replies", async ({ page }) => {
    await page.goto("/en/sign-in?redirect=%2Fadmin%2Finbox");
    await page.locator("#auth-email").fill("owner@omancompasstours.com");
    await page.locator("#auth-password").fill("OmanCompass!2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/en\/admin\/inbox/);
    const row = page.getByRole("button", { name: /Playwright Visitor/ }).first();
    await expect(row).toBeVisible();
    await row.click();
    await page.getByPlaceholder(/Type a reply/).fill("Hello from the team, how can we help?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(row).toContainText("Hello from the team, how can we help?");
  });
});
