"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { CalendarDays, MailCheck, Map, Send, Tag } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const t = useTranslations("newsletter");
  const locale = useLocale() as "en" | "ar";
  const subscribe = useMutation(api.newsletter.subscribe);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  // Email that was just subscribed; set → the thank-you dialog is open
  const [subscribed, setSubscribed] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await subscribe({ email, locale, source });
      setSubscribed(email.trim());
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

      {/* Thank-you dialog: confirms the subscription and sets expectations */}
      <Dialog open={subscribed !== null} onOpenChange={(o) => !o && setSubscribed(null)}>
        <DialogContent className="sm:max-w-md" data-testid="newsletter-thanks">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-700">
              <MailCheck className="size-6" />
            </div>
            <DialogTitle className="text-center font-heading text-xl">{t("thanksTitle")}</DialogTitle>
            <DialogDescription className="text-center leading-relaxed">
              {t("thanksBody", { email: subscribed ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="text-sm font-semibold text-navy-950">{t("expectTitle")}</p>
            <ul className="mt-2 space-y-2 text-sm text-ink-900">
              <li className="flex gap-2.5"><CalendarDays className="mt-0.5 size-4 shrink-0 text-gold-600" /><span>{t("expectTips")}</span></li>
              <li className="flex gap-2.5"><Map className="mt-0.5 size-4 shrink-0 text-gold-600" /><span>{t("expectTours")}</span></li>
              <li className="flex gap-2.5"><Tag className="mt-0.5 size-4 shrink-0 text-gold-600" /><span>{t("expectOffers")}</span></li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t("frequency")}</p>
          </div>
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="ghost" onClick={() => setSubscribed(null)}>{t("close")}</Button>
            <Button asChild className="bg-gold-gradient text-navy-950" onClick={() => setSubscribed(null)}>
              <Link href="/tours">{t("browseTours")}</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
