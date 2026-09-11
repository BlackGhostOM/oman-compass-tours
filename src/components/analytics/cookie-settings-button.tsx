"use client";

import { useTranslations } from "next-intl";
import { OPEN_CONSENT_EVENT } from "@/lib/analytics";

/** Footer link that reopens the consent banner so visitors can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("consent");
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className={className}>
      {t("settings")}
    </button>
  );
}
