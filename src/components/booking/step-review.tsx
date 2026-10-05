"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Clock, Mail, MapPin, Phone, Receipt, ShieldCheck, UserRound, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDate, formatHijri, formatOmr, pick, cancellationWindow } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingTour, WizardState } from "@/components/booking/types";
import { SelectionIssue, useGuestsLabel, type QuoteView } from "@/components/booking/price-summary";
import { isQuoteBookable } from "@/components/booking/selection";

export function StepReview({ tour, state, update, quote, onBack, onEdit, onNext }: { tour: BookingTour; state: WizardState; update: (p: Partial<WizardState>) => void; quote: QuoteView; onBack: () => void; onEdit: () => void; onNext: () => void }) {
  const locale = useLocale();
  const t = useTranslations("booking.review");
  const tc = useTranslations("common");
  const tsum = useTranslations("booking.summary");
  const guests = useGuestsLabel();
  const canContinue = state.acceptedPolicies && state.acceptedWaiver && isQuoteBookable(quote, state.couponCode);
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
        <div className="flex gap-3 sm:col-span-2"><Users className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("guests")}</dt><dd className="font-medium text-ink-900">{guests(state.adults, state.children, state.infants)}</dd></div></div>
        <div className="flex gap-3"><UserRound className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("lead")}</dt><dd className="font-medium text-ink-900">{state.traveller.firstName} {state.traveller.lastName} · {countryName(state.traveller.nationality, locale)}</dd></div></div>
        <div className="flex gap-3"><Phone className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("contact")}</dt><dd className="font-medium text-ink-900"><span dir="ltr">{state.traveller.phone}</span><span className="block text-xs"><Mail className="me-1 inline size-3" />{state.traveller.email}</span></dd></div></div>
        {(state.traveller.hotel || state.traveller.pickupLocation) && (
          <div className="flex gap-3 sm:col-span-2"><MapPin className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("pickup")}</dt><dd className="font-medium text-ink-900">{[state.traveller.hotel, state.traveller.pickupLocation].filter(Boolean).join(" · ")}</dd></div></div>
        )}
        {state.traveller.specialRequests && (
          <div className="sm:col-span-2"><dt className="text-ink-500">{t("requests")}</dt><dd className="mt-1 whitespace-pre-wrap text-ink-900">{state.traveller.specialRequests}</dd></div>
        )}
        {/* The price on the card itself: on a phone the summary column sits below the buttons */}
        <div className="flex gap-3 border-t border-sand-200 pt-4 sm:col-span-2">
          <Receipt className="mt-0.5 size-4 text-gold-500" />
          <div className="min-w-0 flex-1">
            <dt className="text-ink-500">{t("price")}</dt>
            {quote === undefined ? (
              <dd className="mt-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-5 w-1/2" /></dd>
            ) : quote === null ? (
              <dd className="mt-1 text-ink-500">—</dd>
            ) : (
              <dd className="mt-1 space-y-1">
                <ul className="space-y-1">
                  {quote.items.map((it, i) => (
                    <li key={i} className={it.kind === "discount" ? "flex justify-between gap-3 text-success" : "flex justify-between gap-3 text-ink-500"}>
                      <span>{pick(it.label, locale)}{it.quantity > 1 && it.kind !== "discount" ? ` × ${it.quantity}` : ""}</span>
                      <span dir="ltr">{it.total === 0 && it.kind !== "discount" ? tsum("free") : formatOmr(it.total, locale)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between gap-3 pt-1 font-medium text-ink-900"><span>{tsum("total")}</span><span dir="ltr" className="font-heading text-base text-navy-950">{formatOmr(quote.total, locale)}</span></div>
                {quote.depositDue < quote.total && (
                  <>
                    <div className="flex justify-between gap-3 text-ink-900"><span>{tsum("depositNow", { percent: tour.depositPercent })}</span><span dir="ltr">{formatOmr(quote.depositDue, locale)}</span></div>
                    <div className="flex justify-between gap-3 text-xs text-ink-500"><span>{tsum("balanceLater")}</span><span dir="ltr">{formatOmr(quote.balanceDue, locale)}</span></div>
                  </>
                )}
              </dd>
            )}
          </div>
        </div>
      </dl>

      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-ink-900">
        <p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-success" /> {t("policyHeadline")}</p>
        <p className="mt-1 text-ink-500">
          {tour.freeCancellationHours > 0 ? tc("freeCancellation", { window: cancellationWindow(tour.freeCancellationHours, locale) }) : tc("nonRefundable")}
          {tour.depositPercent < 100 && quote?.total !== 0 && ` · ${t("deposit", { percent: tour.depositPercent })}`}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox id="accept-policies" checked={state.acceptedPolicies} onCheckedChange={(v) => update({ acceptedPolicies: v === true })} className="mt-0.5" />
          <Label htmlFor="accept-policies" className="block text-sm leading-relaxed text-ink-900">
            {t.rich("acceptPolicies", {
              links: () => (
                <span>
                  {policyLinks.filter((p) => p.key !== "waiver").map((p, i, arr) => (
                    <span key={p.key}>
                      <Link href={`/policies/${p.key}`} target="_blank" className="text-gold-700 underline underline-offset-4">{pick(p.title, locale)}</Link>
                      {i < arr.length - 1 ? (locale === "ar" ? "، " : ", ") : ""}
                    </span>
                  ))}
                </span>
              ),
            })}
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="accept-waiver" checked={state.acceptedWaiver} onCheckedChange={(v) => update({ acceptedWaiver: v === true })} className="mt-0.5" />
          <Label htmlFor="accept-waiver" className="block text-sm leading-relaxed text-ink-900">
            {t.rich("acceptWaiver", { link: (chunks) => <Link href="/policies/waiver" target="_blank" className="text-gold-700 underline underline-offset-4">{chunks}</Link> })}
          </Label>
        </div>
        <p className="text-xs text-ink-500">{t("versionNote")}</p>
      </div>

      <SelectionIssue tour={tour} quote={quote} couponCode={state.couponCode} onEdit={onEdit} />

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>{tc("back")}</Button>
        <Button size="lg" disabled={!canContinue} onClick={onNext} className="bg-gold-gradient font-semibold text-navy-950">{t("toPayment")}</Button>
      </div>
    </div>
  );
}
