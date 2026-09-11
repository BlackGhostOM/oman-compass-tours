import { query } from "../_generated/server";
import { requireStaff } from "../lib/access";

const DAY = 86_400_000;
const omanDate = (ts: number) => new Date(ts + 4 * 3_600_000).toISOString().slice(0, 10);

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const now = Date.now();
    const today = omanDate(now);
    const tomorrow = omanDate(now + DAY);

    const todays = await ctx.db.query("bookings").withIndex("by_date", (q) => q.eq("date", today)).take(200);
    const tomorrows = await ctx.db.query("bookings").withIndex("by_date", (q) => q.eq("date", tomorrow)).take(200);
    const active = (rows: typeof todays) => rows.filter((b) => ["confirmed", "in_progress"].includes(b.status));

    // Recent bookings (last 30 days) for funnel / top tours / new bookings
    const recent = await ctx.db.query("bookings").order("desc").take(500);
    const last24 = recent.filter((b) => b._creationTime > now - DAY);
    const last7 = recent.filter((b) => b._creationTime > now - 7 * DAY);
    const last30 = recent.filter((b) => b._creationTime > now - 30 * DAY);

    // Revenue from succeeded payments
    const payments = await ctx.db.query("payments").withIndex("by_status", (q) => q.eq("status", "succeeded")).order("desc").take(1000);
    const partial = await ctx.db.query("payments").withIndex("by_status", (q) => q.eq("status", "partially_refunded")).order("desc").take(200);
    const paid = [...payments, ...partial];
    const revenue = (since: number) => paid.filter((p) => (p.paidAt ?? p._creationTime) >= since).reduce((a, p) => a + p.amountOmr - p.refundedAmount, 0);
    const startOfToday = new Date(today + "T00:00:00+04:00").getTime();
    const startOfWeek = startOfToday - 6 * DAY;
    const startOfMonth = new Date(today.slice(0, 7) + "-01T00:00:00+04:00").getTime();

    // Funnel (30d)
    const drafts = await ctx.db.query("bookingDrafts").withIndex("by_lastTouched", (q) => q.gt("lastTouchedAt", now - 30 * DAY)).take(1000);
    const funnel = {
      drafts: drafts.length,
      bookings: last30.length,
      confirmed: last30.filter((b) => ["confirmed", "in_progress", "completed"].includes(b.status)).length,
      cancelled: last30.filter((b) => b.status === "cancelled").length,
    };

    // Top tours (90d, confirmed+)
    const counts = new Map<string, { title: { en: string; ar: string }; count: number; revenue: number }>();
    for (const b of recent.filter((b) => b._creationTime > now - 90 * DAY && ["confirmed", "in_progress", "completed"].includes(b.status))) {
      const cur = counts.get(String(b.tourId)) ?? { title: b.tourTitle, count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += b.amountPaid - b.amountRefunded;
      counts.set(String(b.tourId), cur);
    }
    const topTours = [...counts.entries()].map(([tourId, v]) => ({ tourId, ...v })).sort((a, b) => b.count - a.count).slice(0, 5);

    // Occupancy today
    const tours = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(200);
    const capacityToday = tours.reduce((a, t) => a + t.defaultCapacityPerSlot * t.startTimes.length, 0);
    const bookedToday = active(todays).reduce((a, b) => a + (b.pricingModel === "per_group" ? 1 : b.groupSize), 0);

    const openLeads = await ctx.db.query("leads").withIndex("by_status", (q) => q.eq("status", "new")).take(200);
    const overdueLeads = openLeads.filter((l) => l.slaDueAt < now).length;
    const waiting = await ctx.db.query("conversations").withIndex("by_status", (q) => q.eq("status", "waiting_human")).take(100);
    const human = await ctx.db.query("conversations").withIndex("by_status", (q) => q.eq("status", "human")).take(200);
    const unreadInbox = [...waiting, ...human].reduce((a, c) => a + c.unreadForStaff, 0);
    const pendingReviews = await ctx.db.query("reviews").withIndex("by_status", (q) => q.eq("status", "pending")).take(100);

    return {
      today,
      departuresToday: active(todays).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "")).map((b) => ({ _id: b._id, reference: b.reference, tourTitle: b.tourTitle, startTime: b.startTime ?? null, groupSize: b.groupSize, traveller: `${b.traveller.firstName} ${b.traveller.lastName}`, phone: b.traveller.phone, pickup: b.traveller.pickupLocation ?? b.traveller.hotel ?? null, status: b.status, guide: b.assignedGuideName ?? null })),
      departuresTomorrow: active(tomorrows).length,
      newBookings: { day: last24.length, week: last7.length, month: last30.length },
      pendingPayment: recent.filter((b) => b.status === "pending_payment" || b.status === "inquiry").length,
      revenue: { day: revenue(startOfToday), week: revenue(startOfWeek), month: revenue(startOfMonth) },
      funnel,
      topTours,
      occupancy: { booked: bookedToday, capacity: capacityToday },
      openLeads: openLeads.length,
      overdueLeads,
      waitingChats: waiting.length,
      unreadInbox,
      pendingReviews: pendingReviews.length,
      revenueSeries: Array.from({ length: 14 }).map((_, i) => {
        const d = omanDate(now - (13 - i) * DAY);
        const start = new Date(d + "T00:00:00+04:00").getTime();
        return { date: d, amount: paid.filter((p) => (p.paidAt ?? p._creationTime) >= start && (p.paidAt ?? p._creationTime) < start + DAY).reduce((a, p) => a + p.amountOmr - p.refundedAmount, 0) };
      }),
    };
  },
});
