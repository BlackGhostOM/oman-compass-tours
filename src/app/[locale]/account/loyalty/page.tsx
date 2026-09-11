"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { formatOmr } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompassRose } from "@/components/brand/compass-rose";

export default function LoyaltyPage() {
  const locale = useLocale();
  const t = useTranslations("account.loyalty");
  const data = useQuery(api.account.loyalty);
  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  const referralUrl = data.referralCode ? `${site.url}/${locale}/tours?ref=${data.referralCode}` : null;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-navy-800 bg-navy-950 p-6 text-sand-50 sm:col-span-2">
          <CompassRose className="absolute -end-10 -top-10 size-48 opacity-10" strokeWidth={0.7} />
          <p className="eyebrow">{t(`tiers.${data.tier}`)}</p>
          <p className="mt-2 font-heading text-5xl text-gold-400">{data.points}</p>
          <p className="text-sm text-sand-100/70">{t("points")}</p>
          <p className="mt-4 text-xs text-sand-100/60">{t("rule")}</p>
        </div>
        <div className="grid gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("spent")}</p>
            <p className="mt-1 font-heading text-xl text-foreground" dir="ltr">{formatOmr(data.spentOmr, locale, { compact: true })}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("completed")}</p>
            <p className="mt-1 font-heading text-xl text-foreground">{data.completedTours}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3"><Gift className="size-6 text-gold-500" /><h3 className="font-heading text-lg text-foreground">{t("referralTitle")}</h3></div>
        <p className="mt-2 text-sm text-muted-foreground">{t("referralBody")}</p>
        {referralUrl && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <code className="flex-1 truncate rounded-lg border border-border bg-muted px-3 py-2 text-sm" dir="ltr">{referralUrl}</code>
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(referralUrl); toast.success(t("copied")); }}><Copy className="size-4" /> {t("copy")}</Button>
            <Button asChild className="bg-[#25D366] text-navy-950 hover:bg-[#1ebe5b]"><a href={`https://wa.me/?text=${encodeURIComponent(`${t("shareText")} ${referralUrl}`)}`} target="_blank" rel="noopener noreferrer"><Share2 className="size-4" /> WhatsApp</a></Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("placeholderNote")}</p>
      </div>
    </div>
  );
}
