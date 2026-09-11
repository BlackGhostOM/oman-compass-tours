import { useLocale, useTranslations } from "next-intl";
import { formatMoney, formatOmr } from "@/lib/content";
import { cn } from "@/lib/utils";

const USD_RATE = 2.6008;

/** Price in OMR with a USD reference line. */
export function PriceTag({
  baisa,
  pricingModel,
  compareAt,
  size = "md",
  className,
  showFrom = true,
  tone = "light",
}: {
  baisa: number;
  pricingModel: "per_group" | "per_person";
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showFrom?: boolean;
  tone?: "light" | "dark";
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const dark = tone === "dark";
  const main = { sm: "text-base", md: "text-xl", lg: "text-3xl" }[size];
  return (
    <div className={cn("leading-tight", className)}>
      {showFrom && <span className={cn("block text-xs", dark ? "text-sand-100/60" : "text-ink-500")}>{t("from")}</span>}
      <span className={cn("font-heading font-semibold", main, dark ? "text-gold-400" : "text-navy-950")} dir="ltr">
        {formatOmr(baisa, locale, { compact: true })}
      </span>
      {compareAt && compareAt > baisa && (
        <span className={cn("ms-2 text-sm line-through", dark ? "text-sand-100/50" : "text-ink-300")} dir="ltr">
          {formatOmr(compareAt, locale, { compact: true })}
        </span>
      )}
      <span className={cn("block text-xs", dark ? "text-sand-100/60" : "text-ink-500")}>
        {pricingModel === "per_group" ? t("perGroup") : t("perAdult")} ·{" "}
        <span dir="ltr">≈ {formatMoney((baisa / 1000) * USD_RATE, "USD", locale)}</span>
      </span>
    </div>
  );
}
