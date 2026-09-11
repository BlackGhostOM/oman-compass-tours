/**
 * Consent-gated analytics helpers.
 *
 * Consent is stored per browser (localStorage) and broadcast through the
 * `oct:consent` event so the pixel loader and the banner stay in sync.
 * Vercel Analytics is cookieless and always on; GA4 / Meta / Snap / TikTok
 * only load after the visitor opts in.
 */

export type Consent = { v: 1; analytics: boolean; marketing: boolean; at: number };

export const CONSENT_KEY = "oct_consent";
export const CONSENT_EVENT = "oct:consent";
export const OPEN_CONSENT_EVENT = "oct:open-consent";

export function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed.v !== 1) return null;
    return { v: 1, analytics: !!parsed.analytics, marketing: !!parsed.marketing, at: Number(parsed.at) || 0 };
  } catch {
    return null;
  }
}

export function writeConsent(choice: Pick<Consent, "analytics" | "marketing">): Consent {
  const consent: Consent = { v: 1, ...choice, at: Date.now() };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    /* storage unavailable: choice lives for this page only */
  }
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export const analyticsIds = {
  ga4: process.env.NEXT_PUBLIC_GA4_ID ?? "",
  meta: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  snap: process.env.NEXT_PUBLIC_SNAP_PIXEL_ID ?? "",
  tiktok: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "",
};

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;
type Snaptr = (...args: unknown[]) => void;
type Ttq = { track: (event: string, params?: Record<string, unknown>) => void };

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    snaptr?: Snaptr;
    ttq?: Ttq;
    dataLayer?: unknown[];
  }
}

const META_STANDARD: Record<string, string> = { view_item: "ViewContent", begin_checkout: "InitiateCheckout", purchase: "Purchase", generate_lead: "Lead", search: "Search", add_to_wishlist: "AddToWishlist" };
const SNAP_STANDARD: Record<string, string> = { view_item: "VIEW_CONTENT", begin_checkout: "START_CHECKOUT", purchase: "PURCHASE", generate_lead: "SIGN_UP", search: "SEARCH", add_to_wishlist: "ADD_TO_WISHLIST" };
const TIKTOK_STANDARD: Record<string, string> = { view_item: "ViewContent", begin_checkout: "InitiateCheckout", purchase: "CompletePayment", generate_lead: "SubmitForm", search: "Search", add_to_wishlist: "AddToWishlist" };

/**
 * Fires a GA4-style event to every pixel the visitor consented to. Safe to
 * call anywhere on the client: it is a no-op until the scripts have loaded.
 */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
    if (window.fbq) {
      const std = META_STANDARD[event];
      window.fbq(std ? "track" : "trackCustom", std ?? event, params);
    }
    if (window.snaptr) window.snaptr("track", SNAP_STANDARD[event] ?? "CUSTOM_EVENT_1", params);
    if (window.ttq) window.ttq.track(TIKTOK_STANDARD[event] ?? event, params);
  } catch {
    /* analytics must never break the page */
  }
}
