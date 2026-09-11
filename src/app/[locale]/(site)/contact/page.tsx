import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/forms/contact-form";
import { MapEmbed } from "@/components/shared/map-embed";
import { SectionHeading } from "@/components/shared/section-heading";
import { SocialLinks } from "@/components/shared/social-links";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { JsonLd } from "@/components/shared/json-ld";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: "en" | "ar" }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          mainEntity: {
            "@type": "TravelAgency",
            name: site.name,
            telephone: site.phoneE164,
            email: site.email,
            address: { "@type": "PostalAddress", streetAddress: site.address.en, addressLocality: "Muscat", addressCountry: "OM" },
          },
        }}
      />
      <section className="relative overflow-hidden surface-dark pt-32 pb-16">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>

      <section className="surface-sand py-14">
        <div className="container-brand grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          {/* Details */}
          <div className="space-y-6">
            <div className="rounded-xl border border-sand-200 bg-white p-6">
              <h2 className="font-heading text-xl text-navy-950">{t("officeTitle")}</h2>
              <ul className="mt-5 space-y-4 text-sm text-ink-900">
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gold-500" />
                  <div>
                    <p>{site.address[locale]}</p>
                    <a href={site.mapsDirectionsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-gold-700 underline-offset-4 hover:underline">
                      <Navigation className="size-3.5" /> {t("directions")}
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Phone className="mt-0.5 size-5 shrink-0 text-gold-500" />
                  <div>
                    <a href={`tel:${site.phoneE164}`} dir="ltr" className="hover:text-gold-700">{site.phoneDisplay}</a>
                    <p className="text-xs text-ink-500">{t("phoneHint")}</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Mail className="mt-0.5 size-5 shrink-0 text-gold-500" />
                  <a href={`mailto:${site.email}`} className="hover:text-gold-700">{site.email}</a>
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-gold-500" />
                  <div>
                    {site.hours.map((h) => (
                      <p key={h.days.en}>
                        <span className="font-medium">{h.days[locale]}</span>: <span dir="ltr">{h.open} – {h.close}</span>
                      </p>
                    ))}
                    <p className="text-xs text-ink-500">{t("timezone")}</p>
                  </div>
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-[#25D366] text-navy-950 hover:bg-[#1ebe5b]">
                  <a href={whatsappLink("Hello Oman Compass Tours 👋 / مرحباً")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" /> {t("whatsapp")}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${site.phoneE164}`}><Phone className="size-4" /> {t("call")}</a>
                </Button>
              </div>
              <div className="mt-6">
                <p className="mb-2 text-xs text-ink-500">{t("follow")}</p>
                <SocialLinks iconClassName="border-sand-200 bg-sand-50 text-ink-500 hover:border-gold-500 hover:text-gold-700" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src="/media/placeholders/office-1.jpg" alt={t("officePhoto1")} fill sizes="25vw" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src="/media/placeholders/office-2.jpg" alt={t("officePhoto2")} fill sizes="25vw" className="object-cover" />
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="rounded-xl border border-sand-200 bg-white p-6 sm:p-8">
            <h2 className="font-heading text-xl text-navy-950">{t("formTitle")}</h2>
            <p className="mt-1 text-sm text-ink-500">{t("formDescription")}</p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>

        <div className="container-brand mt-10">
          <MapEmbed className="h-96" title={t("mapTitle")} query="Oman Compass Tours, Bawshar, Muscat, Oman" />
        </div>
      </section>
    </>
  );
}
