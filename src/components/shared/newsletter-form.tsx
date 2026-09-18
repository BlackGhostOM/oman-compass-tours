"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const t = useTranslations("newsletter");
  const locale = useLocale() as "en" | "ar";
  const subscribe = useMutation(api.newsletter.subscribe);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await subscribe({ email, locale, source });
      toast.success(t("success"));
      setEmail("");
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      toast.error(code === "RATE_LIMITED" ? t("rateLimited") : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" aria-label={t("title")}>
      <label htmlFor={`newsletter-${source}`} className="block text-sm font-medium text-sand-50">
        {t("title")}
      </label>
      <div className="flex gap-2">
        <Input
          id={`newsletter-${source}`}
          type="email"
          required
          autoComplete="email"
          placeholder={t("placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-navy-800 bg-navy-900 text-sand-50 placeholder:text-sand-100/40 focus-visible:border-gold-500"
        />
        <Button
          type="submit"
          disabled={busy}
          className="shrink-0 bg-gold-gradient text-navy-950"
          aria-label={t("subscribe")} title={t("subscribe")}
        >
          <Send className="size-4 rtl-flip" />
          <span className="hidden sm:inline">{t("subscribe")}</span>
        </Button>
      </div>
      <p className="text-xs text-sand-100/50">{t("privacy")}</p>
    </form>
  );
}
