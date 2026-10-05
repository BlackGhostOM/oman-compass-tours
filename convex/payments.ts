import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, query, type MutationCtx } from "./_generated/server";
import { capturePaypalOrder } from "./gateways/paypal";
import { configuredProviders, defaultProviderFor, getProvider } from "./gateways/registry";
import type { NormalizedEvent, ProviderId } from "./gateways/provider";
import { requireStaff, audit } from "./lib/access";
import { generateToken } from "./lib/ids";
import { remainingCapacity } from "./lib/capacity";
import { departureMs } from "./lib/dates";
import { CHECKOUT_SESSION_COVER_MS, hasDeparted, holdCeiling, unpayableReason } from "./lib/holds";
import { capacityUnits } from "./lib/pricing";
import { baisaToMinor, FALLBACK_RATES, type Currency } from "./lib/money";
import { currencyValidator, paymentKindValidator, paymentProviderValidator } from "./schema";

const PROVIDER_IDS = ["thawani", "stripe", "paypal"] as const;

/**
 * The checkout success/cancel URLs are built from the caller-supplied origin. Once SITE_URL is configured,
 * only our own site (and local development) may receive the provider redirect, so a hosted checkout page
 * cannot be made to bounce a payer to a third-party site.
 */
function isAllowedOrigin(origin: string): boolean {
  if (!/^https?:\/\/[^/]+$/.test(origin)) return false;
  const site = process.env.SITE_URL;
  if (!site) return true;
  const strip = (host: string) => host.replace(/^www\./, "");
  try {
    const host = new URL(origin).host;
    if (host === "localhost" || host.startsWith("localhost:") || host.startsWith("127.0.0.1")) return true;
    return strip(host) === strip(new URL(site).host);
  } catch {
    return false;
  }
}
const providerIdValidator = v.union(v.literal("thawani"), v.literal("stripe"), v.literal("paypal"));

/* ------------------------------------------------------------------ */
/* Public: available providers / FX for the checkout page              */
/* ------------------------------------------------------------------ */

export const checkoutOptions = query({
  args: { country: v.optional(v.string()) },
  handler: async (ctx, { country }) => {
    const rates = await ctx.db.query("fxRates").take(20);
    const fx: Record<string, number> = { ...FALLBACK_RATES };
    for (const r of rates) fx[r.quote] = r.rate;
    const configured = configuredProviders();
    const disabled = ((await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "payments.disabledProviders")).unique())?.value as ProviderId[] | undefined) ?? [];
    const available = configured.filter((p) => !disabled.includes(p));
    return {
      providers: available,
      allProviders: [...PROVIDER_IDS],
      defaultProvider: defaultProviderFor(country, available),
      rates: fx,
      ratesFetchedAt: rates[0]?.fetchedAt ?? null,
      apiVerification: process.env.PAYMENTS_TRUST_API_VERIFICATION === "true",
    };
  },
});

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

export const getBookingForCheckout = internalQuery({
  args: { reference: v.string(), token: v.string() },
  handler: async (ctx, { reference, token }) => {
    const b = await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", reference.toUpperCase())).unique();
    if (!b || b.voucherToken !== token) return null;
    const rates = await ctx.db.query("fxRates").take(20);
    const fx: Record<string, number> = { ...FALLBACK_RATES };
    for (const r of rates) fx[r.quote] = r.rate;
    return { booking: b, fx };
  },
});

export const createPaymentRecord = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    provider: paymentProviderValidator,
    kind: paymentKindValidator,
    amount: v.number(),
    currency: currencyValidator,
    amountOmr: v.number(),
    fxRate: v.number(),
    createdByStaffId: v.optional(v.id("users")),
  },
  returns: v.object({ paymentId: v.id("payments"), idempotencyKey: v.string() }),
  handler: async (ctx, args) => {
    // Re-checked here, atomically with the payment row, so a hold cannot expire between the check and the session
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new ConvexError({ code: "BOOKING_NOT_FOUND" });
    const now = Date.now();
    assertPayable(booking, now);
    // Reuse an open session for the same booking/provider/amount (idempotent retries); it already extended the hold
    const existing = await ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId)).take(50);
    const open = existing.find((p) => p.provider === args.provider && p.kind === args.kind && p.amount === args.amount && p.currency === args.currency && (p.status === "created" || p.status === "pending") && p.checkoutUrl && Date.now() - p._creationTime < 55 * 60 * 1000);
    if (open) return { paymentId: open._id, idempotencyKey: open.idempotencyKey };
    if ((booking.status === "inquiry" || booking.status === "pending_payment") && booking.amountPaid <= 0 && booking.holdExpiresAt !== undefined) {
      // The provider page stays open for up to an hour: keep the place for it, but never past the hold's ceiling
      // (the hold plus one checkout window, fixed on the first extension) nor the departure itself, so starting
      // checkouts again and again cannot lock the place. Partly paid holds never expire, so they need no extension.
      const tour = await ctx.db.get(booking.tourId);
      const departure = departureMs(booking.date, booking.startTime || tour?.startTimes[0] || "00:00");
      const ceiling = holdCeiling(booking, now);
      let cover = Math.min(now + CHECKOUT_SESSION_COVER_MS, ceiling);
      if (Number.isFinite(departure)) cover = Math.min(cover, departure);
      if (cover > booking.holdExpiresAt + 60_000) {
        await ctx.db.patch(booking._id, { holdExpiresAt: cover, holdCeilingAt: ceiling, updatedAt: now });
        await ctx.scheduler.runAt(cover, internal.bookings.expireHold, { id: booking._id });
      }
    }
    const idempotencyKey = `pay_${generateToken(24)}`;
    const paymentId = await ctx.db.insert("payments", { ...args, status: "created", idempotencyKey, refundedAmount: 0, updatedAt: Date.now() });
    return { paymentId, idempotencyKey };
  },
});

export const attachSession = internalMutation({
  args: { paymentId: v.id("payments"), providerSessionId: v.string(), checkoutUrl: v.string(), providerCustomerId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { paymentId, ...rest }) => {
    await ctx.db.patch(paymentId, { ...rest, status: "pending", updatedAt: Date.now() });
    return null;
  },
});

export const markFailed = internalMutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { paymentId, reason }) => {
    await ctx.db.patch(paymentId, { status: "failed", failureReason: reason.slice(0, 500), updatedAt: Date.now() });
    return null;
  },
});

export const getPayment = internalQuery({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, { paymentId }) => ctx.db.get(paymentId),
});

/** Throws HOLD_EXPIRED (expired hold or departed tour) or BOOKING_NOT_PAYABLE (status) when the booking cannot be paid online. */
function assertPayable(booking: Doc<"bookings">, now: number) {
  const reason = unpayableReason(booking, now);
  if (reason === "status") throw new ConvexError({ code: "BOOKING_NOT_PAYABLE", status: booking.status });
  if (reason) throw new ConvexError({ code: "HOLD_EXPIRED", reason });
}

/** Takes a coupon use again for a booking re-confirmed after its hold expired (the expiry gave the use back). */
async function retakeCoupon(ctx: MutationCtx, code: string | undefined) {
  if (!code) return;
  const c = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique();
  if (c) await ctx.db.patch(c._id, { usedCount: c.usedCount + 1 });
}

export type PaidOutcome = "confirmed" | "reconfirmed" | "recorded" | "needs_attention";

/**
 * [P] Applies a successful payment to its booking. Shared by the provider webhook (applyEvent) and staff
 * recordManualPayment so both make the same decision. `booking` is the row with amountPaid already including the
 * new payment; this writes amountPaid and the resulting status, and schedules the emails.
 *
 * - inquiry / pending_payment: the hold already owns its place (holds count for capacity), so covering the deposit
 *   confirms it, unless the departure has passed.
 * - confirmed / in_progress / completed: a balance payment, recorded (with a receipt when receiptPaymentId is given).
 * - cancelled because the hold expired, departure still ahead and the place still free (excluding itself):
 *   re-confirmed, and its coupon use taken again.
 * - anything else (cancelled, refunded, departed): the status is kept and the money recorded, the booking is flagged
 *   needsAttention, an audit row is written, staff are notified and the customer gets a dedicated email.
 *
 * source "staff" (recordManualPayment): staff took the money themselves, often in person at departure, so the
 * departure check is skipped and nothing is ever emailed about an inactive booking (the caller refuses cancelled and
 * refunded bookings it cannot re-confirm, so staff reinstate those with a status change first).
 */
export async function confirmPaidBooking(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  now: number,
  opts: { receiptPaymentId?: Id<"payments">; actor?: { _id: Id<"users">; email?: string } | null; source?: "provider" | "staff" } = {},
): Promise<PaidOutcome> {
  const staffPayment = opts.source === "staff";
  const tour = await ctx.db.get(booking.tourId);
  const startTime = booking.startTime || tour?.startTimes[0] || "00:00";
  const departed = !staffPayment && hasDeparted(booking.date, startTime, now);
  const coversDeposit = booking.amountPaid >= booking.depositDue;
  const base = { amountPaid: booking.amountPaid, updatedAt: now };

  const confirm = async (outcome: "confirmed" | "reconfirmed"): Promise<PaidOutcome> => {
    await ctx.db.patch(booking._id, {
      ...base,
      status: "confirmed",
      confirmedAt: booking.confirmedAt ?? now,
      holdExpiresAt: undefined,
      ...(outcome === "reconfirmed" ? { cancelledAt: undefined, cancellationReason: undefined } : {}),
    });
    await ctx.scheduler.runAfter(0, internal.bookingEmails.sendConfirmation, { bookingId: booking._id });
    return outcome;
  };
  const record = async (): Promise<PaidOutcome> => {
    await ctx.db.patch(booking._id, base);
    if (opts.receiptPaymentId) await ctx.scheduler.runAfter(0, internal.bookingEmails.sendPaymentReceipt, { bookingId: booking._id, paymentId: opts.receiptPaymentId });
    return "recorded";
  };
  const flag = async (reason: string): Promise<PaidOutcome> => {
    await ctx.db.patch(booking._id, { ...base, needsAttention: true, attentionReason: reason });
    await ctx.db.insert("auditLogs", {
      actorId: opts.actor?._id,
      actorEmail: opts.actor?.email,
      action: "payment.on_unpayable_booking",
      entityType: "bookings",
      entityId: booking._id,
      before: { status: booking.status },
      after: { status: booking.status, amountPaid: booking.amountPaid, reason, paymentId: opts.receiptPaymentId },
      createdAt: now,
    });
    // Staff entered this payment themselves: no "action needed" email to them and no refund email to the customer
    if (!staffPayment) {
      await ctx.scheduler.runAfter(0, internal.bookingEmails.notifyStaffPaymentOnUnpayable, { bookingId: booking._id, reason });
      await ctx.scheduler.runAfter(0, internal.bookingEmails.sendPaymentOnUnpayable, { bookingId: booking._id });
    }
    return "needs_attention";
  };

  if (booking.status === "inquiry" || booking.status === "pending_payment") {
    if (departed) return await flag("payment_after_departure");
    return coversDeposit ? await confirm("confirmed") : await record();
  }
  if (booking.status === "confirmed" || booking.status === "in_progress" || booking.status === "completed") return await record();
  if (departed) return await flag("payment_after_departure");
  if (booking.status === "cancelled" && booking.cancellationReason === "hold_expired" && coversDeposit && tour) {
    const remaining = await remainingCapacity(ctx, tour, booking.date, startTime, { excludeBookingId: booking._id });
    if (remaining < capacityUnits(tour, booking.adults, booking.children)) return await flag("no_capacity");
    await retakeCoupon(ctx, booking.couponCode);
    await ctx.db.insert("auditLogs", { actorId: opts.actor?._id, actorEmail: opts.actor?.email, action: "booking.reconfirmed_after_payment", entityType: "bookings", entityId: booking._id, before: { status: "cancelled", cancellationReason: "hold_expired" }, after: { status: "confirmed" }, createdAt: now });
    return await confirm("reconfirmed");
  }
  return await flag(booking.status === "refunded" ? "payment_on_refunded" : "payment_on_cancelled");
}

/* ------------------------------------------------------------------ */
/* Public action: start a hosted checkout                              */
/* ------------------------------------------------------------------ */

export const startCheckout = action({
  args: {
    reference: v.string(),
    token: v.string(),
    provider: providerIdValidator,
    currency: currencyValidator,
    kind: v.union(v.literal("full"), v.literal("deposit"), v.literal("balance")),
    locale: v.union(v.literal("en"), v.literal("ar")),
    origin: v.string(),
  },
  returns: v.object({ checkoutUrl: v.string(), paymentId: v.id("payments"), amount: v.number(), currency: v.string() }),
  handler: async (ctx, args): Promise<{ checkoutUrl: string; paymentId: Id<"payments">; amount: number; currency: string }> => {
    const data: { booking: Doc<"bookings">; fx: Record<string, number> } | null = await ctx.runQuery(internal.payments.getBookingForCheckout, { reference: args.reference, token: args.token });
    if (!data) throw new ConvexError({ code: "BOOKING_NOT_FOUND" });
    const { booking, fx } = data;
    // Fails fast here; createPaymentRecord re-checks atomically and extends the hold for the provider session
    assertPayable(booking, Date.now());
    if (!isAllowedOrigin(args.origin)) throw new ConvexError({ code: "INVALID_ORIGIN" });

    const provider = getProvider(args.provider);
    if (!provider.isConfigured()) throw new ConvexError({ code: "PROVIDER_NOT_CONFIGURED", provider: args.provider });

    // Amount in OMR (baisa)
    const outstanding = Math.max(0, booking.total - booking.amountPaid);
    let amountOmr: number;
    if (args.kind === "deposit") amountOmr = Math.min(outstanding, Math.max(0, booking.depositDue - booking.amountPaid));
    else amountOmr = outstanding;
    if (amountOmr <= 0) throw new ConvexError({ code: "NOTHING_TO_PAY" });

    const currency = provider.settlementCurrency(args.currency) as Currency;
    const rate = currency === "OMR" ? 1 : (fx[currency] ?? FALLBACK_RATES[currency]);
    const amountMinor = baisaToMinor(amountOmr, currency, rate);

    const { paymentId, idempotencyKey }: { paymentId: Id<"payments">; idempotencyKey: string } = await ctx.runMutation(internal.payments.createPaymentRecord, {
      bookingId: booking._id,
      provider: args.provider,
      kind: args.kind === "full" && booking.amountPaid > 0 ? "balance" : args.kind,
      amount: amountMinor,
      currency,
      amountOmr,
      fxRate: rate,
    });

    const existing: Doc<"payments"> | null = await ctx.runQuery(internal.payments.getPayment, { paymentId });
    if (existing?.checkoutUrl && existing.status === "pending") {
      return { checkoutUrl: existing.checkoutUrl, paymentId, amount: amountMinor, currency };
    }

    const base = `${args.origin}/${args.locale}/checkout/${booking.reference}`;
    const successUrl = `${base}/success?t=${booking.voucherToken}&p=${args.provider}&pid=${paymentId}${args.provider === "paypal" ? "&token={ORDER_ID}" : ""}`;
    const cancelUrl = `${base}?t=${booking.voucherToken}&cancelled=1`;
    try {
      const result = await provider.createCheckout({
        paymentId: String(paymentId),
        bookingReference: booking.reference,
        amountMinor,
        currency,
        description: `${booking.tourTitle.en} · ${booking.date} · ${booking.reference}`,
        customer: { email: booking.traveller.email, name: `${booking.traveller.firstName} ${booking.traveller.lastName}`, phone: booking.traveller.phone },
        successUrl: successUrl.replace("{ORDER_ID}", ""),
        cancelUrl,
        locale: args.locale,
        metadata: { bookingId: String(booking._id) },
        idempotencyKey,
      });
      await ctx.runMutation(internal.payments.attachSession, { paymentId, providerSessionId: result.providerSessionId, checkoutUrl: result.checkoutUrl, providerCustomerId: result.providerCustomerId });
      return { checkoutUrl: result.checkoutUrl, paymentId, amount: amountMinor, currency };
    } catch (err) {
      await ctx.runMutation(internal.payments.markFailed, { paymentId, reason: (err as Error).message });
      throw new ConvexError({ code: "PROVIDER_ERROR", message: (err as Error).message });
    }
  },
});

/* ------------------------------------------------------------------ */
/* PayPal capture on return                                            */
/* ------------------------------------------------------------------ */

export const capturePaypal = action({
  args: { reference: v.string(), token: v.string(), orderId: v.string() },
  returns: v.object({ status: v.string() }),
  handler: async (ctx, args): Promise<{ status: string }> => {
    const data: { booking: Doc<"bookings">; fx: Record<string, number> } | null = await ctx.runQuery(internal.payments.getBookingForCheckout, { reference: args.reference, token: args.token });
    if (!data) throw new ConvexError({ code: "BOOKING_NOT_FOUND" });
    // The order must be one we created for this booking; otherwise the merchant credentials would capture arbitrary orders.
    const payment: Doc<"payments"> | null = await ctx.runQuery(internal.payments.getPaypalPaymentByOrder, { orderId: args.orderId });
    if (!payment || payment.bookingId !== data.booking._id) throw new ConvexError({ code: "PAYMENT_NOT_FOUND" });
    // Never take money for a booking that can no longer be paid: the approved order is left uncaptured and lapses.
    // Opening the checkout extended the hold, so this only refuses a booking that was cancelled or really ran out.
    if (payment.status !== "succeeded" && unpayableReason(data.booking, Date.now())) return { status: "not_payable" };
    const result = await capturePaypalOrder(args.orderId);
    if (result.status === "succeeded" && process.env.PAYMENTS_TRUST_API_VERIFICATION === "true") {
      await ctx.runMutation(internal.payments.applyEvent, {
        provider: "paypal",
        event: { eventId: `capture:${result.providerPaymentId}`, type: "payment.succeeded", rawType: "api.capture", providerSessionId: args.orderId, providerPaymentId: result.providerPaymentId, amountMinor: result.amountMinor, currency: result.currency, raw: result.raw },
      });
    }
    return { status: result.status };
  },
});

export const getPaypalPaymentByOrder = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => ctx.db.query("payments").withIndex("by_provider_session", (q) => q.eq("provider", "paypal").eq("providerSessionId", orderId)).first(),
});

/** Optional API-side verification (used by the success page as a fallback when enabled). */
export const verifyWithProvider = action({
  args: { reference: v.string(), token: v.string(), paymentId: v.id("payments") },
  returns: v.object({ status: v.string(), applied: v.boolean() }),
  handler: async (ctx, args): Promise<{ status: string; applied: boolean }> => {
    const data: { booking: Doc<"bookings">; fx: Record<string, number> } | null = await ctx.runQuery(internal.payments.getBookingForCheckout, { reference: args.reference, token: args.token });
    if (!data) throw new ConvexError({ code: "BOOKING_NOT_FOUND" });
    const payment: Doc<"payments"> | null = await ctx.runQuery(internal.payments.getPayment, { paymentId: args.paymentId });
    if (!payment || payment.bookingId !== data.booking._id || !payment.providerSessionId || payment.provider === "manual") return { status: "unknown", applied: false };
    const provider = getProvider(payment.provider);
    const remote = await provider.getStatus(payment.providerSessionId);
    if (remote.status === "succeeded" && process.env.PAYMENTS_TRUST_API_VERIFICATION === "true") {
      await ctx.runMutation(internal.payments.applyEvent, {
        provider: payment.provider,
        event: { eventId: `api:${payment.providerSessionId}`, type: "payment.succeeded", rawType: "api.status", providerSessionId: payment.providerSessionId, providerPaymentId: remote.providerPaymentId, amountMinor: remote.amountMinor, currency: remote.currency, raw: remote.raw },
      });
      return { status: remote.status, applied: true };
    }
    return { status: remote.status, applied: false };
  },
});

/* ------------------------------------------------------------------ */
/* Webhook processing (idempotent)                                     */
/* ------------------------------------------------------------------ */

const normalizedEventValidator = v.object({
  eventId: v.string(),
  type: v.union(v.literal("payment.succeeded"), v.literal("payment.failed"), v.literal("payment.cancelled"), v.literal("refund.succeeded"), v.literal("refund.failed"), v.literal("ignored")),
  rawType: v.string(),
  providerSessionId: v.optional(v.string()),
  providerPaymentId: v.optional(v.string()),
  providerRefundId: v.optional(v.string()),
  amountMinor: v.optional(v.number()),
  currency: v.optional(v.string()),
  raw: v.any(),
});

export const applyEvent = internalMutation({
  args: { provider: providerIdValidator, event: normalizedEventValidator },
  returns: v.object({ handled: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, { provider, event }) => {
    const now = Date.now();
    const seen = await ctx.db.query("webhookEvents").withIndex("by_provider_event", (q) => q.eq("provider", provider).eq("eventId", event.eventId)).unique();
    if (seen?.processed) return { handled: false, reason: "duplicate" };
    const eventRowId = seen?._id ?? (await ctx.db.insert("webhookEvents", { provider, eventId: event.eventId, type: event.rawType, receivedAt: now, processed: false }));

    if (event.type === "ignored") {
      await ctx.db.patch(eventRowId, { processed: true });
      return { handled: false, reason: "ignored" };
    }

    // Locate the payment row
    let payment: Doc<"payments"> | null = null;
    if (event.providerSessionId) payment = await ctx.db.query("payments").withIndex("by_provider_session", (q) => q.eq("provider", provider).eq("providerSessionId", event.providerSessionId!)).unique();
    if (!payment && event.providerPaymentId) payment = await ctx.db.query("payments").withIndex("by_provider_payment", (q) => q.eq("provider", provider).eq("providerPaymentId", event.providerPaymentId!)).unique();
    if (!payment) {
      await ctx.db.patch(eventRowId, { processed: true, error: "payment_not_found" });
      return { handled: false, reason: "payment_not_found" };
    }
    const booking = await ctx.db.get(payment.bookingId);
    if (!booking) {
      await ctx.db.patch(eventRowId, { processed: true, error: "booking_not_found" });
      return { handled: false, reason: "booking_not_found" };
    }

    switch (event.type) {
      case "payment.succeeded": {
        if (payment.status === "succeeded") break; // already applied
        if (event.amountMinor !== undefined && event.amountMinor < payment.amount) {
          await ctx.db.patch(eventRowId, { processed: true, error: `amount_mismatch:${event.amountMinor}<${payment.amount}` });
          return { handled: false, reason: "amount_mismatch" };
        }
        await ctx.db.patch(payment._id, { status: "succeeded", providerPaymentId: event.providerPaymentId ?? payment.providerPaymentId, paidAt: now, rawEvent: event.raw, updatedAt: now });
        const amountPaid = booking.amountPaid + payment.amountOmr;
        // The money is taken whatever happens next: confirmPaidBooking confirms, records, or flags it for staff
        const outcome = await confirmPaidBooking(ctx, { ...booking, amountPaid }, now, { receiptPaymentId: payment._id });
        const statusAfter = (await ctx.db.get(booking._id))?.status ?? booking.status;
        await ctx.db.insert("auditLogs", { action: "payment.succeeded", entityType: "bookings", entityId: booking._id, before: { status: booking.status, amountPaid: booking.amountPaid }, after: { status: statusAfter, amountPaid, provider, eventId: event.eventId, outcome }, createdAt: now });
        // Loyalty: 1 point per OMR
        if (booking.userId) {
          const user = await ctx.db.get(booking.userId);
          if (user) await ctx.db.patch(user._id, { loyaltyPoints: (user.loyaltyPoints ?? 0) + Math.floor(payment.amountOmr / 1000) });
        }
        break;
      }
      case "payment.failed":
        if (payment.status !== "succeeded") await ctx.db.patch(payment._id, { status: "failed", failureReason: event.rawType, rawEvent: event.raw, updatedAt: now });
        break;
      case "payment.cancelled":
        if (payment.status !== "succeeded") await ctx.db.patch(payment._id, { status: "cancelled", rawEvent: event.raw, updatedAt: now });
        break;
      case "refund.succeeded": {
        const refundedMinor = event.amountMinor ?? payment.amount;
        const refundedOmr = Math.round((refundedMinor / payment.amount) * payment.amountOmr);
        const alreadyOmr = payment.refundedAmount;
        const deltaOmr = Math.max(0, refundedOmr - alreadyOmr);
        await ctx.db.patch(payment._id, { refundedAmount: refundedOmr, status: refundedOmr >= payment.amountOmr ? "refunded" : "partially_refunded", updatedAt: now });
        const amountRefunded = booking.amountRefunded + deltaOmr;
        await ctx.db.patch(booking._id, { amountRefunded, status: amountRefunded >= booking.amountPaid && booking.status === "cancelled" ? "refunded" : booking.status, updatedAt: now });
        const refunds = await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", payment._id)).take(20);
        for (const r of refunds) if (r.status !== "succeeded") await ctx.db.patch(r._id, { status: "succeeded", providerRefundId: event.providerRefundId ?? r.providerRefundId, updatedAt: now });
        await ctx.scheduler.runAfter(0, internal.bookingEmails.sendRefundNotice, { bookingId: booking._id, amountOmr: deltaOmr });
        break;
      }
      case "refund.failed": {
        const refunds = await ctx.db.query("refunds").withIndex("by_payment", (q) => q.eq("paymentId", payment._id)).take(20);
        for (const r of refunds) if (r.status === "processing") await ctx.db.patch(r._id, { status: "failed", error: event.rawType, updatedAt: now });
        break;
      }
    }
    await ctx.db.patch(eventRowId, { processed: true });
    return { handled: true };
  },
});

/** Called by the HTTP webhook routes after signature verification. */
export const processWebhook = internalAction({
  args: { provider: providerIdValidator, events: v.array(normalizedEventValidator) },
  returns: v.null(),
  handler: async (ctx, { provider, events }) => {
    for (const event of events) {
      await ctx.runMutation(internal.payments.applyEvent, { provider, event: event as NormalizedEvent });
    }
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Staff: refunds & payment links                                      */
/* ------------------------------------------------------------------ */

export const createRefundRequest = internalMutation({
  args: { paymentId: v.id("payments"), amountOmr: v.number(), reason: v.string(), staffId: v.id("users") },
  returns: v.object({ refundId: v.id("refunds"), amountMinor: v.number() }),
  handler: async (ctx, { paymentId, amountOmr, reason, staffId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.status !== "succeeded" && payment.status !== "partially_refunded") throw new ConvexError({ code: "PAYMENT_NOT_REFUNDABLE" });
    const refundable = payment.amountOmr - payment.refundedAmount;
    if (!Number.isInteger(amountOmr) || amountOmr <= 0 || amountOmr > refundable) throw new ConvexError({ code: "INVALID_REFUND_AMOUNT", refundable });
    const amountMinor = Math.round((amountOmr / payment.amountOmr) * payment.amount);
    const refundId = await ctx.db.insert("refunds", { paymentId, bookingId: payment.bookingId, amount: amountMinor, amountOmr, reason, status: "processing", requestedByStaffId: staffId, updatedAt: Date.now() });
    const staff = await ctx.db.get(staffId);
    await audit(ctx, staff, "payment.refund_requested", "payments", paymentId, undefined, { amountOmr, reason });
    return { refundId, amountMinor };
  },
});

export const finishRefundRequest = internalMutation({
  args: { refundId: v.id("refunds"), status: v.union(v.literal("succeeded"), v.literal("pending"), v.literal("failed")), providerRefundId: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { refundId, status, providerRefundId, error }) => {
    const r = await ctx.db.get(refundId);
    if (!r) return null;
    await ctx.db.patch(refundId, { status: status === "pending" ? "processing" : status, providerRefundId, error, updatedAt: Date.now() });
    if (status === "succeeded") {
      const payment = await ctx.db.get(r.paymentId);
      if (payment) {
        // Apply immediately (idempotent with a later webhook thanks to refundedAmount comparison)
        await ctx.runMutation(internal.payments.applyEvent, {
          provider: payment.provider as ProviderId,
          event: { eventId: `refund:${refundId}`, type: "refund.succeeded", rawType: "api.refund", providerPaymentId: payment.providerPaymentId, providerSessionId: payment.providerSessionId, providerRefundId, amountMinor: (payment.refundedAmount / payment.amountOmr) * payment.amount + r.amount, currency: payment.currency, raw: { refundId } },
        });
      }
    }
    return null;
  },
});

export const refund = action({
  args: { paymentId: v.id("payments"), amountOmr: v.number(), reason: v.string() },
  returns: v.object({ status: v.string(), error: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ status: string; error?: string }> => {
    const staff = await ctx.runQuery(internal.payments.requireStaffForAction, {});
    const payment: Doc<"payments"> | null = await ctx.runQuery(internal.payments.getPayment, { paymentId: args.paymentId });
    if (!payment) throw new ConvexError({ code: "PAYMENT_NOT_FOUND" });
    const { refundId, amountMinor }: { refundId: Id<"refunds">; amountMinor: number } = await ctx.runMutation(internal.payments.createRefundRequest, { paymentId: args.paymentId, amountOmr: Math.round(args.amountOmr), reason: args.reason.slice(0, 500), staffId: staff._id });
    if (payment.provider === "manual" || !payment.providerPaymentId && !payment.providerSessionId) {
      await ctx.runMutation(internal.payments.finishRefundRequest, { refundId, status: "succeeded" });
      return { status: "succeeded" };
    }
    const provider = getProvider(payment.provider as ProviderId);
    const result = await provider.refund({ providerPaymentId: payment.providerPaymentId ?? "", providerSessionId: payment.providerSessionId, amountMinor, currency: payment.currency, reason: args.reason, idempotencyKey: `refund_${refundId}` });
    await ctx.runMutation(internal.payments.finishRefundRequest, { refundId, status: result.status, providerRefundId: result.providerRefundId, error: result.error });
    return { status: result.status, error: result.error };
  },
});

export const requireStaffForAction = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireStaff(ctx);
    return { _id: user._id, email: user.email ?? null };
  },
});

export const reconcile = action({
  args: { paymentId: v.id("payments") },
  returns: v.object({ status: v.string() }),
  handler: async (ctx, { paymentId }): Promise<{ status: string }> => {
    await ctx.runQuery(internal.payments.requireStaffForAction, {});
    const payment: Doc<"payments"> | null = await ctx.runQuery(internal.payments.getPayment, { paymentId });
    if (!payment || !payment.providerSessionId || payment.provider === "manual") return { status: "unknown" };
    const remote = await getProvider(payment.provider as ProviderId).getStatus(payment.providerSessionId);
    if (remote.status === "succeeded" && payment.status !== "succeeded") {
      await ctx.runMutation(internal.payments.applyEvent, {
        provider: payment.provider as ProviderId,
        event: { eventId: `reconcile:${payment.providerSessionId}:${Date.now()}`, type: "payment.succeeded", rawType: "staff.reconcile", providerSessionId: payment.providerSessionId, providerPaymentId: remote.providerPaymentId, amountMinor: remote.amountMinor, currency: remote.currency, raw: remote.raw },
      });
    }
    return { status: remote.status };
  },
});

/** Staff-issued payment link (WhatsApp / phone bookings). */
export const createPaymentLink = internalMutation({
  args: { bookingId: v.id("bookings"), amountOmr: v.number(), kind: paymentKindValidator, description: v.optional(v.string()), staffId: v.id("users"), expiresInHours: v.number() },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const token = generateToken(32);
    await ctx.db.insert("paymentLinks", { bookingId: args.bookingId, token, amountOmr: args.amountOmr, kind: args.kind, description: args.description, expiresAt: Date.now() + args.expiresInHours * 3_600_000, createdByStaffId: args.staffId });
    return { token };
  },
});

export const paymentLinkByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db.query("paymentLinks").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!link) return null;
    const booking = await ctx.db.get(link.bookingId);
    if (!booking) return null;
    const expired = link.expiresAt < Date.now();
    const used = !!link.usedAt;
    // An expired or used link must not keep granting the voucher token (and with it the booking details) forever.
    return { reference: booking.reference, voucherToken: expired || used ? "" : booking.voucherToken, amountOmr: link.amountOmr, kind: link.kind, description: link.description ?? null, expired, used, tourTitle: booking.tourTitle, date: booking.date };
  },
});

export const listConfiguredProviders = internalQuery({
  args: {},
  handler: async () => configuredProviders(),
});
