"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import AutoScroll from "embla-carousel-auto-scroll";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { TourCard } from "@/components/tours/tour-card";
import { SectionHeading } from "@/components/shared/section-heading";
import type { TourCard as TourCardData } from "../../../convex/tours";

/** True when the visitor asked the OS/browser for reduced motion; the carousel then stays still. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function FeaturedTours({ tours }: { tours: TourCardData[] }) {
  const t = useTranslations("home.featured");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  // Continuous, slow drift: "forward" follows the reading direction, so Arabic drifts left → right and English right → left.
  // Pauses while the pointer is over the cards and resumes afterwards; arrows still work for manual browsing.
  const plugins = useMemo(() => [AutoScroll({ speed: 0.6, startDelay: 800, direction: "forward", stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true, playOnInit: !reduced })], [reduced]);
  // A looping track needs more slides than fit on screen; repeat a short list so the motion never stalls.
  const slides = useMemo(() => (tours.length > 0 && tours.length < 8 ? [...tours, ...tours] : tours), [tours]);
  if (tours.length === 0) return null;
  return (
    <section id="featured" className="cv-auto relative surface-sand py-20 sm:py-24">
      <div className="container-brand">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} align="start" />
          <Link href="/tours" className="inline-flex items-center gap-2 font-medium text-gold-700 transition hover:text-gold-500">
            {t("viewAll")} <ArrowRight className="size-4 rtl-flip" />
          </Link>
        </div>
        <Carousel key={`${locale}-${reduced}`} opts={{ align: "start", direction: locale === "ar" ? "rtl" : "ltr", loop: true, dragFree: true }} plugins={plugins} className="mt-10">
          <CarouselContent className="-ms-4">
            {slides.map((tour, i) => (
              <CarouselItem key={`${tour._id}-${i}`} className="ps-4 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
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
