"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageCircle, MessagesSquare, X } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { site, whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";
import { ChatWidget } from "@/components/chat/chat-widget";

/**
 * Floating bottom-end support button present on every public page.
 * Offers WhatsApp (deep link with page context) and the in-site chat.
 */
export function SupportFab({ contextLabel }: { contextLabel?: string }) {
  const t = useTranslations("support");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const page = contextLabel ?? (typeof document !== "undefined" ? document.title : pathname);
  const message =
    `Hello Oman Compass Tours 👋 I have a question about: ${page}\n` +
    `مرحباً بوصلة عُمان للسياحة 👋 لديّ استفسار حول: ${page}\n` +
    `${site.url}/${locale}${pathname === "/" ? "" : pathname}`;

  return (
    <>
      <div className="fixed bottom-[calc(1.25rem_+_var(--bottom-bar,0px))] end-5 z-40 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col gap-2 animate-fade-up">
            <a
              href={whatsappLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-900 py-2.5 pe-4 ps-3 text-sm text-sand-50 shadow-lg transition hover:border-gold-500/60"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#25D366] text-navy-950">
                <MessageCircle className="size-4" />
              </span>
              <span>
                <span className="block font-medium">{t("whatsapp")}</span>
                <span className="block text-xs text-sand-100/60">{t("whatsappHint")}</span>
              </span>
            </a>
            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                setOpen(false);
              }}
              className="flex items-center gap-3 rounded-xl border border-navy-800 bg-navy-900 py-2.5 pe-4 ps-3 text-start text-sm text-sand-50 shadow-lg transition hover:border-gold-500/60"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-gold-gradient text-navy-950">
                <MessagesSquare className="size-4" />
              </span>
              <span>
                <span className="block font-medium">{t("chat")}</span>
                <span className="block text-xs text-sand-100/60">{t("chatHint")}</span>
              </span>
            </button>
          </div>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? t("close") : t("open")} title={open ? t("close") : t("open")}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex size-14 items-center justify-center rounded-full bg-gold-gradient text-navy-950 shadow-gold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500",
          )}
        >
          {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        </button>
      </div>
      <ChatWidget open={chatOpen} onOpenChange={setChatOpen} />
    </>
  );
}
