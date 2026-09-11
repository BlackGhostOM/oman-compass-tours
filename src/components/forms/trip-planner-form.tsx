"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { CheckCircle2, Compass } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { countries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/forms/phone-input";
import { Turnstile } from "@/components/forms/turnstile";

const INTERESTS = ["desert", "wadis", "mountains", "culture", "food", "sea", "photography", "family", "luxury", "hiking"] as const;
const BUDGETS = ["economy", "comfort", "luxury"] as const;

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().min(7),
  nationality: z.string().length(2).optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  travellers: z.coerce.number().int().min(1).max(60),
  budget: z.enum(BUDGETS).optional(),
  message: z.string().max(4000).optional().or(z.literal("")),
});

export function TripPlannerForm() {
  const t = useTranslations("planner");
  const locale = useLocale() as "en" | "ar";
  const create = useMutation(api.leads.createFromTripPlanner);
  const [form, setForm] = useState({ name: "", email: "", phone: "", nationality: "", startDate: "", endDate: "", travellers: 2, budget: "comfort" as (typeof BUDGETS)[number], message: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [, setTurnstile] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = t("invalid");
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await create({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        nationality: parsed.data.nationality || undefined,
        locale,
        startDate: parsed.data.startDate || undefined,
        endDate: parsed.data.endDate || undefined,
        travellers: parsed.data.travellers,
        budget: parsed.data.budget,
        interests,
        message: parsed.data.message || undefined,
        honeypot,
      });
      setDone(true);
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      toast.error(code === "RATE_LIMITED" ? t("rateLimited") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-10 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <h2 className="font-heading text-xl text-navy-950">{t("doneTitle")}</h2>
        <p className="max-w-md text-sm text-ink-500">{t("doneBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <fieldset className="space-y-4">
        <legend className="eyebrow mb-2">{t("step1")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-start">{t("startDate")}</Label>
            <Input id="p-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-end">{t("endDate")}</Label>
            <Input id="p-end" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-trav">{t("travellers")}</Label>
            <Input id="p-trav" type="number" min={1} max={60} value={form.travellers} onChange={(e) => setForm({ ...form, travellers: Number(e.target.value) })} aria-invalid={!!errors.travellers} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("budget")}</Label>
            <Select value={form.budget} onValueChange={(v) => setForm({ ...form, budget: v as (typeof BUDGETS)[number] })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUDGETS.map((b) => (
                  <SelectItem key={b} value={b}>{t(`budgets.${b}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("interests")}</Label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const on = interests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setInterests((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))}
                  className={cn("rounded-full border px-3.5 py-1.5 text-sm transition", on ? "border-gold-500 bg-gold-500/15 text-navy-950" : "border-sand-200 bg-white text-ink-500 hover:border-gold-500/60")}
                >
                  {t(`interestOptions.${i}`)}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="eyebrow mb-2">{t("step2")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">{t("name")}</Label>
            <Input id="p-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">{t("email")}</Label>
            <Input id="p-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">{t("phone")}</Label>
            <PhoneInput id="p-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} invalid={!!errors.phone} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("nationality")}</Label>
            <Select value={form.nationality || "none"} onValueChange={(v) => setForm({ ...form, nationality: v === "none" ? "" : v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">{t("select")}</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-msg">{t("message")}</Label>
          <Textarea id="p-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("messagePlaceholder")} />
        </div>
      </fieldset>

      <div className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>Website <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
      </div>
      <Turnstile onToken={setTurnstile} />

      <Button type="submit" size="lg" disabled={busy} className="bg-gold-gradient font-semibold text-navy-950 shadow-gold">
        <Compass className="size-4" /> {busy ? t("sending") : t("submit")}
      </Button>
    </form>
  );
}
