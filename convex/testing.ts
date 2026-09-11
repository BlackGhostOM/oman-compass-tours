/**
 * Internal helpers used by the Playwright suite (run via `npx convex run`).
 * They are internal functions: not callable from browsers or public clients.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { generateToken } from "./lib/ids";

/** Creates a pending payment row that a signed webhook can then confirm. */
export const createPendingPayment = internalMutation({
  args: {
    reference: v.string(),
    provider: v.union(v.literal("stripe"), v.literal("thawani"), v.literal("paypal")),
    providerSessionId: v.string(),
    currency: v.optional(v.string()),
  },
  returns: v.object({ paymentId: v.id("payments"), amount: v.number(), currency: v.string() }),
  handler: async (ctx, args) => {
    const booking = await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", args.reference.toUpperCase())).unique();
    if (!booking) throw new Error("booking not found");
    const amountOmr = Math.max(0, booking.depositDue - booking.amountPaid);
    const currency = (args.currency ?? (args.provider === "thawani" ? "OMR" : "USD")) as "OMR" | "USD";
    const rate = currency === "OMR" ? 1 : 2.6008;
    const amount = currency === "OMR" ? amountOmr : Math.round((amountOmr / 1000) * rate * 100);
    const paymentId = await ctx.db.insert("payments", {
      bookingId: booking._id,
      provider: args.provider,
      kind: amountOmr >= booking.total ? "full" : "deposit",
      amount,
      currency,
      amountOmr,
      fxRate: rate,
      status: "pending",
      providerSessionId: args.providerSessionId,
      checkoutUrl: "https://example.test/checkout",
      idempotencyKey: `test_${generateToken(12)}`,
      refundedAmount: 0,
      updatedAt: Date.now(),
    });
    return { paymentId, amount, currency };
  },
});

export const bookingStatus = internalQuery({
  args: { reference: v.string() },
  returns: v.union(v.null(), v.object({ status: v.string(), amountPaid: v.number(), voucherToken: v.string() })),
  handler: async (ctx, { reference }) => {
    const b = await ctx.db.query("bookings").withIndex("by_reference", (q) => q.eq("reference", reference.toUpperCase())).unique();
    return b ? { status: b.status, amountPaid: b.amountPaid, voucherToken: b.voucherToken } : null;
  },
});
