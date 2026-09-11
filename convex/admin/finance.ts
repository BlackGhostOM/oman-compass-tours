import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireStaff } from "../lib/access";
import { paymentProviderValidator, paymentStatusValidator } from "../schema";

const DAY = 86_400_000;

export const transactions = query({
  args: { provider: v.optional(paymentProviderValidator), status: v.optional(paymentStatusValidator), from: v.optional(v.number()), to: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    let rows: Doc<"payments">[] = args.status
      ? await ctx.db.query("payments").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").take(Math.min(args.limit ?? 300, 1000))
      : await ctx.db.query("payments").order("desc").take(Math.min(args.limit ?? 300, 1000));
    rows = rows.filter((p) => (!args.provider || p.provider === args.provider) && (!args.from || p._creationTime >= args.from) && (!args.to || p._creationTime <= args.to));
    return Promise.all(
      rows.map(async (p) => {
        const b = await ctx.db.get(p.bookingId);
        return { _id: p._id, bookingId: p.bookingId, reference: b?.reference ?? null, customer: b ? `${b.traveller.firstName} ${b.traveller.lastName}` : null, tourTitle: b?.tourTitle ?? null, provider: p.provider, kind: p.kind, amount: p.amount, currency: p.currency, amountOmr: p.amountOmr, refundedAmount: p.refundedAmount, status: p.status, providerPaymentId: p.providerPaymentId ?? null, providerSessionId: p.providerSessionId ?? null, paidAt: p.paidAt ?? null, createdAt: p._creationTime, failureReason: p.failureReason ?? null };
      }),
    );
  },
});

export const refunds = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("refunds").order("desc").take(300);
    return Promise.all(rows.map(async (r) => { const b = await ctx.db.get(r.bookingId); const staff = await ctx.db.get(r.requestedByStaffId); return { ...r, reference: b?.reference ?? null, requestedBy: staff?.name ?? staff?.email ?? null }; }));
  },
});

/** Reconciliation: totals per provider for a period. */
export const reconciliation = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, { from, to }) => {
    await requireStaff(ctx);
    const start = from ?? Date.now() - 30 * DAY;
    const end = to ?? Date.now();
    const rows = (await ctx.db.query("payments").order("desc").take(3000)).filter((p) => (p.paidAt ?? p._creationTime) >= start && (p.paidAt ?? p._creationTime) <= end);
    const byProvider: Record<string, { count: number; succeeded: number; grossOmr: number; refundedOmr: number; failed: number; pending: number; byCurrency: Record<string, number> }> = {};
    for (const p of rows) {
      const k = p.provider;
      byProvider[k] ??= { count: 0, succeeded: 0, grossOmr: 0, refundedOmr: 0, failed: 0, pending: 0, byCurrency: {} };
      byProvider[k].count++;
      if (p.status === "succeeded" || p.status === "partially_refunded" || p.status === "refunded") {
        byProvider[k].succeeded++;
        byProvider[k].grossOmr += p.amountOmr;
        byProvider[k].refundedOmr += p.refundedAmount;
        byProvider[k].byCurrency[p.currency] = (byProvider[k].byCurrency[p.currency] ?? 0) + p.amount;
      } else if (p.status === "failed") byProvider[k].failed++;
      else if (p.status === "pending" || p.status === "created") byProvider[k].pending++;
    }
    const webhooks = await ctx.db.query("webhookEvents").order("desc").take(50);
    return { from: start, to: end, byProvider, recentWebhooks: webhooks };
  },
});

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export const reports = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, { months }) => {
    await requireStaff(ctx);
    const span = Math.min(months ?? 12, 36);
    const since = Date.now() - span * 30 * DAY;
    const bookings = (await ctx.db.query("bookings").order("desc").take(5000)).filter((b) => b._creationTime >= since);
    const payments = (await ctx.db.query("payments").order("desc").take(5000)).filter((p) => (p.paidAt ?? p._creationTime) >= since && ["succeeded", "partially_refunded", "refunded"].includes(p.status));

    const monthKey = (ts: number) => new Date(ts + 4 * 3_600_000).toISOString().slice(0, 7);
    const revenueByMonth: Record<string, { gross: number; refunded: number; net: number; count: number }> = {};
    for (const p of payments) {
      const k = monthKey(p.paidAt ?? p._creationTime);
      revenueByMonth[k] ??= { gross: 0, refunded: 0, net: 0, count: 0 };
      revenueByMonth[k].gross += p.amountOmr;
      revenueByMonth[k].refunded += p.refundedAmount;
      revenueByMonth[k].net += p.amountOmr - p.refundedAmount;
      revenueByMonth[k].count++;
    }
    const tally = (key: (b: Doc<"bookings">) => string) => {
      const m: Record<string, { count: number; revenue: number }> = {};
      for (const b of bookings) {
        const k = key(b) || "unknown";
        m[k] ??= { count: 0, revenue: 0 };
        m[k].count++;
        m[k].revenue += b.amountPaid - b.amountRefunded;
      }
      return Object.entries(m).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count);
    };
    const cancellations = bookings.filter((b) => b.status === "cancelled" || b.status === "refunded");
    return {
      since,
      revenueByMonth: Object.entries(revenueByMonth).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
      byNationality: tally((b) => b.traveller.nationality),
      bySource: tally((b) => b.source),
      byTour: tally((b) => b.tourTitle.en),
      byStatus: tally((b) => b.status),
      cancellations: { count: cancellations.length, rate: bookings.length ? Math.round((cancellations.length / bookings.length) * 1000) / 10 : 0, reasons: tally.call(null, (b) => (cancellations.includes(b) ? b.cancellationReason ?? "unspecified" : "")).filter((r) => r.key !== "" && r.key !== "unknown") },
      totals: { bookings: bookings.length, revenue: payments.reduce((a, p) => a + p.amountOmr - p.refundedAmount, 0), guests: bookings.reduce((a, b) => a + b.groupSize, 0), avgBooking: bookings.length ? Math.round(bookings.reduce((a, b) => a + b.total, 0) / bookings.length) : 0 },
    };
  },
});
