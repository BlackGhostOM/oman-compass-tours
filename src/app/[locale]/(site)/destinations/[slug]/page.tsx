import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { api } from "../../../../../../convex/_generated/api";
import { fetchPublic } from "@/lib/convex-server";
import { decodeSlug, pick } from "@/lib/content";
import { TourCatalog } from "@/components/tours/tour-catalog";
import { MapEmbed } from "@/components/shared/map-embed";

export const revalidate = 300;

type Props = { params: Promise<{ locale: "en" | "ar"; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const d = await fetchPublic(api.catalog.destinationBySlug, { slug: decodeSlug(slug), locale });
  if (!d) return {};
  return {
    title: pick(d.seo?.title ?? d.name, locale),
    description: pick(d.seo?.description ?? d.tagline, locale),
    alternates: { languages: { en: `/en/destinations/${d.slug.en}`, ar: `/ar/destinations/${d.slug.ar}` } },
  };
}

export default async function DestinationPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const d = await fetchPublic(api.catalog.destinationBySlug, { slug: decodeSlug(slug), locale });
  if (!d) notFound();
  const t = await getTranslations("destination");

  return (
    <>
      <section className="relative flex min-h-[60vh] items-end overflow-hidden surface-dark pt-32 pb-12">
        <Image src={d.image?.url ?? "/media/placeholders/hero.jpg"} alt={pick(d.image?.alt, locale) || pick(d.name, locale)} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/20" />
        <div className="container-brand relative">
          <p className="eyebrow">{d.region ?? t("eyebrow")}</p>
          <h1 className="heading-brand mt-3 font-heading text-4xl text-sand-50 sm:text-5xl">{pick(d.name, locale)}</h1>
          {d.tagline && <p className="mt-3 max-w-2xl font-editorial text-xl text-sand-100/85">{pick(d.tagline, locale)}</p>}
        </div>
      </section>
      <section className="surface-sand py-12">
        <div className="container-brand grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div>
            {d.description && <p className="max-w-3xl text-lg leading-relaxed text-ink-500">{pick(d.description, locale)}</p>}
            <h2 className="mt-10 mb-6 font-heading text-2xl text-navy-950">{t("toursIn", { name: pick(d.name, locale) })}</h2>
            <Suspense>
              <TourCatalog initialDestination={d.key} />
            </Suspense>
          </div>
          <aside className="space-y-4">
            <MapEmbed className="h-64" title={pick(d.name, locale)} lat={d.lat ?? undefined} lng={d.lng ?? undefined} zoom={9} />
          </aside>
        </div>
      </section>
    </>
  );
}
