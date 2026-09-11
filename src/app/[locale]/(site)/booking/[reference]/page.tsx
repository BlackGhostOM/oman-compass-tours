import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmationView } from "@/components/booking/confirmation-view";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; reference: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, reference } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return { title: `${t("metaTitle")} ${reference.toUpperCase()}`, robots: { index: false } };
}

export default async function BookingConfirmationPage({ params, searchParams }: Props) {
  const { locale, reference } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  if (!token) notFound();
  return (
    <div className="surface-sand pt-24 pb-16">
      <div className="container-brand">
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <ConfirmationView reference={reference.toUpperCase()} token={token} />
        </Suspense>
      </div>
    </div>
  );
}
