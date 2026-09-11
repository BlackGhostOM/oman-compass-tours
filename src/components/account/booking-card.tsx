"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { CalendarPlus, Clock, Download, MapPin, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { formatDate, formatOmr, pick, type LocalizedString } from "@/lib/content";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export type BookingSummary = {
  _id: Id<"bookings">;
  reference: string;
  tourTitle: LocalizedString;
  tourSlug: LocalizedString | null;
  coverImage: { url?: string; alt: LocalizedString } | null;
  date: string;
  startTime: string | null;
  durationLabel: LocalizedString | null;
  adults: number;
  children: number;
  infants: number;
  total: number;
  amountPaid: number;
  amountRefunded: number;
  depositDue: number;
  status: string;
  voucherToken: string;
  pickup: string | LocalizedString | null;
  freeCancellationHours: number;
  canCancelFree: boolean;
  holdExpiresAt: number | null;
};

const tone: Record<string, string> = {
  inquiry: "bg-warning/15 text-warning",
  pending_payment: "bg-warning/15 text-warning",
  confirmed: "bg-success/15 text-success",
  in_progress: "bg-navy-950 text-gold-400",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-danger/15 text-danger",
  refunded: "bg-muted text-muted-foreground",
};

function Countdown({ date, startTime }: { date: string; startTime: string | null }) {
  const t = useTranslations("account.bookings");
  const start = new Date(`${date}T${startTime ?? "08:00"}:00+04:00`).getTime();
  const diff = start - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  return <span className="text-xs text-gold-700 dark:text-gold-400">{t("countdown", { d, h })}</span>;
}

export function BookingCard({ booking }: { booking: BookingSummary }) {
  const locale = useLocale();
  const t = useTranslations("account.bookings");
  const ts = useTranslations("bookingStatus");
  const cancel = useMutation(api.bookings.requestCancellation);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = ["confirmed", "in_progress", "completed"].includes(booking.status);
  const cancellable = ["inquiry", "pending_payment", "confirmed"].includes(booking.status);
  const needsPayment = booking.status === "inquiry" || booking.status === "pending_payment";
  const pickup = typeof booking.pickup === "string" ? booking.pickup : booking.pickup ? pick(booking.pickup, locale) : null;

  async function doCancel() {
    setBusy(true);
    try {
      const r = await cancel({ bookingId: booking._id, reason });
      toast.success(r.refundEligible ? t("cancelledRefund") : t("cancelled"));
    } catch {
      toast.error(t("cancelFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card sm:flex-row">
      <div className="relative h-40 w-full shrink-0 sm:h-auto sm:w-48">
        <Image src={booking.coverImage?.url ?? "/media/placeholders/hero.jpg"} alt="" fill sizes="(min-width: 640px) 12rem, 100vw" className="object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-heading text-xs tracking-[0.2em] text-muted-foreground" dir="ltr">{booking.reference}</p>
            <h3 className="mt-1 font-heading text-base text-foreground">
              {booking.tourSlug ? <Link href={`/tours/${pick(booking.tourSlug, locale)}`} className="hover:text-gold-700">{pick(booking.tourTitle, locale)}</Link> : pick(booking.tourTitle, locale)}
            </h3>
          </div>
          <Badge className={cn(tone[booking.status])}>{ts(booking.status)}</Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex items-center gap-2"><Clock className="size-4 text-gold-500" /> {formatDate(booking.date, locale, "short")} · <span dir="ltr">{booking.startTime}</span></div>
          {pickup && <div className="flex items-center gap-2"><MapPin className="size-4 text-gold-500" /> <span className="truncate">{pickup}</span></div>}
          <div>{t("guests", { adults: booking.adults, children: booking.children })}</div>
          <div dir="ltr" className="text-foreground">{formatOmr(booking.amountPaid, locale)} / {formatOmr(booking.total, locale)}</div>
        </dl>
        {confirmed && booking.status !== "completed" && <Countdown date={booking.date} startTime={booking.startTime} />}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm" variant="outline"><Link href={`/booking/${booking.reference}?t=${booking.voucherToken}`}>{t("details")}</Link></Button>
          {confirmed && (
            <Button asChild size="sm" variant="outline"><a href={`/api/voucher/${booking.voucherToken}`} target="_blank" rel="noopener noreferrer"><Download className="size-4" /> {t("voucher")}</a></Button>
          )}
          <Button asChild size="sm" variant="outline"><a href={`/api/calendar/${booking.voucherToken}`}><CalendarPlus className="size-4" /> {t("calendar")}</a></Button>
          {needsPayment && (
            <Button asChild size="sm" className="bg-gold-gradient text-navy-950"><Link href={`/checkout/${booking.reference}?t=${booking.voucherToken}`}>{t("payNow")}</Link></Button>
          )}
          <Button asChild size="sm" variant="ghost"><a href={`https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(`Booking ${booking.reference}: `)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> {t("modify")}</a></Button>
          {cancellable && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-danger hover:text-danger"><XCircle className="size-4" /> {t("cancel")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {booking.amountPaid > 0 ? (booking.canCancelFree ? t("cancelFreeBody", { hours: booking.freeCancellationHours }) : t("cancelLateBody", { hours: booking.freeCancellationHours })) : t("cancelUnpaidBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea placeholder={t("cancelReason")} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                  <AlertDialogAction onClick={doCancel} disabled={busy} className="bg-danger text-white hover:bg-danger/90">{t("confirmCancel")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </article>
  );
}
