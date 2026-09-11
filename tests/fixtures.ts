import { test as base, expect } from "@playwright/test";

/**
 * Shared fixture: every page starts with the cookie banner already answered
 * (essential only) so it never intercepts clicks. `chat.spec.ts` tests the
 * banner itself and therefore uses the plain Playwright `test`.
 */
export const test = base.extend({
  context: async ({ context }, run) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("oct_consent", JSON.stringify({ v: 1, analytics: false, marketing: false, at: Date.now() }));
      } catch {
        /* ignore */
      }
    });
    await run(context);
  },
});

export { expect };
