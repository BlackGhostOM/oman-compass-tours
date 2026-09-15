import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle, Mail } from "lucide-react";
import { FAQ } from "../../../../../convex/lib/faq";
import { Link } from "@/i18n/navigation";
import { site, whatsappLink } from "@/lib/site";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { JsonLd } from "@/components/shared/json-ld";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: `/${locale}/faq`, languages: { en: "/en/faq", ar: "/ar/faq" } },
  };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const l = locale === "ar" ? "ar" : "en";
  let n = 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((group) => group.items.map((i) => ({ "@type": "Question", name: i.q[l], acceptedAnswer: { "@type": "Answer", text: i.a[l] } }))),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className="relative overflow-hidden surface-dark pt-32 pb-14">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
        </div>
      </section>

      <section className="surface-sand py-12 sm:py-16">
        <div className="container-brand grid gap-10 lg:grid-cols-[16rem_1fr]">
          <nav aria-label={t("sections")} className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow mb-3">{t("sections")}</p>
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {FAQ.map((group) => (
                <li key={group.key}>
                  <a href={`#${group.key}`} className="inline-block rounded-md border border-sand-200 bg-white px-3 py-1.5 text-sm text-ink-900 transition hover:border-gold-500 hover:text-gold-700 lg:w-full">
                    {group.title[l]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            {FAQ.map((group) => (
              <div key={group.key} id={group.key} className="scroll-mt-28">
                <h2 className="font-heading text-2xl text-navy-950">{group.title[l]}</h2>
                <Accordion type="multiple" className="mt-4 rounded-xl border border-sand-200 bg-white px-5">
                  {group.items.map((item) => {
                    n += 1;
                    return (
                      <AccordionItem key={item.q.en} value={`${group.key}-${n}`}>
                        <AccordionTrigger className="text-start text-base font-medium text-navy-950 hover:no-underline">
                          <span className="flex gap-3">
                            <span className="w-7 shrink-0 font-heading text-gold-700" dir="ltr">{n}.</span>
                            <span>{item.q[l]}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="ps-10 text-base leading-relaxed text-ink-500">{item.a[l]}</AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            ))}

            <div className="rounded-xl border border-gold-500/40 bg-navy-950 p-6 text-sand-50 sm:p-8">
              <h2 className="font-heading text-2xl text-gold-400">{t("ctaTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sand-100/80">{t("ctaBody")}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild className="bg-[#25D366] text-navy-950 hover:bg-[#1ebe5b]">
                  <a href={whatsappLink("Hello Oman Compass Tours 👋 I have a question. / مرحباً، لديّ سؤال.")} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> {t("ctaWhatsapp")}</a>
                </Button>
                <Button asChild variant="outline" className="border-gold-500/50 bg-transparent text-sand-50 hover:bg-navy-900">
                  <Link href="/contact"><Mail className="size-4" /> {t("ctaContact")}</Link>
                </Button>
                <a href={`tel:${site.phoneE164}`} dir="ltr" className="self-center text-sm text-gold-400 underline-offset-4 hover:underline">{site.phoneDisplay}</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
