"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Users } from "lucide-react";
import { formatDate, formatOmr, pick, cancellationWindow } from "@/lib/content";
import { cn } from "@/lib/utils";
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
  available?: boolean;
} | null | undefined;

export function PriceSummary({
  tour,
  date,
  startTime,
  adults,
  kids,
  infants,
  quote,
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
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("booking.summary");
  const tc = useTranslations("common");

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
            {tc("adults", { count: adults })}
            {kids > 0 && `, ${tc("children", { count: kids })}`}
            {infants > 0 && `, ${t("infants", { count: infants })}`}
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
                  <span dir="ltr" className="font-medium text-ink-900">{it.kind === "infant" ? t("free") : formatOmr(it.total, locale)}</span>
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
            {quote.available === false && (
              <p className="mt-3 rounded-lg border border-danger/40 bg-danger/5 p-2 text-xs text-danger">{t("soldOut", { remaining: quote.remaining ?? 0 })}</p>
            )}
            {tour.freeCancellationHours > 0 && <p className="mt-3 text-xs text-success">{tc("freeCancellation", { window: cancellationWindow(tour.freeCancellationHours, locale) })}</p>}
          </>
        )}
      </div>
    </aside>
  );
}
