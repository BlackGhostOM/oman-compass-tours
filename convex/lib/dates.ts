/**
 * Calendar-day helpers shared by Convex functions and the browser.
 *
 * Pure module: no Convex imports, so client components can import it too.
 * A tour date is a calendar day in Oman written as "YYYY-MM-DD". Oman is UTC+4
 * all year (no daylight saving), so a fixed offset is exact.
 */

export const OMAN_OFFSET_MS = 4 * 3_600_000;

/** How many days after the earliest bookable day (Oman's tomorrow) customers can book. */
export const BOOKING_HORIZON_DAYS = 120;

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Today's calendar date in Oman, whatever the time zone of the machine running this. */
export function omanTodayIso(now: number = Date.now()): string {
  return new Date(now + OMAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds whole days to a YYYY-MM-DD string (UTC arithmetic, so time zones and DST never shift it). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True only for a real calendar day in YYYY-MM-DD form (rejects 2027-02-30 and 2027-13-45 without throwing). */
export function isRealIsoDate(d: unknown): d is string {
  if (typeof d !== "string" || !ISO_DAY_RE.test(d)) return false;
  const t = Date.parse(d + "T00:00:00Z");
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === d;
}

/** The calendar day a local Date (e.g. a react-day-picker cell at local midnight) stands for. Never use toISOString for this. */
export function isoDayFromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** An instant inside the given Oman calendar day (noon Muscat time), safe to format with timeZone "Asia/Muscat" from any viewer zone. */
export function isoDayToInstant(iso: string): Date {
  return new Date(iso + "T12:00:00+04:00");
}

/** Epoch ms of a departure, from its Oman date and HH:MM start time. NaN when either is malformed. */
export function departureMs(date: string, startTime: string): number {
  return Date.parse(`${date}T${startTime}:00+04:00`);
}

/** The bookable window for customers: Oman's tomorrow through tomorrow + BOOKING_HORIZON_DAYS (inclusive). */
export function bookingWindow(now: number = Date.now()): { from: string; to: string } {
  const from = addDaysIso(omanTodayIso(now), 1);
  return { from, to: addDaysIso(from, BOOKING_HORIZON_DAYS) };
}

export type DateProblem = "invalid" | "past" | "too_far";

/** Why a customer cannot book this date, or null when it is inside the bookable window. Same-day bookings count as past. */
export function dateProblem(date: string, now: number = Date.now()): DateProblem | null {
  if (!isRealIsoDate(date)) return "invalid";
  const { from, to } = bookingWindow(now);
  if (date < from) return "past";
  if (date > to) return "too_far";
  return null;
}

/** Weekday of a calendar day, 0 = Sunday. Computed in UTC so it is the same in every time zone. */
export function weekdayOfIso(iso: string): number {
  return new Date(iso + "T00:00:00Z").getUTCDay();
}

/** Operating rules a tour may carry. Both optional; when neither is set the tour runs every day. */
export type OperatingRules = {
  operatingWeekdays?: readonly number[] | null;
  fixedDepartureDates?: readonly string[] | null;
};

/**
 * True when the tour departs on this date. Fixed departure dates win over weekdays.
 * Typed loosely so any tour-shaped object can be passed before or after the schema carries these fields.
 */
export function isOperatingDate(tour: object, iso: string): boolean {
  const rules = tour as OperatingRules;
  if (rules.fixedDepartureDates && rules.fixedDepartureDates.length > 0) return rules.fixedDepartureDates.includes(iso);
  if (rules.operatingWeekdays && rules.operatingWeekdays.length > 0) {
    if (!isRealIsoDate(iso)) return false;
    return rules.operatingWeekdays.includes(weekdayOfIso(iso));
  }
  return true;
}

/** The first date in [from, to] on which the tour runs, or null when there is none. */
export function firstOperatingDate(tour: object, from: string, to: string): string | null {
  for (let d = from; d <= to; d = addDaysIso(d, 1)) if (isOperatingDate(tour, d)) return d;
  return null;
}
