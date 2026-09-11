"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Heart } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatOmr, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingStars } from "@/components/tours/rating-stars";
import { WishlistButton } from "@/components/account/wishlist-button";

export default function WishlistPage() {
  const locale = useLocale();
  const t = useTranslations("account.wishlist");
  const tc = useTranslations("common");
  const rows = useQuery(api.account.wishlist);
  if (rows === undefined) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div>
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
      {rows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Heart className="size-10 text-gold-500" />
          <p className="text-muted-foreground">{t("empty")}</p>
          <Button asChild variant="outline"><Link href="/tours">{t("browse")}</Link></Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((tour) => (
            <li key={tour._id} className="overflow-hidden rounded-xl border border-border bg-card">
              <Link href={`/tours/${pick(tour.slug, locale)}`} className="relative block aspect-[4/3]">
                <Image src={tour.coverImage?.url ?? "/media/placeholders/hero.jpg"} alt="" fill sizes="(min-width: 1280px) 25vw, 50vw" className="object-cover" />
                <div className="absolute end-3 top-3"><WishlistButton tourId={tour._id} /></div>
              </Link>
              <div className="p-4">
                <h3 className="font-heading text-base text-foreground"><Link href={`/tours/${pick(tour.slug, locale)}`}>{pick(tour.title, locale)}</Link></h3>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{pick(tour.durationLabel, locale)}</span>
                  {tour.ratingAverage > 0 && <RatingStars rating={tour.ratingAverage} />}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span dir="ltr" className="font-heading text-lg text-foreground">{formatOmr(tour.priceFrom, locale, { compact: true })}<span className="ms-1 text-xs font-normal text-muted-foreground">{tour.pricingModel === "per_group" ? tc("perGroup") : tc("perAdult")}</span></span>
                  <Button asChild size="sm" className="bg-gold-gradient text-navy-950"><Link href={`/book/${pick(tour.slug, locale)}`}>{tc("bookNow")}</Link></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
