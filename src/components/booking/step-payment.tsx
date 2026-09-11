"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Clock, CreditCard, LockKeyhole } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatOmr } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PaymentLogos } from "@/components/shared/payment-logos";
import { ProviderPicker, type Currency, type ProviderId } from "@/components/booking/provider-picker";
import type { BookingTour, WizardState } from "@/components/booking/types";
import type { QuoteView } from "@/components/booking/price-summary";

export function StepPayment({
  tour,
  state,
  quote,
  submitting,
  onBack,
  onSubmit,
}: {
  tour: BookingTour;
  state: WizardState;
  quote: QuoteView;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (payLater: boolean, provider?: ProviderId, currency?: Currency) => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations("booking.payment");
  const tc = useTranslations("common");
  const options = useQuery(api.payments.checkoutOptions, { country: state.traveller.nationality || undefined });
  const [mode, setMode] = useState<"now" | "later">("now");
  const [provider, setProvider] = useState<ProviderId>("stripe");
  const [currency, setCurrency] = useState<Currency>("OMR");

  useEffect(() => {
    if (options) setProvider(options.defaultProvider as ProviderId);
  }, [options]);

  const amount = quote?.depositDue ?? 0;
  const providers = (options?.providers ?? []) as ProviderId[];
  const noneConfigured = options !== undefined && providers.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl text-navy-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("now")} aria-pressed={mode === "now"} className={cn("flex items-start gap-3 rounded-xl border p-4 text-start transition", mode === "now" ? "border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/30" : "border-sand-200 bg-white hover:border-gold-500/60")}>
          <CreditCard className="mt-0.5 size-5 text-gold-700" />
          <span>
            <span className="block font-heading text-base text-navy-950">{quote && quote.depositDue < quote.total ? t("payDeposit", { amount: formatOmr(amount, locale, { compact: true }) }) : t("payNow", { amount: formatOmr(amount, locale, { compact: true }) })}</span>
            <span className="block text-xs text-ink-500">{t("payNowHint")}</span>
          </span>
        </button>
        {tour.allowReserveNowPayLater && (
          <button type="button" onClick={() => setMode("later")} aria-pressed={mode === "later"} className={cn("flex items-start gap-3 rounded-xl border p-4 text-start transition", mode === "later" ? "border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/30" : "border-sand-200 bg-white hover:border-gold-500/60")}>
            <Clock className="mt-0.5 size-5 text-gold-700" />
            <span>
              <span className="block font-heading text-base text-navy-950">{t("payLater")}</span>
              <span className="block text-xs text-ink-500">{t("payLaterHint", { hours: tour.holdHours })}</span>
            </span>
          </button>
        )}
      </div>

      {mode === "now" && (
        <ProviderPicker
          amountBaisa={amount}
          rates={options?.rates ?? {}}
          providers={providers}
          provider={provider}
          currency={currency}
          onChange={(p, c) => {
            setProvider(p);
            setCurrency(c);
          }}
          disabledReason={noneConfigured ? t("noneConfigured") : undefined}
        />
      )}

      <div className="flex items-center gap-3 rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs text-ink-500">
        <LockKeyhole className="size-4 shrink-0 text-success" />
        <span>{t("secure")}</span>
      </div>
      <PaymentLogos className="[&_li]:border-sand-200 [&_li]:bg-white [&_li]:text-ink-500" />

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack} disabled={submitting}>{tc("back")}</Button>
        <Button
          size="lg"
          disabled={submitting || !quote || quote.available === false || (mode === "now" && noneConfigured)}
          onClick={() => onSubmit(mode === "later", mode === "now" ? provider : undefined, mode === "now" ? currency : undefined)}
          className="bg-gold-gradient font-semibold text-navy-950 shadow-gold"
        >
          {submitting ? t("processing") : mode === "later" ? t("reserveCta") : t("payCta")}
        </Button>
      </div>
    </div>
  );
}
