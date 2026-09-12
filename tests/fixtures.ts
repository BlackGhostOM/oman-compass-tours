import { test as base, expect } from "@playwright/test";

/**
 * Shared fixture: every page starts with the cookie banner already answered
 * (essential only) so it never intercepts clicks. `chat.spec.ts` tests the
 * banner itself and therefore uses the plain Playwright `test`.
 */
/** Hides the Next.js dev overlay badge, which otherwise sits on top of the support button and swallows clicks. */
export const HIDE_DEV_OVERLAY = `(() => { const css = "nextjs-portal{display:none!important}"; const add = () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }; if (document.head) add(); else document.addEventListener("DOMContentLoaded", add); })();`;

export const test = base.extend({
  context: async ({ context }, run) => {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem("oct_consent", JSON.stringify({ v: 1, analytics: false, marketing: false, at: Date.now() }));
      } catch {
        /* ignore */
      }
    });
    await context.addInitScript(HIDE_DEV_OVERLAY);
    await run(context);
  },
});

export { expect };
