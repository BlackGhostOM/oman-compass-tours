"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { formatDate, pick } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ReviewCard } from "@/components/tours/review-card";

export default function ReviewsPage() {
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("account.reviews");
  const params = useSearchParams();
  const mine = useQuery(api.reviews.mine);
  const bookings = useQuery(api.account.myBookings);
  const submit = useMutation(api.reviews.submit);
  const [bookingId, setBookingId] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const reviewed = new Set((mine ?? []).map((r) => String(r.tourId)));
  const eligible = (bookings?.past ?? []).filter((b) => b.status === "completed");
  const preselect = params.get("booking");
  const selectedId = bookingId || eligible.find((b) => b.reference === preselect)?._id || "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    try {
      await submit({ bookingId: selectedId as Id<"bookings">, rating, title: title || undefined, body, language: locale });
      toast.success(t("submitted"));
      setBody("");
      setTitle("");
      setBookingId("");
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      toast.error(code === "ALREADY_REVIEWED" ? t("already") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (mine === undefined || bookings === undefined) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
        {mine.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {mine.map((r) => (
              <li key={String(r._id)} className="relative">
                <Badge className={cn("absolute end-3 top-3 z-10", r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning")}>{t(`status.${r.status}`)}</Badge>
                <ReviewCard review={r} />
                {r.tourTitle && <p className="mt-1 text-xs text-muted-foreground">{pick(r.tourTitle, locale)}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="h-fit rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-lg text-foreground">{t("writeTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("writeBody")}</p>
        {eligible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("noneEligible")}</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>{t("tour")}</Label>
              <Select value={selectedId} onValueChange={setBookingId}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("selectTour")} /></SelectTrigger>
                <SelectContent>
                  {eligible.map((b) => (
                    <SelectItem key={b._id} value={b._id} disabled={reviewed.has(String(b._id))}>
                      {pick(b.tourTitle, locale)} · {formatDate(b.date, locale, "short")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("rating")}</Label>
              <div className="flex gap-1" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className="p-0.5">
                    <Star className={cn("size-7", n <= rating ? "fill-gold-500 text-gold-500" : "text-muted-foreground/40")} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="rv-title">{t("headline")}</Label><Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
            <div className="space-y-1.5"><Label htmlFor="rv-body">{t("review")}</Label><Textarea id="rv-body" rows={5} required minLength={10} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <Button type="submit" disabled={busy || !selectedId} className="w-full bg-gold-gradient text-navy-950">{busy ? t("sending") : t("submit")}</Button>
            <p className="text-xs text-muted-foreground">{t("moderation")}</p>
          </form>
        )}
      </aside>
    </div>
  );
}
