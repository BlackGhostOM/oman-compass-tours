"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pick, type LocalizedString, cancellationWindow } from "@/lib/content";
import { whatsappLink, site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/tours/price-tag";
import { RatingStars } from "@/components/tours/rating-stars";

export function BookPanel({
  tour,
}: {
  tour: {
    title: LocalizedString;
    slug: LocalizedString;
    priceFrom: number;
    pricingModel: "per_group" | "per_person";
    compareAtPriceFrom?: number | null;
    priceAdult?: number | null;
    priceChild?: number | null;
    priceGroup?: number | null;
    childAgeMax?: number | null;
    durationLabel: LocalizedString;
    maxGroup: number;
    freeCancellationHours: number;
    depositPercent: number;
    allowReserveNowPayLater: boolean;
    ratingAverage: number;
    ratingCount: number;
    externalReviewCount?: number | null;
    startTimes: string[];
  };
}) {
  const locale = useLocale();
  const t = useTranslations("tour");
  const tc = useTranslations("common");
  const slug = pick(tour.slug, locale);
  const title = pick(tour.title, locale);
  const reviews = tour.ratingCount + (tour.externalReviewCount ?? 0);
  const message = `Hello Oman Compass Tours 👋 I would like to book: ${title}\nمرحباً، أرغب في حجز: ${pick(tour.title, "ar")}\n${site.url}/${locale}/tours/${slug}`;

  return (
    <aside className="rounded-xl border border-sand-200 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(14,11,46,0.35)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <PriceTag baisa={tour.priceFrom} pricingModel={tour.pricingModel} compareAt={tour.compareAtPriceFrom} size="lg" />
        {tour.ratingAverage > 0 && (
          <div className="text-end text-xs text-ink-500">
            <RatingStars rating={tour.ratingAverage} size="md" />
            <div className="mt-1">
              <span className="font-semibold text-ink-900">{tour.ratingAverage.toFixed(1)}</span> · {tc("reviews", { count: reviews })}
            </div>
          </div>
        )}
      </div>

      {tour.pricingModel === "per_person" && tour.priceChild ? (
        <p className="mt-3 text-xs text-ink-500">
          {t("childPrice", { age: tour.childAgeMax ?? 11 })}:{" "}
          <span className="font-medium text-ink-900" dir="ltr">
            {new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", { style: "currency", currency: "OMR", maximumFractionDigits: 0 }).format(tour.priceChild / 1000)}
          </span>
        </p>
      ) : null}

      <ul className="mt-5 space-y-2.5 text-sm text-ink-500">
        <li className="flex items-center gap-2.5">
          <Clock className="size-4 text-gold-500" /> {pick(tour.durationLabel, locale)}
        </li>
        <li className="flex items-center gap-2.5">
          <Users className="size-4 text-gold-500" /> {t("privateUpTo", { count: tour.maxGroup })}
        </li>
        <li className="flex items-center gap-2.5">
          <CalendarDays className="size-4 text-gold-500" />
          <span dir="ltr">{tour.startTimes.join(" · ")}</span>
        </li>
        {tour.freeCancellationHours > 0 ? (
          <li className="flex items-center gap-2.5 text-success">
            <ShieldCheck className="size-4" /> {tc("freeCancellation", { window: cancellationWindow(tour.freeCancellationHours, locale) })}
          </li>
        ) : (
          <li className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-warning" /> {tc("nonRefundable")}
          </li>
        )}
        {tour.depositPercent < 100 && (
          <li className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-gold-500" /> {t("depositOnly", { percent: tour.depositPercent })}
          </li>
        )}
      </ul>

      <div className="mt-6 space-y-2.5">
        <Button asChild size="lg" className="w-full bg-gold-gradient text-base font-semibold text-navy-950 shadow-gold hover:brightness-110">
          <Link href={`/book/${slug}`}>{t("checkAvailability")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full border-[#25D366]/50 text-ink-900 hover:bg-[#25D366]/10">
          <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4 text-[#25D366]" /> {t("askOnWhatsapp")}
          </a>
        </Button>
        {tour.allowReserveNowPayLater && <p className="text-center text-xs text-ink-500">{t("reserveNowPayLater")}</p>}
      </div>
    </aside>
  );
}

/** Mobile sticky bar shown below the fold. */
export function MobileBookBar({ tour }: { tour: { slug: LocalizedString; priceFrom: number; pricingModel: "per_group" | "per_person" } }) {
  const locale = useLocale();
  const t = useTranslations("tour");
  const ref = useRef<HTMLDivElement>(null);

  // Publish the bar's height as --bottom-bar so the other fixed elements (support
  // button, consent banner) sit above it instead of covering the Book button.
  // On lg+ the bar is display:none, which the observer reports as 0.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty("--bottom-bar", `${el.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--bottom-bar");
    };
  }, []);

  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
      <PriceTag baisa={tour.priceFrom} pricingModel={tour.pricingModel} size="sm" />
      <Button asChild className="bg-gold-gradient font-semibold text-navy-950">
        <Link href={`/book/${pick(tour.slug, locale)}`}>{t("bookNow")}</Link>
      </Button>
    </div>
  );
}
