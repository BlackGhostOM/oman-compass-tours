/**
 * How long an unpaid booking keeps its place, shared by bookings.create, admin createManual / updateStatus,
 * payments.startCheckout and the booking wizard (so the deadline the customer is shown is the one enforced).
 *
 * Pure apart from loadHoldSettings (type-only Convex imports), so client components can import it too.
 *
 * - pay_now: a short checkout hold (booking.checkoutHoldMinutes, default 60). Opening a provider session
 *   extends it (CHECKOUT_SESSION_COVER_MS), so an abandoned checkout releases the departure within the hour.
 * - pay_later: tour.holdHours ("Reserve now, pay later").
 * - staff: a week, for bookings staff put on hold from the dashboard.
 *
 * Every hold ends no later than departure minus booking.payBeforeDepartureHours (default 2 h), so nobody is
 * told to pay by a time after the tour has left.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { departureMs } from "./dates";

export type HoldKind = "pay_now" | "pay_later" | "staff";
export type HoldSettings = { checkoutHoldMinutes: number; payBeforeDepartureHours: number };

export const DEFAULT_HOLD_SETTINGS: HoldSettings = { checkoutHoldMinutes: 60, payBeforeDepartureHours: 2 };
/** A hold shorter than this is not worth offering (pay-later is refused instead). */
export const MIN_HOLD_WINDOW_MS = 60 * 60_000;
export const STAFF_HOLD_MS = 7 * 24 * 3_600_000;
/**
 * How long an opened checkout keeps the booking's place: longer than Stripe's 1 h session and the 55-minute
 * session reuse in createPaymentRecord, so a customer paying on the provider page never loses the place mid-payment.
 */
export const CHECKOUT_SESSION_COVER_MS = 65 * 60_000;

/** When an unpaid hold must end, or null when less than MIN_HOLD_WINDOW_MS would be left before the pay-by cutoff. */
export function holdExpiryFor(args: {
  tour: { holdHours: number };
  date: string;
  startTime: string;
  kind: HoldKind;
  now: number;
  settings?: HoldSettings;
}): number | null {
  const settings = args.settings ?? DEFAULT_HOLD_SETTINGS;
  const base =
    args.kind === "pay_now" ? settings.checkoutHoldMinutes * 60_000
    : args.kind === "pay_later" ? Math.max(0, args.tour.holdHours) * 3_600_000
    : STAFF_HOLD_MS;
  let expiry = args.now + base;
  const departure = departureMs(args.date, args.startTime);
  if (Number.isFinite(departure)) expiry = Math.min(expiry, departure - settings.payBeforeDepartureHours * 3_600_000);
  return expiry - args.now >= MIN_HOLD_WINDOW_MS ? expiry : null;
}

/**
 * The hold to use when holdExpiryFor returns null but a hold must still be set (pay-now checkout, staff hold close
 * to departure): one checkout window, never past the departure itself.
 */
export function fallbackHoldExpiry(date: string, startTime: string, now: number, settings: HoldSettings = DEFAULT_HOLD_SETTINGS): number {
  const window = now + settings.checkoutHoldMinutes * 60_000;
  const departure = departureMs(date, startTime);
  return Number.isFinite(departure) && departure > now ? Math.min(window, departure) : window;
}

/** True once the departure instant (Oman time) has passed. */
export function hasDeparted(date: string, startTime: string | undefined | null, now: number): boolean {
  const departure = departureMs(date, startTime || "00:00");
  return Number.isFinite(departure) && departure <= now;
}

/**
 * Why an unpaid booking can no longer be paid online, or null when it still can. Confirmed bookings (balance) stay payable.
 *
 * Mirrors bookings.expireIfDue: a hold is only released when nothing has been paid and holdExpiresAt is set. A partly
 * paid hold, or a legacy unpaid booking with no holdExpiresAt, keeps its place, so it stays payable until departure.
 */
export function unpayableReason(
  b: { status: string; holdExpiresAt?: number | null; date: string; startTime?: string | null; amountPaid?: number | null },
  now: number,
): "status" | "hold_expired" | "departed" | null {
  if (b.status === "confirmed") return null;
  if (b.status !== "inquiry" && b.status !== "pending_payment") return "status";
  if (hasDeparted(b.date, b.startTime, now)) return "departed";
  if ((b.amountPaid ?? 0) > 0 || b.holdExpiresAt == null) return null;
  if (b.holdExpiresAt <= now) return "hold_expired";
  return null;
}

/**
 * The latest an opened checkout may stretch a hold: once set (holdCeilingAt) it never moves, otherwise the current
 * hold plus one checkout window. Shared by payments.createPaymentRecord and bookings.expireIfDue, so repeated
 * checkout starts cannot keep a place locked indefinitely.
 */
export function holdCeiling(b: { holdExpiresAt?: number | null; holdCeilingAt?: number | null }, now: number): number {
  return b.holdCeilingAt ?? (b.holdExpiresAt ?? now) + CHECKOUT_SESSION_COVER_MS;
}

function positiveNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/** siteSettings booking.checkoutHoldMinutes (default 60) and booking.payBeforeDepartureHours (default 2; 0 allowed). */
export async function loadHoldSettings(ctx: QueryCtx | MutationCtx): Promise<HoldSettings> {
  const [checkout, payBefore] = await Promise.all(
    ["booking.checkoutHoldMinutes", "booking.payBeforeDepartureHours"].map((key) =>
      ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", key)).unique(),
    ),
  );
  const payBeforeRaw = typeof payBefore?.value === "string" ? Number(payBefore.value) : payBefore?.value;
  return {
    checkoutHoldMinutes: Math.max(30, positiveNumber(checkout?.value) ?? DEFAULT_HOLD_SETTINGS.checkoutHoldMinutes),
    payBeforeDepartureHours:
      typeof payBeforeRaw === "number" && Number.isFinite(payBeforeRaw) && payBeforeRaw >= 0 ? payBeforeRaw : DEFAULT_HOLD_SETTINGS.payBeforeDepartureHours,
  };
}
