"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
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

export function ManualBookingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const locale = useLocale() as "en" | "ar";
  const t = useTranslations("admin.bookings.manual");
  const router = useRouter();
  const tours = useQuery(api.admin.bookings.toursForSelect);
  const create = useMutation(api.admin.bookings.createManual);
  const [form, setForm] = useState({ tourId: "", date: addDaysIso(todayIso(), 1), startTime: "", adults: 2, children: 0, infants: 0, firstName: "", lastName: "", nationality: "OM", phone: "", email: "", hotel: "", requests: "", locale: "en" as "en" | "ar", source: "whatsapp" as "whatsapp" | "phone" | "email" | "office" | "viator" | "tripadvisor" | "staff", totalOmr: 0, status: "confirmed" as "inquiry" | "pending_payment" | "confirmed", paidOmr: 0, notes: "" });
  const [busy, setBusy] = useState(false);
  const tour = tours?.find((x) => x._id === form.tourId);

  function pickTour(id: string) {
    const tr = tours?.find((x) => x._id === id);
    setForm((f) => ({ ...f, tourId: id, startTime: tr?.startTimes[0] ?? "", totalOmr: tr ? (tr.pricingModel === "per_group" ? tr.priceFrom / 1000 : (tr.priceFrom / 1000) * (f.adults + f.children)) : 0 }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tourId) return;
    setBusy(true);
    try {
      const r = await create({ tourId: form.tourId as Id<"tours">, date: form.date, startTime: form.startTime, adults: form.adults, children: form.children, infants: form.infants, traveller: { firstName: form.firstName, lastName: form.lastName, nationality: form.nationality, phone: form.phone, email: form.email, hotel: form.hotel || undefined, specialRequests: form.requests || undefined, preferredLanguage: form.locale }, locale: form.locale, source: form.source, totalOmr: form.totalOmr, status: form.status, amountPaidOmr: form.paidOmr || undefined, internalNotes: form.notes || undefined });
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
          <div className="space-y-1.5"><Label htmlFor="mb-date">{t("date")}</Label><Input id="mb-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-time">{t("time")}</Label>
            <Select value={form.startTime} onValueChange={(v) => setForm({ ...form, startTime: v })}>
              <SelectTrigger id="mb-time" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(tour?.startTimes ?? ["08:00"]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div className="space-y-1.5"><Label htmlFor="mb-adults">{t("adults")}</Label><Input id="mb-adults" type="number" min={1} value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="mb-children">{t("children")}</Label><Input id="mb-children" type="number" min={0} value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="mb-infants">{t("infants")}</Label><Input id="mb-infants" type="number" min={0} value={form.infants} onChange={(e) => setForm({ ...form, infants: Number(e.target.value) })} /></div>
          </div>
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
          <div className="space-y-1.5"><Label htmlFor="mb-total">{t("total")}</Label><Input id="mb-total" type="number" step="0.001" min={0} value={form.totalOmr} onChange={(e) => setForm({ ...form, totalOmr: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label htmlFor="mb-paid">{t("paid")}</Label><Input id="mb-paid" type="number" step="0.001" min={0} value={form.paidOmr} onChange={(e) => setForm({ ...form, paidOmr: Number(e.target.value) })} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mb-status">{t("status")}</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
              <SelectTrigger id="mb-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="confirmed">{t("statusConfirmed")}</SelectItem><SelectItem value="pending_payment">{t("statusPending")}</SelectItem><SelectItem value="inquiry">{t("statusInquiry")}</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="mb-requests">{t("requests")}</Label><Textarea id="mb-requests" rows={2} value={form.requests} onChange={(e) => setForm({ ...form, requests: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="mb-notes">{t("notes")}</Label><Textarea id="mb-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={busy || !form.tourId} className="bg-gold-gradient text-navy-950">{busy ? t("saving") : t("create")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
