import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { fetchPublic } from "@/lib/convex-server";
import { decodeSlug, pick } from "@/lib/content";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: "en" | "ar"; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  const tour = await fetchPublic(api.tours.forBooking, { slug: decodeSlug(slug), locale });
  return { title: tour ? `${t("metaTitle")} · ${pick(tour.title, locale)}` : t("metaTitle"), robots: { index: false } };
}

export default async function BookPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const tour = await fetchPublic(api.tours.forBooking, { slug: decodeSlug(slug), locale });
  if (!tour) notFound();
  const t = await getTranslations("booking");

  return (
    <div className="surface-sand pt-24 pb-16">
      <div className="container-brand">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="heading-brand mt-2 font-heading text-2xl text-navy-950 sm:text-3xl">{pick(tour.title, locale)}</h1>
        <p className="mt-1 text-sm text-ink-500">
          <Link href={`/tours/${pick(tour.slug, locale)}`} className="text-gold-700 underline-offset-4 hover:underline">{t("backToTour")}</Link>
        </p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <BookingWizard tour={tour} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
