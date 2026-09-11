import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutPanel } from "@/components/booking/checkout-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; reference: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { locale, reference } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  if (!token) notFound();
  const t = await getTranslations("checkout");
  return (
    <div className="surface-sand pt-24 pb-16">
      <div className="container-brand">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="heading-brand mt-2 font-heading text-2xl text-navy-950 sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle", { reference: reference.toUpperCase() })}</p>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
            <CheckoutPanel reference={reference.toUpperCase()} token={token} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
