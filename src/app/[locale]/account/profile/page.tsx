"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { countries } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneInput } from "@/components/forms/phone-input";

export default function ProfilePage() {
  const locale = useLocale();
  const t = useTranslations("account.profile");
  const viewer = useQuery(api.users.viewer);
  const update = useMutation(api.users.updateProfile);
  const [form, setForm] = useState({ name: "", phone: "", nationality: "", locale: "en" as "en" | "ar", marketingOptIn: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (viewer) setForm({ name: viewer.name ?? "", phone: viewer.phone ?? "", nationality: viewer.nationality ?? "", locale: (viewer.locale as "en" | "ar") ?? "en", marketingOptIn: viewer.marketingOptIn });
  }, [viewer]);

  if (viewer === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (viewer === null) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await update({ name: form.name, phone: form.phone || undefined, nationality: form.nationality || undefined, locale: form.locale, marketingOptIn: form.marketingOptIn });
      toast.success(t("saved"));
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
      <form onSubmit={save} className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">{t("name")}</Label>
          <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-email">{t("email")}</Label>
          <Input id="p-email" value={viewer.email ?? ""} readOnly className="bg-muted" />
          <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">{t("phone")}</Label>
          <PhoneInput id="p-phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("nationality")}</Label>
            <Select value={form.nationality || "none"} onValueChange={(v) => setForm({ ...form, nationality: v === "none" ? "" : v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">—</SelectItem>
                {countries.map((c) => <SelectItem key={c.code} value={c.code}>{locale === "ar" ? c.ar : c.en}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("language")}</Label>
            <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "en" | "ar" })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <Label htmlFor="p-marketing">{t("marketing")}</Label>
            <p className="text-xs text-muted-foreground">{t("marketingHint")}</p>
          </div>
          <Switch id="p-marketing" checked={form.marketingOptIn} onCheckedChange={(v) => setForm({ ...form, marketingOptIn: v })} />
        </div>
        <Button type="submit" disabled={busy} className="bg-gold-gradient text-navy-950">{busy ? t("saving") : t("save")}</Button>
      </form>
    </div>
  );
}
