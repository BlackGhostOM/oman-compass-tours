"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { addDaysIso, todayIso } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Next-14-days availability strip on the tour page. */
export function AvailabilityPreview({ tourId, slug }: { tourId: Id<"tours">; slug: string }) {
  const locale = useLocale();
  const t = useTranslations("tour");
  const from = addDaysIso(todayIso(), 1);
  const to = addDaysIso(from, 13);
  const data = useQuery(api.availability.forTour, { tourId, from, to });

  if (!data) return <Skeleton className="h-24 rounded-xl" />;

  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {data.dates.map((d) => {
        const date = new Date(d.date + "T00:00:00");
        // Same rule as the booking calendar: some start time still fits the smallest party the tour accepts
        const available = !d.isBlackout && d.slots.some((s) => s.bookable);
        const chipClass = cn(
          "flex min-w-[4.6rem] flex-col items-center rounded-lg border px-2 py-2.5 text-center transition",
          available ? "border-sand-200 bg-white hover:border-gold-500" : "cursor-not-allowed border-sand-200 bg-sand-100 opacity-60",
        );
        const content = (
          <>
            <span className="text-[11px] uppercase text-ink-500">
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { weekday: "short" }).format(date)}
            </span>
            <span className="font-heading text-lg text-navy-950">{new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { day: "numeric" }).format(date)}</span>
            <span className="text-[11px] text-ink-500">{new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { month: "short" }).format(date)}</span>
            {/* A day the tour does not run is not an alarm: neutral, unlike a sold-out departure */}
            <span className={cn("mt-1 text-[11px] font-medium", available ? "text-success" : d.operating === false ? "text-ink-500" : "text-danger")}>
              {available ? t("available") : d.operating === false ? t("noDeparture") : t("soldOut")}
            </span>
          </>
        );
        // Unavailable days are not links (no jump to "#", not focusable)
        return available ? (
          <Link key={d.date} href={`/book/${slug}?date=${d.date}`} className={chipClass}>{content}</Link>
        ) : (
          <div key={d.date} aria-disabled="true" className={chipClass}>{content}</div>
        );
      })}
    </div>
  );
}
