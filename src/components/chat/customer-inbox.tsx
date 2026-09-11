"use client";

import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";

/**
 * Customer message history. Phase 6 wires this to the Convex-backed
 * conversations (AI assistant + staff replies).
 */
export function CustomerInbox() {
  const t = useTranslations("account.messages");
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <MessagesSquare className="size-10 text-gold-500" />
      <p className="font-heading text-foreground">{t("emptyTitle")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{t("emptyBody")}</p>
    </div>
  );
}
