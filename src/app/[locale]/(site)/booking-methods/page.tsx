import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Building2, Check, Globe, Mail, MessageCircle, Minus, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { site, whatsappLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookingMethods" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const methods = [
  { key: "online", Icon: Globe, href: "/tours", external: false },
  { key: "whatsapp", Icon: MessageCircle, href: whatsappLink("Hello Oman Compass Tours 👋 I would like to book a tour. / مرحباً، أرغب في حجز جولة."), external: true },
  { key: "phone", Icon: Phone, href: `tel:${site.phoneE164}`, external: true },
  { key: "email", Icon: Mail, href: `mailto:${site.email}?subject=Booking%20enquiry`, external: true },
  { key: "office", Icon: Building2, href: site.mapsDirectionsUrl, external: true },
] as const;

const features = ["instantConfirmation", "securePayment", "freeCancellation", "customItinerary", "payLater", "voucher"] as const;
const matrix: Record<(typeof features)[number], Record<(typeof methods)[number]["key"], boolean>> = {
  instantConfirmation: { online: true, whatsapp: false, phone: false, email: false, office: true },
  securePayment: { online: true, whatsapp: true, phone: true, email: true, office: true },
  freeCancellation: { online: true, whatsapp: true, phone: true, email: true, office: true },
  customItinerary: { online: false, whatsapp: true, phone: true, email: true, office: true },
  payLater: { online: true, whatsapp: true, phone: true, email: true, office: false },
  voucher: { online: true, whatsapp: true, phone: true, email: true, office: true },
};

export default async function BookingMethodsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bookingMethods");

  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-16">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>

      <section className="surface-sand py-14">
        <div className="container-brand">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {methods.map(({ key, Icon, href, external }) => (
              <div key={key} className="flex flex-col rounded-xl border border-sand-200 bg-white p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-gold-gradient text-navy-950"><Icon className="size-5" /></div>
                <h2 className="mt-4 font-heading text-lg text-navy-950">{t(`methods.${key}.title`)}</h2>
                <p className="mt-2 flex-1 text-sm text-ink-500">{t(`methods.${key}.body`)}</p>
                <p className="mt-3 text-xs text-ink-500">{t(`methods.${key}.hours`)}</p>
                <Button asChild className="mt-4 bg-navy-950 text-gold-400 hover:bg-navy-800">
                  {external ? (
                    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{t(`methods.${key}.cta`)}</a>
                  ) : (
                    <Link href={href}>{t(`methods.${key}.cta`)}</Link>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <h2 className="mt-16 font-heading text-2xl text-navy-950">{t("compareTitle")}</h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-sand-200 bg-white">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-sand-100 text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("feature")}</th>
                  {methods.map((m) => (
                    <th key={m.key} className="px-4 py-3 text-center font-medium">{t(`methods.${m.key}.title`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {features.map((f) => (
                  <tr key={f}>
                    <td className="px-4 py-3 text-ink-900">{t(`features.${f}`)}</td>
                    {methods.map((m) => (
                      <td key={m.key} className="px-4 py-3 text-center">
                        {matrix[f][m.key] ? <Check className="mx-auto size-4 text-success" aria-label={t("yes")} /> : <Minus className="mx-auto size-4 text-ink-300" aria-label={t("no")} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 rounded-xl border border-gold-500/40 bg-navy-950 p-8 text-center text-sand-50">
            <h2 className="font-heading text-2xl">{t("ctaTitle")}</h2>
            <p className="mt-2 text-sand-100/75">{t("ctaBody")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-gold-gradient font-semibold text-navy-950"><Link href="/tours">{t("ctaTours")}</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-gold-500/60 bg-transparent text-sand-50 hover:bg-navy-900 hover:text-gold-400"><Link href="/plan-my-trip">{t("ctaPlan")}</Link></Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
