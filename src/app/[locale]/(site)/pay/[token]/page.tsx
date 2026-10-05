"use client";

import { use, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertTriangle, CheckCircle2, CreditCard, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatDate, formatOmr, pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderPicker, type Currency, type ProviderId } from "@/components/booking/provider-picker";

/**
 * Public page for staff-issued payment links (WhatsApp / phone bookings). Pays the link's amount (capped at what is
 * still owed) straight from here, the balance of a confirmed booking included (payments.startLinkCheckout).
 */
export default function PaymentLinkPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { token } = use(params);
  const { cancelled } = use(searchParams);
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("checkout");
  const link = useQuery(api.payments.paymentLinkByToken, { token });
  const options = useQuery(api.payments.checkoutOptions, {});
  const startLinkCheckout = useAction(api.payments.startLinkCheckout);
  const [provider, setProvider] = useState<ProviderId>("stripe");
  const [currency, setCurrency] = useState<Currency>("OMR");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (options) setProvider(options.defaultProvider as ProviderId);
  }, [options]);

  async function pay() {
    setBusy(true);
    try {
      const result = await startLinkCheckout({ token, provider, currency, locale, origin: window.location.origin });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; message?: string }) : undefined;
      toast.error(
        data?.code === "HOLD_EXPIRED" ? t("errors.holdExpired")
        : data?.code === "LINK_EXPIRED" ? t("errors.linkExpired")
        : data?.code === "PROVIDER_NOT_CONFIGURED" ? t("errors.notConfigured")
        : data?.code === "PROVIDER_ERROR" ? `${t("errors.provider")} ${data.message ?? ""}`
        : t("errors.generic"),
      );
      setBusy(false);
    }
  }

  const whatsappHref = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(link ? `Booking ${link.reference}` : "Payment link")}`;
  const notice = (tone: "danger" | "success", title: string, body?: string) => (
    <div className={`rounded-xl border bg-white p-8 text-center ${tone === "success" ? "border-success/40" : "border-danger/40"}`}>
      {tone === "success" ? <CheckCircle2 className="mx-auto size-10 text-success" /> : <AlertTriangle className="mx-auto size-10 text-danger" />}
      <p className="mt-3 font-heading text-navy-950">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-prose text-sm text-ink-500">{body}</p>}
      <Button asChild variant="outline" className="mt-4"><a href={whatsappHref} target="_blank" rel="noopener noreferrer">{t("whatsapp")}</a></Button>
    </div>
  );

  return (
    <div className="surface-sand pt-28 pb-16">
      <div className="container-brand max-w-xl">
        {link === undefined ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : link === null ? (
          <div className="rounded-xl border border-danger/40 bg-white p-8 text-center">
            <AlertTriangle className="mx-auto size-10 text-danger" />
            <p className="mt-3 font-heading text-navy-950">{t("notFound")}</p>
            <Button asChild className="mt-4"><Link href="/contact">{t("browseTours")}</Link></Button>
          </div>
        ) : link.used ? (
          notice("success", t("linkPaid"))
        ) : link.settled ? (
          notice("success", t("linkSettled"))
        ) : link.expired ? (
          notice("danger", t("linkExpired"), t("linkExpiredBody"))
        ) : !link.payable ? (
          notice("danger", t("linkUnpayable"), t("linkUnpayableBody"))
        ) : (
          <div className="space-y-6 rounded-xl border border-sand-200 bg-white p-5 sm:p-8">
            <div className="text-center">
              <CreditCard className="mx-auto size-10 text-gold-500" />
              <p className="eyebrow mt-4">{t("eyebrow")}</p>
              <h1 className="mt-2 font-heading text-2xl text-navy-950">{pick(link.tourTitle, locale)}</h1>
              <p className="mt-1 text-sm text-ink-500">{formatDate(link.date, locale)} · {link.reference}</p>
              {link.description && <p className="mt-2 text-sm text-ink-500">{link.description}</p>}
              <p className="mt-4 font-heading text-3xl text-navy-950" dir="ltr">{formatOmr(link.amountOmr, locale)}</p>
            </div>
            {cancelled && <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-ink-900">{t("paymentCancelled")}</p>}
            <ProviderPicker
              amountBaisa={link.amountOmr}
              rates={options?.rates ?? {}}
              providers={(options?.providers ?? []) as ProviderId[]}
              provider={provider}
              currency={currency}
              onChange={(p, c) => {
                setProvider(p);
                setCurrency(c);
              }}
              disabledReason={options && options.providers.length === 0 ? t("errors.notConfigured") : undefined}
            />
            <div className="flex items-center gap-3 rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs text-ink-500">
              <LockKeyhole className="size-4 shrink-0 text-success" /> {t("secure")}
            </div>
            <Button size="lg" disabled={busy || !options || !options.providers.includes(provider)} onClick={() => void pay()} className="w-full bg-gold-gradient text-base font-semibold text-navy-950 shadow-gold">
              {busy ? t("redirecting") : t("payCta", { provider: t(`providers.${provider}.name`) })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
