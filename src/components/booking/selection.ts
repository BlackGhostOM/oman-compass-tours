/**
 * Booking-wizard selection rules shared by the initial state, the draft restore and step 1.
 *
 * Pure (no React), so it can be unit-tested. Dates use the Oman-calendar helpers in convex/lib/dates
 * and capacity uses the same unit rule as the server (convex/lib/pricing capacityUnits).
 */
import { addDaysIso, isOperatingDate, isRealIsoDate } from "../../../convex/lib/dates";
import { capacityUnits, INFANT_MAX } from "../../../convex/lib/pricing";
import type { QuoteView } from "@/components/booking/price-summary";
import type { BookingTour, WizardState } from "@/components/booking/types";

/** The parts of availability.forTour the wizard reads. */
export type SlotAvailability = { time: string; remaining: number; capacity?: number; bookable: boolean };
export type DayAvailability = { date: string; isBlackout: boolean; slots: SlotAvailability[] };
export type Availability = { dates: DayAvailability[] };

export type SelectionOptions = {
  /** The customer booking window (bookingWindow() from convex/lib/dates). */
  window: { from: string; to: string };
  /** availability.forTour over the window; when missing, capacity is not checked. */
  availability?: Availability | null;
  /** A ?date= deep link; it wins over the draft's date when it is a real, in-window operating date. */
  explicitDate?: string | null;
};

/** Capacity units this party takes (seats, private departures or 4WDs, as on the server). */
export function partyUnits(tour: Pick<BookingTour, "pricingModel" | "vehiclePricing">, adults: number, children: number): number {
  return capacityUnits({ pricingModel: tour.pricingModel, vehiclePricing: tour.vehiclePricing ?? undefined }, adults, children);
}

/** True when the slot is on sale and has room for a party needing `needed` units. */
export function slotFits(slot: SlotAvailability | undefined, needed: number): boolean {
  return !!slot && slot.bookable && slot.remaining >= needed;
}

/** A day the calendar greys out: blacked out, not operating, or with no slot left for even the smallest party. */
export function isDaySoldOut(day: DayAvailability | undefined): boolean {
  return !!day && (day.isBlackout || day.slots.every((s) => !s.bookable));
}

/** The first of the tour's start times that fits this party on this day, or null. */
export function firstFittingTime(tour: Pick<BookingTour, "startTimes">, day: DayAvailability | undefined, needed: number): string | null {
  if (!day) return null;
  return tour.startTimes.find((time) => slotFits(day.slots.find((s) => s.time === time), needed)) ?? null;
}

/**
 * True only when the live quote says this selection can be booked as it stands: loaded, available (date window,
 * operating day, start time, group rules and capacity, all checked by bookings.quote), and no entered coupon
 * that fails to apply (bookings.create would refuse it with COUPON_INVALID).
 */
export function isQuoteBookable(quote: QuoteView, couponCode: string): boolean {
  return !!quote && quote.available === true && !(couponCode && quote.couponError);
}

const dayOf = (availability: Availability | null | undefined, date: string) => availability?.dates.find((d) => d.date === date);

const blankTraveller = (): WizardState["traveller"] => ({ firstName: "", lastName: "", nationality: "", phone: "", email: "", hotel: "", pickupLocation: "", specialRequests: "" });

const asInt = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : undefined);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Turns any input (a raw saved draft, a fresh state, or nothing) into a WizardState that is valid for the tour
 * today. `changed` is true when a value the input carried was dropped or corrected (or a ?date= link replaced
 * the input's date); values the input did not carry are filled with defaults without counting as changes.
 *
 * - Date: a valid explicitDate wins; otherwise the input date if it is real, in the window, an operating day and
 *   not sold out; otherwise the first bookable date.
 * - Start time: kept if the tour still offers it and (when availability is known) it fits the party; otherwise
 *   the first time that fits, else the first start time.
 * - Guests: adults 1..maxGroup, children 0..maxGroup-adults, adults raised to reach minGroup,
 *   infants 0..min(adults, INFANT_MAX).
 * - Add-ons: only ids the tour still offers; child seats at most children + infants.
 * - Consent boxes are always cleared, so a returning customer ticks the policy versions in force today.
 * - Step: 1..3 from the input, forced to 1 whenever anything changed.
 */
export function sanitizeSelection(tour: BookingTour, input: unknown, opts: SelectionOptions): { state: WizardState; changed: boolean } {
  const d = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const { window, availability } = opts;
  let changed = false;

  // Date
  const inWindow = (date: unknown): date is string => isRealIsoDate(date) && date >= window.from && date <= window.to && isOperatingDate(tour, date);
  const bookable = (date: unknown): date is string => inWindow(date) && !isDaySoldOut(dayOf(availability, date));
  let date: string;
  if (inWindow(opts.explicitDate)) {
    date = opts.explicitDate;
  } else if (bookable(d.date)) {
    date = d.date;
  } else {
    date = window.from;
    for (let day = window.from; day <= window.to; day = addDaysIso(day, 1)) {
      if (bookable(day)) {
        date = day;
        break;
      }
    }
  }
  if (d.date !== undefined && d.date !== date) changed = true;

  // Guests
  const maxGroup = Math.max(1, tour.maxGroup);
  const minGroup = clamp(tour.minGroup, 1, maxGroup);
  const inAdults = asInt(d.adults);
  const inChildren = asInt(d.children);
  const inInfants = asInt(d.infants);
  let adults = clamp(inAdults ?? minGroup, 1, maxGroup);
  const children = clamp(inChildren ?? 0, 0, maxGroup - adults);
  if (adults + children < minGroup) adults = minGroup - children;
  const infants = clamp(inInfants ?? 0, 0, Math.min(adults, INFANT_MAX));
  if ((d.adults !== undefined && d.adults !== adults) || (d.children !== undefined && d.children !== children) || (d.infants !== undefined && d.infants !== infants)) changed = true;

  // Start time
  const needed = partyUnits(tour, adults, children);
  const day = dayOf(availability, date);
  const offered = typeof d.startTime === "string" && tour.startTimes.includes(d.startTime);
  let startTime: string;
  if (offered && (!day || slotFits(day.slots.find((s) => s.time === d.startTime), needed))) startTime = d.startTime as string;
  else startTime = firstFittingTime(tour, day, needed) ?? tour.startTimes[0] ?? "08:00";
  if (d.startTime !== undefined && d.startTime !== startTime) changed = true;

  // Add-ons
  const addOns: Record<string, number> = {};
  const offeredAddOns = new Set(tour.addOns.map((a) => String(a._id)));
  if (d.addOns && typeof d.addOns === "object") {
    for (const [id, q] of Object.entries(d.addOns as Record<string, unknown>)) {
      const quantity = asInt(q);
      if (offeredAddOns.has(id) && quantity !== undefined && quantity >= 0) {
        addOns[id] = quantity;
        if (quantity !== q) changed = true;
      } else if (quantity !== 0) {
        changed = true;
      }
    }
  }
  // Child seats: at most one per child or infant (the server clamps the same way)
  const childSeat = tour.addOns.find((a) => a.key === "child_seat");
  if (childSeat && (addOns[childSeat._id] ?? 0) > children + infants) {
    addOns[childSeat._id] = children + infants;
    changed = true;
  }

  // Traveller details carry over as plain strings
  const traveller = blankTraveller();
  if (d.traveller && typeof d.traveller === "object") {
    const t = d.traveller as Record<string, unknown>;
    for (const key of Object.keys(traveller) as (keyof WizardState["traveller"])[]) if (typeof t[key] === "string") traveller[key] = t[key] as string;
  }

  const inStep = asInt(d.step);
  const step = (changed ? 1 : clamp(inStep ?? 1, 1, 3)) as WizardState["step"];

  return {
    changed,
    state: {
      step,
      date,
      startTime,
      adults,
      children,
      infants,
      addOns,
      couponCode: typeof d.couponCode === "string" ? d.couponCode : "",
      traveller,
      acceptedPolicies: false,
      acceptedWaiver: false,
      payLater: d.payLater === true,
      tourSlug: tour.slug.en,
    },
  };
}
