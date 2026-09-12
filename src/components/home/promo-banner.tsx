"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { pick, type LocalizedString } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PromoBanner = {
  _id: string;
  key: string;
  title?: LocalizedString;
  subtitle?: LocalizedString;
  ctaLabel?: LocalizedString;
  ctaHref?: string;
  countdownTo?: number;
  endsAt?: number;
};

/** Marketing strip under the hero: seasonal offer with an optional live countdown. */
export function PromoBannerStrip({ promos }: { promos: PromoBanner[] }) {
  const locale = useLocale();
  const t = useTranslations("home.promo");
  const promo = promos[0];
  const target = promo?.countdownTo ?? promo?.endsAt ?? null;
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!promo) return null;
  const title = pick(promo.title, locale);
  if (!title) return null;
  const parts = remaining !== null ? split(remaining) : null;
  const href = promo.ctaHref ?? "/tours";

  return (
    <section aria-label={title} className="bg-navy-900 text-sand-50">
      <div className="container-brand flex flex-col items-center gap-4 py-5 md:flex-row md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-navy-950" aria-hidden><Sparkles className="size-5" /></span>
          <div>
            <p className="font-heading text-xl leading-normal text-gold-400 sm:text-2xl">{title}</p>
            {pick(promo.subtitle, locale) && <p className={cn("text-sm leading-relaxed text-sand-100/75", locale === "ar" ? "mt-3" : "mt-1.5")}>{pick(promo.subtitle, locale)}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {parts && remaining! > 0 && (
            <div className="flex items-center gap-2" role="timer" aria-label={t("endsIn")}>
              <span className="text-xs uppercase tracking-wider text-sand-100/60">{t("endsIn")}</span>
              <div className="flex gap-1.5" dir="ltr">
                {(["days", "hours", "minutes", "seconds"] as const).map((unit) => (
                  <div key={unit} className="min-w-11 rounded-md border border-gold-500/40 bg-navy-950 px-1.5 py-1 text-center">
                    <div className="font-heading text-lg leading-none tabular-nums text-sand-50">{String(parts[unit]).padStart(2, "0")}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wide text-sand-100/60">{t(unit)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button asChild className="bg-gold-gradient font-semibold text-navy-950 shadow-gold">
            {href.startsWith("http") ? <a href={href}>{pick(promo.ctaLabel, locale) || t("cta")}</a> : <Link href={href}>{pick(promo.ctaLabel, locale) || t("cta")}</Link>}
          </Button>
        </div>
      </div>
    </section>
  );
}

function split(ms: number) {
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86_400), hours: Math.floor((s % 86_400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
