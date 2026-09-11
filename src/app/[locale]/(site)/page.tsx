import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CompassWatermark } from "@/components/brand/compass-rose";
import { Logo } from "@/components/brand/logo";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home.hero");

  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden surface-dark">
      <CompassWatermark opacity={0.06} />
      <div className="container-brand relative z-10 flex flex-col items-center py-32 text-center">
        <div className="w-40 sm:w-56">
          <Logo variant="full" priority />
        </div>
        <p className="eyebrow mt-8">{t("eyebrow")}</p>
        <h1 className="heading-brand mt-4 max-w-3xl font-heading text-4xl leading-tight text-sand-50 sm:text-5xl lg:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-2xl font-editorial text-xl text-sand-100/80 sm:text-2xl">{t("subtitle")}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-gold-gradient px-8 font-semibold text-navy-950 shadow-gold hover:brightness-110">
            <Link href="/tours">{t("exploreTours")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-gold-500/60 bg-transparent px-8 text-sand-50 hover:bg-navy-900 hover:text-gold-400">
            <Link href="/plan-my-trip">{t("planMyTrip")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
