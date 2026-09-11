import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { assertInt, assertString, enforceRateLimit, getViewer, isStaff } from "./lib/access";
import { generateBookingReference, generateToken } from "./lib/ids";
import { computeQuote, isFreeCancellation, type PricingCoupon } from "./lib/pricing";
import { localeValidator, paymentProviderValidator, travellerValidator } from "./schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addOnSelectionValidator = v.array(v.object({ addOnId: v.id("addOns"), quantity: v.number() }));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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
    if (a && a.isActive && (a.tourId === undefined || a.tourId === tour._id)) {
      const quantity = Number.isFinite(sel.quantity) ? Math.min(20, Math.max(0, Math.floor(sel.quantity))) : 0;
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

async function remainingCapacity(ctx: QueryCtx | MutationCtx, tour: Doc<"tours">, date: string, startTime: string): Promise<number> {
  const overrides = await ctx.db.query("availability").withIndex("by_tour_date", (q) => q.eq("tourId", tour._id).eq("date", date)).take(20);
  if (overrides.some((o) => o.isBlackout && (!o.startTime || o.startTime === startTime))) return 0;
  const slot = overrides.find((o) => o.startTime === startTime);
  const capacity = slot?.capacity ?? tour.defaultCapacityPerSlot;
  const bookings = await ctx.db.query("bookings").withIndex("by_tour_date", (q) => q.eq("tourId", tour._id).eq("date", date)).take(500);
  const booked = bookings
    .filter((b) => ["pending_payment", "confirmed", "in_progress"].includes(b.status) && (b.startTime ?? tour.startTimes[0]) === startTime)
    .reduce((a, b) => a + (tour.pricingModel === "per_group" ? 1 : b.groupSize), 0);
  return Math.max(0, capacity - booked);
}

function assertBookingArgs(tour: Doc<"tours">, args: { date: string; startTime: string; adults: number; children: number; infants: number }) {
  if (!DATE_RE.test(args.date)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
  if (!TIME_RE.test(args.startTime) || !tour.startTimes.includes(args.startTime)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "startTime" });
  const today = new Date().toISOString().slice(0, 10);
  if (args.date < today) throw new ConvexError({ code: "DATE_IN_PAST" });
  assertInt(args.adults, 1, 60, "adults");
  assertInt(args.children, 0, 60, "children");
  assertInt(args.infants, 0, 20, "infants");
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
  paymentMethodPreference: b.paymentMethodPreference ?? null,
  displayCurrency: b.displayCurrency ?? null,
  confirmedAt: b.confirmedAt ?? null,
  cancelledAt: b.cancelledAt ?? null,
  voucherToken: b.voucherToken,
  createdAt: b._creationTime,
  customerNotes: b.customerNotes ?? null,
});

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

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
    const startTime = args.startTime ?? tour.startTimes[0];
    const remaining = DATE_RE.test(args.date) && tour.startTimes.includes(startTime) ? await remainingCapacity(ctx, tour, args.date, startTime) : 0;
    const needed = tour.pricingModel === "per_group" ? 1 : quote.groupSize;
    return { ...quote, remaining, available: remaining >= needed && needed > 0 };
  },
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
    const data = JSON.parse(JSON.stringify(args.data).slice(0, 20_000));
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
  returns: v.object({ reference: v.string(), token: v.string(), bookingId: v.id("bookings"), status: v.string() }),
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour || tour.status !== "published") throw new ConvexError({ code: "TOUR_NOT_FOUND" });
    assertBookingArgs(tour, args);

    const email = args.traveller.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    if (!/^\+[1-9][0-9]{6,14}$/.test(args.traveller.phone)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "phone" });
    await enforceRateLimit(ctx, `booking:${email}`, 10, 60 * 60 * 1000);

    // Policies: every required current version must be accepted
    const policies = await ctx.db.query("policies").take(50);
    const required = policies.filter((p) => p.requiredAtCheckout && p.currentVersionId).map((p) => p.currentVersionId!);
    for (const id of required) {
      if (!args.acceptedPolicyVersionIds.includes(id)) throw new ConvexError({ code: "POLICIES_NOT_ACCEPTED" });
    }

    if (args.payLater && !tour.allowReserveNowPayLater) throw new ConvexError({ code: "PAY_LATER_NOT_ALLOWED" });

    const { quote, coupon } = await buildQuote(ctx, tour, args);
    if (args.couponCode && quote.couponError) throw new ConvexError({ code: "COUPON_INVALID", reason: quote.couponError });

    const needed = tour.pricingModel === "per_group" ? 1 : quote.groupSize;
    const remaining = await remainingCapacity(ctx, tour, args.date, args.startTime);
    if (remaining < needed) throw new ConvexError({ code: "SOLD_OUT", remaining });

    const viewer = await getViewer(ctx);
    const now = Date.now();
    const holdMs = tour.holdHours * 3_600_000;
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
      status: args.payLater ? "inquiry" : "pending_payment",
      paymentMethodPreference: args.paymentMethodPreference,
      holdExpiresAt: now + holdMs,
      policyVersionIds: args.acceptedPolicyVersionIds,
      source: "web",
      voucherToken,
      updatedAt: now,
    });

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

    // Notifications: reserve-now-pay-later gets an immediate hold email; paid bookings wait for the webhook
    if (args.payLater) {
      await ctx.scheduler.runAfter(0, internal.bookingEmails.sendHoldCreated, { bookingId });
    }
    await ctx.scheduler.runAfter(0, internal.bookingEmails.notifyStaffNewBooking, { bookingId });

    return { reference, token: voucherToken, bookingId, status: args.payLater ? "inquiry" : "pending_payment" };
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

export const expireHolds = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let expired = 0;
    for (const status of ["pending_payment", "inquiry"] as const) {
      const rows = await ctx.db.query("bookings").withIndex("by_holdExpiry", (q) => q.eq("status", status).lt("holdExpiresAt", now)).take(100);
      for (const b of rows) {
        if (b.amountPaid > 0) continue; // a payment arrived; never auto-cancel a paid booking
        await ctx.db.patch(b._id, { status: "cancelled", cancellationReason: "hold_expired", cancelledAt: now, updatedAt: now });
        await ctx.db.insert("auditLogs", { action: "booking.hold_expired", entityType: "bookings", entityId: b._id, before: { status }, after: { status: "cancelled" }, createdAt: now });
        expired++;
      }
    }
    return expired;
  },
});

export const markInProgressAndCompleted = internalMutation({
  args: {},
  returns: v.object({ started: v.number(), completed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const today = new Date(now + 4 * 3_600_000).toISOString().slice(0, 10); // Oman date
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
    const tomorrow = new Date(Date.now() + 28 * 3_600_000).toISOString().slice(0, 10);
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

/** Attach guest bookings (same email) to a user who just signed in. */
export const claimGuestBookings = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer?.email) return 0;
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
