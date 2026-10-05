import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { assertInt, assertString, audit, requireStaff } from "../lib/access";
import { generateBookingReference, generateToken } from "../lib/ids";
import { bookingStatusValidator, travellerValidator } from "../schema";
import { departureMs, isOperatingDate, isRealIsoDate, lastTourDay, omanTodayIso } from "../lib/dates";
import { countsForCapacity, overridesOn, remainingCapacity, slotOf } from "../lib/capacity";
import { releaseCouponUse, retakeCouponUse } from "../lib/coupons";
import { buildQuote } from "../bookings";
import { fallbackHoldExpiry, holdExpiryFor, isLapsedHold, loadHoldSettings } from "../lib/holds";
import { confirmPaidBooking } from "../payments";
import { capacityUnits } from "../lib/pricing";

type Status = Doc<"bookings">["status"];

/** Allowed workflow transitions (staff can also force with `force: true`). */
const TRANSITIONS: Record<Status, Status[]> = {
  inquiry: ["pending_payment", "confirmed", "cancelled"],
  pending_payment: ["confirmed", "cancelled", "inquiry"],
  confirmed: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["refunded"],
  cancelled: ["refunded", "confirmed"],
  refunded: [],
};

/**
 * In progress only from the departure day, completed only from the tour's last day (Oman date): marking a future
 * booking done would release its place for resale, move it to the customer's past trips and open reviews early.
 * The nightly job does this progression on its own; staff can still force it.
 */
function tooEarlyFor(status: Status, b: Pick<Doc<"bookings">, "date">, tour: Pick<Doc<"tours">, "durationDays"> | null, today: string): boolean {
  if (status === "in_progress") return b.date > today;
  if (status === "completed") return lastTourDay(b.date, tour?.durationDays) > today;
  return false;
}

/** Statuses whose date, time, party and price staff can still change. */
const AMENDABLE: Status[] = ["inquiry", "pending_payment", "confirmed"];

export const list = query({
  args: {
    status: v.optional(bookingStatusValidator),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    tourId: v.optional(v.id("tours")),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const limit = Math.min(args.limit ?? 200, 500);
    let rows: Doc<"bookings">[];
    if (args.status) rows = await ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").take(limit * 2);
    else if (args.from || args.to) rows = await ctx.db.query("bookings").withIndex("by_date", (q) => (args.from && args.to ? q.gte("date", args.from).lte("date", args.to) : args.from ? q.gte("date", args.from) : q.lte("date", args.to!))).order("desc").take(limit * 2);
    else rows = await ctx.db.query("bookings").order("desc").take(limit * 2);

    const s = args.search?.trim().toLowerCase();
    rows = rows.filter((b) => {
      if (args.tourId && b.tourId !== args.tourId) return false;
      if (args.from && b.date < args.from) return false;
      if (args.to && b.date > args.to) return false;
      if (s) {
        const hay = `${b.reference} ${b.traveller.firstName} ${b.traveller.lastName} ${b.traveller.email} ${b.traveller.phone} ${b.tourTitle.en} ${b.tourTitle.ar}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    return rows.slice(0, limit).map((b) => ({
      _id: b._id,
      reference: b.reference,
      tourTitle: b.tourTitle,
      date: b.date,
      startTime: b.startTime ?? null,
      groupSize: b.groupSize,
      adults: b.adults,
      children: b.children,
      infants: b.infants,
      traveller: `${b.traveller.firstName} ${b.traveller.lastName}`,
      email: b.traveller.email,
      phone: b.traveller.phone,
      nationality: b.traveller.nationality,
      total: b.total,
      amountPaid: b.amountPaid,
      status: b.status,
      source: b.source,
      createdAt: b._creationTime,
      holdExpiresAt: b.holdExpiresAt ?? null,
      guide: b.assignedGuideName ?? null,
      needsAttention: b.needsAttention ?? false,
    }));
  },
});

export const get = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) return null;
    const [tour, items, payments, refunds, notifications, acceptances, auditRows, user] = await Promise.all([
      ctx.db.get(b.tourId),
      ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(50),
      ctx.db.query("payments").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(50),
      ctx.db.query("refunds").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(50),
      ctx.db.query("notifications").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(50),
      ctx.db.query("policyAcceptances").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(5),
      ctx.db.query("auditLogs").withIndex("by_entity", (q) => q.eq("entityType", "bookings").eq("entityId", String(id))).order("desc").take(50),
      b.userId ? ctx.db.get(b.userId) : Promise.resolve(null),
    ]);
    const links = await ctx.db.query("paymentLinks").withIndex("by_booking", (q) => q.eq("bookingId", id)).take(20);
    return {
      ...b,
      tour: tour
        ? {
            _id: tour._id,
            slug: tour.slug,
            title: tour.title,
            freeCancellationHours: tour.freeCancellationHours,
            startTimes: tour.startTimes,
            pricingModel: tour.pricingModel,
            vehiclePricing: tour.vehiclePricing ?? null,
            minGroup: tour.minGroup,
            maxGroup: tour.maxGroup,
            durationDays: tour.durationDays,
          }
        : null,
      items,
      payments,
      refunds,
      notifications,
      acceptances,
      audit: auditRows,
      paymentLinks: links,
      customer: user ? { _id: user._id, name: user.name ?? null, email: user.email ?? null, tags: user.tags ?? [], loyaltyPoints: user.loyaltyPoints ?? 0 } : null,
      allowedTransitions: TRANSITIONS[b.status].filter((s) => !tooEarlyFor(s, b, tour, omanTodayIso())),
      amendable: AMENDABLE.includes(b.status),
    };
  },
});

const isHold = (s: Status) => s === "inquiry" || s === "pending_payment";

/**
 * Why a staff booking (new, reinstated or amended) would break the website's rules on this departure (empty = none):
 * a start time the tour does not list, blacked out, not an operating date, not enough places left (the booking itself
 * excluded), group size outside the tour's range, or more infants than adults.
 */
async function manualBookingProblems(
  ctx: QueryCtx | MutationCtx,
  tour: Doc<"tours">,
  date: string,
  startTime: string,
  adults: number,
  children: number,
  infants: number,
  excludeBookingId?: Id<"bookings">,
): Promise<{ problems: string[]; remaining: number; needed: number }> {
  const problems: string[] = [];
  const overrides = await overridesOn(ctx, tour._id, date);
  const blackout = overrides.some((o) => o.isBlackout && (!o.startTime || o.startTime === startTime));
  const operating = isOperatingDate(tour, date);
  // A time the tour no longer lists is not counted against any departure (see admin products upsert)
  if (!tour.startTimes.includes(startTime)) problems.push("off_schedule");
  if (blackout) problems.push("blackout");
  if (!operating) problems.push("not_operating");
  const remaining = await remainingCapacity(ctx, tour, date, startTime, { excludeBookingId });
  const needed = capacityUnits(tour, adults, children);
  if (!blackout && operating && remaining < needed) problems.push("no_capacity");
  const group = adults + children;
  if (group < tour.minGroup || group > tour.maxGroup) problems.push("group_size");
  if (infants > adults) problems.push("too_many_infants");
  return { problems, remaining, needed };
}

/**
 * A staff hold (a week), capped before the departure like every hold; close to departure, one checkout window.
 * `holdUntil` (an Oman calendar day staff picked) holds until the end of that day instead, within the same cap.
 */
async function staffHoldExpiry(ctx: MutationCtx, tour: Doc<"tours"> | null, date: string, startTime: string | undefined, now: number, holdUntil?: string): Promise<number> {
  const settings = await loadHoldSettings(ctx);
  const time = startTime || tour?.startTimes[0] || "00:00";
  const standard = holdExpiryFor({ tour: { holdHours: tour?.holdHours ?? 24 }, date, startTime: time, kind: "staff", now, settings });
  if (!holdUntil) return standard ?? fallbackHoldExpiry(date, time, now, settings);
  if (!isRealIsoDate(holdUntil)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "holdUntil" });
  const endOfDay = Date.parse(`${holdUntil}T23:59:59+04:00`);
  if (endOfDay <= now) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "holdUntil" });
  // Never past the pay-by cutoff before departure (or, that close to departure, the fallback window)
  const departure = departureMs(date, time);
  const cutoff = Number.isFinite(departure) ? departure - settings.payBeforeDepartureHours * 3_600_000 : Infinity;
  const latest = cutoff > now ? cutoff : fallbackHoldExpiry(date, time, now, settings);
  return Math.min(endOfDay, latest);
}

export const updateStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: bookingStatusValidator,
    reason: v.optional(v.string()),
    force: v.optional(v.boolean()),
    /** Staff confirmed they want this booking back on a departure that no longer has room for it. */
    override: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { id, status, reason, force, override }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    if (b.status === status) return null;
    if (!force && !TRANSITIONS[b.status].includes(status)) throw new ConvexError({ code: "INVALID_TRANSITION", from: b.status, to: status });
    const tour = await ctx.db.get(b.tourId);
    if (!force && tooEarlyFor(status, b, tour, omanTodayIso())) throw new ConvexError({ code: "STATUS_TOO_EARLY", status, date: b.date });
    // A cancelled (or completed/refunded) booking gave its place back; taking it again must not overbook the departure,
    // land on a blacked-out or non-operating date or break the group rules unless staff confirm it (override)
    let overrideReasons: string[] | undefined;
    if (tour && !countsForCapacity(b.status) && countsForCapacity(status)) {
      const check = await manualBookingProblems(ctx, tour, b.date, slotOf(tour, b), b.adults, b.children, b.infants, id);
      if (check.problems.length > 0) {
        if (!override) throw new ConvexError({ code: "NEEDS_OVERRIDE", reasons: check.problems, remaining: check.remaining, needed: check.needed });
        overrideReasons = check.problems;
      }
    }
    const now = Date.now();
    const patch: Partial<Doc<"bookings">> = { status, updatedAt: now };
    if (status === "confirmed") { patch.confirmedAt = b.confirmedAt ?? now; patch.holdExpiresAt = undefined; }
    if (status === "cancelled") { patch.cancelledAt = now; patch.cancellationReason = reason?.slice(0, 500) ?? "staff"; }
    if (b.status === "cancelled" && countsForCapacity(status)) { patch.cancelledAt = undefined; patch.cancellationReason = undefined; }
    if (status === "completed") patch.completedAt = now;
    // Moving into an unpaid status always starts a fresh staff hold (a missing or past hold must never carry over,
    // or expiry would cancel the booking straight away); it is released exactly when it runs out
    if (isHold(status)) {
      patch.holdExpiresAt = await staffHoldExpiry(ctx, tour, b.date, b.startTime, now);
      patch.holdCeilingAt = undefined; // a fresh hold gets a fresh checkout ceiling
    }
    await ctx.db.patch(id, patch);
    if (patch.holdExpiresAt !== undefined) await ctx.scheduler.runAt(patch.holdExpiresAt, internal.bookings.expireHold, { id });
    // Coupon uses follow the booking, as on hold expiry and customer cancellation (lib/coupons): an unpaid booking
    // cancelled by staff gives its use back, and a reinstated booking takes it again
    if (status === "cancelled" && countsForCapacity(b.status) && b.amountPaid === 0) await releaseCouponUse(ctx, b);
    if (b.status === "cancelled" && countsForCapacity(status)) await retakeCouponUse(ctx, b);
    await audit(ctx, staff, "booking.status_change", "bookings", String(id), { status: b.status }, { status, reason, force: force || undefined, overrideReasons });
    if (status === "confirmed" && b.status !== "confirmed") await ctx.scheduler.runAfter(0, internal.bookingEmails.sendConfirmation, { bookingId: id });
    return null;
  },
});

/** Operations details only; date, start time and party go through amend (validated, capacity-checked, re-priced). */
export const updateDetails = mutation({
  args: {
    id: v.id("bookings"),
    internalNotes: v.optional(v.string()),
    assignedGuideName: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    traveller: v.optional(travellerValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(args.id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    const patch: Partial<Doc<"bookings">> = { updatedAt: Date.now() };
    if (args.internalNotes !== undefined) patch.internalNotes = assertString(args.internalNotes, 4000, "internalNotes");
    if (args.assignedGuideName !== undefined) patch.assignedGuideName = assertString(args.assignedGuideName, 120, "guide");
    if (args.vehicle !== undefined) patch.vehicle = assertString(args.vehicle, 120, "vehicle");
    if (args.traveller !== undefined) patch.traveller = { ...args.traveller, email: args.traveller.email.toLowerCase() };
    await ctx.db.patch(args.id, patch);
    await audit(ctx, staff, "booking.update", "bookings", String(args.id), { guide: b.assignedGuideName, vehicle: b.vehicle }, patch);
    return null;
  },
});

/** Staff type one agreed total, so every model but per-person prints it as a single line on the voucher. */
function staffPriceItem(tour: Doc<"tours">, adults: number, children: number, total: number) {
  const heads = adults + children;
  const vehicles = tour.pricingModel === "per_vehicle" ? capacityUnits(tour, adults, children) : 0;
  const item =
    tour.pricingModel === "per_person"
      ? { kind: "adult" as const, label: { en: "Guests", ar: "الضيوف" }, quantity: heads, unitPrice: Math.round(total / Math.max(1, heads)) }
      : tour.pricingModel === "per_vehicle"
        ? { kind: "group" as const, label: { en: "4WD vehicle", ar: "سيارة دفع رباعي" }, quantity: vehicles, unitPrice: Math.round(total / Math.max(1, vehicles)) }
        : tour.pricingModel === "tiered"
          ? { kind: "group" as const, label: { en: `Private tour (${adults} adults${children ? `, ${children} children` : ""})`, ar: `جولة خاصة (${adults} بالغين${children ? ` و${children} أطفال` : ""})` }, quantity: 1, unitPrice: total }
          : { kind: "group" as const, label: { en: "Private group", ar: "مجموعة خاصة" }, quantity: 1, unitPrice: total };
  return { ...item, total };
}

/* ------------------------------------------------------------------ */
/* Change booking (date, start time, party, price)                     */
/* ------------------------------------------------------------------ */

const amendArgs = {
  id: v.id("bookings"),
  date: v.optional(v.string()),
  startTime: v.optional(v.string()),
  adults: v.optional(v.number()),
  children: v.optional(v.number()),
  infants: v.optional(v.number()),
  /** An agreed total in OMR instead of the website price (one line on the voucher, as for manual bookings). */
  totalOmrOverride: v.optional(v.number()),
};
type AmendInput = { date?: string; startTime?: string; adults?: number; children?: number; infants?: number; totalOmrOverride?: number };
type AmendItem = { kind: Doc<"bookingItems">["kind"]; label: { en: string; ar: string }; quantity: number; unitPrice: number; total: number; addOnId?: Id<"addOns"> };

/**
 * What a change would do, shared by amendPreview (shown live in the dialog) and amend (which applies it), so staff
 * see exactly what is saved. Throws ConvexError for invalid input.
 * - Same rules as staff bookings: a real date (not in the past when it changes, no lead time), a listed start time,
 *   whole-number guests; blackouts, operating days, capacity (this booking excluded), group size and infants are
 *   reported as problems that need an explicit override when the slot or party changes.
 * - Priced like the website (season, the booking's extras, its coupon honoured as redeemed), unless staff give an
 *   agreed total. A coupon whose deal no longer fits the new party (minimum spend, group, tour) is dropped.
 */
async function planAmendment(ctx: QueryCtx | MutationCtx, b: Doc<"bookings">, tour: Doc<"tours">, input: AmendInput) {
  const date = input.date ?? b.date;
  const startTime = input.startTime ?? slotOf(tour, b) ?? "";
  const adults = input.adults ?? b.adults;
  const children = input.children ?? b.children;
  const infants = input.infants ?? b.infants;
  if (!isRealIsoDate(date)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
  if (date !== b.date && date < omanTodayIso()) throw new ConvexError({ code: "DATE_IN_PAST" });
  if (!tour.startTimes.includes(startTime)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "startTime" });
  assertInt(adults, 1, 100, "adults");
  assertInt(children, 0, 100, "children");
  assertInt(infants, 0, 50, "infants");
  const slotChanged = date !== b.date || startTime !== slotOf(tour, b);
  const partyChanged = adults !== b.adults || children !== b.children || infants !== b.infants;

  let items: AmendItem[];
  let subtotal: number, addOnsTotal: number, discountTotal: number, total: number, depositDue: number;
  let couponDropped: string | undefined;
  if (input.totalOmrOverride !== undefined) {
    if (!Number.isFinite(input.totalOmrOverride) || input.totalOmrOverride < 0 || input.totalOmrOverride > 100_000) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "total" });
    total = Math.round(input.totalOmrOverride * 1000);
    items = [staffPriceItem(tour, adults, children, total)];
    subtotal = total;
    addOnsTotal = 0;
    discountTotal = 0;
    depositDue = Math.round((total * tour.depositPercent) / 100);
  } else {
    // Keep the booking's extras: stored per-person extras hold quantity x guests, so divide by the old party
    const current = await ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(50);
    const addOns: { addOnId: Id<"addOns">; quantity: number }[] = [];
    for (const item of current) {
      if (item.kind !== "addon" || !item.addOnId) continue;
      const a = await ctx.db.get(item.addOnId);
      addOns.push({ addOnId: item.addOnId, quantity: a?.priceType === "per_person" ? Math.max(1, Math.round(item.quantity / Math.max(1, b.groupSize))) : item.quantity });
    }
    const { quote } = await buildQuote(ctx, tour, { date, adults, children, infants, addOns, couponCode: b.couponCode }, { honourCoupon: true });
    if (b.couponCode && quote.couponError) couponDropped = quote.couponError;
    const free = quote.total === 0 && !!quote.couponCode && quote.discountTotal > 0;
    if (quote.total <= 0 && !free) throw new ConvexError({ code: "PRICE_UNAVAILABLE" });
    items = quote.items.map((i) => ({ kind: i.kind, label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, addOnId: i.addOnId ? (i.addOnId as Id<"addOns">) : undefined }));
    ({ subtotal, addOnsTotal, discountTotal, total, depositDue } = quote);
  }
  const check = await manualBookingProblems(ctx, tour, date, startTime, adults, children, infants, b._id);
  return {
    date,
    startTime,
    adults,
    children,
    infants,
    groupSize: adults + children,
    slotChanged,
    partyChanged,
    // Rules are only enforced on what changes: a price-only change never needs an override
    problems: slotChanged || partyChanged ? check.problems : [],
    remaining: check.remaining,
    needed: check.needed,
    items,
    subtotal,
    addOnsTotal,
    discountTotal,
    total,
    depositDue,
    couponDropped,
  };
}

/** Live preview for the "Change booking" dialog: new price, balance and the rules the change would break. */
export const amendPreview = query({
  args: amendArgs,
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const b = await ctx.db.get(args.id);
    if (!b || !AMENDABLE.includes(b.status)) return null;
    const tour = await ctx.db.get(b.tourId);
    if (!tour) return null;
    try {
      const plan = await planAmendment(ctx, b, tour, args);
      return {
        ok: true as const,
        total: plan.total,
        depositDue: plan.depositDue,
        amountPaid: b.amountPaid,
        balance: Math.max(0, plan.total - b.amountPaid),
        refundDue: Math.max(0, b.amountPaid - plan.total),
        problems: plan.problems,
        remaining: plan.remaining,
        needed: plan.needed,
        couponDropped: plan.couponDropped ?? null,
        changed: plan.slotChanged || plan.partyChanged || plan.total !== b.total,
      };
    } catch (err) {
      if (err instanceof ConvexError) return { ok: false as const, error: err.data as { code: string; field?: string } };
      throw err;
    }
  },
});

/**
 * Staff change a booking's date, start time, party or price (customer change requests). Only inquiry, pending payment
 * and confirmed bookings. Re-prices with the website rules (or the agreed total), replaces the line items, keeps the
 * money already paid (an overpayment flags needsAttention for a refund), resets the reminder when the date moves,
 * keeps an unpaid hold no later than the new departure allows, audits before and after, and optionally emails the
 * customer the updated booking. Breaking a departure rule needs override (NEEDS_OVERRIDE lists the reasons).
 */
export const amend = mutation({
  args: { ...amendArgs, reason: v.string(), notifyCustomer: v.optional(v.boolean()), override: v.optional(v.boolean()) },
  returns: v.object({ total: v.number(), balance: v.number(), refundDue: v.number(), couponDropped: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(args.id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    if (!AMENDABLE.includes(b.status)) throw new ConvexError({ code: "NOT_AMENDABLE", status: b.status });
    const tour = await ctx.db.get(b.tourId);
    if (!tour) throw new ConvexError({ code: "TOUR_NOT_FOUND" });
    const reason = assertString(args.reason, 500, "reason", 1);
    const plan = await planAmendment(ctx, b, tour, args);
    if (plan.problems.length > 0 && !args.override) throw new ConvexError({ code: "NEEDS_OVERRIDE", reasons: plan.problems, remaining: plan.remaining, needed: plan.needed });

    const now = Date.now();
    if (plan.couponDropped) await releaseCouponUse(ctx, b);
    for (const item of await ctx.db.query("bookingItems").withIndex("by_booking", (q) => q.eq("bookingId", b._id)).take(100)) await ctx.db.delete(item._id);
    for (const item of plan.items) await ctx.db.insert("bookingItems", { bookingId: b._id, ...item });
    const refundDue = Math.max(0, b.amountPaid - plan.total);
    const patch: Partial<Doc<"bookings">> = {
      date: plan.date,
      endDate: lastTourDay(plan.date, tour.durationDays),
      startTime: plan.startTime,
      adults: plan.adults,
      children: plan.children,
      infants: plan.infants,
      groupSize: plan.groupSize,
      subtotal: plan.subtotal,
      addOnsTotal: plan.addOnsTotal,
      discountTotal: plan.discountTotal,
      total: plan.total,
      depositDue: plan.depositDue,
      updatedAt: now,
    };
    if (plan.couponDropped) { patch.couponCode = undefined; patch.couponReleased = undefined; }
    // The day-before reminder belongs to the old date
    if (plan.date !== b.date) patch.reminderSentAt = undefined;
    if (refundDue > 0) { patch.needsAttention = true; patch.attentionReason = "refund_due_after_change"; }
    // An unpaid hold must still end before the (new) departure; it is never extended here
    if (isHold(b.status) && plan.slotChanged && b.holdExpiresAt !== undefined) {
      const cap = await staffHoldExpiry(ctx, tour, plan.date, plan.startTime, now);
      if (cap < b.holdExpiresAt) patch.holdExpiresAt = cap;
    }
    await ctx.db.patch(b._id, patch);
    if (patch.holdExpiresAt !== undefined) await ctx.scheduler.runAt(patch.holdExpiresAt, internal.bookings.expireHold, { id: b._id });
    await audit(
      ctx,
      staff,
      "booking.amend",
      "bookings",
      String(b._id),
      { date: b.date, startTime: b.startTime, adults: b.adults, children: b.children, infants: b.infants, total: b.total, couponCode: b.couponCode },
      {
        date: plan.date,
        startTime: plan.startTime,
        adults: plan.adults,
        children: plan.children,
        infants: plan.infants,
        total: plan.total,
        reason,
        agreedTotal: args.totalOmrOverride !== undefined || undefined,
        overrideReasons: plan.problems.length > 0 ? plan.problems : undefined,
        couponDropped: plan.couponDropped,
        refundDue: refundDue || undefined,
      },
    );
    if (args.notifyCustomer) await ctx.scheduler.runAfter(0, internal.bookingEmails.sendBookingChanged, { bookingId: b._id });
    return { total: plan.total, balance: Math.max(0, plan.total - b.amountPaid), refundDue, couponDropped: plan.couponDropped };
  },
});

/** Manual booking (WhatsApp / phone / office / OTA). */
export const createManual = mutation({
  args: {
    tourId: v.id("tours"),
    date: v.string(),
    startTime: v.string(),
    adults: v.number(),
    children: v.number(),
    infants: v.number(),
    traveller: travellerValidator,
    locale: v.union(v.literal("en"), v.literal("ar")),
    source: v.union(v.literal("whatsapp"), v.literal("phone"), v.literal("email"), v.literal("office"), v.literal("viator"), v.literal("tripadvisor"), v.literal("staff")),
    totalOmr: v.number(), // override price in OMR
    status: v.union(v.literal("inquiry"), v.literal("pending_payment"), v.literal("confirmed")),
    amountPaidOmr: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    /** Unpaid statuses: keep the place until the end of this Oman day (YYYY-MM-DD) instead of the default week. */
    holdUntil: v.optional(v.string()),
    /** Staff confirmed they want this booking despite the reasons NEEDS_OVERRIDE listed (full, blacked out, ...). */
    override: v.optional(v.boolean()),
  },
  returns: v.object({ bookingId: v.id("bookings"), reference: v.string() }),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new ConvexError({ code: "TOUR_NOT_FOUND" });
    if (!isRealIsoDate(args.date)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
    assertInt(args.adults, 1, 100, "adults");
    assertInt(args.children, 0, 100, "children");
    assertInt(args.infants, 0, 50, "infants");
    const total = Math.round(Math.max(0, args.totalOmr) * 1000);
    const paid = Math.round(Math.max(0, Math.min(args.amountPaidOmr ?? 0, args.totalOmr)) * 1000);
    const now = Date.now();
    let reference = generateBookingReference();
    while (await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", reference)).unique()) reference = generateBookingReference();
    const policies = await ctx.db.query("policies").take(50);
    // Capacity is counted per listed departure; a blank or unknown time would make the booking invisible
    // to it, letting the website sell the same seat or 4WD again. Fall back to the first departure.
    const startTime = args.startTime && tour.startTimes.includes(args.startTime) ? args.startTime : tour.startTimes[0];
    // Every status staff can create here takes a place (inquiries included), so warn before overbooking, selling a
    // blacked-out or non-operating date, or breaking the group rules; staff may still go ahead with override
    const reasons = await manualBookingProblems(ctx, tour, args.date, startTime, args.adults, args.children, args.infants);
    if (reasons.problems.length > 0 && !args.override) throw new ConvexError({ code: "NEEDS_OVERRIDE", reasons: reasons.problems, remaining: reasons.remaining, needed: reasons.needed });
    const holdExpiresAt = args.status === "confirmed" ? undefined : await staffHoldExpiry(ctx, tour, args.date, startTime, now, args.holdUntil || undefined);
    const bookingId = await ctx.db.insert("bookings", {
      reference,
      tourId: tour._id,
      tourTitle: tour.title,
      date: args.date,
      endDate: lastTourDay(args.date, tour.durationDays),
      startTime,
      adults: args.adults,
      children: args.children,
      infants: args.infants,
      groupSize: args.adults + args.children,
      pricingModel: tour.pricingModel,
      currency: "OMR",
      subtotal: total,
      addOnsTotal: 0,
      discountTotal: 0,
      total,
      depositDue: Math.round((total * tour.depositPercent) / 100),
      amountPaid: paid,
      amountRefunded: 0,
      traveller: { ...args.traveller, email: args.traveller.email.toLowerCase() },
      locale: args.locale,
      status: args.status,
      holdExpiresAt,
      policyVersionIds: policies.map((p) => p.currentVersionId).filter((x): x is Id<"policyVersions"> => !!x),
      source: args.source,
      internalNotes: args.internalNotes,
      voucherToken: generateToken(40),
      confirmedAt: args.status === "confirmed" ? now : undefined,
      createdByStaffId: staff._id,
      updatedAt: now,
    });
    await ctx.db.insert("bookingItems", { bookingId, ...staffPriceItem(tour, args.adults, args.children, total) });
    if (holdExpiresAt !== undefined) await ctx.scheduler.runAt(holdExpiresAt, internal.bookings.expireHold, { id: bookingId });
    if (paid > 0) {
      await ctx.db.insert("payments", { bookingId, provider: "manual", kind: paid >= total ? "full" : "deposit", amount: paid, currency: "OMR", amountOmr: paid, status: "succeeded", providerPaymentId: `manual_${reference}`, idempotencyKey: `manual_${bookingId}`, paidAt: now, refundedAmount: 0, createdByStaffId: staff._id, updatedAt: now });
    }
    await audit(ctx, staff, "booking.create_manual", "bookings", String(bookingId), undefined, { reference, source: args.source, total, paid, overrideReasons: reasons.problems.length > 0 ? reasons.problems : undefined });
    if (args.status === "confirmed") await ctx.scheduler.runAfter(0, internal.bookingEmails.sendConfirmation, { bookingId });
    return { bookingId, reference };
  },
});

/** Records an offline payment (cash / bank transfer) and confirms if the deposit is covered. */
export const recordManualPayment = mutation({
  args: { id: v.id("bookings"), amountOmr: v.number(), method: v.string(), reference: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, amountOmr, method, reference }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    const amount = Math.round(amountOmr * 1000);
    if (!Number.isFinite(amount) || amount <= 0 || amount > b.total - b.amountPaid + 1) throw new ConvexError({ code: "INVALID_AMOUNT" });
    const now = Date.now();
    // Money is only recorded on a booking it can apply to. A refunded or cancelled booking is reinstated first with
    // a status change (which checks capacity); only a lapsed hold that this payment confirms, with its place still
    // free, is re-confirmed directly. Nothing here emails the customer about an "inactive" booking.
    if (b.status === "refunded" || b.status === "cancelled") {
      const tour = await ctx.db.get(b.tourId);
      const reinstatable =
        isLapsedHold(b) &&
        b.amountPaid + amount >= b.depositDue &&
        !!tour &&
        (await remainingCapacity(ctx, tour, b.date, slotOf(tour, b), { excludeBookingId: id })) >= capacityUnits(tour, b.adults, b.children);
      if (!reinstatable) throw new ConvexError({ code: "BOOKING_NOT_PAYABLE", status: b.status });
    }
    const paymentId = await ctx.db.insert("payments", { bookingId: id, provider: "manual", kind: b.amountPaid + amount >= b.total ? (b.amountPaid > 0 ? "balance" : "full") : "deposit", amount, currency: "OMR", amountOmr: amount, status: "pending", providerSessionId: `manual_${id}_${now}`, idempotencyKey: `manual_${id}_${now}`, refundedAmount: 0, createdByStaffId: staff._id, updatedAt: now, rawEvent: { method: method.slice(0, 40), reference: reference?.slice(0, 80) } });
    // Apply directly (manual provider is trusted staff input)
    await ctx.db.patch(paymentId, { status: "succeeded", providerPaymentId: `manual_${paymentId}`, paidAt: now, updatedAt: now });
    const amountPaid = b.amountPaid + amount;
    // Same decision as the provider webhook, as a staff payment: cash taken at or after departure still confirms,
    // and no "booking no longer active" emails go out
    const outcome = await confirmPaidBooking(ctx, { ...b, amountPaid }, now, { actor: staff, source: "staff" });
    await audit(ctx, staff, "payment.manual", "bookings", String(id), { amountPaid: b.amountPaid }, { amountPaid, method, reference, outcome });
    return null;
  },
});

/** Staff have dealt with a payment that arrived on a cancelled, refunded or departed booking (refunded or rebooked). */
export const clearAttention = mutation({
  args: { id: v.id("bookings"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, note }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    if (!b.needsAttention) return null;
    await ctx.db.patch(id, { needsAttention: false, updatedAt: Date.now() });
    await audit(ctx, staff, "booking.attention_cleared", "bookings", String(id), { attentionReason: b.attentionReason }, { note: note?.slice(0, 500) });
    return null;
  },
});

export const regenerateVoucher = mutation({
  args: { id: v.id("bookings") },
  returns: v.string(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    const voucherToken = generateToken(40);
    await ctx.db.patch(id, { voucherToken, updatedAt: Date.now() });
    await audit(ctx, staff, "booking.voucher_regenerated", "bookings", String(id));
    return voucherToken;
  },
});

/** Statuses a payment link can be issued for: unpaid holds, and confirmed bookings with a balance still owed. */
const LINK_STATUSES: Status[] = ["inquiry", "pending_payment", "confirmed"];

/**
 * Staff payment link (WhatsApp / phone bookings). The link never outlives what it pays for: it ends by the departure
 * (an unpaid hold by the same pay-by cutoff as every hold), and an unpaid hold is extended to last as long as the link
 * (after a capacity re-check if the hold had already run out), so the customer never opens a "Pay" link on a booking
 * that was silently released.
 */
export const issuePaymentLink = mutation({
  args: {
    id: v.id("bookings"),
    amountOmr: v.number(),
    description: v.optional(v.string()),
    expiresInHours: v.optional(v.number()),
    /** Staff confirmed it: a link below the rest of the deposit lowers depositDue so paying it confirms the booking. */
    lowerDeposit: v.optional(v.boolean()),
  },
  returns: v.object({ token: v.string(), url: v.string(), expiresAt: v.number() }),
  handler: async (ctx, { id, amountOmr, description, expiresInHours, lowerDeposit }): Promise<{ token: string; url: string; expiresAt: number }> => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    if (!LINK_STATUSES.includes(b.status)) throw new ConvexError({ code: "LINK_NOT_ALLOWED", status: b.status });
    const amount = Math.round(amountOmr * 1000);
    if (!Number.isFinite(amount) || amount <= 0) throw new ConvexError({ code: "INVALID_AMOUNT" });
    const owed = b.total - b.amountPaid;
    if (owed <= 0) throw new ConvexError({ code: "NOTHING_TO_PAY" });
    // An unpaid hold is confirmed only once the deposit is covered (confirmPaidBooking). A smaller link would be paid,
    // leave the booking unconfirmed and keep its place indefinitely, so staff must agree to lower the deposit to it.
    const depositLeft = Math.min(owed, b.depositDue - b.amountPaid);
    const lowersDeposit = isHold(b.status) && depositLeft > 0 && amount < depositLeft;
    if (lowersDeposit && !lowerDeposit) throw new ConvexError({ code: "LINK_BELOW_DEPOSIT", minimum: depositLeft, depositDue: b.depositDue });
    const hours = expiresInHours ?? 72;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "expiresInHours" });

    const now = Date.now();
    const tour = await ctx.db.get(b.tourId);
    const time = b.startTime || tour?.startTimes[0] || "00:00";
    const departure = departureMs(b.date, time);
    let expiresAt = now + hours * 3_600_000;
    if (Number.isFinite(departure)) {
      const settings = await loadHoldSettings(ctx);
      const cutoff = isHold(b.status) ? departure - settings.payBeforeDepartureHours * 3_600_000 : departure;
      expiresAt = Math.min(expiresAt, cutoff > now ? cutoff : departure);
    }
    if (expiresAt <= now) throw new ConvexError({ code: "LINK_TOO_LATE" });

    // An unpaid hold (nothing paid, with a deadline) must last as long as the link
    let holdExtendedTo: number | undefined;
    if (isHold(b.status) && b.amountPaid <= 0 && b.holdExpiresAt !== undefined && b.holdExpiresAt < expiresAt) {
      if (b.holdExpiresAt <= now && tour) {
        // The hold already ran out (expiry not yet applied): only keep the place if it is still free
        const remaining = await remainingCapacity(ctx, tour, b.date, time, { excludeBookingId: id });
        const needed = capacityUnits(tour, b.adults, b.children);
        if (remaining < needed) throw new ConvexError({ code: "SOLD_OUT", remaining, needed });
      }
      holdExtendedTo = expiresAt;
      // A fresh hold gets a fresh checkout ceiling (lib/holds)
      await ctx.db.patch(id, { holdExpiresAt: expiresAt, holdCeilingAt: undefined, updatedAt: now });
      await ctx.scheduler.runAt(expiresAt, internal.bookings.expireHold, { id });
    }

    if (lowersDeposit) {
      const depositDue = b.amountPaid + amount;
      await ctx.db.patch(id, { depositDue, updatedAt: now });
      await audit(ctx, staff, "booking.deposit_lowered", "bookings", String(id), { depositDue: b.depositDue }, { depositDue, reason: "payment_link" });
    }

    const token = generateToken(32);
    const kind = b.amountPaid > 0 ? "balance" : amount >= owed ? "full" : "deposit";
    await ctx.db.insert("paymentLinks", { bookingId: id, token, amountOmr: amount, kind, description: description?.slice(0, 300), expiresAt, createdByStaffId: staff._id });
    await audit(ctx, staff, "payment.link_issued", "bookings", String(id), undefined, { amount, expiresAt, holdExtendedTo });
    const base = process.env.SITE_URL ?? "http://localhost:3000";
    return { token, url: `${base}/${b.locale}/pay/${token}`, expiresAt };
  },
});

/**
 * What the website would charge a party on a date (season included, no extras or coupon), so the manual-booking
 * suggestion matches the online price. Null for an unknown tour or a date that is not a real day.
 */
export const suggestedTotal = query({
  args: { tourId: v.id("tours"), date: v.string(), adults: v.number(), children: v.number(), infants: v.number() },
  returns: v.union(v.null(), v.object({ total: v.number(), seasonal: v.boolean() })),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour || !isRealIsoDate(args.date)) return null;
    const party = (x: number) => (Number.isFinite(x) ? Math.min(500, Math.max(0, Math.floor(x))) : 0);
    const { quote } = await buildQuote(ctx, tour, { date: args.date, adults: party(args.adults), children: party(args.children), infants: party(args.infants), addOns: [] });
    return { total: quote.total, seasonal: quote.seasonal ?? false };
  },
});

export const toursForSelect = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("tours").take(500);
    // Everything the dialog needs to suggest a total with the same engine the website uses
    return rows.map((t) => ({
      _id: t._id,
      code: t.code,
      title: t.title,
      status: t.status,
      startTimes: t.startTimes,
      pricingModel: t.pricingModel,
      priceFrom: t.priceFrom,
      priceGroup: t.priceGroup ?? null,
      priceAdult: t.priceAdult ?? null,
      priceChild: t.priceChild ?? null,
      tieredPricing: t.tieredPricing ?? null,
      vehiclePricing: t.vehiclePricing ?? null,
      depositPercent: t.depositPercent,
      minGroup: t.minGroup,
      maxGroup: t.maxGroup,
    }));
  },
});
