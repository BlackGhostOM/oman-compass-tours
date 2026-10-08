"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ar as arLocale, enGB } from "react-day-picker/locale";
import { Minus, Plus, Tag } from "lucide-react";
import { formatOmr, pick } from "@/lib/content";
import { whatsappLink } from "@/lib/site";
import { BOOKING_HORIZON_DAYS, bookingWindow, isoDayFromLocalDate, isRealIsoDate } from "../../../convex/lib/dates";
import { INFANT_MAX, PARTY_MAX, roomsNeeded, singleRoomSupplements } from "../../../convex/lib/pricing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingTour, WizardState } from "@/components/booking/types";
import { UnavailableNote, type QuoteView } from "@/components/booking/price-summary";
import { firstFittingTime, isDaySoldOut, isQuoteBookable, partyUnits, slotFits, type Availability } from "@/components/booking/selection";

function Counter({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
  increaseLabel,
  decreaseLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  /** Translated accessible names for the buttons, e.g. "Add one adult" / "Remove one adult". */
  increaseLabel: string;
  decreaseLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-sand-200 px-4 py-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</Label>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={decreaseLabel}><Minus className="size-3.5" /></Button>
        <input id={id} type="number" readOnly value={value} className="w-12 min-w-0 bg-transparent text-center font-heading text-lg tabular-nums text-navy-950 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" aria-live="polite" />
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={increaseLabel}><Plus className="size-3.5" /></Button>
      </div>
    </div>
  );
}

/** "Runs on Fridays only" / "Fixed departures: …" for tours with operating rules, in the visitor's language. */
function useOperatingNote(tour: BookingTour, locale: string): string | null {
  const t = useTranslations("booking.dates");
  const intlLocale = locale === "ar" ? "ar-OM" : "en-GB";
  const list = (items: string[]) => new Intl.ListFormat(intlLocale, { style: "long", type: "conjunction" }).format(items);
  if (tour.fixedDepartureDates && tour.fixedDepartureDates.length > 0) {
    // Only departures the calendar can select (inside the booking window); later ones are mentioned, not listed
    const { from, to } = bookingWindow();
    const upcoming = tour.fixedDepartureDates.filter((d) => d >= from && d <= to);
    const later = tour.fixedDepartureDates.some((d) => d > to);
    if (upcoming.length === 0) return later ? t("onlyLaterDepartures", { days: BOOKING_HORIZON_DAYS }) : t("noUpcomingDepartures");
    const fmt = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const note = t("fixedDepartures", { dates: list(upcoming.map((d) => fmt.format(new Date(d + "T00:00:00Z")))) });
    return later ? `${note} ${t("laterDepartures", { days: BOOKING_HORIZON_DAYS })}` : note;
  }
  if (tour.operatingWeekdays && tour.operatingWeekdays.length > 0 && tour.operatingWeekdays.length < 7) {
    // 2023-01-01 was a Sunday, so day n of that week has weekday n
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: "UTC" });
    const days = [...tour.operatingWeekdays].sort((a, b) => a - b).map((n) => fmt.format(new Date(Date.UTC(2023, 0, 1 + n))));
    return t("runsOn", { days: list(days) });
  }
  return null;
}

export function StepDates({
  tour,
  state,
  update,
  quote,
  availability,
  ready,
  onNext,
}: {
  tour: BookingTour;
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  quote: QuoteView;
  /** availability.forTour over bookingWindow(), loaded by the wizard (undefined while loading). */
  availability: Availability | undefined;
  /** True once the wizard has restored (or found no) draft; start times are only auto-corrected after that. */
  ready: boolean;
  onNext: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("booking.dates");
  const tc = useTranslations("common");
  const { from, to } = bookingWindow();
  // A slot is bookable only while the smallest party the tour accepts still fits (server-side, lib/capacity)
  const soldOut = useMemo(() => new Set((availability?.dates ?? []).filter(isDaySoldOut).map((d) => d.date)), [availability]);
  // Capacity this party takes on a slot (seats, a private departure or 4WDs), same rule as the server
  const needed = partyUnits(tour, state.adults, state.children);
  const day = availability?.dates.find((d) => d.date === state.date);
  const selectedFits = slotFits(day?.slots.find((s) => s.time === state.startTime), needed);
  // When the chosen time is full (or too small for the party) on the chosen date, move to the first time that fits
  // and say why next to the time buttons.
  const [switched, setSwitched] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (!ready || !day) return;
    if (tour.startTimes.includes(state.startTime) && selectedFits) return;
    const firstFit = firstFittingTime(tour, day, needed);
    if (!firstFit || firstFit === state.startTime) return;
    setSwitched({ from: state.startTime, to: firstFit });
    update({ startTime: firstFit });
  }, [ready, day, needed, selectedFits, state.startTime, tour, update]);
  const operatingNote = useOperatingNote(tour, locale);
  // Local midnight of the chosen day, matching react-day-picker's local grid (see isoDayFromLocalDate).
  const selected = isRealIsoDate(state.date) ? new Date(state.date + "T00:00:00") : undefined;
  const startMonth = new Date(from + "T00:00:00");
  // Controlled month so the calendar opens on the selected date's month (deep links, restored drafts, Back),
  // and follows the date when it changes while this step is mounted (e.g. a draft restored after first render).
  const [month, setMonth] = useState<Date>(() => selected ?? startMonth);
  const [monthFor, setMonthFor] = useState(state.date);
  if (monthFor !== state.date) {
    setMonthFor(state.date);
    if (selected) setMonth(selected);
  }
  const groupSize = state.adults + state.children;
  // Lap infants: one per adult (the server's TOO_MANY_INFANTS rule), never more than INFANT_MAX
  const infantMax = Math.min(state.adults, INFANT_MAX);
  // The free child seat is requested per child or infant, so it is offered only when the party has small travellers
  const childSeat = tour.addOns.find((a) => a.key === "child_seat");
  const smallTravellers = state.children + state.infants;
  const visibleAddOns = tour.addOns.filter((a) => a.key !== "child_seat" || smallTravellers > 0);
  /** Changes the party, keeping infants within the adults and child seats within children + infants. */
  const setParty = (p: { adults?: number; children?: number; infants?: number; singleRooms?: number }) => {
    const adults = p.adults ?? state.adults;
    const children = p.children ?? state.children;
    const infants = Math.min(p.infants ?? state.infants, adults, INFANT_MAX);
    // Single-room requests never exceed the guests (adults and children)
    const singleRooms = Math.min(p.singleRooms ?? state.singleRooms ?? 0, adults + children);
    const patch: Partial<WizardState> = { adults, children, infants, singleRooms };
    if (childSeat && (state.addOns[childSeat._id] ?? 0) > children + infants) patch.addOns = { ...state.addOns, [childSeat._id]: children + infants };
    update(patch);
  };
  // No tour caps the group (vehicles and private groups are added); this only stops absurd online requests
  const maxGroup = PARTY_MAX;
  const waLink = (href: string) => function WhatsAppLink(chunks: ReactNode) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-navy-950 underline underline-offset-4">{chunks}</a>;
  };
  const canContinue =
    !!state.date &&
    state.date >= from &&
    state.date <= to &&
    !soldOut.has(state.date) &&
    tour.startTimes.includes(state.startTime) &&
    selectedFits &&
    groupSize >= tour.minGroup &&
    groupSize <= maxGroup &&
    // quote.available carries the server's date, start-time, group and capacity reasons; an entered code must apply
    isQuoteBookable(quote, state.couponCode);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl text-navy-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t(tour.departureType === "shared" ? (tour.kind === "service" ? "subtitleTicket" : "subtitleShared") : "subtitle")}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="rounded-lg border border-sand-200 p-2">
          <Calendar
            mode="single"
            locale={locale === "ar" ? arLocale : enGB}
            dir={locale === "ar" ? "rtl" : "ltr"}
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => d && update({ date: isoDayFromLocalDate(d) })}
            disabled={(d) => {
              const iso = isoDayFromLocalDate(d);
              return iso < from || iso > to || soldOut.has(iso);
            }}
            startMonth={startMonth}
            endMonth={new Date(to + "T00:00:00")}
            className="[--cell-size:2.4rem]"
          />
          {operatingNote && <p className="max-w-[18rem] px-2 pb-1 text-xs font-medium text-navy-950">{operatingNote}</p>}
          <p className="px-2 pb-1 text-xs text-ink-500">{t("legend")}</p>
        </div>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">{t("startTime")}</Label>
            <div className="flex flex-wrap gap-2" dir="ltr">
              {tour.startTimes.map((time) => {
                const loading = availability === undefined;
                const slot = day?.slots.find((s) => s.time === time);
                // Unknown availability is never "open": a day or slot outside the loaded window counts as full.
                const remaining = slot?.remaining ?? 0;
                const capacity = slot?.capacity ?? 0;
                // Selectable only when this party fits, so the buttons agree with the server's capacity check
                const disabled = loading || !slotFits(slot, needed);
                // Only a real scarcity cue: fewer than the slot holds, and down to about a third of it
                const low = remaining < capacity && remaining <= Math.max(1, Math.floor(capacity / 3));
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSwitched(null);
                      update({ startTime: time });
                    }}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm transition",
                      state.startTime === time ? "border-gold-500 bg-gold-500/15 text-navy-950" : "border-sand-200 bg-white text-ink-500 hover:border-gold-500/60",
                      disabled && "cursor-not-allowed opacity-40",
                      loading && "animate-pulse",
                    )}
                  >
                    {time}
                    {availability && remaining > 0 && tour.pricingModel === "per_person" && (low || disabled) && <span className="ms-2 text-[11px] text-warning">{t("spotsLeft", { count: remaining })}</span>}
                  </button>
                );
              })}
            </div>
            {switched && switched.to === state.startTime && (
              <p className="mt-2 text-xs text-ink-500" aria-live="polite">
                {t("timeSwitched", { from: switched.from, to: switched.to })}
              </p>
            )}
            <UnavailableNote tour={tour} quote={quote} className="mt-2" />
          </div>

          <div className="space-y-3">
            <Label className="block">{t("guests")}</Label>
            <Counter id="adults" label={t("adults")} hint={t("adultsHint", { min: (tour.childAgeMax ?? 11) + 1 })} value={state.adults} min={1} max={Math.max(1, maxGroup - state.children)} onChange={(v) => setParty({ adults: v })} increaseLabel={t("counter.adults.increase")} decreaseLabel={t("counter.adults.decrease")} />
            <Counter id="children" label={t("children")} hint={t("childrenHint", { min: tour.infantAgeMax + 1, max: tour.childAgeMax ?? 11 })} value={state.children} min={0} max={Math.max(0, maxGroup - state.adults)} onChange={(v) => setParty({ children: v })} increaseLabel={t("counter.children.increase")} decreaseLabel={t("counter.children.decrease")} />
            <Counter id="infants" label={t("infants")} hint={t("infantsHint", { max: tour.infantAgeMax })} value={state.infants} min={0} max={infantMax} onChange={(v) => setParty({ infants: v })} increaseLabel={t("counter.infants.increase")} decreaseLabel={t("counter.infants.decrease")} />
            {tour.pricingModel === "per_group" && <p className="text-xs text-ink-500">{t("perGroupNote", { max: tour.maxGroup })}</p>}
            {tour.pricingModel === "per_vehicle_multiday" && (() => {
              const rooms = roomsNeeded(groupSize, state.singleRooms);
              return (
                <>
                  <Counter id="singleRooms" label={t("singleRooms")} hint={t("singleRoomsHint")} value={state.singleRooms ?? 0} min={0} max={groupSize} onChange={(v) => setParty({ singleRooms: v })} increaseLabel={t("counter.singleRooms.increase")} decreaseLabel={t("counter.singleRooms.decrease")} />
                  <p className="text-xs font-medium text-navy-950" aria-live="polite">{t("roomsSummary", { shared: rooms.shared, single: rooms.single })}</p>
                  {rooms.single > rooms.singleRequested && <p className="text-xs text-ink-500">{t(rooms.singleRequested > 0 ? "roomsPartnerNote" : "roomsOddNote")}</p>}
                  {singleRoomSupplements(groupSize, rooms) > 0 && tour.vehiclePricing?.singleRoomPrice != null && <p className="text-xs text-ink-500">{t("singleSupplementNote", { count: singleRoomSupplements(groupSize, rooms) })}</p>}
                  <p className="text-xs text-ink-500">{t("perVehicleMultidayNote")}</p>
                </>
              );
            })()}
            {tour.pricingModel === "per_vehicle" && tour.vehiclePricing && (
              <p className="text-xs text-ink-500">{t("perVehicleNote", { maxAdults: tour.vehiclePricing.maxAdults, seats: tour.vehiclePricing.seats })}</p>
            )}
            {groupSize < tour.minGroup && <p className="text-xs text-danger">{t("minGroup", { min: tour.minGroup, age: tour.infantAgeMax + 1 })}</p>}
            {/* Why "+" stops at the limit, with a way to book a larger group */}
            {state.infants > 0 && state.infants >= infantMax && <p className="text-xs text-ink-500">{t.rich("infantsLimit", { link: waLink(whatsappLink(pick(tour.title, locale))) })}</p>}
          </div>
        </div>
      </div>

      {visibleAddOns.length > 0 && (
        <div>
          <h3 className="font-heading text-lg text-navy-950">{t("addOns")}</h3>
          <p className="mt-1 text-sm text-ink-500">{t("addOnsHint")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {visibleAddOns.map((a) => {
              if (a.key === "child_seat") {
                // One seat per child or infant, chosen with a counter rather than an on/off toggle
                const price = a.price === 0 ? t("free") : formatOmr(a.price, locale, { compact: true });
                return (
                  <li key={a._id}>
                    <Counter
                      id="child-seats"
                      label={pick(a.name, locale)}
                      hint={`${t("childSeatHint")} · ${price}`}
                      value={Math.min(state.addOns[a._id] ?? 0, smallTravellers)}
                      min={0}
                      max={smallTravellers}
                      onChange={(v) => update({ addOns: { ...state.addOns, [a._id]: v } })}
                      increaseLabel={t("counter.childSeats.increase")}
                      decreaseLabel={t("counter.childSeats.decrease")}
                    />
                  </li>
                );
              }
              const on = (state.addOns[a._id] ?? 0) > 0;
              return (
                <li key={a._id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ addOns: { ...state.addOns, [a._id]: on ? 0 : 1 } })}
                    className={cn("flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-start transition", on ? "border-gold-500 bg-gold-500/10" : "border-sand-200 bg-white hover:border-gold-500/60")}
                  >
                    <span>
                      <span className="block font-medium text-ink-900">{pick(a.name, locale)}</span>
                      {a.description && <span className="mt-0.5 block text-xs text-ink-500">{pick(a.description, locale)}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-navy-950" dir="ltr">
                      {a.price === 0 ? t("free") : formatOmr(a.price, locale, { compact: true })}
                      <span className="block text-end text-[11px] font-normal text-ink-500">{a.priceType === "per_person" ? tc("perPerson") : t("perBooking")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <Label htmlFor="coupon" className="mb-2 block">{t("coupon")}</Label>
        <div className="flex max-w-sm gap-2">
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <Input id="coupon" value={state.couponCode} onChange={(e) => update({ couponCode: e.target.value.toUpperCase() })} placeholder={t("couponPlaceholder")} className="ps-9 uppercase" />
          </div>
        </div>
        {state.couponCode && quote?.couponError && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-danger" role="alert">
            <span>{t.has(`couponErrors.${quote.couponError}`) ? t(`couponErrors.${quote.couponError}`) : t("couponErrors.not_found")}</span>
            <button type="button" onClick={() => update({ couponCode: "" })} className="font-medium text-navy-950 underline underline-offset-4">
              {t("removeCoupon")}
            </button>
          </p>
        )}
        {state.couponCode && quote && !quote.couponError && quote.discountTotal > 0 && <p className="mt-1 text-xs text-success">{t("couponApplied", { amount: formatOmr(quote.discountTotal, locale) })}</p>}
      </div>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canContinue} onClick={onNext} className="bg-gold-gradient font-semibold text-navy-950">
          {tc("continue")}
        </Button>
      </div>
    </div>
  );
}
