import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { assertInt, assertString, enforceRateLimit, getViewer, isStaff } from "./lib/access";
import { generateBookingReference, generateToken } from "./lib/ids";
import { addDaysIso, BOOKING_HORIZON_DAYS, dateProblem, isOperatingDate, omanTodayIso } from "./lib/dates";
import { maxUnpaidHoldsPerSlot, remainingCapacity, unpaidWebHoldsOn } from "./lib/capacity";
import { CHECKOUT_SESSION_COVER_MS, fallbackHoldExpiry, holdCeiling, holdExpiryFor, loadHoldSettings } from "./lib/holds";
import { addOnAppliesTo, capacityUnits, computeQuote, INFANT_MAX, isFreeCancellation, type PricingCoupon } from "./lib/pricing";
import { localeValidator, paymentProviderValidator, travellerValidator } from "./schema";

const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addOnSelectionValidator = v.array(v.object({ addOnId: v.id("addOns"), quantity: v.number() }));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Gives a coupon use back when an unpaid booking is cancelled, so throwaway holds cannot exhaust a usage limit. */
async function releaseCoupon(ctx: MutationCtx, code: string | undefined) {
  if (!code) return;
  const c = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique();
  if (c && c.usedCount > 0) await ctx.db.patch(c._id, { usedCount: c.usedCount - 1 });
}

async function loadCoupon(ctx: QueryCtx | MutationCtx, code?: string): Promise<(PricingCoupon & { _id: Id<"coupons"> }) | null | undefined> {
  if (!code) return null;
  const c = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase())).unique();
  if (!c) return undefined; // not found
  return { ...c, _id: c._id, tourIds: c.tourIds?.map(String) };
}

async function loadSeason(ctx: QueryCtx | MutationCtx, tourId: Id<"tours">, date: string) {
  const seasons = await ctx.db.query("pricingSeasons").withIndex("by_tour", (q) => q.eq("tourId", tourId).lte("startDate", date)).take(50);
  return seasons.find((s) => s.isActive && s.endDate >= date) ?? null;
}

async function buildQuote(
  ctx: QueryCtx | MutationCtx,
  tour: Doc<"tours">,
  args: { date: string; adults: number; children: number; infants: number; addOns: { addOnId: Id<"addOns">; quantity: number }[]; couponCode?: string },
) {
  const season = await loadSeason(ctx, tour._id, args.date);
  const addOns = [];
  for (const sel of args.addOns) {
    const a = await ctx.db.get(sel.addOnId);
    if (a && a.isActive && (a.tourId === undefined || a.tourId === tour._id) && addOnAppliesTo(a, tour)) {
      let quantity = Number.isFinite(sel.quantity) ? Math.min(20, Math.max(0, Math.floor(sel.quantity))) : 0;
      // Child seats are requested per child or infant, so a party never books more seats than small travellers
      if (a.key === "child_seat") quantity = Math.min(quantity, Math.max(0, Math.floor(args.children) + Math.floor(args.infants)));
      addOns.push({ addOn: { _id: String(a._id), name: a.name, price: a.price, priceType: a.priceType }, quantity });
    }
  }
  const coupon = await loadCoupon(ctx, args.couponCode);
  const quote = computeQuote({
    tour,
    tourId: String(tour._id),
    season,
    adults: args.adults,
    children: args.children,
    infants: args.infants,
    addOns,
    coupon: coupon ?? null,
    date: args.date,
  });
  if (args.couponCode && coupon === undefined) quote.couponError = "not_found";
  return { quote, coupon };
}

/** Customer booking rules (public create only; staff manual bookings and amendments only require a real date). */
function assertBookingArgs(tour: Doc<"tours">, args: { date: string; startTime: string; adults: number; children: number; infants: number }) {
  // Dates follow the Oman calendar: bookable from Oman's tomorrow through the shared horizon (see lib/dates).
  const problem = dateProblem(args.date);
  if (problem === "invalid") throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
  if (problem === "past") throw new ConvexError({ code: "DATE_IN_PAST" });
  if (problem === "too_far") throw new ConvexError({ code: "DATE_OUT_OF_RANGE", maxDays: BOOKING_HORIZON_DAYS });
  if (!isOperatingDate(tour, args.date)) throw new ConvexError({ code: "DATE_NOT_OPERATING" });
  if (!TIME_RE.test(args.startTime) || !tour.startTimes.includes(args.startTime)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "startTime" });
  assertInt(args.adults, 1, 60, "adults");
  assertInt(args.children, 0, 60, "children");
  assertInt(args.infants, 0, INFANT_MAX, "infants");
  // Infants travel on an adult's lap (child policy), so one per adult; larger families are arranged by staff
  if (args.infants > args.adults) throw new ConvexError({ code: "TOO_MANY_INFANTS", max: args.adults });
  const groupSize = args.adults + args.children;
  if (groupSize < tour.minGroup) throw new ConvexError({ code: "BELOW_MIN_GROUP", min: tour.minGroup });
  if (groupSize > tour.maxGroup) throw new ConvexError({ code: "ABOVE_MAX_GROUP", max: tour.maxGroup });
}

const publicBooking = (b: Doc<"bookings">) => ({
  _id: b._id,
  reference: b.reference,
  tourId: b.tourId,
  tourTitle: b.tourTitle,
  date: b.date,
  startTime: b.startTime ?? null,
  adults: b.adults,
  children: b.children,
  infants: b.infants,
  groupSize: b.groupSize,
  pricingModel: b.pricingModel,
  subtotal: b.subtotal,
  addOnsTotal: b.addOnsTotal,
  discountTotal: b.discountTotal,
  couponCode: b.couponCode ?? null,
  total: b.total,
  depositDue: b.depositDue,
  amountPaid: b.amountPaid,
  amountRefunded: b.amountRefunded,
  traveller: b.traveller,
  locale: b.locale,
  status: b.status,
  holdExpiresAt: b.holdExpiresAt ?? null,
  /** A payment arrived that could not confirm the booking (cancelled, expired or departed); staff will follow up. */
  needsAttention: b.needsAttention ?? false,
  paymentMethodPreference: b.paymentMethodPreference ?? null,
  displayCurrency: b.displayCurrency ?? null,
  confirmedAt: b.confirmedAt ?? null,
  cancelledAt: b.cancelledAt ?? null,
  /** Cancelled because the unpaid hold ran out (not by the customer or staff), so pages can say so and offer rebooking. */
  holdExpired: b.status === "cancelled" && b.cancellationReason === "hold_expired",
  voucherToken: b.voucherToken,
  createdAt: b._creationTime,
  customerNotes: b.customerNotes ?? null,
});

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

export type QuoteUnavailableReason = "invalid_date" | "past" | "too_far" | "not_operating" | "invalid_start_time" | "below_min_group" | "above_max_group" | "too_many_infants" | "sold_out";

export const quote = query({
  args: {
    tourId: v.id("tours"),
    date: v.string(),
    startTime: v.optional(v.string()),
    adults: v.number(),
    children: v.number(),
    infants: v.number(),
    addOns: addOnSelectionValidator,
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour || tour.status !== "published") return null;
    const { quote } = await buildQuote(ctx, tour, args);
    const startTime = args.startTime || tour.startTimes[0];
    // Never throws (the wizard reads this through useQuery): every reason the booking would be refused becomes
    // available:false with an unavailableReason, so step 1 is gated by one flag.
    const problem = dateProblem(args.date);
    const groupSize = args.adults + args.children;
    const blocked: QuoteUnavailableReason | null =
      problem === "invalid" ? "invalid_date"
      : problem === "past" ? "past"
      : problem === "too_far" ? "too_far"
      : !isOperatingDate(tour, args.date) ? "not_operating"
      : !startTime || !TIME_RE.test(startTime) || !tour.startTimes.includes(startTime) ? "invalid_start_time"
      : groupSize < tour.minGroup ? "below_min_group"
      : groupSize > tour.maxGroup ? "above_max_group"
      : args.infants > args.adults || args.infants > INFANT_MAX ? "too_many_infants"
      : null;
    // Capacity units this party needs (seats, a private departure or 4WDs), so the sold-out message can name them
    const needed = capacityUnits(tour, args.adults, args.children);
    if (blocked) return { ...quote, remaining: 0, needed, available: false, unavailableReason: blocked };
    const remaining = await remainingCapacity(ctx, tour, args.date, startTime);
    const available = remaining >= needed && needed > 0;
    return { ...quote, remaining, needed, available, unavailableReason: available ? null : ("sold_out" as QuoteUnavailableReason) };
  },
});

/** Hold settings the wizard needs to show the same pay-by deadline the server will set (lib/holds). */
export const holdPolicy = query({
  args: {},
  returns: v.object({ checkoutHoldMinutes: v.number(), payBeforeDepartureHours: v.number() }),
  handler: async (ctx) => await loadHoldSettings(ctx),
});

/* ------------------------------------------------------------------ */
/* Drafts (resumable wizard)                                           */
/* ------------------------------------------------------------------ */

export const getDraft = query({
  args: { sessionKey: v.string(), tourId: v.id("tours") },
  handler: async (ctx, { sessionKey, tourId }) => {
    const drafts = await ctx.db.query("bookingDrafts").withIndex("by_session", (q) => q.eq("sessionKey", sessionKey)).take(20);
    const d = drafts.find((x) => x.tourId === tourId && !x.convertedBookingId);
    return d ? { _id: d._id, step: d.step, data: d.data, lastTouchedAt: d.lastTouchedAt } : null;
  },
});

export const saveDraft = mutation({
  args: { sessionKey: v.string(), tourId: v.id("tours"), step: v.number(), data: v.any(), locale: localeValidator },
  returns: v.id("bookingDrafts"),
  handler: async (ctx, args) => {
    assertString(args.sessionKey, 64, "sessionKey", 8);
    const viewer = await getViewer(ctx);
    const drafts = await ctx.db.query("bookingDrafts").withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey)).take(20);
    const existing = drafts.find((x) => x.tourId === args.tourId && !x.convertedBookingId);
    await enforceRateLimit(ctx, `draft:${args.sessionKey}`, 120, 60 * 60 * 1000);
    const serialized = JSON.stringify(args.data ?? null);
    if (serialized.length > 20_000) throw new ConvexError({ code: "TOO_LARGE" });
    const data = JSON.parse(serialized);
    if (existing) {
      await ctx.db.patch(existing._id, { step: assertInt(args.step, 1, 5, "step"), data, lastTouchedAt: Date.now(), userId: viewer?._id ?? existing.userId, locale: args.locale });
      return existing._id;
    }
    return await ctx.db.insert("bookingDrafts", {
      sessionKey: args.sessionKey,
      userId: viewer?._id,
      tourId: args.tourId,
      step: assertInt(args.step, 1, 5, "step"),
      data,
      locale: args.locale,
      lastTouchedAt: Date.now(),
    });
  },
});

/* ------------------------------------------------------------------ */
/* Create booking                                                      */
/* ------------------------------------------------------------------ */

export const create = mutation({
  args: {
    sessionKey: v.string(),
    tourId: v.id("tours"),
    date: v.string(),
    startTime: v.string(),
    adults: v.number(),
    children: v.number(),
    infants: v.number(),
    addOns: addOnSelectionValidator,
    couponCode: v.optional(v.string()),
    traveller: travellerValidator,
    locale: localeValidator,
    acceptedPolicyVersionIds: v.array(v.id("policyVersions")),
    payLater: v.boolean(),
    paymentMethodPreference: v.optional(paymentProviderValidator),
    displayCurrency: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ reference: v.string(), token: v.string(), bookingId: v.id("bookings"), status: v.string(), free: v.optional(v.boolean()) }),
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour || tour.status !== "published") throw new ConvexError({ code: "TOUR_NOT_FOUND" });
    assertBookingArgs(tour, args);

    const email = args.traveller.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    if (!/^\+[1-9][0-9]{6,14}$/.test(args.traveller.phone)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "phone" });
    await enforceRateLimit(ctx, `booking:${email}`, 10, 60 * 60 * 1000);
    // Holds consume real capacity until they expire, so the e-mail key alone (attacker-chosen) is not enough.
    await enforceRateLimit(ctx, `booking:session:${args.sessionKey}`, 10, 60 * 60 * 1000);
    await enforceRateLimit(ctx, "booking:global", 150, 60 * 60 * 1000);

    // Policies: every required current version must be accepted
    const policies = await ctx.db.query("policies").take(50);
    const required = policies.filter((p) => p.requiredAtCheckout && p.currentVersionId).map((p) => p.currentVersionId!);
    for (const id of required) {
      if (!args.acceptedPolicyVersionIds.includes(id)) throw new ConvexError({ code: "POLICIES_NOT_ACCEPTED" });
    }

    if (args.payLater && !tour.allowReserveNowPayLater) throw new ConvexError({ code: "PAY_LATER_NOT_ALLOWED" });
    // Pay-now gets a short checkout hold, pay-later the tour's holdHours; both end before the departure (lib/holds).
    const now = Date.now();
    const holdSettings = await loadHoldSettings(ctx);
    let holdExpiresAt = holdExpiryFor({ tour, date: args.date, startTime: args.startTime, kind: args.payLater ? "pay_later" : "pay_now", now, settings: holdSettings });
    if (holdExpiresAt === null) {
      // Too close to the departure to hold a place unpaid; paying now is still possible
      if (args.payLater) throw new ConvexError({ code: "PAY_LATER_NOT_ALLOWED", reason: "too_close" });
      holdExpiresAt = fallbackHoldExpiry(args.date, args.startTime, now, holdSettings);
    }

    const { quote, coupon } = await buildQuote(ctx, tour, args);
    if (args.couponCode && quote.couponError) throw new ConvexError({ code: "COUPON_INVALID", reason: quote.couponError });

    const needed = capacityUnits(tour, args.adults, args.children);
    const remaining = await remainingCapacity(ctx, tour, args.date, args.startTime);
    if (remaining < needed) throw new ConvexError({ code: "SOLD_OUT", remaining });
    // Pay-later holds take real places, so a few unpaid website holds per departure is the limit; past it the
    // customer can still pay now (which is never blocked here, so abandoned checkouts cannot lock a departure).
    if (args.payLater) {
      const max = await maxUnpaidHoldsPerSlot(ctx);
      if ((await unpaidWebHoldsOn(ctx, tour, args.date, args.startTime)) >= max) throw new ConvexError({ code: "HOLD_LIMIT", max });
    }

    // A code that covers the whole price leaves nothing to pay, and checkout cannot take 0 OMR: confirm at once.
    // (Checked on the total, not depositDue, so a low deposit never confirms a priced booking unpaid.) Only a valid
    // coupon may explain a 0 total; a 0 or negative price (e.g. a season typo) must never confirm tours unpaid.
    const free = quote.total === 0 && !!quote.couponCode && quote.discountTotal > 0 && quote.subtotal + quote.addOnsTotal > 0;
    if (quote.total <= 0 && !free) throw new ConvexError({ code: "PRICE_UNAVAILABLE" });
    const status = free ? "confirmed" : args.payLater ? "inquiry" : "pending_payment";

    const viewer = await getViewer(ctx);
    const traveller = {
      ...args.traveller,
      firstName: assertString(args.traveller.firstName, 80, "firstName", 1),
      lastName: assertString(args.traveller.lastName, 80, "lastName", 1),
      nationality: assertString(args.traveller.nationality, 2, "nationality", 2).toUpperCase(),
      email,
      hotel: args.traveller.hotel ? assertString(args.traveller.hotel, 160, "hotel") : undefined,
      pickupLocation: args.traveller.pickupLocation ? assertString(args.traveller.pickupLocation, 200, "pickupLocation") : undefined,
      specialRequests: args.traveller.specialRequests ? assertString(args.traveller.specialRequests, 1000, "specialRequests") : undefined,
    };

    let reference = generateBookingReference();
    while (await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", reference)).unique()) {
      reference = generateBookingReference();
    }
    const voucherToken = generateToken(40);
    const displayCurrency = (["OMR", "USD", "EUR", "GBP", "AED", "SAR"] as const).find((c) => c === args.displayCurrency);

    const bookingId = await ctx.db.insert("bookings", {
      reference,
      userId: viewer?._id,
      tourId: tour._id,
      tourTitle: tour.title,
      date: args.date,
      startTime: args.startTime,
      adults: args.adults,
      children: args.children,
      infants: args.infants,
      groupSize: quote.groupSize,
      pricingModel: tour.pricingModel,
      currency: "OMR",
      subtotal: quote.subtotal,
      addOnsTotal: quote.addOnsTotal,
      discountTotal: quote.discountTotal,
      couponCode: quote.couponCode,
      total: quote.total,
      depositDue: quote.depositDue,
      amountPaid: 0,
      amountRefunded: 0,
      displayCurrency,
      traveller,
      locale: args.locale,
      status,
      confirmedAt: free ? now : undefined,
      paymentMethodPreference: args.paymentMethodPreference,
      holdExpiresAt: free ? undefined : holdExpiresAt,
      policyVersionIds: args.acceptedPolicyVersionIds,
      source: "web",
      voucherToken,
      updatedAt: now,
    });

    // Release the place exactly when the hold runs out (the 15-minute cron stays as a backstop)
    if (!free) await ctx.scheduler.runAt(holdExpiresAt, internal.bookings.expireHold, { id: bookingId });

    for (const item of quote.items) {
      await ctx.db.insert("bookingItems", {
        bookingId,
        kind: item.kind,
        label: item.label,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        addOnId: item.addOnId ? (item.addOnId as Id<"addOns">) : undefined,
      });
    }

    await ctx.db.insert("policyAcceptances", {
      bookingId,
      userId: viewer?._id,
      policyVersionIds: args.acceptedPolicyVersionIds,
      acceptedAt: now,
      userAgent: args.userAgent?.slice(0, 300),
      email,
    });

    if (coupon) await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });

    // Link + convert the draft
    const drafts = await ctx.db.query("bookingDrafts").withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey)).take(20);
    for (const d of drafts) if (d.tourId === tour._id && !d.convertedBookingId) await ctx.db.patch(d._id, { convertedBookingId: bookingId });

    // Notifications: a free booking is confirmed now; reserve-now-pay-later gets an immediate hold email;
    // paid bookings wait for the webhook
    if (free) {
      await ctx.scheduler.runAfter(0, internal.bookingEmails.sendConfirmation, { bookingId });
    } else if (args.payLater) {
      await ctx.scheduler.runAfter(0, internal.bookingEmails.sendHoldCreated, { bookingId });
    }
    await ctx.scheduler.runAfter(0, internal.bookingEmails.notifyStaffNewBooking, { bookingId });

    return { reference, token: voucherToken, bookingId, status, ...(free ? { free: true } : {}) };
  },
});

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

/** Public read by reference + voucher token (checkout / confirmation pages). */
export const byReference = query({
  args: { reference: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, { reference, token }) => {
    const b = await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", reference.toUpperCase())).unique();
    if (!b) return null;
    const viewer = await getViewer(ctx);
    const allowed = (token && token === b.voucherToken) || (viewer && (isStaff(viewer) || viewer._id === b.userId));
    if (!allowed) return null;
    const [tour, items, payments] = await Promise.all([
      ctx.db.get(b.tourId),
      ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50),
      ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50),
    ]);
    return {
      ...publicBooking(b),
      tour: tour
        ? {
            slug: tour.slug,
            coverImage: tour.coverImage ?? null,
            durationLabel: tour.durationLabel,
            meetingPoint: tour.meetingPoint ?? null,
            freeCancellationHours: tour.freeCancellationHours,
            depositPercent: tour.depositPercent,
            pickupIncluded: tour.pickupIncluded,
            durationDays: tour.durationDays,
          }
        : null,
      items,
      payments: payments.map((p) => ({ _id: p._id, provider: p.provider, kind: p.kind, amount: p.amount, currency: p.currency, amountOmr: p.amountOmr, status: p.status, paidAt: p.paidAt ?? null, refundedAmount: p.refundedAmount, checkoutUrl: p.status === "created" || p.status === "pending" ? p.checkoutUrl ?? null : null })),
      freeCancellationNow: tour ? isFreeCancellation(b.date, b.startTime, tour.freeCancellationHours) : false,
    };
  },
});

/** Token-only read used by the voucher / calendar API routes. */
export const byToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 20) return null;
    const b = await ctx.db.query("bookings").withIndex("by_voucherToken", (q) => q.eq("voucherToken", token)).unique();
    if (!b) return null;
    const tour = await ctx.db.get(b.tourId);
    const items = await ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50);
    return {
      ...publicBooking(b),
      items,
      tour: tour ? { slug: tour.slug, durationLabel: tour.durationLabel, durationDays: tour.durationDays, durationMinutes: tour.durationMinutes, meetingPoint: tour.meetingPoint ?? null, freeCancellationHours: tour.freeCancellationHours, pickupIncluded: tour.pickupIncluded, inclusions: tour.inclusions } : null,
    };
  },
});

export const getInternal = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const b = await ctx.db.get(bookingId);
    if (!b) return null;
    const tour = await ctx.db.get(b.tourId);
    const items = await ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50);
    return { ...b, tour, items };
  },
});

/* ------------------------------------------------------------------ */
/* Internal status transitions                                         */
/* ------------------------------------------------------------------ */

/**
 * Cancels a booking whose unpaid hold has run out, releasing its place and coupon use. Idempotent: it re-reads
 * the booking and does nothing unless it is still an unpaid inquiry / pending_payment past holdExpiresAt
 * (a payment, a staff status change or a new hold since scheduling all make it a no-op).
 */
async function expireIfDue(ctx: MutationCtx, b: Doc<"bookings">, now: number): Promise<boolean> {
  if (b.status !== "inquiry" && b.status !== "pending_payment") return false;
  if (b.amountPaid > 0) return false; // a payment arrived; never auto-cancel a paid booking
  if (b.holdExpiresAt === undefined || b.holdExpiresAt > now) return false;
  // A checkout opened recently may still be paid on the provider page: keep the place until that session is over
  const payments = await ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50);
  // ...but never past the hold's ceiling, so starting checkouts over and over cannot keep the place locked
  const openUntil = Math.min(
    holdCeiling(b, now),
    Math.max(0, ...payments.filter((p) => p.status === "created" || p.status === "pending").map((p) => p._creationTime + CHECKOUT_SESSION_COVER_MS)),
  );
  if (openUntil > now) {
    await ctx.scheduler.runAt(openUntil, internal.bookings.expireHold, { id: b._id });
    return false;
  }
  await ctx.db.patch(b._id, { status: "cancelled", cancellationReason: "hold_expired", cancelledAt: now, updatedAt: now });
  await releaseCoupon(ctx, b.couponCode);
  await ctx.db.insert("auditLogs", { action: "booking.hold_expired", entityType: "bookings", entityId: b._id, before: { status: b.status }, after: { status: "cancelled" }, createdAt: now });
  return true;
}

/** Scheduled with ctx.scheduler.runAt(holdExpiresAt) wherever a hold starts. */
export const expireHold = internalMutation({
  args: { id: v.id("bookings") },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const b = await ctx.db.get(id);
    return b ? await expireIfDue(ctx, b, Date.now()) : false;
  },
});

/**
 * Backstop sweep (cron) for holds whose scheduled expiry did not run. The range starts above 0 because a missing
 * holdExpiresAt sorts below every number: without it, a booking staff moved back to an unpaid status with no hold
 * would be cancelled as hold_expired.
 */
export const expireHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let expired = 0;
    for (const status of ["pending_payment", "inquiry"] as const) {
      const rows = await ctx.db.query("bookings").withIndex("by_holdExpiry", (q) => q.eq("status", status).gt("holdExpiresAt", 0).lt("holdExpiresAt", now)).take(100);
      for (const b of rows) if (await expireIfDue(ctx, b, now)) expired++;
    }
    return expired;
  },
});

export const markInProgressAndCompleted = internalMutation({
  args: {},
  returns: v.object({ started: v.number(), completed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const today = omanTodayIso(now);
    let started = 0;
    let completed = 0;
    const confirmed = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", "confirmed").lte("date", today)).take(200);
    for (const b of confirmed) {
      if (b.date === today) {
        await ctx.db.patch(b._id, { status: "in_progress", updatedAt: now });
        started++;
      } else if (b.date < today) {
        await ctx.db.patch(b._id, { status: "completed", completedAt: now, updatedAt: now });
        completed++;
      }
    }
    const inProgress = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", "in_progress").lt("date", today)).take(200);
    for (const b of inProgress) {
      await ctx.db.patch(b._id, { status: "completed", completedAt: now, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.bookingEmails.sendReviewRequest, { bookingId: b._id });
      completed++;
    }
    return { started, completed };
  },
});

export const dueForReminder = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tomorrow = addDaysIso(omanTodayIso(), 1);
    const rows = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", "confirmed").eq("date", tomorrow)).take(200);
    return rows.filter((b) => !b.reminderSentAt).map((b) => b._id);
  },
});

export const markReminded = internalMutation({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    await ctx.db.patch(bookingId, { reminderSentAt: Date.now() });
    return null;
  },
});

export const abandonedDrafts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 3 * 3_600_000;
    const rows = await ctx.db.query("bookingDrafts").withIndex("by_lastTouched", (q) => q.lt("lastTouchedAt", cutoff)).order("desc").take(100);
    return rows.filter((d) => !d.convertedBookingId && !d.remindedAt && d.lastTouchedAt > cutoff - 24 * 3_600_000);
  },
});

export const markDraftReminded = internalMutation({
  args: { draftId: v.id("bookingDrafts"), leadId: v.optional(v.id("leads")) },
  returns: v.null(),
  handler: async (ctx, { draftId }) => {
    await ctx.db.patch(draftId, { remindedAt: Date.now() });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Customer actions                                                    */
/* ------------------------------------------------------------------ */

export const requestCancellation = mutation({
  args: { bookingId: v.id("bookings"), reason: v.optional(v.string()) },
  returns: v.object({ status: v.string(), refundEligible: v.boolean() }),
  handler: async (ctx, { bookingId, reason }) => {
    const viewer = await getViewer(ctx);
    if (!viewer) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const b = await ctx.db.get(bookingId);
    if (!b || b.userId !== viewer._id) throw new ConvexError({ code: "FORBIDDEN" });
    if (!["inquiry", "pending_payment", "confirmed"].includes(b.status)) throw new ConvexError({ code: "NOT_CANCELLABLE" });
    const tour = await ctx.db.get(b.tourId);
    const eligible = tour ? isFreeCancellation(b.date, b.startTime, tour.freeCancellationHours) : false;
    const now = Date.now();
    if (b.amountPaid === 0) {
      await ctx.db.patch(b._id, { status: "cancelled", cancelledAt: now, cancellationReason: reason?.slice(0, 500) ?? "customer", updatedAt: now });
      await releaseCoupon(ctx, b.couponCode);
      return { status: "cancelled", refundEligible: false };
    }
    // Paid bookings: mark cancelled; refund is processed by staff through the provider adapter.
    await ctx.db.patch(b._id, { status: "cancelled", cancelledAt: now, cancellationReason: reason?.slice(0, 500) ?? "customer", updatedAt: now });
    await ctx.db.insert("auditLogs", { actorId: viewer._id, actorEmail: viewer.email, action: "booking.customer_cancelled", entityType: "bookings", entityId: b._id, before: { status: b.status }, after: { status: "cancelled", refundEligible: eligible }, createdAt: now });
    await ctx.scheduler.runAfter(0, internal.bookingEmails.notifyStaffCancellation, { bookingId: b._id, refundEligible: eligible });
    return { status: "cancelled", refundEligible: eligible };
  },
});

export const addCustomerNote = mutation({
  args: { bookingId: v.id("bookings"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { bookingId, note }) => {
    const viewer = await getViewer(ctx);
    if (!viewer) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const b = await ctx.db.get(bookingId);
    if (!b || b.userId !== viewer._id) throw new ConvexError({ code: "FORBIDDEN" });
    await ctx.db.patch(b._id, { customerNotes: assertString(note, 1000, "note"), updatedAt: Date.now() });
    return null;
  },
});

/**
 * Attach guest bookings (same email) to a user who just signed in. Only an
 * e-mail the auth provider verified (Google, magic link) may claim them: a
 * password sign-up can use any address, so trusting it would hand a stranger
 * the traveller's name, phone and hotel.
 */
export const claimGuestBookings = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer?.email || !viewer.emailVerificationTime) return 0;
    const rows = await ctx.db.query("bookings").withIndex("by_email", (q) => q.eq("traveller.email", viewer.email!)).take(100);
    let n = 0;
    for (const b of rows) {
      if (!b.userId) {
        await ctx.db.patch(b._id, { userId: viewer._id });
        n++;
      }
    }
    return n;
  },
});
