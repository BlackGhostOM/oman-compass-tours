import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { assertInt, assertString, audit, requireStaff } from "../lib/access";
import { generateBookingReference, generateToken } from "../lib/ids";
import { bookingStatusValidator, travellerValidator } from "../schema";
import { isOperatingDate, isRealIsoDate } from "../lib/dates";
import { countsForCapacity, overridesOn, remainingCapacity, slotOf } from "../lib/capacity";
import { fallbackHoldExpiry, holdExpiryFor, loadHoldSettings } from "../lib/holds";
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
      tour: tour ? { _id: tour._id, slug: tour.slug, title: tour.title, freeCancellationHours: tour.freeCancellationHours, startTimes: tour.startTimes, pricingModel: tour.pricingModel } : null,
      items,
      payments,
      refunds,
      notifications,
      acceptances,
      audit: auditRows,
      paymentLinks: links,
      customer: user ? { _id: user._id, name: user.name ?? null, email: user.email ?? null, tags: user.tags ?? [], loyaltyPoints: user.loyaltyPoints ?? 0 } : null,
      allowedTransitions: TRANSITIONS[b.status],
    };
  },
});

const isHold = (s: Status) => s === "inquiry" || s === "pending_payment";

/**
 * Why a staff booking would break the website's rules on this departure (empty = none): blacked out, not an operating
 * date, not enough places left, group size outside the tour's range, or more infants than adults.
 */
async function manualBookingProblems(
  ctx: MutationCtx,
  tour: Doc<"tours">,
  date: string,
  startTime: string,
  adults: number,
  children: number,
  infants: number,
): Promise<{ problems: string[]; remaining: number; needed: number }> {
  const problems: string[] = [];
  const overrides = await overridesOn(ctx, tour._id, date);
  const blackout = overrides.some((o) => o.isBlackout && (!o.startTime || o.startTime === startTime));
  const operating = isOperatingDate(tour, date);
  if (blackout) problems.push("blackout");
  if (!operating) problems.push("not_operating");
  const remaining = await remainingCapacity(ctx, tour, date, startTime);
  const needed = capacityUnits(tour, adults, children);
  if (!blackout && operating && remaining < needed) problems.push("no_capacity");
  const group = adults + children;
  if (group < tour.minGroup || group > tour.maxGroup) problems.push("group_size");
  if (infants > adults) problems.push("too_many_infants");
  return { problems, remaining, needed };
}

/** A staff hold (a week), capped before the departure like every hold; close to departure, one checkout window. */
async function staffHoldExpiry(ctx: MutationCtx, tour: Doc<"tours"> | null, date: string, startTime: string | undefined, now: number): Promise<number> {
  const settings = await loadHoldSettings(ctx);
  const time = startTime || tour?.startTimes[0] || "00:00";
  return holdExpiryFor({ tour: { holdHours: tour?.holdHours ?? 24 }, date, startTime: time, kind: "staff", now, settings }) ?? fallbackHoldExpiry(date, time, now, settings);
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
    // A cancelled (or completed/refunded) booking gave its place back; taking it again must not overbook the departure
    if (tour && !countsForCapacity(b.status) && countsForCapacity(status)) {
      const remaining = await remainingCapacity(ctx, tour, b.date, slotOf(tour, b), { excludeBookingId: id });
      const needed = capacityUnits(tour, b.adults, b.children);
      if (remaining < needed && !override) throw new ConvexError({ code: "NEEDS_OVERRIDE", remaining, needed });
    }
    const now = Date.now();
    const patch: Partial<Doc<"bookings">> = { status, updatedAt: now };
    if (status === "confirmed") { patch.confirmedAt = b.confirmedAt ?? now; patch.holdExpiresAt = undefined; }
    if (status === "cancelled") { patch.cancelledAt = now; patch.cancellationReason = reason?.slice(0, 500) ?? "staff"; }
    if (status === "completed") patch.completedAt = now;
    // Moving into an unpaid status always starts a fresh staff hold (a missing or past hold must never carry over,
    // or expiry would cancel the booking straight away); it is released exactly when it runs out
    if (isHold(status)) {
      patch.holdExpiresAt = await staffHoldExpiry(ctx, tour, b.date, b.startTime, now);
      patch.holdCeilingAt = undefined; // a fresh hold gets a fresh checkout ceiling
    }
    await ctx.db.patch(id, patch);
    if (patch.holdExpiresAt !== undefined) await ctx.scheduler.runAt(patch.holdExpiresAt, internal.bookings.expireHold, { id });
    await audit(ctx, staff, "booking.status_change", "bookings", String(id), { status: b.status }, { status, reason, override: override || undefined });
    if (status === "confirmed" && b.status !== "confirmed") await ctx.scheduler.runAfter(0, internal.bookingEmails.sendConfirmation, { bookingId: id });
    return null;
  },
});

export const updateDetails = mutation({
  args: {
    id: v.id("bookings"),
    internalNotes: v.optional(v.string()),
    assignedGuideName: v.optional(v.string()),
    vehicle: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
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
    if (args.date !== undefined) {
      if (!isRealIsoDate(args.date)) throw new ConvexError({ code: "INVALID_ARGUMENT", field: "date" });
      patch.date = args.date;
    }
    if (args.startTime !== undefined) patch.startTime = args.startTime;
    if (args.traveller !== undefined) patch.traveller = { ...args.traveller, email: args.traveller.email.toLowerCase() };
    await ctx.db.patch(args.id, patch);
    await audit(ctx, staff, "booking.update", "bookings", String(args.id), { date: b.date, startTime: b.startTime, guide: b.assignedGuideName }, patch);
    return null;
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
    const holdExpiresAt = args.status === "confirmed" ? undefined : await staffHoldExpiry(ctx, tour, args.date, startTime, now);
    const bookingId = await ctx.db.insert("bookings", {
      reference,
      tourId: tour._id,
      tourTitle: tour.title,
      date: args.date,
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
    // Staff type one agreed total, so every model but per-person prints it as a single line on the voucher
    const heads = args.adults + args.children;
    const vehicles = tour.pricingModel === "per_vehicle" ? capacityUnits(tour, args.adults, args.children) : 0;
    const item =
      tour.pricingModel === "per_person"
        ? { kind: "adult" as const, label: { en: "Guests", ar: "الضيوف" }, quantity: heads, unitPrice: Math.round(total / Math.max(1, heads)) }
        : tour.pricingModel === "per_vehicle"
          ? { kind: "group" as const, label: { en: "4WD vehicle", ar: "سيارة دفع رباعي" }, quantity: vehicles, unitPrice: Math.round(total / Math.max(1, vehicles)) }
          : tour.pricingModel === "tiered"
            ? { kind: "group" as const, label: { en: `Private tour (${args.adults} adults${args.children ? `, ${args.children} children` : ""})`, ar: `جولة خاصة (${args.adults} بالغين${args.children ? ` و${args.children} أطفال` : ""})` }, quantity: 1, unitPrice: total }
            : { kind: "group" as const, label: { en: "Private group", ar: "مجموعة خاصة" }, quantity: 1, unitPrice: total };
    await ctx.db.insert("bookingItems", { bookingId, ...item, total });
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
        b.status === "cancelled" &&
        b.cancellationReason === "hold_expired" &&
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

export const issuePaymentLink = mutation({
  args: { id: v.id("bookings"), amountOmr: v.number(), description: v.optional(v.string()), expiresInHours: v.optional(v.number()) },
  returns: v.object({ token: v.string(), url: v.string() }),
  handler: async (ctx, { id, amountOmr, description, expiresInHours }): Promise<{ token: string; url: string }> => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    const amount = Math.round(amountOmr * 1000);
    if (!Number.isFinite(amount) || amount <= 0) throw new ConvexError({ code: "INVALID_AMOUNT" });
    const { token }: { token: string } = await ctx.runMutation(internal.payments.createPaymentLink, { bookingId: id, amountOmr: amount, kind: amount >= b.total - b.amountPaid ? "full" : "deposit", description, staffId: staff._id, expiresInHours: expiresInHours ?? 72 });
    await audit(ctx, staff, "payment.link_issued", "bookings", String(id), undefined, { amount, expiresInHours: expiresInHours ?? 72 });
    const base = process.env.SITE_URL ?? "http://localhost:3000";
    return { token, url: `${base}/${b.locale}/pay/${token}` };
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
