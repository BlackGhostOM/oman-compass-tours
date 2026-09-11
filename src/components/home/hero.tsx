import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pick, type LocalizedString } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { CompassWatermark } from "@/components/brand/compass-rose";

export async function Hero({
  banner,
  videoUrl,
  posterUrl,
}: {
  banner: { title?: LocalizedString; subtitle?: LocalizedString; ctaLabel?: LocalizedString; ctaHref?: string } | null;
  videoUrl: string | null;
  posterUrl: string;
}) {
  const locale = await getLocale();
  const t = await getTranslations("home.hero");
  const title = pick(banner?.title, locale) || t("title");
  const subtitle = pick(banner?.subtitle, locale) || t("subtitle");

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden surface-dark">
      {/* Background media */}
      <div className="absolute inset-0">
        {videoUrl ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={posterUrl}
            aria-hidden="true"
          >
            <source src={videoUrl} />
          </video>
        ) : (
          <Image src={posterUrl} alt="" fill priority sizes="100vw" className="animate-slow-zoom object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/55 to-navy-950" />
      </div>
      <CompassWatermark opacity={0.06} />

      <div className="container-brand relative z-10 flex flex-col items-center pt-32 pb-24 text-center">
        <Image src="/brand/logo-mark.png" alt="" width={522} height={522} priority className="size-24 rounded-full ring-1 ring-gold-500/40 sm:size-28" />
        <p className="eyebrow mt-8 animate-fade-up">{t("eyebrow")}</p>
        <h1 className="heading-brand mt-4 max-w-4xl animate-fade-up font-heading text-4xl leading-[1.1] text-sand-50 [animation-delay:80ms] sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl animate-fade-up font-editorial text-xl text-sand-100/85 [animation-delay:160ms] sm:text-2xl">
          {subtitle}
        </p>
        <div className="mt-10 flex animate-fade-up flex-col gap-3 [animation-delay:240ms] sm:flex-row">
          <Button asChild size="lg" className="h-12 bg-gold-gradient px-8 text-base font-semibold text-navy-950 shadow-gold hover:brightness-110">
            <Link href={banner?.ctaHref ?? "/tours"}>{pick(banner?.ctaLabel, locale) || t("exploreTours")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 border-gold-500/60 bg-navy-950/40 px-8 text-base text-sand-50 backdrop-blur hover:bg-navy-900 hover:text-gold-400">
            <Link href="/plan-my-trip">{t("planMyTrip")}</Link>
          </Button>
        </div>

        <a
          href={site.tripadvisor.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 inline-flex animate-fade-up items-center gap-3 rounded-full border border-gold-500/30 bg-navy-950/60 py-2 pe-5 ps-3 text-sm text-sand-100/85 backdrop-blur transition [animation-delay:320ms] hover:border-gold-500/70"
        >
          <span className="flex items-center gap-0.5 text-gold-400" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-current" />
            ))}
          </span>
          <span>{t("ratingBadge", { rating: "5.0", count: site.tripadvisor.reviewCount, position: site.tripadvisor.rank.position })}</span>
        </a>
      </div>

      <a
        href="#featured"
        aria-label={t("scroll")}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 animate-bounce text-gold-500/80"
      >
        <ChevronDown className="size-7" />
      </a>
    </section>
  );
}
