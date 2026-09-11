"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { formatDate, formatOmr, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderPicker, type Currency, type ProviderId } from "@/components/booking/provider-picker";

export function CheckoutPanel({ reference, token }: { reference: string; token: string }) {
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("checkout");
  const params = useSearchParams();
  const booking = useQuery(api.bookings.byReference, { reference, token });
  const options = useQuery(api.payments.checkoutOptions, { country: booking?.traveller.nationality });
  const startCheckout = useAction(api.payments.startCheckout);
  const [provider, setProvider] = useState<ProviderId>((params.get("provider") as ProviderId) || "stripe");
  const [currency, setCurrency] = useState<Currency>(((params.get("currency") as Currency) || (booking?.displayCurrency as Currency) || "OMR"));
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"deposit" | "full">("deposit");
  const autoStarted = useRef(false);

  useEffect(() => {
    if (options && !params.get("provider")) setProvider(options.defaultProvider as ProviderId);
  }, [options, params]);

  const outstanding = booking ? Math.max(0, booking.total - booking.amountPaid) : 0;
  const depositRemaining = booking ? Math.max(0, booking.depositDue - booking.amountPaid) : 0;
  const amount = kind === "deposit" && depositRemaining > 0 && depositRemaining < outstanding ? depositRemaining : outstanding;

  async function pay(p = provider, c = currency) {
    if (!booking) return;
    setBusy(true);
    try {
      const result = await startCheckout({ reference, token, provider: p, currency: c, kind: amount < outstanding ? "deposit" : "full", locale, origin: window.location.origin });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; message?: string }) : undefined;
      toast.error(data?.code === "PROVIDER_NOT_CONFIGURED" ? t("errors.notConfigured") : data?.code === "PROVIDER_ERROR" ? `${t("errors.provider")} ${data.message ?? ""}` : t("errors.generic"));
      setBusy(false);
    }
  }

  // Auto-start when arriving from the wizard with a chosen provider
  useEffect(() => {
    const p = params.get("provider") as ProviderId | null;
    if (p && booking && options && !autoStarted.current && options.providers.includes(p) && booking.status !== "confirmed") {
      autoStarted.current = true;
      void pay(p, (params.get("currency") as Currency) || currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, options]);

  if (booking === undefined) return <Skeleton className="h-96 rounded-xl" />;
  if (booking === null) {
    return (
      <div className="rounded-xl border border-danger/40 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-danger" />
        <h2 className="mt-3 font-heading text-lg text-navy-950">{t("notFound")}</h2>
        <Button asChild className="mt-4"><Link href="/tours">{t("browseTours")}</Link></Button>
      </div>
    );
  }

  if (booking.status === "confirmed" || booking.status === "in_progress" || booking.status === "completed") {
    return (
      <div className="rounded-xl border border-success/40 bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-3 font-heading text-lg text-navy-950">{t("alreadyConfirmed")}</h2>
        <Button asChild className="mt-4 bg-gold-gradient text-navy-950"><Link href={`/booking/${reference}?t=${token}`}>{t("viewBooking")} <ArrowRight className="size-4 rtl-flip" /></Link></Button>
      </div>
    );
  }
  if (booking.status === "cancelled" || booking.status === "refunded") {
    return (
      <div className="rounded-xl border border-sand-200 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-warning" />
        <h2 className="mt-3 font-heading text-lg text-navy-950">{t("cancelled")}</h2>
        <Button asChild className="mt-4"><Link href={`/book/${pick(booking.tour?.slug, locale)}`}>{t("rebook")}</Link></Button>
      </div>
    );
  }

  const holdLeft = booking.holdExpiresAt ? Math.max(0, booking.holdExpiresAt - Date.now()) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6 rounded-xl border border-sand-200 bg-white p-5 sm:p-8">
        {params.get("cancelled") && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-ink-900">{t("paymentCancelled")}</p>
        )}
        {holdLeft !== null && (
          <p className="flex items-center gap-2 text-sm text-ink-500"><Clock className="size-4 text-gold-500" /> {t("holdUntil", { hours: Math.max(1, Math.round(holdLeft / 3_600_000)) })}</p>
        )}

        {depositRemaining > 0 && depositRemaining < outstanding && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setKind("deposit")} aria-pressed={kind === "deposit"} className={`rounded-xl border p-4 text-start ${kind === "deposit" ? "border-gold-500 bg-gold-500/10" : "border-sand-200"}`}>
              <span className="block font-heading text-navy-950">{t("depositOption")}</span>
              <span className="block text-sm text-ink-500" dir="ltr">{formatOmr(depositRemaining, locale)}</span>
            </button>
            <button type="button" onClick={() => setKind("full")} aria-pressed={kind === "full"} className={`rounded-xl border p-4 text-start ${kind === "full" ? "border-gold-500 bg-gold-500/10" : "border-sand-200"}`}>
              <span className="block font-heading text-navy-950">{t("fullOption")}</span>
              <span className="block text-sm text-ink-500" dir="ltr">{formatOmr(outstanding, locale)}</span>
            </button>
          </div>
        )}

        <ProviderPicker
          amountBaisa={amount}
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

        <Button size="lg" disabled={busy || !options || !options.providers.includes(provider) || amount <= 0} onClick={() => pay()} className="w-full bg-gold-gradient text-base font-semibold text-navy-950 shadow-gold sm:w-auto">
          {busy ? t("redirecting") : t("payCta", { provider: t(`providers.${provider}.name`) })}
        </Button>
      </div>

      <aside className="h-fit rounded-xl border border-sand-200 bg-white p-5 text-sm">
        <p className="eyebrow">{t("summary")}</p>
        <h2 className="mt-2 font-heading text-base text-navy-950">{pick(booking.tourTitle, locale)}</h2>
        <p className="mt-1 text-ink-500">{formatDate(booking.date, locale)} · <span dir="ltr">{booking.startTime}</span></p>
        <p className="mt-1 text-ink-500">{booking.reference}</p>
        <dl className="mt-4 space-y-1.5 border-t border-sand-200 pt-4">
          <div className="flex justify-between"><dt className="text-ink-500">{t("total")}</dt><dd dir="ltr" className="font-medium text-ink-900">{formatOmr(booking.total, locale)}</dd></div>
          {booking.amountPaid > 0 && <div className="flex justify-between"><dt className="text-ink-500">{t("paid")}</dt><dd dir="ltr" className="text-success">{formatOmr(booking.amountPaid, locale)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-500">{t("payingNow")}</dt><dd dir="ltr" className="font-heading text-lg text-navy-950">{formatOmr(amount, locale)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}
