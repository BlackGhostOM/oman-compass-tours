"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/forms/phone-input";
import { Turnstile } from "@/components/forms/turnstile";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().max(32).optional().or(z.literal("")),
  message: z.string().trim().min(5).max(4000),
});

export function ContactForm({ tourId, compact = false }: { tourId?: Id<"tours">; compact?: boolean }) {
  const t = useTranslations("contact.form");
  const locale = useLocale() as "en" | "ar";
  const pathname = usePathname();
  const create = useMutation(api.leads.createFromContact);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstile, setTurnstile] = useState<string | undefined>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = t(`errors.${String(issue.path[0])}`);
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await create({ ...parsed.data, phone: parsed.data.phone || undefined, locale, tourId, pagePath: pathname, honeypot, turnstileToken: turnstile });
      setDone(true);
      toast.success(t("success"));
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      toast.error(code === "RATE_LIMITED" ? t("rateLimited") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-success/40 bg-success/5 p-8 text-center">
        <CheckCircle2 className="size-10 text-success" />
        <h3 className="font-heading text-lg text-navy-950">{t("doneTitle")}</h3>
        <p className="text-sm text-ink-500">{t("doneBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <div className="space-y-1.5">
          <Label htmlFor="c-name">{t("name")}</Label>
          <Input id="c-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
          {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">{t("email")}</Label>
          <Input id="c-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-phone">{t("phone")}</Label>
        <PhoneInput id="c-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-message">{t("message")}</Label>
        <Textarea id="c-message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-invalid={!!errors.message} />
        {errors.message && <p className="text-xs text-danger">{errors.message}</p>}
      </div>
      {/* Honeypot — hidden from humans */}
      <div className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </label>
      </div>
      <Turnstile onToken={setTurnstile} />
      <Button type="submit" disabled={busy} className="bg-gold-gradient font-semibold text-navy-950">
        <Send className="size-4 rtl-flip" /> {busy ? t("sending") : t("submit")}
      </Button>
      <p className="text-xs text-ink-500">{t("privacy")}</p>
    </form>
  );
}
