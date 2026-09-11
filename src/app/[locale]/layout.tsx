import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Direction } from "radix-ui";
import { Analytics } from "@vercel/analytics/next";

import "../globals.css";
import { routing, dirFor } from "@/i18n/routing";
import { arabicFontClasses, latinFontClasses } from "@/lib/fonts";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(site.url),
    title: {
      default: t("defaultTitle"),
      template: `%s · ${site.shortName}`,
    },
    description: t("defaultDescription"),
    applicationName: site.shortName,
    openGraph: {
      type: "website",
      siteName: site.shortName,
      locale: locale === "ar" ? "ar_OM" : "en_US",
      images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: "summary_large_image" },
    alternates: {
      languages: { en: "/en", ar: "/ar", "x-default": "/en" },
    },
    icons: {
      icon: "/icon.png",
      apple: "/apple-icon.png",
    },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#0E0B2E",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = dirFor(locale);
  const messages = await getMessages();

  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang={locale}
        dir={dir}
        className={cn(latinFontClasses, locale === "ar" && arabicFontClasses)}
        suppressHydrationWarning
      >
        <body className="flex min-h-dvh flex-col">
          <ConvexClientProvider>
            <NextIntlClientProvider messages={messages}>
              <Direction.Provider dir={dir}>
                {children}
                <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
              </Direction.Provider>
            </NextIntlClientProvider>
          </ConvexClientProvider>
          <Analytics />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
