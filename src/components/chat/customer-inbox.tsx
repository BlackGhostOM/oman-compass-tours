"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { MessagesSquare } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationThread } from "@/components/chat/conversation-thread";

/** Customer message history: every conversation with the assistant and the team. */
export function CustomerInbox() {
  const t = useTranslations("account.messages");
  const locale = useLocale();
  const conversations = useQuery(api.chat.myConversations);
  const [selected, setSelected] = useState<Id<"conversations"> | null>(null);

  useEffect(() => {
    if (!selected && conversations?.length) setSelected(conversations[0]._id);
  }, [conversations, selected]);

  if (conversations === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (conversations.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <MessagesSquare className="size-10 text-gold-500" />
        <p className="font-heading text-foreground">{t("emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Muscat" });

  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[16rem_1fr]">
      <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto border-b border-border md:border-b-0 md:border-e" aria-label={t("title")}>
        {conversations.map((c) => (
          <li key={c._id}>
            <button
              type="button"
              onClick={() => setSelected(c._id)}
              aria-current={selected === c._id ? "true" : undefined}
              className={cn("w-full px-4 py-3 text-start transition hover:bg-muted/60", selected === c._id && "bg-muted")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{fmt.format(new Date(c.lastMessageAt))}</span>
                {c.unread > 0 && <Badge className="bg-gold-500 text-navy-950">{c.unread}</Badge>}
              </div>
              <p className="mt-1 truncate text-sm text-foreground">{c.subject ?? c.lastMessagePreview ?? t("noMessages")}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t(`status.${c.status}`)}</p>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <ConversationThread key={selected} conversationId={selected} className="max-h-[32rem]" />
      ) : (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">{t("select")}</div>
      )}
    </div>
  );
}
