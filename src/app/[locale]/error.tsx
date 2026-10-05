"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CompassRose } from "@/components/brand/compass-rose";

/** Recoverable error page for anything under /[locale], instead of a blank screen. */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.boundary");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center surface-dark px-6 text-center">
      <CompassRose className="size-24 opacity-70" />
      <h1 className="mt-8 font-heading text-3xl text-sand-50">{t("title")}</h1>
      <p className="mt-3 max-w-md text-sand-100/70">{t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} className="bg-gold-gradient text-navy-950">{t("retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
