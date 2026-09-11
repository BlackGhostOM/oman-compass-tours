import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CarFront, Compass, Route, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TourCatalog } from "@/components/tours/tour-catalog";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const items = [
  { key: "transfers", Icon: CarFront, href: "/tours?category=transfers" },
  { key: "carWithDriver", Icon: Route, href: "/plan-my-trip" },
  { key: "custom", Icon: Compass, href: "/plan-my-trip" },
  { key: "groups", Icon: Users, href: "/plan-my-trip" },
] as const;

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");
  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-16">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ key, Icon, href }) => (
              <div key={key} className="card-dark flex flex-col p-6">
                <Icon className="size-8 text-gold-500" />
                <h2 className="mt-4 font-heading text-lg text-sand-50">{t(`items.${key}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm text-sand-100/70">{t(`items.${key}.body`)}</p>
                <Button asChild variant="link" className="mt-4 h-auto justify-start p-0 text-gold-400">
                  <Link href={href}>{t(`items.${key}.cta`)}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="surface-sand py-12">
        <div className="container-brand">
          <h2 className="mb-6 font-heading text-2xl text-navy-950">{t("bookable")}</h2>
          <Suspense>
            <TourCatalog kind="service" hideCategoryFilter />
          </Suspense>
        </div>
      </section>
    </>
  );
}
