"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { usePathname } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { countries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/forms/phone-input";
import { Turnstile } from "@/components/forms/turnstile";

export const BUSINESS_TYPES = ["travel_agency", "tour_operator", "travel_advisor", "corporate_mice", "hotel_resort", "tourism_business", "independent", "other"] as const;
export const MARKETS = ["europe", "gcc", "usa_canada", "asia", "australia_nz", "other"] as const;
export const CLIENT_TYPES = ["luxury", "families", "adventure", "cultural", "fit", "groups", "corporate_mice"] as const;
export const BOOKINGS = ["1_10", "11_30", "31_100", "100_plus"] as const;
export const INTERESTS = ["sell_tours", "net_rates", "commission", "ground_handling", "rental_4wd", "custom_programs", "group_operations", "other"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  country: z.string().min(2).max(2),
  city: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().min(6).max(32),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  businessType: z.enum(BUSINESS_TYPES),
  markets: z.array(z.enum(MARKETS)),
  clientTypes: z.array(z.enum(CLIENT_TYPES)),
  bookingsPerYear: z.enum(BOOKINGS).optional(),
  interests: z.array(z.enum(INTERESTS)).min(1),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  consent: z.literal(true),
});

type Form = z.input<typeof schema>;

export function PartnerForm() {
  const t = useTranslations("partners.form");
  const locale = useLocale() as "en" | "ar";
  const pathname = usePathname();
  const create = useMutation(api.leads.createPartnerRequest);
  const [form, setForm] = useState<Form>({ name: "", company: "", country: "", city: "", email: "", phone: "", website: "", businessType: "travel_agency", markets: [], clientTypes: [], bookingsPerYear: undefined, interests: [], message: "", consent: false as unknown as true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstile, setTurnstile] = useState<string | undefined>();

  const toggle = <K extends "markets" | "clientTypes" | "interests">(key: K, value: Form[K][number]) =>
    setForm((f) => ({ ...f, [key]: (f[key] as string[]).includes(value) ? (f[key] as string[]).filter((v) => v !== value) : [...(f[key] as string[]), value] }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        errs[field] = t.has(`errors.${field}`) ? t(`errors.${field}`) : t("errors.generic");
      }
      setErrors(errs);
      document.getElementById("partner-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const d = parsed.data;
      await create({
        name: d.name, company: d.company || undefined, country: d.country, city: d.city, email: d.email, phone: d.phone, website: d.website || undefined,
        businessType: d.businessType, markets: d.markets, clientTypes: d.clientTypes, bookingsPerYear: d.bookingsPerYear, interests: d.interests,
        message: d.message || undefined, locale, pagePath: pathname, honeypot, turnstileToken: turnstile,
      });
      setDone(true);
      track("generate_lead", { source: "partner" });
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      toast.error(code === "RATE_LIMITED" ? t("rateLimited") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-success/40 bg-white p-8 text-center" role="status">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h3 className="mt-4 font-heading text-2xl text-navy-950">{t("doneTitle")}</h3>
        <p className="mx-auto mt-2 max-w-xl text-ink-500">{t("doneBody")}</p>
      </div>
    );
  }

  const field = (key: keyof Form, label: string, node: React.ReactNode, className?: string) => (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={`pf-${key}`}>{label}</Label>
      {node}
      {errors[key] && <p className="text-xs text-danger">{errors[key]}</p>}
    </div>
  );

  const checkGroup = (key: "markets" | "clientTypes" | "interests", options: readonly string[], ns: string) => (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 rounded-md border border-sand-200 bg-white px-3 py-2 text-sm text-ink-900">
          <Checkbox checked={(form[key] as string[]).includes(opt)} onCheckedChange={() => toggle(key, opt as never)} />
          {t(`${ns}.${opt}`)}
        </label>
      ))}
    </div>
  );

  return (
    <form id="partner-form" onSubmit={onSubmit} className="space-y-8 rounded-xl border border-sand-200 bg-sand-50 p-6 sm:p-8" noValidate>
      <div>
        <h3 className="font-heading text-xl text-navy-950">{t("contactTitle")}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {field("name", t("name"), <Input id="pf-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />)}
          {field("company", t("company"), <Input id="pf-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />)}
          {field("country", t("country"), (
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
              <SelectTrigger id="pf-country" className="w-full" aria-invalid={!!errors.country}><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent className="max-h-72">{countries.map((c) => <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>)}</SelectContent>
            </Select>
          ))}
          {field("city", t("city"), <Input id="pf-city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} aria-invalid={!!errors.city} />)}
          {field("email", t("email"), <Input id="pf-email" type="email" dir="ltr" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />)}
          {field("phone", t("phone"), <PhoneInput id="pf-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} invalid={!!errors.phone} />)}
          {field("website", t("website"), <Input id="pf-website" dir="ltr" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />, "sm:col-span-2")}
        </div>
      </div>

      <div>
        <h3 className="font-heading text-xl text-navy-950">{t("businessTitle")}</h3>
        <div className="mt-4 space-y-5">
          {field("businessType", t("businessType"), (
            <Select value={form.businessType} onValueChange={(v) => setForm({ ...form, businessType: v as Form["businessType"] })}>
              <SelectTrigger id="pf-businessType" className="w-full sm:max-w-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{BUSINESS_TYPES.map((b) => <SelectItem key={b} value={b}>{t(`businessTypes.${b}`)}</SelectItem>)}</SelectContent>
            </Select>
          ))}
          <div className="space-y-2"><Label>{t("markets")}</Label>{checkGroup("markets", MARKETS, "marketOptions")}</div>
          <div className="space-y-2"><Label>{t("clientTypes")}</Label>{checkGroup("clientTypes", CLIENT_TYPES, "clientOptions")}</div>
          {field("bookingsPerYear", t("bookingsPerYear"), (
            <Select value={form.bookingsPerYear ?? ""} onValueChange={(v) => setForm({ ...form, bookingsPerYear: v as Form["bookingsPerYear"] })}>
              <SelectTrigger id="pf-bookingsPerYear" className="w-full sm:max-w-sm"><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>{BOOKINGS.map((b) => <SelectItem key={b} value={b}>{t(`bookingOptions.${b}`)}</SelectItem>)}</SelectContent>
            </Select>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-heading text-xl text-navy-950">{t("interestTitle")}</h3>
        <div className="mt-4 space-y-2">
          {checkGroup("interests", INTERESTS, "interestOptions")}
          {errors.interests && <p className="text-xs text-danger">{errors.interests}</p>}
        </div>
        <div className="mt-5">{field("message", t("message"), <Textarea id="pf-message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("messagePlaceholder")} />)}</div>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm text-ink-900">
          <Checkbox checked={form.consent === true} onCheckedChange={(v) => setForm({ ...form, consent: (v === true) as unknown as true })} aria-invalid={!!errors.consent} />
          <span>{t("consent")}</span>
        </label>
        {errors.consent && <p className="text-xs text-danger">{errors.consent}</p>}
        <input type="text" name="company_website_confirm" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
        <Turnstile onToken={setTurnstile} />
        <Button type="submit" size="lg" disabled={busy} className="bg-gold-gradient font-semibold text-navy-950 shadow-gold">
          <Send className="size-4 rtl:-scale-x-100" /> {busy ? t("sending") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
