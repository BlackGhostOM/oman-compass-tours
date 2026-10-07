"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Users } from "lucide-react";
import { formatDate, formatOmr, pick, cancellationWindow } from "@/lib/content";
import { BOOKING_HORIZON_DAYS } from "../../../convex/lib/dates";
import { PARTY_MAX, isVehicleModel } from "../../../convex/lib/pricing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingTour } from "@/components/booking/types";

export type QuoteView = {
  items: { kind: string; label: { en: string; ar: string }; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  addOnsTotal: number;
  discountTotal: number;
  total: number;
  depositDue: number;
  balanceDue: number;
  couponCode?: string;
  couponError?: string;
  remaining?: number;
  /** Capacity units this party needs: seats (per_person), one departure (per_group, tiered) or 4WDs (per_vehicle). */
  needed?: number;
  available?: boolean;
  /** Set by bookings.quote when available is false; "sold_out" means not enough capacity left. */
  unavailableReason?: string | null;
} | null | undefined;

/** Why the current selection cannot be booked (quote.available === false), worded for its reason. Renders nothing otherwise. */
export function UnavailableNote({ tour, quote, className, id }: { tour: BookingTour; quote: QuoteView; className?: string; id?: string }) {
  const t = useTranslations("booking.summary");
  if (!quote || quote.available !== false) return null;
  const reason = quote.unavailableReason;
  const remaining = quote.remaining ?? 0;
  let text: string;
  if (reason && reason !== "sold_out" && t.has(`unavailableReasons.${reason}`)) {
    text = t(`unavailableReasons.${reason}`, { days: BOOKING_HORIZON_DAYS, min: tour.minGroup, max: PARTY_MAX, age: tour.infantAgeMax + 1 });
  } else if (quote.needed === undefined) {
    text = t("soldOut", { remaining });
  } else if (isVehicleModel(tour.pricingModel) && tour.vehiclePricing) {
    // remaining and needed count 4WDs here, not places
    text = t("soldOutVehicles", { remaining, needed: quote.needed, maxAdults: tour.vehiclePricing.maxAdults, seats: tour.vehiclePricing.seats });
  } else if (tour.pricingModel === "per_group" || tour.pricingModel === "tiered") {
    // A private departure: one booking takes the whole slot
    text = t("slotFull");
  } else {
    text = t("soldOutSeats", { remaining, needed: quote.needed });
  }
  return (
    <p id={id} role="alert" className={cn("rounded-lg border border-danger/40 bg-danger/5 p-2 text-xs text-danger", className)}>
      {text}
    </p>
  );
}

/**
 * Shown on Review and Payment when the selection can no longer be booked as it stands (availability changed, or the
 * coupon stopped applying): the reason plus a way back to step 1, where both are fixed.
 */
export function SelectionIssue({ tour, quote, couponCode, onEdit }: { tour: BookingTour; quote: QuoteView; couponCode: string; onEdit: () => void }) {
  const t = useTranslations("booking");
  if (!quote) return null;
  const couponInvalid = !!couponCode && !!quote.couponError;
  if (quote.available !== false && !couponInvalid) return null;
  return (
    <div className="space-y-2">
      <UnavailableNote tour={tour} quote={quote} />
      {couponInvalid && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-2 text-xs text-danger">
          {t("summary.couponNotApplied", { code: couponCode })}{" "}
          {t.has(`dates.couponErrors.${quote.couponError}`) && t(`dates.couponErrors.${quote.couponError}`)}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onEdit}>{t("editSelection")}</Button>
    </div>
  );
}

/** The party as one phrase ("2 adults, 1 child, 1 infant" / "بالغان، طفل واحد، رضيع واحد"), zero children and infants left out. */
export function useGuestsLabel() {
  const locale = useLocale();
  const t = useTranslations("booking.summary");
  const tc = useTranslations("common");
  return (adults: number, kids: number, infants: number) =>
    [tc("adults", { count: adults }), ...(kids > 0 ? [tc("children", { count: kids })] : []), ...(infants > 0 ? [t("infants", { count: infants })] : [])].join(locale === "ar" ? "، " : ", ");
}

export function PriceSummary({
  tour,
  date,
  startTime,
  adults,
  kids,
  infants,
  quote,
  couponCode,
  className,
  compact = false,
}: {
  tour: BookingTour;
  date: string;
  startTime: string;
  adults: number;
  kids: number;
  infants: number;
  quote: QuoteView;
  /** The code the customer entered; when the quote reports a couponError, the summary says it is not applied. */
  couponCode?: string;
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("booking.summary");
  const td = useTranslations("booking.dates");
  const tc = useTranslations("common");
  const guests = useGuestsLabel();

  return (
    <aside className={cn("rounded-xl border border-sand-200 bg-white", className)}>
      {!compact && (
        <div className="flex gap-4 border-b border-sand-200 p-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
            <Image src={tour.coverImage?.url ?? "/media/placeholders/hero.jpg"} alt="" fill sizes="80px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-heading text-base leading-snug text-navy-950">{pick(tour.title, locale)}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500"><Clock className="size-3.5 text-gold-500" /> {pick(tour.durationLabel, locale)}</p>
          </div>
        </div>
      )}
      <dl className="space-y-2 border-b border-sand-200 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-ink-500"><CalendarDays className="size-4 text-gold-500" /> {t("date")}</dt>
          <dd className="text-end font-medium text-ink-900">{date ? formatDate(date, locale, "short") : "—"}{startTime ? <span className="text-ink-500"> · <span dir="ltr">{startTime}</span></span> : null}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-ink-500"><Users className="size-4 text-gold-500" /> {t("guests")}</dt>
          <dd className="text-end font-medium text-ink-900">
            {guests(adults, kids, infants)}
          </dd>
        </div>
      </dl>
      <div className="p-4">
        {quote === undefined ? (
          <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-6 w-1/2" /></div>
        ) : quote === null ? (
          <p className="text-sm text-ink-500">{t("unavailable")}</p>
        ) : (
          <>
            <ul className="space-y-1.5 text-sm">
              {quote.items.map((it, i) => (
                <li key={i} className={cn("flex items-center justify-between gap-3", it.kind === "discount" && "text-success")}>
                  <span className="text-ink-500">
                    {pick(it.label, locale)}
                    {it.quantity > 1 && it.kind !== "discount" ? <span className="text-ink-300"> × {it.quantity}</span> : null}
                  </span>
                  <span dir="ltr" className="font-medium text-ink-900">{it.total === 0 && it.kind !== "discount" ? t("free") : formatOmr(it.total, locale)}</span>
                </li>
              ))}
            </ul>
            <div className="hairline my-3" />
            <div className="flex items-baseline justify-between">
              <span className="font-heading text-base text-navy-950">{t("total")}</span>
              <span dir="ltr" className="font-heading text-xl text-navy-950">{formatOmr(quote.total, locale)}</span>
            </div>
            {quote.depositDue < quote.total && (
              <div className="mt-2 rounded-lg bg-sand-100 p-3 text-xs text-ink-500">
                <div className="flex justify-between"><span>{t("depositNow", { percent: tour.depositPercent })}</span><span dir="ltr" className="font-medium text-ink-900">{formatOmr(quote.depositDue, locale)}</span></div>
                <div className="mt-1 flex justify-between"><span>{t("balanceLater")}</span><span dir="ltr">{formatOmr(quote.balanceDue, locale)}</span></div>
              </div>
            )}
            <UnavailableNote tour={tour} quote={quote} className="mt-3" />
            {couponCode && quote.couponError && (
              <p className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-2 text-xs text-ink-900">
                {t("couponNotApplied", { code: couponCode })}{" "}
                {td.has(`couponErrors.${quote.couponError}`) && td(`couponErrors.${quote.couponError}`)}
              </p>
            )}
            {tour.freeCancellationHours > 0 && <p className="mt-3 text-xs text-success">{tc("freeCancellation", { window: cancellationWindow(tour.freeCancellationHours, locale) })}</p>}
          </>
        )}
      </div>
    </aside>
  );
}
