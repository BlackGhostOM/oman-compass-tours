"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { analyticsIds, OPEN_CONSENT_EVENT, readConsent, writeConsent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * Cookie consent banner. Shown until the visitor makes a choice; reopened
 * from the footer "Cookie settings" link. Nothing non-essential loads before
 * an explicit opt-in.
 */
export function ConsentBanner() {
  const t = useTranslations("consent");
  // null = not hydrated yet: the markup is rendered and CSS (html[data-consent="pending"]) decides visibility,
  // so first-time visitors see the banner in the first paint and returning visitors never see a flash.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const hasPixels = Boolean(analyticsIds.ga4 || analyticsIds.meta || analyticsIds.snap || analyticsIds.tiktok);

  useEffect(() => {
    const existing = readConsent();
    if (existing) {
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
      setVisible(false);
    } else {
      setVisible(true);
    }
    const reopen = () => {
      setManage(true);
      setVisible(true);
      document.documentElement.setAttribute("data-consent", "pending");
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (visible === false) return null;

  const decide = (choice: { analytics: boolean; marketing: boolean }) => {
    writeConsent(choice);
    document.documentElement.removeAttribute("data-consent");
    setVisible(false);
    setManage(false);
  };

  return (
    <div role="dialog" aria-labelledby="consent-title" aria-describedby="consent-body" className="consent-banner fixed inset-x-3 bottom-3 z-50 max-w-md rounded-xl border border-gold-500/40 bg-navy-950 p-4 text-sand-50 shadow-2xl sm:start-5 sm:inset-x-auto">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-navy-950" aria-hidden><Cookie className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p id="consent-title" className="font-heading text-base text-gold-400">{t("title")}</p>
          <p id="consent-body" className="mt-1 text-xs leading-relaxed text-sand-100/80">
            <span className="sm:hidden">{t("short")} </span>
            <span className="hidden sm:inline">{t("body")} </span>
            <Link href="/policies/privacy" className="text-gold-400 underline underline-offset-4">{t("policy")}</Link>
          </p>
          {!hasPixels && <p className="mt-1 text-[11px] text-sand-100/50">{t("noPixels")}</p>}
        </div>
      </div>
      {manage && (
        <div className="mt-3 space-y-2 rounded-lg border border-navy-800 bg-navy-900 p-3 text-xs">
          <label className="flex items-center justify-between gap-3">
            <span><span className="block font-medium text-sand-50">{t("analytics")}</span><span className="text-sand-100/60">{t("analyticsHint")}</span></span>
            <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label={t("analytics")} />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span><span className="block font-medium text-sand-50">{t("marketing")}</span><span className="text-sand-100/60">{t("marketingHint")}</span></span>
            <Switch checked={marketing} onCheckedChange={setMarketing} aria-label={t("marketing")} />
          </label>
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {manage ? (
          <Button size="sm" variant="outline" className="border-navy-700 bg-transparent text-sand-50 hover:bg-navy-900" onClick={() => decide({ analytics, marketing })}>{t("save")}</Button>
        ) : (
          <Button size="sm" variant="ghost" className="text-sand-100/80 hover:bg-navy-900 hover:text-sand-50" onClick={() => setManage(true)}>{t("manage")}</Button>
        )}
        <Button size="sm" variant="outline" className="border-navy-700 bg-transparent text-sand-50 hover:bg-navy-900" onClick={() => decide({ analytics: false, marketing: false })}>{t("reject")}</Button>
        <Button size="sm" className="bg-gold-gradient font-semibold text-navy-950" onClick={() => decide({ analytics: true, marketing: true })}>{t("accept")}</Button>
      </div>
    </div>
  );
}
