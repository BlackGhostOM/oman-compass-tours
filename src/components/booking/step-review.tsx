"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDate, formatHijri, pick } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { BookingTour, WizardState } from "@/components/booking/types";
import type { QuoteView } from "@/components/booking/price-summary";

export function StepReview({ tour, state, update, quote, onBack, onNext }: { tour: BookingTour; state: WizardState; update: (p: Partial<WizardState>) => void; quote: QuoteView; onBack: () => void; onNext: () => void }) {
  const locale = useLocale();
  const t = useTranslations("booking.review");
  const tc = useTranslations("common");
  const canContinue = state.acceptedPolicies && state.acceptedWaiver && quote?.available !== false;
  const policyLinks = tour.requiredPolicies;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl text-navy-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>

      <dl className="grid gap-4 rounded-lg border border-sand-200 bg-sand-50 p-5 text-sm sm:grid-cols-2">
        <div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("date")}</dt><dd className="font-medium text-ink-900">{formatDate(state.date, locale)}{locale === "ar" && <span className="block text-xs text-ink-500">{formatHijri(state.date, locale)}</span>}</dd></div></div>
        <div className="flex gap-3"><Clock className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("time")}</dt><dd className="font-medium text-ink-900" dir="ltr">{state.startTime} · {pick(tour.durationLabel, locale)}</dd></div></div>
        <div className="flex gap-3"><UserRound className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("lead")}</dt><dd className="font-medium text-ink-900">{state.traveller.firstName} {state.traveller.lastName} · {countryName(state.traveller.nationality, locale)}</dd></div></div>
        <div className="flex gap-3"><Phone className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("contact")}</dt><dd className="font-medium text-ink-900"><span dir="ltr">{state.traveller.phone}</span><span className="block text-xs"><Mail className="me-1 inline size-3" />{state.traveller.email}</span></dd></div></div>
        {(state.traveller.hotel || state.traveller.pickupLocation) && (
          <div className="flex gap-3 sm:col-span-2"><MapPin className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("pickup")}</dt><dd className="font-medium text-ink-900">{[state.traveller.hotel, state.traveller.pickupLocation].filter(Boolean).join(" · ")}</dd></div></div>
        )}
        {state.traveller.specialRequests && (
          <div className="sm:col-span-2"><dt className="text-ink-500">{t("requests")}</dt><dd className="mt-1 whitespace-pre-wrap text-ink-900">{state.traveller.specialRequests}</dd></div>
        )}
      </dl>

      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-ink-900">
        <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-success" /> {t("policyHeadline")}</p>
        <p className="mt-1 text-ink-500">
          {tour.freeCancellationHours > 0 ? tc("freeCancellation", { hours: tour.freeCancellationHours }) : tc("nonRefundable")}
          {tour.depositPercent < 100 && ` · ${t("deposit", { percent: tour.depositPercent })}`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox id="accept-policies" checked={state.acceptedPolicies} onCheckedChange={(v) => update({ acceptedPolicies: v === true })} className="mt-0.5" />
          <Label htmlFor="accept-policies" className="text-sm leading-relaxed text-ink-900">
            {t.rich("acceptPolicies", {
              links: () => (
                <span>
                  {policyLinks.filter((p) => p.key !== "waiver").map((p, i, arr) => (
                    <span key={p.key}>
                      <Link href={`/policies/${p.key}`} target="_blank" className="text-gold-600 underline underline-offset-4">{pick(p.title, locale)}</Link>
                      {i < arr.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </span>
              ),
            })}
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="accept-waiver" checked={state.acceptedWaiver} onCheckedChange={(v) => update({ acceptedWaiver: v === true })} className="mt-0.5" />
          <Label htmlFor="accept-waiver" className="text-sm leading-relaxed text-ink-900">
            {t.rich("acceptWaiver", { link: (chunks) => <Link href="/policies/waiver" target="_blank" className="text-gold-600 underline underline-offset-4">{chunks}</Link> })}
          </Label>
        </div>
        <p className="text-xs text-ink-500">{t("versionNote")}</p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>{tc("back")}</Button>
        <Button size="lg" disabled={!canContinue} onClick={onNext} className="bg-gold-gradient font-semibold text-navy-950">{t("toPayment")}</Button>
      </div>
    </div>
  );
}
