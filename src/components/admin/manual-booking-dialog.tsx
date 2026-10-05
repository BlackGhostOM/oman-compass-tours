"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "@/i18n/navigation";
import { countries } from "@/lib/countries";
import { addDaysIso, pick, todayIso } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/forms/phone-input";
import { BookingSlotFields } from "@/components/admin/booking-slot-fields";

export function ManualBookingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("admin.bookings.manual");
  const router = useRouter();
  const tours = useQuery(api.admin.bookings.toursForSelect);
  const create = useMutation(api.admin.bookings.createManual);
  const [form, setForm] = useState({ tourId: "", date: addDaysIso(todayIso(), 1), startTime: "", adults: 2, children: 0, infants: 0, firstName: "", lastName: "", nationality: "OM", phone: "", email: "", hotel: "", requests: "", locale: "en" as "en" | "ar", source: "whatsapp" as "whatsapp" | "phone" | "email" | "office" | "viator" | "tripadvisor" | "staff", totalOmr: 0, status: "confirmed" as "inquiry" | "pending_payment" | "confirmed", paidOmr: 0, notes: "", holdUntil: "" });
  const [busy, setBusy] = useState(false);
  // Once staff type their own total (an agreed discount, say), guest changes stop overwriting it
  const [totalEdited, setTotalEdited] = useState(false);
  const tour = tours?.find((x) => x._id === form.tourId);
  // What the website would charge this party on this date (same engine, seasons included), as a starting point staff
  // can overwrite; it follows the tour, date and party until staff type their own total
  const suggestion = useQuery(
    api.admin.bookings.suggestedTotal,
    form.tourId ? { tourId: form.tourId as Id<"tours">, date: form.date, adults: form.adults, children: form.children, infants: form.infants } : "skip",
  );
  const totalOmr: number | undefined = totalEdited ? form.totalOmr : suggestion ? suggestion.total / 1000 : undefined;

  function pickTour(id: string) {
    const tr = tours?.find((x) => x._id === id);
    setTotalEdited(false);
    setForm((f) => ({ ...f, tourId: id, startTime: tr?.startTimes[0] ?? "" }));
  }

  function setParty(patch: Partial<Pick<typeof form, "adults" | "children" | "infants">>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tourId || totalOmr === undefined) return;
    setBusy(true);
    try {
      const args = { tourId: form.tourId as Id<"tours">, date: form.date, startTime: form.startTime, adults: form.adults, children: form.children, infants: form.infants, traveller: { firstName: form.firstName, lastName: form.lastName, nationality: form.nationality, phone: form.phone, email: form.email, hotel: form.hotel || undefined, specialRequests: form.requests || undefined, preferredLanguage: form.locale }, locale: form.locale, source: form.source, totalOmr, status: form.status, amountPaidOmr: form.paidOmr || undefined, internalNotes: form.notes || undefined, holdUntil: form.status !== "confirmed" && form.holdUntil ? form.holdUntil : undefined };
      let r: { bookingId: Id<"bookings">; reference: string };
      try {
        r = await create(args);
      } catch (err) {
        // Full, blacked out, not running that day or outside the group rules: staff may still create it on purpose
        const data = err instanceof ConvexError ? (err.data as { code?: string; reasons?: string[]; remaining?: number; needed?: number }) : undefined;
        if (data?.code !== "NEEDS_OVERRIDE") throw err;
        const reasons = (data.reasons ?? []).map((x) => (t.has(`overrideReasons.${x}`) ? t(`overrideReasons.${x}`, { remaining: data.remaining ?? 0, needed: data.needed ?? 0 }) : x));
        if (!window.confirm(`${t("overrideTitle")}\n\n• ${reasons.join("\n• ")}\n\n${t("overrideConfirm")}`)) return;
        r = await create({ ...args, override: true });
      }
      toast.success(t("created", { reference: r.reference }));
      onOpenChange(false);
      router.push(`/admin/bookings/${r.bookingId}`);
    } catch (err) {
      toast.error(t("error"));
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{t("title")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mb-tour">{t("tour")}</Label>
            <Select value={form.tourId} onValueChange={pickTour}>
              <SelectTrigger id="mb-tour" className="w-full"><SelectValue placeholder={t("selectTour")} /></SelectTrigger>
              <SelectContent>{tours?.filter((x) => x.status === "published").map((x) => <SelectItem key={x._id} value={x._id}>{x.code} · {pick(x.title, locale)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Shows what is left on each departure and warns about the departure rules before staff submit */}
          <BookingSlotFields
            idPrefix="mb"
            tour={tour}
            value={{ date: form.date, startTime: form.startTime, adults: form.adults, children: form.children, infants: form.infants }}
            onChange={({ date, startTime, ...party }) => {
              if (date !== undefined) setForm((f) => ({ ...f, date }));
              if (startTime !== undefined) setForm((f) => ({ ...f, startTime }));
              if (Object.keys(party).length > 0) setParty(party);
            }}
          />
          <div className="space-y-1.5"><Label htmlFor="mb-firstName">{t("firstName")}</Label><Input id="mb-firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="mb-lastName">{t("lastName")}</Label><Input id="mb-lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="mb-email">{t("email")}</Label><Input id="mb-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="mb-phone">{t("phone")}</Label><PhoneInput id="mb-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-nationality">{t("nationality")}</Label>
            <Select value={form.nationality} onValueChange={(v) => setForm({ ...form, nationality: v })}>
              <SelectTrigger id="mb-nationality" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">{countries.map((c) => <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="mb-hotel">{t("hotel")}</Label><Input id="mb-hotel" value={form.hotel} onChange={(e) => setForm({ ...form, hotel: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-source">{t("source")}</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as typeof form.source })}>
              <SelectTrigger id="mb-source" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(["whatsapp", "phone", "email", "office", "viator", "tripadvisor", "staff"] as const).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-language">{t("language")}</Label>
            <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "en" | "ar" })}>
              <SelectTrigger id="mb-language" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="mb-total">{t("total")}</Label><Input id="mb-total" type="number" step="0.001" min={0} value={totalOmr ?? ""} onChange={(e) => { setTotalEdited(true); setForm({ ...form, totalOmr: Number(e.target.value) }); }} />{!totalEdited && suggestion?.seasonal && <p className="text-xs text-muted-foreground">{t("seasonalSuggestion")}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="mb-paid">{t("paid")}</Label><Input id="mb-paid" type="number" step="0.001" min={0} value={form.paidOmr} onChange={(e) => setForm({ ...form, paidOmr: Number(e.target.value) })} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mb-status">{t("status")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
              <SelectTrigger id="mb-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="confirmed">{t("statusConfirmed")}</SelectItem><SelectItem value="pending_payment">{t("statusPending")}</SelectItem><SelectItem value="inquiry">{t("statusInquiry")}</SelectItem></SelectContent>
            </Select>
          </div>
          {form.status !== "confirmed" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mb-hold-until">{t("holdUntil")}</Label>
              <Input id="mb-hold-until" type="date" className="w-48" dir="ltr" min={todayIso()} max={form.date || undefined} value={form.holdUntil} onChange={(e) => setForm({ ...form, holdUntil: e.target.value })} aria-describedby="mb-hold-until-hint" />
              <p id="mb-hold-until-hint" className="text-xs text-muted-foreground">{t("holdUntilHint")}</p>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="mb-requests">{t("requests")}</Label><Textarea id="mb-requests" rows={2} value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="mb-notes">{t("notes")}</Label><Textarea id="mb-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={busy || !form.tourId || totalOmr === undefined} className="bg-gold-gradient text-navy-950">{busy ? t("saving") : t("create")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
