import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Anchor, Briefcase, Building2, Bus, Camera, Car, Compass, Globe2, Handshake, Headset, Hotel, Map, Mountain, Plane, Route, Sparkles, Tent, Users, Waves, Wallet } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { JsonLd } from "@/components/shared/json-ld";
import { PartnerForm } from "@/components/forms/partner-form";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "partners" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: `/${locale}/partners`, languages: { en: "/en/partners", ar: "/ar/partners" } } };
}

const audiences = [
  { key: "agencies", Icon: Globe2 },
  { key: "operators", Icon: Route },
  { key: "advisors", Icon: Compass },
  { key: "corporate", Icon: Briefcase },
  { key: "hotels", Icon: Hotel },
  { key: "independent", Icon: Users },
] as const;

const reasons = [
  { key: "expertise", Icon: Map },
  { key: "rates", Icon: Wallet },
  { key: "tailorMade", Icon: Sparkles },
  { key: "operations", Icon: Bus },
  { key: "support", Icon: Headset },
  { key: "onePartner", Icon: Handshake },
] as const;

const services = [
  { key: "private", Icon: Compass }, { key: "group", Icon: Users }, { key: "fit", Icon: Route }, { key: "luxury", Icon: Sparkles },
  { key: "adventure", Icon: Mountain }, { key: "cultural", Icon: Camera }, { key: "transport4wd", Icon: Car }, { key: "selfDrive", Icon: Car },
  { key: "hotels", Icon: Hotel }, { key: "camps", Icon: Tent }, { key: "airport", Icon: Plane }, { key: "intercity", Icon: Bus },
  { key: "guides", Icon: Map }, { key: "dhow", Icon: Anchor }, { key: "marine", Icon: Waves }, { key: "custom", Icon: Building2 },
] as const;

const models = ["agency", "advisor", "strategic"] as const;
const steps = ["register", "review", "connect", "info", "sell"] as const;

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("partners");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t("metaTitle"),
    description: t("metaDescription"),
    about: { "@type": "TravelAgency", name: site.name, telephone: site.phoneE164, email: site.email },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* Hero */}
      <section className="relative overflow-hidden surface-dark pt-32 pb-16 sm:pb-20">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <p className="eyebrow eyebrow-light">{t("hero.eyebrow")}</p>
          <h1 className="heading-brand mt-3 max-w-3xl font-heading text-4xl leading-tight text-sand-50 sm:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 max-w-2xl font-editorial text-xl text-sand-100/85">{t("hero.subtitle")}</p>
          <p className="mt-4 max-w-2xl text-sand-100/70">{t("hero.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gold-gradient font-semibold text-navy-950 shadow-gold"><a href="#partner-form">{t("hero.cta")}</a></Button>
            <Button asChild size="lg" variant="outline" className="border-gold-500/50 bg-transparent text-sand-50 hover:bg-navy-900">
              <a href={whatsappLink("Hello Oman Compass Tours 👋 I am a travel professional interested in a B2B partnership.")} target="_blank" rel="noopener noreferrer">{t("hero.whatsapp")}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Who we work with */}
      <section className="surface-sand py-16 sm:py-20">
        <div className="container-brand">
          <SectionHeading eyebrow={t("who.eyebrow")} title={t("who.title")} description={t("who.description")} align="start" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ key, Icon }) => (
              <div key={key} className="rounded-xl border border-sand-200 bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-gold-gradient text-navy-950"><Icon className="size-5" /></span>
                <h3 className="mt-4 font-heading text-lg text-navy-950">{t(`who.items.${key}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-500">{t(`who.items.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why partner */}
      <section className="relative overflow-hidden surface-dark py-16 sm:py-20">
        <CompassWatermark opacity={0.04} className="-translate-x-1/3" />
        <div className="container-brand relative">
          <SectionHeading eyebrow={t("why.eyebrow")} title={t("why.title")} tone="dark" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map(({ key, Icon }) => (
              <div key={key} className="card-dark group p-6 transition hover:border-gold-500/60">
                <span className="flex size-11 items-center justify-center rounded-lg bg-gold-gradient text-navy-950 shadow-gold"><Icon className="size-5" /></span>
                <h3 className="mt-4 font-heading text-lg text-sand-50">{t(`why.items.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-sand-100/70">{t(`why.items.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DMC services + partnership models */}
      <section className="surface-sand py-16 sm:py-20">
        <div className="container-brand">
          <SectionHeading eyebrow={t("services.eyebrow")} title={t("services.title")} description={t("services.description")} align="start" />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(({ key, Icon }) => (
              <li key={key} className="flex items-center gap-3 rounded-lg border border-sand-200 bg-white px-4 py-3 text-sm text-ink-900">
                <Icon className="size-4 shrink-0 text-gold-700" /> {t(`services.items.${key}`)}
              </li>
            ))}
          </ul>

          <div className="mt-16">
            <SectionHeading eyebrow={t("models.eyebrow")} title={t("models.title")} align="start" />
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {models.map((key) => (
                <div key={key} className="flex flex-col rounded-xl border border-sand-200 bg-white p-6">
                  <h3 className="font-heading text-xl text-navy-950">{t(`models.items.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-ink-500">{t(`models.items.${key}.body`)}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-ink-900">
                    {t(`models.items.${key}.points`).split("|").map((p) => (
                      <li key={p} className="flex items-start gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" /> {p.trim()}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works + form */}
      <section className="relative overflow-hidden surface-dark py-16 sm:py-20">
        <CompassWatermark opacity={0.04} className="translate-x-1/3" />
        <div className="container-brand relative">
          <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} tone="dark" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((key, i) => (
              <li key={key} className="card-dark p-5">
                <span className="font-heading text-2xl text-gold-400" dir="ltr">0{i + 1}</span>
                <h3 className="mt-2 font-heading text-base text-sand-50">{t(`how.steps.${key}.title`)}</h3>
                <p className="mt-1 text-sm text-sand-100/70">{t(`how.steps.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="surface-sand py-16 sm:py-20">
        <div className="container-brand max-w-4xl">
          <SectionHeading eyebrow={t("form.eyebrow")} title={t("form.title")} description={t("form.description")} align="start" />
          <div className="mt-8"><PartnerForm /></div>
          <p className="mt-6 text-center text-sm text-ink-500">
            {t("form.footer")} <a href={`mailto:${site.email}`} className="text-gold-700 underline-offset-4 hover:underline">{site.email}</a> · <a href={whatsappLink("Hello Oman Compass Tours 👋 partnership enquiry")} className="text-gold-700 underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">WhatsApp {site.phoneDisplay}</a>
          </p>
        </div>
      </section>
    </>
  );
}
