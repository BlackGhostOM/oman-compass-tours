import { getTranslations } from "next-intl/server";
import { BadgeCheck, Car, Gem, HeartHandshake, MapPinned, ShieldCheck, SlidersHorizontal, Tags } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

const items = [
  { key: "hidden", Icon: Gem },
  { key: "guides", Icon: MapPinned },
  { key: "comfort", Icon: Car },
  { key: "flexible", Icon: SlidersHorizontal },
  { key: "service", Icon: HeartHandshake },
  { key: "pricing", Icon: Tags },
] as const;

export async function WhyUs() {
  const t = await getTranslations("home.why");
  return (
    <section className="cv-auto relative overflow-hidden surface-dark py-20 sm:py-24">
      <CompassWatermark opacity={0.04} className="translate-x-1/3" />
      <div className="container-brand relative">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ key, Icon }) => (
            <div key={key} className="card-dark group p-6 transition hover:border-gold-500/60">
              <div className="flex size-12 items-center justify-center rounded-lg bg-gold-gradient text-navy-950 shadow-gold">
                <Icon className="size-6" />
              </div>
              <h3 className="mt-5 font-heading text-lg text-sand-50">{t(`items.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-100/70">{t(`items.${key}.body`)}</p>
              <div className="hairline mt-5 w-12 opacity-60 transition group-hover:w-full" />
            </div>
          ))}
        </div>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-sand-100/75">
          <li className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-gold-400" /> {t("trust.licensed")}</li>
          <li className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-gold-400" /> {t("trust.insured")}</li>
          <li className="inline-flex items-center gap-2"><MapPinned className="size-4 text-gold-400" /> {t("trust.guides")}</li>
        </ul>
      </div>
    </section>
  );
}
