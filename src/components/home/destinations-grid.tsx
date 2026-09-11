import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pick, type LocalizedString } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/section-heading";

type Destination = {
  key: string;
  name: LocalizedString;
  slug: LocalizedString;
  tagline: LocalizedString | null;
  image: { url?: string; alt: LocalizedString } | null;
  count: number;
};

export async function DestinationsGrid({ destinations, compact = false }: { destinations: Destination[]; compact?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations("home.destinations");
  const tc = await getTranslations("common");
  if (destinations.length === 0) return null;

  return (
    <section className={cn("surface-sand", compact ? "py-0" : "py-20 sm:py-24")}>
      <div className="container-brand">
        {!compact && <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />}
        <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", !compact && "mt-12")}>
          {destinations.map((d, i) => (
            <Link
              key={d.key}
              href={`/destinations/${pick(d.slug, locale)}`}
              className={cn(
                "group relative block overflow-hidden rounded-xl",
                i === 0 && !compact ? "sm:col-span-2 sm:row-span-2 aspect-[4/3] sm:aspect-auto" : "aspect-[4/3]",
              )}
            >
              <Image
                src={d.image?.url ?? "/media/placeholders/hero.jpg"}
                alt={pick(d.image?.alt, locale) || pick(d.name, locale)}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="heading-brand font-heading text-xl text-sand-50">{pick(d.name, locale)}</h3>
                    {d.tagline && <p className="mt-1 line-clamp-1 text-sm text-sand-100/75">{pick(d.tagline, locale)}</p>}
                    <p className="mt-1 text-xs text-gold-400">{t("tourCount", { count: d.count })}</p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold-500/50 text-gold-400 transition group-hover:bg-gold-500 group-hover:text-navy-950">
                    <ArrowUpRight className="size-4 rtl-flip" aria-hidden="true" />
                    <span className="sr-only">{tc("learnMore")}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
