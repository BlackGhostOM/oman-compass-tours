import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "../../../../../convex/_generated/api";
import { fetchPublic } from "@/lib/convex-server";
import { TourCatalog } from "@/components/tours/tour-catalog";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ToursPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const initialTours = await fetchPublic(api.tours.list, { kind: "tour" });
  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-14">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>
      <section className="surface-sand py-12">
        <div className="container-brand">
          <Suspense>
            <TourCatalog kind="tour" initialTours={initialTours ?? undefined} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
