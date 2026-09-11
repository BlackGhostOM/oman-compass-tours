"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Bot, MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DateTime, EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

function InboxInner() {
  const locale = useLocale();
  const t = useTranslations("admin.inbox");
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("c") as Id<"conversations"> | null;
  const [filter, setFilter] = useState<string>("open");
  const list = useQuery(api.chat.inbox, filter === "open" ? {} : { status: filter as "ai" | "waiting_human" | "human" | "closed" });
  const thread = useQuery(api.chat.staffMessages, selected ? { conversationId: selected } : "skip");
  const staff = useQuery(api.admin.leads.staffMembers);
  const reply = useMutation(api.chat.staffReply);
  const update = useMutation(api.chat.staffUpdate);
  const markRead = useMutation(api.chat.markReadByStaff);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) void markRead({ conversationId: selected });
  }, [selected, thread?.messages.length, markRead]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function send() {
    if (!selected || !text.trim()) return;
    await reply({ conversationId: selected, body: text.trim() });
    setText("");
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("subtitle")} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{t("open")}</SelectItem>
                <SelectItem value="waiting_human"><StatusBadge status="waiting_human" /></SelectItem>
                <SelectItem value="human"><StatusBadge status="human" /></SelectItem>
                <SelectItem value="ai"><StatusBadge status="ai" /></SelectItem>
                <SelectItem value="closed"><StatusBadge status="closed" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {list === undefined ? <li className="p-3"><Skeleton className="h-40" /></li> : list.length === 0 ? <li className="p-4 text-sm text-muted-foreground">{t("empty")}</li> : list.map((c) => (
              <li key={c._id}>
                <button type="button" onClick={() => router.replace(`/admin/inbox?c=${c._id}`)} className={cn("flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-start hover:bg-muted", selected === c._id && "bg-muted")}>
                  <div className="flex items-center gap-2"><span className="flex-1 truncate text-sm font-medium">{c.name ?? t("visitor")}</span>{c.unread > 0 && <span className="rounded-full bg-gold-500 px-1.5 text-[10px] font-semibold text-navy-950">{c.unread}</span>}<StatusBadge status={c.status} /></div>
                  <p className="truncate text-xs text-muted-foreground">{c.lastMessagePreview ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground"><DateTime value={c.lastMessageAt} /> · {c.locale.toUpperCase()}{c.assignee ? ` · ${c.assignee}` : ""}</p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          {!selected ? <EmptyState title={t("selectConversation")} /> : thread === undefined ? <Skeleton className="m-4 h-64" /> : thread === null ? <EmptyState title={t("notFound")} /> : (
            <>
              <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{thread.conversation.name ?? t("visitor")} <span className="text-xs text-muted-foreground">{thread.conversation.email ?? ""} {thread.conversation.phone ?? ""}</span></p>
                  <p className="text-xs text-muted-foreground">{thread.conversation.pagePath ?? ""}{thread.conversation.handoffReason ? ` · ${t("handoff")}: ${thread.conversation.handoffReason}` : ""}{thread.customer ? <> · <Link href={`/admin/customers/${thread.customer._id}`} className="text-gold-700 hover:underline">{t("customer")}</Link></> : null}{thread.booking ? <> · <Link href={`/admin/bookings/${thread.booking._id}`} className="text-gold-700 hover:underline">{thread.booking.reference}</Link></> : null}</p>
                </div>
                <Select value={thread.conversation.assigneeId ?? "none"} onValueChange={(v) => update({ conversationId: selected, assigneeId: v === "none" ? null : (v as Id<"users">) })}>
                  <SelectTrigger className="h-8 w-40"><SelectValue placeholder={t("assign")} /></SelectTrigger>
                  <SelectContent><SelectItem value="none">{t("unassigned")}</SelectItem>{staff?.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {thread.conversation.status !== "closed" ? (
                  <Button size="sm" variant="outline" onClick={() => update({ conversationId: selected, status: "closed" }).then(() => toast.success(t("closed")))}>{t("close")}</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => update({ conversationId: selected, status: "human" })}>{t("reopen")}</Button>
                )}
                {thread.conversation.status === "human" && <Button size="sm" variant="ghost" onClick={() => update({ conversationId: selected, status: "ai" })}><Bot className="size-4" /> {t("backToAi")}</Button>}
                {thread.conversation.phone && <Button asChild size="sm" variant="ghost"><a href={`https://wa.me/${thread.conversation.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-[#25D366]" /></a></Button>}
              </header>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {thread.messages.map((m) => (
                  <div key={String(m._id)} className={cn("flex", m.role === "customer" ? "justify-start" : "justify-end")}>
                    <div className={cn("max-w-[75%] rounded-xl px-3 py-2 text-sm", m.role === "customer" ? "bg-muted text-foreground" : m.role === "assistant" ? "bg-gold-500/15 text-foreground" : m.role === "system" ? "bg-transparent text-xs italic text-muted-foreground" : "bg-navy-950 text-sand-50")} dir="auto">
                      <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-70">{m.role === "assistant" ? <Bot className="size-3" /> : m.role === "customer" ? <UserRound className="size-3" /> : null}{t(`roles.${m.role}`)}{m.aiConfidence !== null && m.aiConfidence !== undefined ? ` · ${Math.round(m.aiConfidence * 100)}%` : ""} · <DateTime value={m.createdAt} /></div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("replyPlaceholder")} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
                <Button type="submit" disabled={!text.trim()} className="bg-gold-gradient text-navy-950"><Send className="size-4 rtl-flip" /> {t("send")}</Button>
              </form>
            </>
          )}
        </section>
      </div>
      <span className="hidden">{locale}</span>
    </div>
  );
}

export default function AdminInboxPage() {
  return <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}><InboxInner /></Suspense>;
}
