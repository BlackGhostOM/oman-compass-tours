"use client";

import { use } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { AlertTriangle, CreditCard } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatDate, formatOmr, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Public landing page for staff-issued payment links (WhatsApp / phone bookings). */
export default function PaymentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const locale = useLocale();
  const t = useTranslations("checkout");
  const link = useQuery(api.payments.paymentLinkByToken, { token });

  return (
    <div className="surface-sand pt-28 pb-16">
      <div className="container-brand max-w-xl">
        {link === undefined ? <Skeleton className="h-64 rounded-xl" /> : link === null || link.expired ? (
          <div className="rounded-xl border border-danger/40 bg-white p-8 text-center">
            <AlertTriangle className="mx-auto size-10 text-danger" />
            <p className="mt-3 font-heading text-navy-950">{link === null ? t("notFound") : t("cancelled")}</p>
            <Button asChild className="mt-4"><Link href="/contact">{t("browseTours")}</Link></Button>
          </div>
        ) : (
          <div className="rounded-xl border border-sand-200 bg-white p-8 text-center">
            <CreditCard className="mx-auto size-10 text-gold-500" />
            <p className="eyebrow mt-4">{t("eyebrow")}</p>
            <h1 className="mt-2 font-heading text-2xl text-navy-950">{pick(link.tourTitle, locale)}</h1>
            <p className="mt-1 text-sm text-ink-500">{formatDate(link.date, locale)} · {link.reference}</p>
            {link.description && <p className="mt-2 text-sm text-ink-500">{link.description}</p>}
            <p className="mt-4 font-heading text-3xl text-navy-950" dir="ltr">{formatOmr(link.amountOmr, locale)}</p>
            {link.used ? (
              <p className="mt-4 text-sm text-success">{t("alreadyConfirmed")}</p>
            ) : (
              <Button asChild size="lg" className="mt-6 bg-gold-gradient font-semibold text-navy-950 shadow-gold">
                <Link href={`/checkout/${link.reference}?t=${link.voucherToken}`}>{t("payLinkCta")}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
