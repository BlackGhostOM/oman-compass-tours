import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "../../../../../convex/_generated/api";
import { fetchPublic } from "@/lib/convex-server";
import { DestinationsGrid } from "@/components/home/destinations-grid";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.destinations" });
  return { title: t("title"), description: t("description") };
}

export default async function DestinationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.destinations");
  const destinations = await fetchPublic(api.catalog.destinations, {});
  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-14">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>
      <div className="surface-sand py-12">
        <DestinationsGrid destinations={destinations ?? []} compact />
      </div>
    </>
  );
}
