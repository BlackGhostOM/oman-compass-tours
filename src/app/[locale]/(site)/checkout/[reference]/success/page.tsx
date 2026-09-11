import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentStatus } from "@/components/booking/payment-status";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; reference: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout.status" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function CheckoutSuccessPage({ params, searchParams }: Props) {
  const { locale, reference } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  if (!token) notFound();
  return (
    <div className="surface-sand pt-28 pb-16">
      <div className="container-brand max-w-2xl">
        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <PaymentStatus reference={reference.toUpperCase()} token={token} />
        </Suspense>
      </div>
    </div>
  );
}
