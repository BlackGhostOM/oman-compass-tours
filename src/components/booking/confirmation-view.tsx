"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { track } from "@/lib/analytics";
import { AlertTriangle, CalendarPlus, CheckCircle2, Clock, CreditCard, Download, MapPin, MessageCircle, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/countries";
import { formatDate, formatHijri, formatOmr, pick } from "@/lib/content";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const statusTone: Record<string, string> = {
  inquiry: "bg-warning/15 text-warning",
  pending_payment: "bg-warning/15 text-warning",
  confirmed: "bg-success/15 text-success",
  in_progress: "bg-navy-950 text-gold-400",
  completed: "bg-navy-950 text-sand-50",
  cancelled: "bg-danger/15 text-danger",
  refunded: "bg-ink-500/15 text-ink-500",
};

export function ConfirmationView({ reference, token }: { reference: string; token: string }) {
  const locale = useLocale();
  const t = useTranslations("confirmation");
  const ts = useTranslations("bookingStatus");
  const params = useSearchParams();
  const booking = useQuery(api.bookings.byReference, { reference, token });
  const viewer = useQuery(api.users.viewer);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) return;
    const start = new Date(`${booking.date}T${booking.startTime ?? "08:00"}:00+04:00`).getTime();
    const tick = () => {
      const diff = start - Date.now();
      if (diff <= 0) return setCountdown(null);
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setCountdown(t("countdown", { d, h, m }));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [booking, t]);

  // Conversion event, fired once per confirmed booking per browser.
  useEffect(() => {
    if (!booking || !["confirmed", "in_progress", "completed"].includes(booking.status)) return;
    const key = `oct_purchase_${booking.reference}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    track("purchase", { transaction_id: booking.reference, currency: "OMR", value: booking.amountPaid / 1000, items: [{ item_name: booking.tourTitle.en, quantity: booking.adults + booking.children }] });
  }, [booking]);

  if (booking === undefined) return <Skeleton className="h-96 rounded-xl" />;
  if (booking === null) {
    return (
      <div className="rounded-xl border border-danger/40 bg-white p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-danger" />
        <p className="mt-3 font-heading text-navy-950">{t("notFound")}</p>
      </div>
    );
  }

  const isNew = params.get("new") === "1";
  const confirmed = ["confirmed", "in_progress", "completed"].includes(booking.status);
  const needsPayment = booking.status === "inquiry" || booking.status === "pending_payment";
  const voucherUrl = `/api/voucher/${booking.voucherToken}`;
  const icsUrl = `/api/calendar/${booking.voucherToken}`;
  const shareUrl = `${site.url}/${locale}/booking/${booking.reference}?t=${booking.voucherToken}`;
  const waText = locale === "ar"
    ? `تأكيد الحجز ${booking.reference}\n${pick(booking.tourTitle, "ar")}\n${formatDate(booking.date, "ar")} ${booking.startTime ?? ""}\n${shareUrl}`
    : `Booking confirmation ${booking.reference}\n${pick(booking.tourTitle, "en")}\n${formatDate(booking.date, "en")} ${booking.startTime ?? ""}\n${shareUrl}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div className={cn("rounded-xl border p-6 text-center sm:p-8", confirmed ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5")}>
          {confirmed ? <CheckCircle2 className="mx-auto size-12 text-success" /> : <Clock className="mx-auto size-12 text-warning" />}
          <h1 className="heading-brand mt-4 font-heading text-2xl text-navy-950 sm:text-3xl">
            {confirmed ? (isNew ? t("confirmedTitle") : t("bookingTitle")) : needsPayment ? t("holdTitle") : t("bookingTitle")}
          </h1>
          <p className="mt-2 text-ink-500">
            {confirmed ? t("confirmedBody", { email: booking.traveller.email }) : needsPayment ? t("holdBody", { hours: booking.holdExpiresAt ? Math.max(1, Math.round((booking.holdExpiresAt - Date.now()) / 3_600_000)) : 24 }) : ""}
          </p>
          <p className="mt-4 font-heading text-lg tracking-[0.2em] text-navy-950" dir="ltr">{booking.reference}</p>
          <Badge className={cn("mt-2", statusTone[booking.status])}>{ts(booking.status)}</Badge>
          {countdown && confirmed && <p className="mt-3 text-sm text-gold-700">{countdown}</p>}
        </div>

        {needsPayment && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-sand-200 bg-white p-6 text-center">
            <p className="text-sm text-ink-900">{t("payPrompt", { amount: formatOmr(Math.max(0, booking.depositDue - booking.amountPaid), locale) })}</p>
            <Button asChild size="lg" className="bg-gold-gradient font-semibold text-navy-950"><Link href={`/checkout/${booking.reference}?t=${booking.voucherToken}`}><CreditCard className="size-4" /> {t("payNow")}</Link></Button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild variant="outline" className="h-auto flex-col gap-1 py-4" disabled={!confirmed}>
            <a href={voucherUrl} target="_blank" rel="noopener noreferrer" aria-disabled={!confirmed} className={cn(!confirmed && "pointer-events-none opacity-50")}>
              <Download className="size-5 text-gold-700" /> <span>{t("voucher")}</span>
            </a>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1 py-4">
            <a href={icsUrl}><CalendarPlus className="size-5 text-gold-700" /> <span>{t("addToCalendar")}</span></a>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1 py-4 border-[#25D366]/50">
            <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-5 text-[#25D366]" /> <span>{t("sendWhatsapp")}</span></a>
          </Button>
        </div>

        <div className="rounded-xl border border-sand-200 bg-white p-6">
          <div className="flex gap-4">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
              <Image src={booking.tour?.coverImage?.url ?? "/media/placeholders/hero.jpg"} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-navy-950">{pick(booking.tourTitle, locale)}</h2>
              <p className="mt-1 text-sm text-ink-500">{formatDate(booking.date, locale)} · <span dir="ltr">{booking.startTime}</span>{locale === "ar" && <span className="block text-xs">{formatHijri(booking.date, locale)}</span>}</p>
              {booking.tour && <p className="mt-1 text-sm text-ink-500">{pick(booking.tour.durationLabel, locale)}</p>}
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-sand-200 pt-5 text-sm sm:grid-cols-2">
            <div className="flex gap-3"><UserRound className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("lead")}</dt><dd className="font-medium text-ink-900">{booking.traveller.firstName} {booking.traveller.lastName} · {countryName(booking.traveller.nationality, locale)}</dd><dd className="text-xs text-ink-500" dir="ltr">{booking.traveller.phone}</dd></div></div>
            <div className="flex gap-3"><MapPin className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("pickup")}</dt><dd className="font-medium text-ink-900">{booking.traveller.pickupLocation || booking.traveller.hotel || pick(booking.tour?.meetingPoint?.label, locale) || "—"}</dd></div></div>
            <div className="flex gap-3 sm:col-span-2"><Clock className="mt-0.5 size-4 text-gold-500" /><div><dt className="text-ink-500">{t("guests")}</dt><dd className="font-medium text-ink-900">{booking.adults} × {t("adult")}{booking.children > 0 && ` · ${booking.children} × ${t("child")}`}{booking.infants > 0 && ` · ${booking.infants} × ${t("infant")}`}</dd></div></div>
          </dl>
          <div className="mt-5 border-t border-sand-200 pt-5">
            <ul className="space-y-1.5 text-sm">
              {booking.items.map((it) => (
                <li key={it._id} className="flex justify-between"><span className="text-ink-500">{pick(it.label, locale)}{it.quantity > 1 && it.kind !== "discount" ? ` × ${it.quantity}` : ""}</span><span dir="ltr" className={it.kind === "discount" ? "text-success" : "text-ink-900"}>{formatOmr(it.total, locale)}</span></li>
              ))}
            </ul>
            <div className="hairline my-3" />
            <div className="flex justify-between text-sm"><span className="text-ink-500">{t("total")}</span><span dir="ltr" className="font-heading text-lg text-navy-950">{formatOmr(booking.total, locale)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-ink-500">{t("paid")}</span><span dir="ltr" className="text-success">{formatOmr(booking.amountPaid, locale)}</span></div>
            {booking.total - booking.amountPaid > 0 && <div className="flex justify-between text-sm"><span className="text-ink-500">{t("balance")}</span><span dir="ltr" className="text-warning">{formatOmr(booking.total - booking.amountPaid, locale)}</span></div>}
          </div>
        </div>

        {booking.tour && (
          <p className="text-xs text-ink-500">{booking.tour.freeCancellationHours > 0 ? t("cancellationNote", { hours: booking.tour.freeCancellationHours }) : t("nonRefundableNote")}</p>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {!viewer && (
          <div className="rounded-xl border border-gold-500/40 bg-navy-950 p-5 text-sand-50">
            <h2 className="font-heading text-base text-gold-400">{t("createAccountTitle")}</h2>
            <p className="mt-1 text-sm text-sand-100/75">{t("createAccountBody")}</p>
            <Button asChild className="mt-4 w-full bg-gold-gradient text-navy-950"><Link href={`/sign-up?email=${encodeURIComponent(booking.traveller.email)}&redirect=/account`}>{t("createAccount")}</Link></Button>
          </div>
        )}
        <div className="rounded-xl border border-sand-200 bg-white p-5 text-sm">
          <h2 className="font-heading text-base text-navy-950">{t("helpTitle")}</h2>
          <p className="mt-1 text-ink-500">{t("helpBody")}</p>
          <a href={`https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(`Booking ${booking.reference}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 block text-gold-700 underline-offset-4 hover:underline">WhatsApp {site.phoneDisplay}</a>
          <a href={`mailto:${site.email}?subject=Booking ${booking.reference}`} className="mt-1 block text-gold-700 underline-offset-4 hover:underline">{site.email}</a>
        </div>
      </aside>
    </div>
  );
}
