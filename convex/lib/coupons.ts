/**
 * Coupon usage bookkeeping shared by every path that cancels or reinstates a booking (hold expiry, customer
 * cancellation, staff status changes, late payments, staff amendments), so a coupon's usedCount always matches the
 * bookings that really use it. Each booking gives its use back at most once (bookings.couponReleased) and takes it
 * again only if it gave it back.
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type CouponBooking = Pick<Doc<"bookings">, "_id" | "couponCode" | "couponReleased" | "status" | "cancellationReason">;

/**
 * True when this booking's coupon use has already been given back. Bookings from before the couponReleased flag were
 * only ever released by hold expiry, so a hold_expired cancellation without the flag counts as released.
 */
export function couponWasReleased(b: CouponBooking): boolean {
  return b.couponReleased ?? (b.status === "cancelled" && b.cancellationReason === "hold_expired");
}

/** Gives the booking's coupon use back (unpaid booking cancelled), so throwaway holds cannot exhaust a usage limit. */
export async function releaseCouponUse(ctx: MutationCtx, b: CouponBooking): Promise<boolean> {
  if (!b.couponCode || couponWasReleased(b)) return false;
  const code = b.couponCode;
  const c = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique();
  if (c && c.usedCount > 0) await ctx.db.patch(c._id, { usedCount: c.usedCount - 1 });
  await ctx.db.patch(b._id, { couponReleased: true });
  return true;
}

/** Takes the coupon use again for a booking brought back after its use was released (re-confirmed or reinstated). */
export async function retakeCouponUse(ctx: MutationCtx, b: CouponBooking): Promise<boolean> {
  if (!b.couponCode || !couponWasReleased(b)) return false;
  const code = b.couponCode;
  const c = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique();
  if (c) await ctx.db.patch(c._id, { usedCount: c.usedCount + 1 });
  await ctx.db.patch(b._id, { couponReleased: false });
  return true;
}
