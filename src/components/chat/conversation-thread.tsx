"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Bot, Headset, MessageCircle, SendHorizontal, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { site, whatsappLink } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/forms/phone-input";

type Props = {
  conversationId: Id<"conversations">;
  /** Anonymous visitors authenticate with their session key; signed-in users do not need it. */
  sessionKey?: string;
  /** Called when the visitor wants to start a fresh conversation after this one was closed. */
  onStartNew?: () => void;
  className?: string;
};

/**
 * Shared conversation view: message list, composer, AI typing indicator and
 * the human-handoff flow. Used by the site chat widget and the account inbox.
 */
export function ConversationThread({ conversationId, sessionKey, onStartNew, className }: Props) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const data = useQuery(api.chat.messages, { conversationId, sessionKey });
  const support = useQuery(api.content.supportStatus);
  const send = useMutation(api.chat.send);
  const identify = useMutation(api.chat.identify);
  const requestHuman = useMutation(api.chat.requestHuman);
  const markRead = useMutation(api.chat.markReadByCustomer);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const status = data?.status;

  // Keep the newest message in view and clear the customer's unread counter.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    if (messages.length) void markRead({ conversationId, sessionKey }).catch(() => {});
  }, [messages.length, conversationId, sessionKey, markRead]);

  const last = messages[messages.length - 1];
  const awaitingAi = (status === "ai" || status === "waiting_human") && last?.role === "customer" && lastSentAt !== null && Date.now() - lastSentAt < 30_000;

  async function submit(text: string) {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send({ conversationId, sessionKey, body });
      setDraft("");
      setLastSentAt(Date.now());
    } catch (err) {
      const code = err instanceof ConvexError ? (err.data as { code?: string }).code : undefined;
      toast.error(code === "RATE_LIMITED" ? t("rateLimited") : t("error"));
    } finally {
      setSending(false);
    }
  }

  async function connectHuman(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      if (!data?.guestName || !data?.guestPhone) {
        if (!contact.name.trim() || contact.phone.replace(/\D/g, "").length < 6) {
          setHandoffOpen(true);
          return;
        }
        await identify({ conversationId, sessionKey, name: contact.name.trim(), phone: contact.phone, email: contact.email.trim() || undefined });
      }
      await requestHuman({ conversationId, sessionKey });
      setHandoffOpen(false);
    } catch {
      toast.error(t("error"));
    }
  }

  const time = (ms: number) => new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat" }).format(new Date(ms));
  const roleLabel = (role: string) => (role === "assistant" ? t("assistant") : role === "staff" ? (data?.assigneeName ?? t("team")) : t("you"));

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Status line */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className={cn("size-2 rounded-full", support?.online ? "bg-success" : "bg-warning")} aria-hidden />
        <span className="flex-1">
          {status === "ai" && t("statusAi")}
          {status === "waiting_human" && t("statusWaiting", { minutes: support?.expectedResponseMinutes ?? 10 })}
          {status === "human" && t("statusHuman", { name: data?.assigneeName ?? t("team") })}
          {status === "closed" && t("statusClosed")}
        </span>
        <span className="whitespace-nowrap">{support?.online ? t("online") : t("offline")}</span>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
        {data === undefined ? (
          <p className="text-center text-xs text-muted-foreground">…</p>
        ) : messages.length === 0 ? (
          <Bubble role="assistant" label={t("assistant")}>{t("welcome")}</Bubble>
        ) : (
          messages.map((m) =>
            m.role === "system" ? (
              <p key={m._id} className="mx-auto max-w-[85%] text-center text-xs italic text-muted-foreground">{m.body}</p>
            ) : (
              <Bubble key={m._id} role={m.role} label={roleLabel(m.role)} time={time(m.createdAt)}>
                {m.body}
                {m.aiSuggestedHandoff && status === "ai" && (
                  <button type="button" onClick={() => void connectHuman()} className="mt-2 block text-xs font-medium text-gold-500 underline-offset-4 hover:underline">
                    {t("talkToHuman")}
                  </button>
                )}
              </Bubble>
            ),
          )
        )}
        {awaitingAi && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span className="inline-flex gap-0.5" aria-hidden><i className="size-1.5 animate-bounce rounded-full bg-gold-500 [animation-delay:-0.3s]" /><i className="size-1.5 animate-bounce rounded-full bg-gold-500 [animation-delay:-0.15s]" /><i className="size-1.5 animate-bounce rounded-full bg-gold-500" /></span>
            {t("typing")}
          </div>
        )}
        {status === "waiting_human" && support && !support.online && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
            <p>{t("offlineHint", { start: support.hours.start, end: support.hours.end, minutes: support.expectedResponseMinutes })}</p>
            <a href={whatsappLink(`Hello Oman Compass Tours 👋 (chat ${conversationId.slice(-6)})`)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-medium text-[#25D366]">
              <MessageCircle className="size-3.5" /> {t("whatsapp")}
            </a>
          </div>
        )}
      </div>

      {/* Quick prompts for an empty conversation */}
      {messages.length === 0 && status === "ai" && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {(["quick1", "quick2", "quick3"] as const).map((k) => (
            <button key={k} type="button" onClick={() => void submit(t(k))} className="rounded-full border border-border px-3 py-1 text-xs text-foreground transition hover:border-gold-500 hover:text-gold-500">
              {t(k)}
            </button>
          ))}
        </div>
      )}

      {/* Handoff contact form */}
      {handoffOpen && status === "ai" && (
        <form onSubmit={connectHuman} className="space-y-2 border-t border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium text-foreground">{t("handoffTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("handoffBody")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="chat-name" className="text-xs">{t("name")}</Label><Input id="chat-name" required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="chat-phone" className="text-xs">{t("phone")}</Label><PhoneInput id="chat-phone" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="chat-email" className="text-xs">{t("email")}</Label><Input id="chat-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setHandoffOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" size="sm" className="bg-gold-gradient text-navy-950"><Headset className="size-4" /> {t("connect")}</Button>
          </div>
        </form>
      )}

      {/* Composer */}
      {status === "closed" ? (
        <div className="border-t border-border px-4 py-3 text-center">
          {onStartNew ? (
            <Button size="sm" variant="outline" onClick={onStartNew}>{t("startNew")}</Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("statusClosed")}</p>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
          className="border-t border-border px-3 py-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit(draft);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              className="max-h-32 min-h-10 flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label={t("send")} title={t("send")} className="bg-gold-gradient text-navy-950">
              <SendHorizontal className="size-4 rtl:-scale-x-100" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            {status === "ai" ? (
              <button type="button" onClick={() => void connectHuman()} className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
                <Headset className="size-3" /> {t("talkToHuman")}
              </button>
            ) : (
              <span />
            )}
            <span dir="ltr">{site.phoneDisplay}</span>
          </div>
        </form>
      )}
    </div>
  );
}

/** Turns bare http(s) URLs in a message into links (same tab for our own site, new tab otherwise). */
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target={part.startsWith(site.url) || part.includes("localhost") ? undefined : "_blank"} rel="noopener noreferrer" className="break-all underline underline-offset-2">
        {part.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
    ) : (
      part
    ),
  );
}

function Bubble({ role, label, time, children }: { role: string; label: string; time?: string; children: React.ReactNode }) {
  const mine = role === "customer";
  const Icon = role === "assistant" ? Bot : role === "staff" ? Headset : UserRound;
  return (
    <div className={cn("flex max-w-[88%] gap-2", mine ? "ms-auto flex-row-reverse" : "")}>
      {!mine && (
        <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-navy-950" aria-hidden>
          <Icon className="size-3.5" />
        </span>
      )}
      <div>
        <div className={cn("whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed", mine ? "rounded-se-sm bg-gold-500 text-navy-950" : "rounded-ss-sm bg-muted text-foreground")}>{typeof children === "string" ? linkify(children) : children}</div>
        <p className={cn("mt-0.5 text-[10px] text-muted-foreground", mine ? "text-end" : "")}>
          {label}
          {time ? ` · ${time}` : ""}
        </p>
      </div>
    </div>
  );
}
