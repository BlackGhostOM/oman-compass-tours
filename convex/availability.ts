import { v } from "convex/values";
import { query } from "./_generated/server";
import { getViewer, isStaff } from "./lib/access";
import { activeBookingsBetween, bookedUnits, slotCapacity, slotView, type SlotView } from "./lib/capacity";
import { isOperatingDate } from "./lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 200;

/** operating is false on a date the tour does not run (operating weekdays / fixed departures); such days are also blackouts. */
type DayView = { date: string; slots: SlotView[]; isBlackout: boolean; operating: boolean };

/**
 * Availability for a tour over a date range (default: next 90 days).
 * Returns one entry per date with, per start time, the units left, the slot's capacity and whether the
 * smallest party the tour accepts still fits (bookable). Uses the same rules as bookings.quote/create
 * (lib/capacity): availability overrides, operating weekdays / fixed departures, and every status that
 * holds a place, unpaid holds included. Dates the tour does not run on are reported as blackouts.
 */
export const forTour = query({
  args: { tourId: v.id("tours"), from: v.string(), to: v.string() },
  handler: async (ctx, { tourId, from, to }) => {
    const empty = { dates: [] as DayView[] };
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return empty;
    if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_RANGE_DAYS) return empty;
    const tour = await ctx.db.get(tourId);
    if (!tour) return empty;
    if (tour.status !== "published") {
      const viewer = await getViewer(ctx);
      if (!viewer || !isStaff(viewer)) return empty;
    }
    // Rows per date are bounded by startTimes + 1, and the range by MAX_RANGE_DAYS
    const rows = await ctx.db
      .query("availability")
      .withIndex("by_tour_date", (q) => q.eq("tourId", tourId).gte("date", from).lte("date", to))
      .collect();
    const active = await activeBookingsBetween(ctx, tourId, from, to);

    const byDate = new Map<string, typeof rows>();
    for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

    const dates: DayView[] = [];
    const start = new Date(from + "T00:00:00Z");
    const end = new Date(to + "T00:00:00Z");
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const operating = isOperatingDate(tour, date);
      const overrides = byDate.get(date) ?? [];
      const dayBlackout = !operating || overrides.some((o) => o.isBlackout && !o.startTime);
      const slots = tour.startTimes.map((time) => {
        const capacity = operating ? slotCapacity(tour, overrides, time) : 0;
        return slotView(tour, time, capacity, capacity > 0 ? bookedUnits(tour, active, date, time) : 0);
      });
      dates.push({ date, slots, isBlackout: dayBlackout, operating });
    }
    return { dates };
  },
});
