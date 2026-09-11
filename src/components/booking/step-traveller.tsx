"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { countries } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/forms/phone-input";
import type { BookingTour, WizardState } from "@/components/booking/types";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  nationality: z.string().length(2),
  phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/),
  email: z.string().trim().email().max(254),
  hotel: z.string().max(160),
  pickupLocation: z.string().max(200),
  specialRequests: z.string().max(1000),
});

export function StepTraveller({ tour, state, update, onBack, onNext }: { tour: BookingTour; state: WizardState; update: (p: Partial<WizardState>) => void; onBack: () => void; onNext: () => void }) {
  const locale = useLocale();
  const t = useTranslations("booking.traveller");
  const tc = useTranslations("common");
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const tr = state.traveller;
  const set = (patch: Partial<WizardState["traveller"]>) => update({ traveller: { ...tr, ...patch } });

  function next() {
    const parsed = schema.safeParse(tr);
    if (!parsed.success) {
      const errs: Record<string, boolean> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = true;
      setErrors(errs);
      return;
    }
    setErrors({});
    onNext();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-xl text-navy-950">{t("title")}</h2>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">{t("firstName")}</Label>
          <Input id="firstName" autoComplete="given-name" value={tr.firstName} onChange={(e) => set({ firstName: e.target.value })} aria-invalid={errors.firstName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">{t("lastName")}</Label>
          <Input id="lastName" autoComplete="family-name" value={tr.lastName} onChange={(e) => set({ lastName: e.target.value })} aria-invalid={errors.lastName} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("nationality")}</Label>
          <Select value={tr.nationality || undefined} onValueChange={(v) => set({ nationality: v })}>
            <SelectTrigger className="w-full" aria-invalid={errors.nationality}><SelectValue placeholder={t("select")} /></SelectTrigger>
            <SelectContent className="max-h-72">
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("phone")}</Label>
          <PhoneInput id="phone" value={tr.phone} onChange={(v) => set({ phone: v })} invalid={errors.phone} />
          <p className="text-xs text-ink-500">{t("phoneHint")}</p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" autoComplete="email" value={tr.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={errors.email} />
          <p className="text-xs text-ink-500">{t("emailHint")}</p>
        </div>
        {tour.pickupIncluded && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="hotel">{t("hotel")}</Label>
              <Input id="hotel" value={tr.hotel} onChange={(e) => set({ hotel: e.target.value })} placeholder={t("hotelPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pickup">{t("pickup")}</Label>
              <Input id="pickup" value={tr.pickupLocation} onChange={(e) => set({ pickupLocation: e.target.value })} placeholder={t("pickupPlaceholder")} />
            </div>
          </>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="requests">{t("requests")}</Label>
          <Textarea id="requests" rows={3} value={tr.specialRequests} onChange={(e) => set({ specialRequests: e.target.value })} placeholder={t("requestsPlaceholder")} />
        </div>
      </div>
      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={onBack}>{tc("back")}</Button>
        <Button size="lg" onClick={next} className="bg-gold-gradient font-semibold text-navy-950">{tc("continue")}</Button>
      </div>
    </div>
  );
}
