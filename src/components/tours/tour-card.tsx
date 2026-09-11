"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Clock, ShieldCheck, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { cn } from "@/lib/utils";
import { RatingStars } from "@/components/tours/rating-stars";
import { PriceTag } from "@/components/tours/price-tag";
import type { TourCard as TourCardData } from "../../../convex/tours";

export function TourCard({
  tour,
  className,
  priority = false,
  tone = "light",
}: {
  tour: TourCardData;
  className?: string;
  priority?: boolean;
  tone?: "light" | "dark";
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const dark = tone === "dark";
  const href = `/tours/${pick(tour.slug, locale)}`;
  const reviewCount = (tour.externalReviewCount ?? 0) + tour.ratingCount;
  const image = tour.coverImage?.url ?? "/media/placeholders/hero.jpg";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border transition duration-300 hover:-translate-y-1",
        dark
          ? "border-navy-800 bg-navy-900 text-sand-50 hover:border-gold-500/60 hover:shadow-gold"
          : "border-sand-200 bg-white text-ink-900 hover:border-gold-500/60 hover:shadow-[0_18px_40px_-20px_rgba(14,11,46,0.35)]",
        className,
      )}
    >
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden">
        <Image
          src={image}
          alt={pick(tour.coverImage?.alt, locale) || pick(tour.title, locale)}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
          priority={priority}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-md bg-navy-950/80 px-2 py-1 text-xs font-medium text-sand-50 backdrop-blur">
            {tour.kind === "service" ? t("service") : tour.durationDays > 1 ? t("days", { count: tour.durationDays }) : pick(tour.durationLabel, locale)}
          </span>
          {tour.isFeatured && (
            <span className="rounded-md bg-gold-gradient px-2 py-1 text-xs font-semibold text-navy-950">{t("featured")}</span>
          )}
        </div>
        {tour.ratingAverage > 0 && (
          <div className="absolute bottom-3 start-3 flex items-center gap-1.5 rounded-md bg-navy-950/80 px-2 py-1 text-xs text-sand-50 backdrop-blur">
            <RatingStars rating={tour.ratingAverage} />
            <span className="font-semibold">{tour.ratingAverage.toFixed(1)}</span>
            {reviewCount > 0 && <span className="text-sand-100/70">({reviewCount})</span>}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-heading text-base leading-snug sm:text-lg">
          <Link href={href} className={cn("transition", dark ? "hover:text-gold-400" : "hover:text-gold-700")}>
            {pick(tour.title, locale)}
          </Link>
        </h3>
        <p className={cn("mt-2 line-clamp-2 text-sm leading-relaxed", dark ? "text-sand-100/70" : "text-ink-500")}>
          {pick(tour.summary, locale)}
        </p>
        <ul className={cn("mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs", dark ? "text-sand-100/70" : "text-ink-500")}>
          <li className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-gold-500" /> {pick(tour.durationLabel, locale)}
          </li>
          <li className="inline-flex items-center gap-1">
            <Users className="size-3.5 text-gold-500" /> {t("upTo", { count: tour.maxGroup })}
          </li>
          {tour.freeCancellationHours > 0 && (
            <li className="inline-flex items-center gap-1 text-success">
              <ShieldCheck className="size-3.5" /> {t("freeCancellationShort")}
            </li>
          )}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <PriceTag baisa={tour.priceFrom} pricingModel={tour.pricingModel} compareAt={tour.compareAtPriceFrom} size="sm" tone={tone} />
          <Link
            href={href}
            className="rounded-lg bg-gold-gradient px-3.5 py-2 text-sm font-semibold text-navy-950 transition hover:brightness-110"
          >
            {t("viewDetails")}
          </Link>
        </div>
      </div>
    </article>
  );
}
