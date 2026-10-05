"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { bookingWindow } from "../../../convex/lib/dates";
import { useSessionKey } from "@/hooks/use-session-key";
import { track } from "@/lib/analytics";
import { WizardProgress } from "@/components/booking/wizard-progress";
import { PriceSummary } from "@/components/booking/price-summary";
import { StepDates } from "@/components/booking/step-dates";
import { StepTraveller } from "@/components/booking/step-traveller";
import { StepReview } from "@/components/booking/step-review";
import { StepPayment } from "@/components/booking/step-payment";
import { sanitizeSelection } from "@/components/booking/selection";
import type { BookingTour, WizardState } from "@/components/booking/types";

/** Errors the customer fixes on step 1 (date, time, guests, coupon); INVALID_ARGUMENT is routed by its field. */
const STEP1_CODES = new Set(["SOLD_OUT", "DATE_IN_PAST", "DATE_OUT_OF_RANGE", "DATE_NOT_OPERATING", "BELOW_MIN_GROUP", "ABOVE_MAX_GROUP", "TOO_MANY_INFANTS", "COUPON_INVALID", "PRICE_UNAVAILABLE"]);
const STEP1_FIELDS = new Set(["date", "startTime", "adults", "children", "infants"]);

/** A fresh wizard: a valid ?date= deep link (real, in the window, an operating day) or the first bookable day. */
function initialState(tour: BookingTour, date?: string | null): WizardState {
  return sanitizeSelection(tour, {}, { window: bookingWindow(), explicitDate: date }).state;
}

export function BookingWizard({ tour }: { tour: BookingTour }) {
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("booking");
  const router = useRouter();
  const params = useSearchParams();
  const sessionKey = useSessionKey();
  const viewer = useQuery(api.users.viewer);

  const [state, setState] = useState<WizardState>(() => initialState(tour, params.get("date")));
  const [restored, setRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveDraft = useMutation(api.bookings.saveDraft);
  const createBooking = useMutation(api.bookings.create);
  const draft = useQuery(api.bookings.getDraft, sessionKey ? { sessionKey, tourId: tour._id } : "skip");
  const { from, to } = bookingWindow();
  // Same arguments as step 1's calendar, so the Convex client shares one subscription
  const availability = useQuery(api.availability.forTour, { tourId: tour._id, from, to });
  const explicitDate = params.get("date");

  // Restore a saved draft once, re-checked against today's tour, window and availability (never spread raw)
  useEffect(() => {
    if (restored || draft === undefined || availability === undefined) return;
    const range = { from, to };
    if (draft && draft.data && typeof draft.data === "object") {
      const { state: clean, changed } = sanitizeSelection(tour, draft.data, { window: range, availability, explicitDate });
      // Whitelisted fields only; traveller fields the draft left blank keep anything already pre-filled
      setState((s) => {
        const traveller = { ...clean.traveller };
        for (const key of Object.keys(traveller) as (keyof WizardState["traveller"])[]) traveller[key] ||= s.traveller[key];
        return { ...clean, traveller };
      });
      // Overwrite the stored draft at once, so stale values and old consent ticks are not restored again
      if (sessionKey) void saveDraft({ sessionKey, tourId: tour._id, step: clean.step, data: clean, locale }).catch(() => {});
      toast.info(changed ? t("draftUpdated") : t("draftRestored"));
    } else {
      // No draft: only correct what availability now shows (a sold-out first day or start time)
      setState((s) => sanitizeSelection(tour, s, { window: range, availability, explicitDate }).state);
    }
    setRestored(true);
  }, [draft, restored, availability, explicitDate, from, to, sessionKey, saveDraft, locale, t, tour]);

  // Pre-fill from signed-in user
  useEffect(() => {
    if (!viewer) return;
    setState((s) => ({
      ...s,
      traveller: {
        ...s.traveller,
        email: s.traveller.email || viewer.email || "",
        phone: s.traveller.phone || viewer.phone || "",
        firstName: s.traveller.firstName || (viewer.name?.split(" ")[0] ?? ""),
        lastName: s.traveller.lastName || (viewer.name?.split(" ").slice(1).join(" ") ?? ""),
        nationality: s.traveller.nationality || viewer.nationality || "",
      },
    }));
  }, [viewer]);

  // Debounced draft persistence
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(
    (next: WizardState) => {
      if (!sessionKey || !restored) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        // Consent is never saved: a returning customer ticks the policy versions in force at that time
        const data: WizardState = { ...next, acceptedPolicies: false, acceptedWaiver: false };
        void saveDraft({ sessionKey, tourId: tour._id, step: next.step, data, locale }).catch(() => {});
      }, 600);
    },
    [sessionKey, restored, saveDraft, tour._id, locale],
  );

  const update = useCallback(
    (patch: Partial<WizardState>) => {
      setState((s) => {
        const next = { ...s, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const addOnSelection = useMemo(
    () => Object.entries(state.addOns).filter(([, q]) => q > 0).map(([addOnId, quantity]) => ({ addOnId: addOnId as BookingTour["addOns"][number]["_id"], quantity })),
    [state.addOns],
  );

  const quote = useQuery(api.bookings.quote, {
    tourId: tour._id,
    date: state.date,
    startTime: state.startTime,
    adults: state.adults,
    children: state.children,
    infants: state.infants,
    addOns: addOnSelection,
    couponCode: state.couponCode || undefined,
  });

  const goTo = (step: 1 | 2 | 3 | 4) => {
    update({ step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function submit(payLater: boolean, provider?: "thawani" | "stripe" | "paypal", currency?: string) {
    if (!sessionKey) return;
    setSubmitting(true);
    try {
      const result = await createBooking({
        sessionKey,
        tourId: tour._id,
        date: state.date,
        startTime: state.startTime,
        adults: state.adults,
        children: state.children,
        infants: state.infants,
        addOns: addOnSelection,
        couponCode: state.couponCode || undefined,
        traveller: {
          firstName: state.traveller.firstName.trim(),
          lastName: state.traveller.lastName.trim(),
          nationality: state.traveller.nationality,
          phone: state.traveller.phone,
          email: state.traveller.email.trim(),
          hotel: state.traveller.hotel.trim() || undefined,
          pickupLocation: state.traveller.pickupLocation.trim() || undefined,
          specialRequests: state.traveller.specialRequests.trim() || undefined,
          preferredLanguage: locale,
        },
        locale,
        acceptedPolicyVersionIds: tour.requiredPolicies.map((p) => p.versionId),
        payLater,
        paymentMethodPreference: provider,
        displayCurrency: currency,
        userAgent: navigator.userAgent,
      });
      track("begin_checkout", { currency: "OMR", value: (quote?.total ?? 0) / 1000, items: [{ item_id: tour.code, item_name: tour.title.en, quantity: state.adults + state.children }], pay_later: payLater });
      // Pay-later holds, and bookings a code covers in full (confirmed at once, nothing to pay), go to the booking page
      if (payLater || result.status === "confirmed") {
        router.push(`/booking/${result.reference}?t=${result.token}&new=1`);
      } else {
        const q = new URLSearchParams({ t: result.token, ...(provider ? { provider } : {}), ...(currency ? { currency } : {}) });
        router.push(`/checkout/${result.reference}?${q.toString()}`);
      }
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; reason?: string; field?: string }) : undefined;
      const code = data?.code ?? "UNKNOWN";
      const step1Field = code === "INVALID_ARGUMENT" && !!data?.field && STEP1_FIELDS.has(data.field);
      toast.error(step1Field ? t("errors.INVALID_SELECTION") : t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.UNKNOWN"));
      if (STEP1_CODES.has(code) || step1Field) goTo(1);
      else if (code === "INVALID_ARGUMENT") goTo(2);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <WizardProgress step={state.step} onJump={goTo} />
        <div className="mt-8 rounded-xl border border-sand-200 bg-white p-5 sm:p-8">
          {state.step === 1 && <StepDates tour={tour} state={state} update={update} quote={quote} availability={availability} ready={restored} onNext={() => goTo(2)} />}
          {state.step === 2 && <StepTraveller tour={tour} state={state} update={update} onBack={() => goTo(1)} onNext={() => goTo(3)} />}
          {state.step === 3 && <StepReview tour={tour} state={state} update={update} quote={quote} onBack={() => goTo(2)} onEdit={() => goTo(1)} onNext={() => goTo(4)} />}
          {state.step === 4 && <StepPayment tour={tour} state={state} quote={quote} submitting={submitting} onBack={() => goTo(3)} onEdit={() => goTo(1)} onSubmit={submit} />}
        </div>
        <p className="mt-4 text-xs text-ink-500">{t("autosave")}</p>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <PriceSummary tour={tour} date={state.date} startTime={state.startTime} adults={state.adults} kids={state.children} infants={state.infants} quote={quote} couponCode={state.couponCode} />
        <p className="mt-3 text-center text-xs text-ink-500">{pick(tour.title, locale)}</p>
      </div>
    </div>
  );
}
