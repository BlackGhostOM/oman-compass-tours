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
        const remaining = d.slots.reduce((a, s) => a + s.remaining, 0);
        const date = new Date(d.date + "T00:00:00");
        const available = remaining > 0 && !d.isBlackout;
        return (
          <Link
            key={d.date}
            href={available ? `/book/${slug}?date=${d.date}` : "#"}
            aria-disabled={!available}
            className={cn(
              "flex min-w-[4.6rem] flex-col items-center rounded-lg border px-2 py-2.5 text-center transition",
              available ? "border-sand-200 bg-white hover:border-gold-500" : "cursor-not-allowed border-sand-200 bg-sand-100 opacity-60",
            )}
          >
            <span className="text-[11px] uppercase text-ink-500">
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { weekday: "short" }).format(date)}
            </span>
            <span className="font-heading text-lg text-navy-950">{new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { day: "numeric" }).format(date)}</span>
            <span className="text-[11px] text-ink-500">{new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en", { month: "short" }).format(date)}</span>
            <span className={cn("mt-1 text-[11px] font-medium", available ? "text-success" : "text-danger")}>
              {available ? t("available") : t("soldOut")}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
