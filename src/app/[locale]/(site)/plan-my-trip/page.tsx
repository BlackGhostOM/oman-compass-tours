import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { TripPlannerForm } from "@/components/forms/trip-planner-form";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassPoint, CompassWatermark } from "@/components/brand/compass-rose";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "planner" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PlanMyTripPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("planner");
  const steps = ["tell", "design", "refine", "go"] as const;

  return (
    <>
      <section className="relative overflow-hidden surface-dark pt-32 pb-16">
        <CompassWatermark opacity={0.05} />
        <div className="container-brand relative">
          <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" align="start" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s} className="card-dark p-5">
                <div className="flex items-center gap-2"><CompassPoint point={(["N", "E", "S", "W"] as const)[i]} /><span className="font-heading text-sm text-gold-400">0{i + 1}</span></div>
                <h2 className="mt-2 font-heading text-base text-sand-50">{t(`steps.${s}.title`)}</h2>
                <p className="mt-1 text-sm text-sand-100/70">{t(`steps.${s}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="surface-sand py-14">
        <div className="container-brand grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div className="rounded-xl border border-sand-200 bg-white p-6 sm:p-10">
            <TripPlannerForm />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-sand-200 bg-white p-5">
              <h2 className="font-heading text-lg text-navy-950">{t("preferChat")}</h2>
              <p className="mt-1 text-sm text-ink-500">{t("preferChatBody")}</p>
              <Button asChild className="mt-4 w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={whatsappLink("Hello Oman Compass Tours 👋 I would like help planning a trip. / مرحباً، أرغب في المساعدة لتخطيط رحلة.")} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
              <a href={`tel:${site.phoneE164}`} dir="ltr" className="mt-3 block text-center text-sm text-gold-600">{site.phoneDisplay}</a>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
