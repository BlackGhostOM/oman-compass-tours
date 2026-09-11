"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TourCard } from "@/components/tours/tour-card";
import { SectionHeading } from "@/components/shared/section-heading";
import type { TourCard as TourCardData } from "../../../convex/tours";

export function FeaturedTours({ tours }: { tours: TourCardData[] }) {
  const t = useTranslations("home.featured");
  const locale = useLocale();
  if (tours.length === 0) return null;
  return (
    <section id="featured" className="relative surface-sand py-20 sm:py-24">
      <div className="container-brand">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} align="start" />
          <Link href="/tours" className="inline-flex items-center gap-2 font-medium text-gold-600 transition hover:text-gold-500">
            {t("viewAll")} <ArrowRight className="size-4 rtl-flip" />
          </Link>
        </div>
        <Carousel opts={{ align: "start", direction: locale === "ar" ? "rtl" : "ltr", loop: tours.length > 3 }} className="mt-10">
          <CarouselContent className="-ms-4">
            {tours.map((tour, i) => (
              <CarouselItem key={tour._id} className="ps-4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <TourCard tour={tour} priority={i < 2} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="-start-4 hidden border-gold-500/40 bg-white text-navy-950 hover:bg-gold-500 hover:text-navy-950 lg:flex" />
          <CarouselNext className="-end-4 hidden border-gold-500/40 bg-white text-navy-950 hover:bg-gold-500 hover:text-navy-950 lg:flex" />
        </Carousel>
      </div>
    </section>
  );
}
