"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { ar as arLocale, enGB } from "react-day-picker/locale";
import { Minus, Plus, Tag } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { addDaysIso, formatOmr, pick, todayIso } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BookingTour, WizardState } from "@/components/booking/types";
import type { QuoteView } from "@/components/booking/price-summary";

function Counter({ id, label, hint, value, min, max, onChange }: { id: string; label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-sand-200 px-4 py-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium text-ink-900">{label}</Label>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-2" dir="ltr">
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−"><Minus className="size-3.5" /></Button>
        <input id={id} type="number" readOnly value={value} className="w-8 bg-transparent text-center font-heading text-lg text-navy-950" aria-live="polite" />
        <Button type="button" variant="outline" size="icon-sm" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+"><Plus className="size-3.5" /></Button>
      </div>
    </div>
  );
}

export function StepDates({ tour, state, update, quote, onNext }: { tour: BookingTour; state: WizardState; update: (p: Partial<WizardState>) => void; quote: QuoteView; onNext: () => void }) {
  const locale = useLocale();
  const t = useTranslations("booking.dates");
  const tc = useTranslations("common");
  const from = addDaysIso(todayIso(), 1);
  const to = addDaysIso(from, 120);
  const availability = useQuery(api.availability.forTour, { tourId: tour._id, from, to });
  const soldOut = useMemo(() => new Set((availability?.dates ?? []).filter((d) => d.isBlackout || d.slots.every((s) => s.remaining <= 0)).map((d) => d.date)), [availability]);
  const selected = state.date ? new Date(state.date + "T00:00:00") : undefined;
  const groupSize = state.adults + state.children;
  const canContinue = !!state.date && !soldOut.has(state.date) && groupSize >= tour.minGroup && groupSize <= tour.maxGroup && quote?.available !== false;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl text-navy-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>

      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="rounded-lg border border-sand-200 p-2">
          <Calendar
            mode="single"
            locale={locale === "ar" ? arLocale : enGB}
            dir={locale === "ar" ? "rtl" : "ltr"}
            selected={selected}
            onSelect={(d) => d && update({ date: d.toISOString().slice(0, 10) })}
            disabled={(d) => {
              const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
              return iso < from || iso > to || soldOut.has(iso);
            }}
            startMonth={new Date(from + "T00:00:00")}
            endMonth={new Date(to + "T00:00:00")}
            className="[--cell-size:2.4rem]"
          />
          <p className="px-2 pb-1 text-xs text-ink-500">{t("legend")}</p>
        </div>

        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">{t("startTime")}</Label>
            <div className="flex flex-wrap gap-2" dir="ltr">
              {tour.startTimes.map((time) => {
                const day = availability?.dates.find((d) => d.date === state.date);
                const slot = day?.slots.find((s) => s.time === time);
                const remaining = slot?.remaining ?? tour.maxGroup;
                const disabled = remaining <= 0;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => update({ startTime: time })}
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm transition",
                      state.startTime === time ? "border-gold-500 bg-gold-500/15 text-navy-950" : "border-sand-200 bg-white text-ink-500 hover:border-gold-500/60",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {time}
                    {availability && !disabled && tour.pricingModel === "per_person" && remaining < 6 && <span className="ms-2 text-[11px] text-warning">{t("spotsLeft", { count: remaining })}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="block">{t("guests")}</Label>
            <Counter id="adults" label={t("adults")} hint={t("adultsHint")} value={state.adults} min={1} max={tour.maxGroup} onChange={(v) => update({ adults: v })} />
            <Counter id="children" label={t("children")} hint={t("childrenHint", { min: tour.infantAgeMax + 1, max: tour.childAgeMax ?? 11 })} value={state.children} min={0} max={Math.max(0, tour.maxGroup - state.adults)} onChange={(v) => update({ children: v })} />
            <Counter id="infants" label={t("infants")} hint={t("infantsHint", { max: tour.infantAgeMax })} value={state.infants} min={0} max={6} onChange={(v) => update({ infants: v })} />
            {tour.pricingModel === "per_group" && <p className="text-xs text-ink-500">{t("perGroupNote", { max: tour.maxGroup })}</p>}
            {groupSize < tour.minGroup && <p className="text-xs text-danger">{t("minGroup", { min: tour.minGroup })}</p>}
          </div>
        </div>
      </div>

      {tour.addOns.length > 0 && (
        <div>
          <h3 className="font-heading text-lg text-navy-950">{t("addOns")}</h3>
          <p className="mt-1 text-sm text-ink-500">{t("addOnsHint")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {tour.addOns.map((a) => {
              const on = (state.addOns[a._id] ?? 0) > 0;
              return (
                <li key={a._id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ addOns: { ...state.addOns, [a._id]: on ? 0 : 1 } })}
                    className={cn("flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-start transition", on ? "border-gold-500 bg-gold-500/10" : "border-sand-200 bg-white hover:border-gold-500/60")}
                  >
                    <span>
                      <span className="block font-medium text-ink-900">{pick(a.name, locale)}</span>
                      {a.description && <span className="mt-0.5 block text-xs text-ink-500">{pick(a.description, locale)}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-navy-950" dir="ltr">
                      {a.price === 0 ? t("free") : formatOmr(a.price, locale, { compact: true })}
                      <span className="block text-end text-[11px] font-normal text-ink-500">{a.priceType === "per_person" ? tc("perPerson") : t("perBooking")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <Label htmlFor="coupon" className="mb-2 block">{t("coupon")}</Label>
        <div className="flex max-w-sm gap-2">
          <div className="relative flex-1">
            <Tag className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
            <Input id="coupon" value={state.couponCode} onChange={(e) => update({ couponCode: e.target.value.toUpperCase() })} placeholder="WELCOME10" className="ps-9 uppercase" />
          </div>
        </div>
        {state.couponCode && quote?.couponError && <p className="mt-1 text-xs text-danger">{t(`couponErrors.${quote.couponError}`)}</p>}
        {state.couponCode && quote && !quote.couponError && quote.discountTotal > 0 && <p className="mt-1 text-xs text-success">{t("couponApplied", { amount: formatOmr(quote.discountTotal, locale) })}</p>}
      </div>

      <div className="flex justify-end">
        <Button size="lg" disabled={!canContinue} onClick={onNext} className="bg-gold-gradient font-semibold text-navy-950">
          {tc("continue")}
        </Button>
      </div>
    </div>
  );
}
