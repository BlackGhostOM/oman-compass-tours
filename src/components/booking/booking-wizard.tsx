"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { addDaysIso, pick, todayIso } from "@/lib/content";
import { useSessionKey } from "@/hooks/use-session-key";
import { track } from "@/lib/analytics";
import { WizardProgress } from "@/components/booking/wizard-progress";
import { PriceSummary } from "@/components/booking/price-summary";
import { StepDates } from "@/components/booking/step-dates";
import { StepTraveller } from "@/components/booking/step-traveller";
import { StepReview } from "@/components/booking/step-review";
import { StepPayment } from "@/components/booking/step-payment";
import type { BookingTour, WizardState } from "@/components/booking/types";

function initialState(tour: BookingTour, date?: string | null): WizardState {
  return {
    step: 1,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > todayIso() ? date : addDaysIso(todayIso(), 1),
    startTime: tour.startTimes[0] ?? "08:00",
    adults: Math.max(1, tour.minGroup),
    children: 0,
    infants: 0,
    addOns: {},
    couponCode: "",
    traveller: { firstName: "", lastName: "", nationality: "", phone: "", email: "", hotel: "", pickupLocation: "", specialRequests: "" },
    acceptedPolicies: false,
    acceptedWaiver: false,
    payLater: false,
    tourSlug: tour.slug.en,
  };
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

  // Restore a saved draft once
  useEffect(() => {
    if (restored || draft === undefined) return;
    if (draft && draft.data && typeof draft.data === "object") {
      const d = draft.data as Partial<WizardState>;
      setState((s) => ({ ...s, ...d, step: (Math.min(d.step ?? 1, 3) as 1 | 2 | 3), tourSlug: tour.slug.en }));
      toast.info(t("draftRestored"));
    }
    setRestored(true);
  }, [draft, restored, t, tour.slug.en]);

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
        void saveDraft({ sessionKey, tourId: tour._id, step: next.step, data: next, locale }).catch(() => {});
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
      if (payLater) {
        router.push(`/booking/${result.reference}?t=${result.token}&new=1`);
      } else {
        const q = new URLSearchParams({ t: result.token, ...(provider ? { provider } : {}), ...(currency ? { currency } : {}) });
        router.push(`/checkout/${result.reference}?${q.toString()}`);
      }
    } catch (err) {
      const data = err instanceof ConvexError ? (err.data as { code?: string; reason?: string }) : undefined;
      const code = data?.code ?? "UNKNOWN";
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.UNKNOWN"));
      if (code === "SOLD_OUT" || code === "DATE_IN_PAST") goTo(1);
      if (code === "INVALID_ARGUMENT") goTo(2);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <WizardProgress step={state.step} onJump={goTo} />
        <div className="mt-8 rounded-xl border border-sand-200 bg-white p-5 sm:p-8">
          {state.step === 1 && <StepDates tour={tour} state={state} update={update} quote={quote} onNext={() => goTo(2)} />}
          {state.step === 2 && <StepTraveller tour={tour} state={state} update={update} onBack={() => goTo(1)} onNext={() => goTo(3)} />}
          {state.step === 3 && <StepReview tour={tour} state={state} update={update} quote={quote} onBack={() => goTo(2)} onNext={() => goTo(4)} />}
          {state.step === 4 && <StepPayment tour={tour} state={state} quote={quote} submitting={submitting} onBack={() => goTo(3)} onSubmit={submit} />}
        </div>
        <p className="mt-4 text-xs text-ink-500">{t("autosave")}</p>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <PriceSummary tour={tour} date={state.date} startTime={state.startTime} adults={state.adults} kids={state.children} infants={state.infants} quote={quote} />
        <p className="mt-3 text-center text-xs text-ink-500">{pick(tour.title, locale)}</p>
      </div>
    </div>
  );
}
