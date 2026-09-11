"use client";

import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { site, whatsappLink } from "@/lib/site";

/**
 * In-site chat widget shell. Phase 6 replaces the body with the
 * Convex-backed AI assistant + human handoff conversation view.
 */
export function ChatWidget({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("support");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="dark flex w-[92vw] max-w-md flex-col border-navy-800 bg-navy-950 text-sand-50">
        <SheetHeader className="border-b border-navy-800">
          <SheetTitle className="font-heading tracking-wide text-gold-400">{t("chat")}</SheetTitle>
          <SheetDescription className="text-sand-100/70">{t("chatComingSoon")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-sand-100/80">{t("chatFallback")}</p>
          <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
            <a href={whatsappLink("Hello Oman Compass Tours 👋 / مرحباً")} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> {t("whatsapp")}
            </a>
          </Button>
          <a href={`tel:${site.phoneE164}`} dir="ltr" className="text-sm text-gold-400 underline-offset-4 hover:underline">
            {site.phoneDisplay}
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
