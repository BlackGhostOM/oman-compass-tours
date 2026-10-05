"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Post-redirect page: waits for the verified webhook to confirm the booking
 * (reactive Convex query). For PayPal it first captures the approved order.
 */
export function PaymentStatus({ reference, token }: { reference: string; token: string }) {
  const locale = useLocale();
  const t = useTranslations("checkout.status");
  const params = useSearchParams();
  const router = useRouter();
  const booking = useQuery(api.bookings.byReference, { reference, token });
  const options = useQuery(api.payments.checkoutOptions, {});
  const capturePaypal = useAction(api.payments.capturePaypal);
  const verify = useAction(api.payments.verifyWithProvider);
  const [elapsed, setElapsed] = useState(0);
  const captured = useRef(false);
  /** PayPal refused to capture because the booking could no longer be paid (no money taken). */
  const [notPayable, setNotPayable] = useState(false);
  const verified = useRef(false);

  const provider = params.get("p");
  const paypalOrder = params.get("token");
  const paymentId = params.get("pid");

  // PayPal: capture the approved order on return
  useEffect(() => {
    if (provider === "paypal" && paypalOrder && !captured.current) {
      captured.current = true;
      void capturePaypal({ reference, token, orderId: paypalOrder })
        .then((r) => {
          if (r.status === "not_payable") setNotPayable(true);
        })
        .catch(() => {});
    }
  }, [provider, paypalOrder, capturePaypal, reference, token]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Optional API-side verification fallback (only applies when enabled server-side)
  useEffect(() => {
    if (elapsed >= 8 && !verified.current && paymentId && options?.apiVerification && booking && booking.status !== "confirmed") {
      verified.current = true;
      void verify({ reference, token, paymentId: paymentId as never }).catch(() => {});
    }
  }, [elapsed, paymentId, options, booking, verify, reference, token]);

  useEffect(() => {
    if (booking && ["confirmed", "in_progress", "completed"].includes(booking.status)) {
      const id = setTimeout(() => router.replace(`/booking/${reference}?t=${token}&new=1`), 1200);
      return () => clearTimeout(id);
    }
  }, [booking, reference, token, router]);

  if (booking === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (booking === null) {
    return (
      <div className="rounded-xl border border-danger/40 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-danger" />
        <p className="mt-3 font-heading text-navy-950">{t("notFound")}</p>
      </div>
    );
  }
  const confirmed = ["confirmed", "in_progress", "completed"].includes(booking.status);
  const failed = booking.payments.some((p) => p.status === "failed") && !confirmed;
  const inactive = booking.status === "cancelled" || booking.status === "refunded";
  // Paid, but the booking could not be confirmed (cancelled, expired or departed): staff follow up, stop spinning
  const paidUnpayable = !confirmed && (booking.needsAttention || (inactive && booking.amountPaid > 0));
  // Cancelled with nothing paid: give the webhook a moment in case the payment is still on its way
  const expired = !confirmed && !paidUnpayable && (notPayable || (inactive && elapsed >= 15));
  const whatsappHref = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(`Payment status for booking ${reference}`)}`;

  if (paidUnpayable || expired) {
    return (
      <div className="rounded-xl border border-warning/40 bg-white p-8 text-center">
        {paidUnpayable ? <AlertTriangle className="mx-auto size-12 text-warning" /> : <Clock className="mx-auto size-12 text-warning" />}
        <h2 className="mt-4 font-heading text-xl text-navy-950">{paidUnpayable ? t("paidUnpayableTitle") : t("expiredTitle")}</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink-500">{paidUnpayable ? t("paidUnpayableBody") : t("expiredBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-gold-gradient text-navy-950"><a href={whatsappHref} target="_blank" rel="noopener noreferrer">{t("whatsapp")}</a></Button>
          {!paidUnpayable && booking.tour && <Button asChild variant="outline"><Link href={`/book/${pick(booking.tour.slug, locale)}`}>{t("rebook")}</Link></Button>}
          <Button asChild variant="outline"><Link href={`/booking/${reference}?t=${token}`}>{t("viewBooking")}</Link></Button>
        </div>
        <p className="mt-6 text-xs text-ink-500" dir="ltr">{reference}</p>
        <p className="sr-only" aria-live="polite">{paidUnpayable ? t("paidUnpayableTitle") : t("expiredTitle")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-white p-8 text-center">
      {confirmed ? (
        <>
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h2 className="mt-4 font-heading text-xl text-navy-950">{t("confirmedTitle")}</h2>
          <p className="mt-2 text-sm text-ink-500">{t("confirmedBody")}</p>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto size-12 animate-spin text-gold-500" />
          <h2 className="mt-4 font-heading text-xl text-navy-950">{t("waitingTitle")}</h2>
          <p className="mt-2 text-sm text-ink-500">{t("waitingBody")}</p>
          {elapsed > 20 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-ink-500">{t("slow")}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild variant="outline"><Link href={`/booking/${reference}?t=${token}`}>{t("viewBooking")}</Link></Button>
                <Button asChild variant="outline"><a href={`https://wa.me/96892255028?text=${encodeURIComponent(`Payment status for booking ${reference}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button>
              </div>
            </div>
          )}
          {failed && <p className="mt-4 text-sm text-danger">{t("failed")}</p>}
        </>
      )}
      <p className="mt-6 text-xs text-ink-500" dir="ltr">{reference}</p>
      <p className="sr-only" aria-live="polite">{confirmed ? t("confirmedTitle") : t("waitingTitle")}</p>
      <span className="hidden">{locale}</span>
    </div>
  );
}
