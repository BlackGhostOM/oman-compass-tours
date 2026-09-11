import { getTranslations } from "next-intl/server";
import { BadgeCheck, Headset, MapPinned, Sparkles } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { CompassWatermark } from "@/components/brand/compass-rose";

const items = [
  { key: "licensed", Icon: BadgeCheck },
  { key: "guides", Icon: MapPinned },
  { key: "private", Icon: Sparkles },
  { key: "support", Icon: Headset },
] as const;

export async function WhyUs() {
  const t = await getTranslations("home.why");
  return (
    <section className="relative overflow-hidden surface-dark py-20 sm:py-24">
      <CompassWatermark opacity={0.04} className="translate-x-1/3" />
      <div className="container-brand relative">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </section>
  );
}
