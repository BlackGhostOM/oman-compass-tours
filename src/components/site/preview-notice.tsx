"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Construction, Mail, MessageCircle, Phone } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Link, usePathname } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STORAGE_KEY = "oct_preview_notice_v1";
/** Pages where a visitor gets the notice (locale-less paths). */
const ROUTES = new Set(["/", "/tours", "/services"]);
/** A dismissed notice stays hidden for the rest of the visit; after this much time away it shows again. */
const REPEAT_AFTER_MS = 30 * 60 * 1000;

export type PreviewNoticeSetting = { enabled: boolean } | null;

/**
 * "Site under construction" notice, shown once per visit: dismissing it hides
 * it while the visitor browses, and it returns on the next visit (new tab or
 * browser session, or after 30 minutes away). Staff switch it off from
 * Admin → Settings → Company once bookings open.
 */
export function PreviewNotice() {
  const t = useTranslations("previewNotice");
  const pathname = usePathname();
  const setting = useQuery(api.content.setting, { key: "site.previewNotice" }) as PreviewNoticeSetting | undefined;
  const [open, setOpen] = useState(false);

  const enabled = setting === undefined ? false : setting === null ? true : setting.enabled;

  useEffect(() => {
    if (!enabled || !ROUTES.has(pathname)) return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? 0);
    } catch {
      /* private mode: show it, it simply will not be remembered */
    }
    if (!dismissedAt || Date.now() - dismissedAt > REPEAT_AFTER_MS) setOpen(true);
  }, [enabled, pathname]);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-lg" data-testid="preview-notice">
        <DialogHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-700">
            <Construction className="size-6" />
          </div>
          <DialogTitle className="text-center font-heading text-xl">{t("title")}</DialogTitle>
          <DialogDescription className="text-center leading-relaxed">{t("body")}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">{t("contact")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild variant="outline" size="sm" className="border-[#25D366]/40">
            <a href={site.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /> WhatsApp</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${site.phoneE164}`} dir="ltr"><Phone className="size-4" /> {site.phoneDisplay}</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${site.email}`}><Mail className="size-4" /> {t("email")}</a>
          </Button>
        </div>
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" onClick={dismiss}>{t("dismiss")}</Button>
          <Button asChild className="bg-gold-gradient text-navy-950" onClick={dismiss}>
            <Link href="/contact">{t("cta")}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
