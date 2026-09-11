import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Availability for a tour over a date range (default: next 90 days).
 * Returns one entry per date with remaining capacity per start time.
 * Dates without an explicit `availability` row use the tour default capacity.
 */
export const forTour = query({
  args: { tourId: v.id("tours"), from: v.string(), to: v.string() },
  handler: async (ctx, { tourId, from, to }) => {
    const tour = await ctx.db.get(tourId);
    if (!tour) return { dates: [] as { date: string; slots: { time: string; remaining: number }[]; isBlackout: boolean }[] };
    const rows = await ctx.db
      .query("availability")
      .withIndex("by_tour_date", (q) => q.eq("tourId", tourId).gte("date", from).lte("date", to))
      .take(400);
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_tour_date", (q) => q.eq("tourId", tourId).gte("date", from).lte("date", to))
      .take(2000);
    const active = bookings.filter((b) => ["pending_payment", "confirmed", "in_progress"].includes(b.status));

    const byDate = new Map<string, typeof rows>();
    for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

    const dates: { date: string; slots: { time: string; remaining: number }[]; isBlackout: boolean }[] = [];
    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const overrides = byDate.get(date) ?? [];
      const dayBlackout = overrides.some((o) => o.isBlackout && !o.startTime);
      const slots = tour.startTimes.map((time) => {
        const override = overrides.find((o) => o.startTime === time);
        const capacity = override?.capacity ?? tour.defaultCapacityPerSlot;
        const blackout = dayBlackout || override?.isBlackout;
        const booked = active.filter((b) => b.date === date && (b.startTime ?? tour.startTimes[0]) === time).reduce((a, b) => a + (tour.pricingModel === "per_group" ? 1 : b.groupSize), 0);
        return { time, remaining: blackout ? 0 : Math.max(0, capacity - booked) };
      });
      dates.push({ date, slots, isBlackout: dayBlackout });
    }
    return { dates };
  },
});
