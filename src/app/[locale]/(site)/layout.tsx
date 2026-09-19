import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SupportFab } from "@/components/layout/support-fab";
import { PreviewNotice } from "@/components/site/preview-notice";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  return (
    // Skip link: invisible until a keyboard user tabs to it (focus-visible), so a tap on the logo never reveals it
    <>
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-gold-500 focus-visible:px-4 focus-visible:py-2 focus-visible:text-navy-950"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <SupportFab />
      <PreviewNotice />
    </>
  );
}
