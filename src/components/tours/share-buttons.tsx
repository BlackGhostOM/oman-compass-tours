"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function ShareButtons({
  title,
  path,
  className,
  variant = "inline",
}: {
  title: string;
  path: string; // locale-less path, e.g. /tours/slug
  className?: string;
  variant?: "inline" | "icons";
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const url = `${site.url}/${locale}${path}`;
  const text = `${title} — Oman Compass Tours`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("error"));
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* cancelled */
      }
    } else {
      await copy();
    }
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const x = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {variant === "inline" && <span className="text-sm text-ink-500">{t("share")}:</span>}
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp">
          <MessageCircle className="size-4 text-[#25D366]" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="icon-sm" aria-label="X" title="X">
        <a href={x} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" className="size-3.5 fill-current"><path d="M17.5 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9L17.5 3zm-1.1 16.2h1.7L7 4.7H5.2l11.2 14.5z" /></svg>
        </a>
      </Button>
      <Button asChild variant="outline" size="icon-sm" aria-label="Facebook" title="Facebook">
        <a href={fb} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" className="size-4 fill-current"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z" /></svg>
        </a>
      </Button>
      <Button variant="outline" size="icon-sm" onClick={copy} aria-label={t("copyLink")} title={t("copyLink")}>
        <Link2 className="size-4" />
      </Button>
      <Button variant="outline" size="icon-sm" onClick={nativeShare} aria-label={t("share")} title={t("share")} className="sm:hidden">
        <Share2 className="size-4" />
      </Button>
    </div>
  );
}
