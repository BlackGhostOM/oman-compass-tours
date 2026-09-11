"use client";

import { useTranslations } from "next-intl";
import { MessageCircle, MessagesSquare } from "lucide-react";
import { site, whatsappLink } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { CustomerInbox } from "@/components/chat/customer-inbox";

export default function MessagesPage() {
  const t = useTranslations("account.messages");
  return (
    <div>
      <p className="eyebrow">{t("eyebrow")}</p>
      <h2 className="mt-1 font-heading text-2xl text-foreground">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <CustomerInbox />
        <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm">
          <MessagesSquare className="size-6 text-gold-500" />
          <h3 className="mt-3 font-heading text-base text-foreground">{t("otherChannels")}</h3>
          <p className="mt-1 text-muted-foreground">{t("otherChannelsBody")}</p>
          <Button asChild className="mt-4 w-full bg-[#25D366] text-navy-950 hover:bg-[#1ebe5b]"><a href={whatsappLink("Hello Oman Compass Tours 👋")} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> WhatsApp</a></Button>
          <a href={`mailto:${site.email}`} className="mt-3 block text-center text-gold-700 underline-offset-4 hover:underline">{site.email}</a>
        </aside>
      </div>
    </div>
  );
}
