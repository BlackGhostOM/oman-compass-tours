/**
 * Pure tests of the Oman calendar-day helpers (convex/lib/dates.ts). No browser and no server:
 * these run in the Playwright test runner only because it is the project's one test tool.
 */
import { expect, test } from "@playwright/test";
import {
  addDaysIso,
  bookingWindow,
  BOOKING_HORIZON_DAYS,
  dateProblem,
  firstOperatingDate,
  isoDayFromLocalDate,
  isoDayToInstant,
  isOperatingDate,
  isRealIsoDate,
  omanTodayIso,
  weekdayOfIso,
} from "../convex/lib/dates";

const ZONES = ["Asia/Muscat", "Europe/Berlin", "Europe/London", "Asia/Kolkata", "America/New_York", "Pacific/Kiritimati", "Pacific/Pago_Pago"];

/** Runs fn with the Node process in another time zone (Node re-reads TZ when it is assigned). */
function inZone<T>(zone: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

test.describe("omanTodayIso", () => {
  test("switches day exactly at midnight in Oman (20:00 UTC), not at UTC midnight", () => {
    // 5 Oct 2026 23:59:59 in Oman is 19:59:59 UTC
    expect(omanTodayIso(Date.parse("2026-10-05T19:59:59.999Z"))).toBe("2026-10-05");
    expect(omanTodayIso(Date.parse("2026-10-05T20:00:00Z"))).toBe("2026-10-06");
    // 01:00 on 6 Oct in Oman, still 5 Oct in UTC: the old UTC-based code said "2026-10-05"
    expect(omanTodayIso(Date.parse("2026-10-05T21:00:00Z"))).toBe("2026-10-06");
    expect(omanTodayIso(Date.parse("2026-10-05T23:59:59Z"))).toBe("2026-10-06");
    // Year boundary
    expect(omanTodayIso(Date.parse("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
    expect(omanTodayIso(Date.parse("2026-12-31T19:59:59Z"))).toBe("2026-12-31");
  });

  test("does not depend on the machine's time zone", () => {
    const now = Date.parse("2026-10-05T21:30:00Z");
    for (const zone of ZONES) expect(inZone(zone, () => omanTodayIso(now)), zone).toBe("2026-10-06");
  });

  test("bookingWindow starts on Oman's tomorrow and spans the horizon", () => {
    const w = bookingWindow(Date.parse("2026-10-05T21:30:00Z"));
    expect(w.from).toBe("2026-10-07");
    expect(w.to).toBe(addDaysIso("2026-10-07", BOOKING_HORIZON_DAYS));
    expect(bookingWindow(Date.parse("2026-10-05T19:30:00Z")).from).toBe("2026-10-06");
  });
});

test.describe("addDaysIso", () => {
  test("crosses month, year and DST boundaries without drift", () => {
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-11-01", -1)).toBe("2026-10-31");
    // Europe/London leaves BST on 25 Oct 2026: still exactly one calendar day
    for (const zone of ZONES) expect(inZone(zone, () => addDaysIso("2026-10-24", 2)), zone).toBe("2026-10-26");
  });
});

test.describe("isRealIsoDate", () => {
  test("accepts real calendar days only, and never throws", () => {
    for (const ok of ["2026-10-06", "2028-02-29", "2027-12-31", "2027-01-01"]) expect(isRealIsoDate(ok), ok).toBe(true);
    for (const bad of ["2027-02-30", "2027-13-45", "2027-13-01", "2027-00-10", "2027-04-31", "2026-02-29", "2026-10-6", "20261006", "2026/10/06", "2026-10-06T00:00", "", " 2026-10-06", "abcd-ef-gh"]) {
      expect(() => isRealIsoDate(bad), bad).not.toThrow();
      expect(isRealIsoDate(bad), bad).toBe(false);
    }
    for (const bad of [undefined, null, 20261006, {}, new Date()]) expect(isRealIsoDate(bad as unknown)).toBe(false);
  });
});

test.describe("dateProblem", () => {
  // 01:00 on 6 Oct 2026 in Oman
  const now = Date.parse("2026-10-05T21:00:00Z");

  test("today and earlier are past (same-day bookings closed), in Oman time", () => {
    expect(dateProblem("2026-10-05", now)).toBe("past");
    expect(dateProblem("2026-10-06", now)).toBe("past");
    expect(dateProblem("2025-01-01", now)).toBe("past");
  });

  test("Oman's tomorrow through the horizon is bookable", () => {
    expect(dateProblem("2026-10-07", now)).toBeNull();
    expect(dateProblem(addDaysIso("2026-10-07", BOOKING_HORIZON_DAYS), now)).toBeNull();
  });

  test("beyond the horizon is too_far", () => {
    expect(dateProblem(addDaysIso("2026-10-07", BOOKING_HORIZON_DAYS + 1), now)).toBe("too_far");
    expect(dateProblem("2099-12-31", now)).toBe("too_far");
  });

  test("impossible or malformed dates are invalid, not a crash", () => {
    for (const bad of ["2027-02-30", "2027-13-45", "tomorrow", "", "2026-10-7"]) expect(dateProblem(bad, now), bad).toBe("invalid");
  });

  test("just before Oman midnight, today's date (UTC) is already past and tomorrow opens", () => {
    const late = Date.parse("2026-10-05T19:59:00Z"); // 23:59 on 5 Oct in Oman
    expect(dateProblem("2026-10-05", late)).toBe("past");
    expect(dateProblem("2026-10-06", late)).toBeNull();
  });
});

test.describe("isoDayFromLocalDate", () => {
  test("a calendar cell at local midnight maps to its own day in every zone (never the day before)", () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        for (const iso of ["2026-10-20", "2026-11-15", "2026-10-25", "2027-03-28", "2027-01-01"]) {
          // react-day-picker builds cells as local midnight (new Date(y, m, d))
          const [y, m, d] = iso.split("-").map(Number);
          const cell = new Date(y, m - 1, d);
          expect(isoDayFromLocalDate(cell), `${zone} ${iso}`).toBe(iso);
          // The old code did toISOString(), which gives the previous day east of UTC
          expect(isoDayFromLocalDate(new Date(iso + "T00:00:00")), `${zone} ${iso} (parsed)`).toBe(iso);
        }
      });
    }
  });

  test("isoDayToInstant formats as the same day in Muscat whatever the viewer's zone", () => {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric" });
    for (const zone of ZONES) expect(inZone(zone, () => fmt.format(isoDayToInstant("2027-03-25"))), zone).toBe("25 Mar 2027");
  });
});

test.describe("isOperatingDate", () => {
  const fridays = { operatingWeekdays: [5] };
  const fixed = { fixedDepartureDates: ["2026-10-19", "2026-12-28"], operatingWeekdays: [1] };

  test("tours without rules run every day", () => {
    expect(isOperatingDate({}, "2026-10-13")).toBe(true);
    expect(isOperatingDate({ operatingWeekdays: [], fixedDepartureDates: [] }, "2026-10-13")).toBe(true);
    expect(isOperatingDate({ operatingWeekdays: null, fixedDepartureDates: null }, "2026-10-13")).toBe(true);
  });

  test("weekday rules use the Oman calendar day in every machine zone", () => {
    for (const zone of ZONES) {
      inZone(zone, () => {
        expect(weekdayOfIso("2026-10-09"), zone).toBe(5);
        expect(isOperatingDate(fridays, "2026-10-09"), zone).toBe(true); // Friday
        expect(isOperatingDate(fridays, "2026-10-13"), zone).toBe(false); // Tuesday
        expect(isOperatingDate(fridays, "2026-10-10"), zone).toBe(false); // Saturday
        expect(isOperatingDate(fridays, "2027-02-30"), zone).toBe(false);
      });
    }
  });

  test("fixed departure dates win over weekdays", () => {
    expect(isOperatingDate(fixed, "2026-10-19")).toBe(true);
    expect(isOperatingDate(fixed, "2026-10-26")).toBe(false); // a Monday, but not a listed departure
    expect(isOperatingDate(fixed, "2026-10-20")).toBe(false);
  });

  test("firstOperatingDate finds the next Friday", () => {
    expect(firstOperatingDate(fridays, "2026-10-06", "2026-10-20")).toBe("2026-10-09");
    expect(firstOperatingDate(fixed, "2026-10-20", "2027-01-31")).toBe("2026-12-28");
    expect(firstOperatingDate(fixed, "2027-01-01", "2027-01-31")).toBeNull();
  });
});
