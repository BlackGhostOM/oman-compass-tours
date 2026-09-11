"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { MessageCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { usePathname } from "@/i18n/navigation";
import { useSessionKey } from "@/hooks/use-session-key";
import { site, whatsappLink } from "@/lib/site";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationThread } from "@/components/chat/conversation-thread";

/**
 * In-site chat widget: opens (or resumes) the visitor's conversation with the
 * AI concierge and hands over to staff on request. Anonymous visitors are
 * identified by their session key; signed-in customers by their account.
 */
export function ChatWidget({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("chat");
  const locale = useLocale() as "en" | "ar";
  const pathname = usePathname();
  const sessionKey = useSessionKey();
  const openConversation = useMutation(api.chat.open);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [error, setError] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!open || !sessionKey) return;
    let cancelled = false;
    setError(false);
    openConversation({ sessionKey, locale, pagePath: pathname })
      .then((id) => {
        if (!cancelled) setConversationId(id);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionKey, locale, pathname, openConversation, epoch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="dark flex w-[94vw] max-w-md flex-col gap-0 border-navy-800 bg-navy-950 p-0 text-sand-50">
        <SheetHeader className="border-b border-navy-800 px-4 py-3">
          <SheetTitle className="font-heading tracking-wide text-gold-400">{t("title")}</SheetTitle>
          <SheetDescription className="text-xs text-sand-100/70">{t("poweredBy")}</SheetDescription>
        </SheetHeader>
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-sand-100/80">{t("unavailable")}</p>
            <Button asChild className="bg-[#25D366] text-navy-950 hover:bg-[#1ebe5b]">
              <a href={whatsappLink("Hello Oman Compass Tours 👋 / مرحباً")} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> {t("whatsapp")}
              </a>
            </Button>
            <a href={`tel:${site.phoneE164}`} dir="ltr" className="text-sm text-gold-400 underline-offset-4 hover:underline">{site.phoneDisplay}</a>
          </div>
        ) : conversationId ? (
          <ConversationThread
            key={conversationId}
            conversationId={conversationId}
            sessionKey={sessionKey ?? undefined}
            onStartNew={() => {
              setConversationId(null);
              setEpoch((n) => n + 1);
            }}
          />
        ) : (
          <div className="flex-1 space-y-3 p-4"><Skeleton className="h-10 w-2/3 rounded-2xl" /><Skeleton className="ms-auto h-10 w-1/2 rounded-2xl" /><Skeleton className="h-10 w-3/4 rounded-2xl" /></div>
        )}
        <p className="border-t border-navy-800 px-4 py-2 text-center text-[10px] text-sand-100/50">{t("privacy")}</p>
      </SheetContent>
    </Sheet>
  );
}
