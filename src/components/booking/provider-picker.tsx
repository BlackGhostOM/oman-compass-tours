"use client";

import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { formatMoney, formatOmr } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProviderId = "thawani" | "stripe" | "paypal";
export const CURRENCIES = ["OMR", "USD", "EUR", "GBP", "AED", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

const meta: Record<ProviderId, { Icon: typeof CreditCard; settles: (c: Currency) => Currency; currencies: Currency[] }> = {
  thawani: { Icon: Landmark, settles: () => "OMR", currencies: ["OMR"] },
  stripe: { Icon: CreditCard, settles: (c) => (c === "OMR" ? "USD" : c), currencies: ["USD", "EUR", "GBP", "AED", "SAR"] },
  paypal: { Icon: Wallet, settles: (c) => (c === "EUR" || c === "GBP" ? c : "USD"), currencies: ["USD", "EUR", "GBP"] },
};

export function settlementFor(provider: ProviderId, currency: Currency): Currency {
  return meta[provider].settles(currency);
}

export function ProviderPicker({
  amountBaisa,
  rates,
  providers,
  provider,
  currency,
  onChange,
  disabledReason,
}: {
  amountBaisa: number;
  rates: Record<string, number>;
  providers: ProviderId[];
  provider: ProviderId;
  currency: Currency;
  onChange: (p: ProviderId, c: Currency) => void;
  disabledReason?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("checkout.providers");
  const settle = settlementFor(provider, currency);
  const settleAmount = settle === "OMR" ? amountBaisa / 1000 : (amountBaisa / 1000) * (rates[settle] ?? 1);
  const all: ProviderId[] = ["thawani", "stripe", "paypal"];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>{t("displayCurrency")}</Label>
        <Select value={currency} onValueChange={(c) => onChange(provider, c as Currency)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                <span dir="ltr">{c} · {c === "OMR" ? formatOmr(amountBaisa, locale) : formatMoney((amountBaisa / 1000) * (rates[c] ?? 1), c, locale)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-ink-500">{t("ratesNote")}</p>
      </div>

      <div role="radiogroup" aria-label={t("method")} className="grid gap-3 sm:grid-cols-3">
        {all.map((p) => {
          const { Icon } = meta[p];
          const available = providers.includes(p);
          const active = provider === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!available}
              onClick={() => onChange(p, currency)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition",
                active ? "border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/30" : "border-sand-200 bg-white hover:border-gold-500/60",
                !available && "cursor-not-allowed opacity-50",
              )}
            >
              <Icon className={cn("size-6", active ? "text-gold-600" : "text-ink-500")} />
              <span className="font-heading text-base text-navy-950">{t(`${p}.name`)}</span>
              <span className="text-xs text-ink-500">{t(`${p}.body`)}</span>
              {!available && <span className="text-[11px] text-warning">{t("notConfigured")}</span>}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-sand-200 bg-sand-50 p-4 text-sm">
        <p className="text-ink-500">{t("youWillBeCharged")}</p>
        <p className="mt-1 font-heading text-2xl text-navy-950" dir="ltr">{settle === "OMR" ? formatOmr(amountBaisa, locale) : formatMoney(settleAmount, settle, locale)}</p>
        {settle !== currency && <p className="mt-1 text-xs text-ink-500">{t("settlementNote", { provider: t(`${provider}.name`), currency: settle })}</p>}
        {disabledReason && <p className="mt-2 text-xs text-danger">{disabledReason}</p>}
      </div>
    </div>
  );
}
