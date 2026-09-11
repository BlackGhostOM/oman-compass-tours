import { defineRouting } from "next-intl/routing";

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export const isRtl = (locale: string) => locale === "ar";
export const dirFor = (locale: string): "rtl" | "ltr" => (isRtl(locale) ? "rtl" : "ltr");
