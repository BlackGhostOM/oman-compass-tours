"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const labels: Record<Locale, { native: string; short: string }> = {
  en: { native: "English", short: "EN" },
  ar: { native: "العربية", short: "ع" },
};

/**
 * Switches locale while keeping the user on the same page
 * (dynamic params such as `[slug]` are preserved).
 */
export function LanguageSwitcher({ className, variant = "ghost" }: { className?: string; variant?: "ghost" | "outline" }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("language");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- params are forwarded for dynamic segments
        { pathname, params },
        { locale: next },
      );
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          aria-label={`${t("switch")}: ${labels[locale].short}`} title={`${t("switch")}: ${labels[locale].short}`}
          disabled={isPending}
          className={cn("gap-1.5 text-sand-100 hover:bg-navy-800 hover:text-gold-400", className)}
        >
          <Languages className="size-4" />
          <span className="font-medium">{labels[locale].short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onSelect={() => switchTo(l)}
            lang={l}
            dir={l === "ar" ? "rtl" : "ltr"}
            className={cn("justify-between", l === locale && "font-semibold text-gold-700")}
          >
            <span>{labels[l].native}</span>
            <span className="text-xs text-muted-foreground">{labels[l].short}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
