"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { pick, type LocalizedString } from "@/lib/content";
import { cn } from "@/lib/utils";

export type MediaItem = {
  kind: "image" | "video";
  url?: string;
  posterUrl?: string;
  alt: LocalizedString;
  width?: number;
  height?: number;
  blurDataUrl?: string;
};

/**
 * Responsive gallery (hero + thumbnails) with a swipeable lightbox
 * supporting images and videos.
 */
export function MediaGallery({ items, title, className }: { items: MediaItem[]; title: string; className?: string }) {
  const locale = useLocale();
  const t = useTranslations("gallery");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const media = items.filter((m) => m.url);
  const count = media.length;

  const show = (i: number) => {
    setIndex(((i % count) + count) % count);
    setOpen(true);
  };
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  // Touch swipe
  const [touchX, setTouchX] = useState<number | null>(null);

  // Filmstrip: keep the active thumbnail in view as the visitor moves through the gallery
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const active = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [open, index]);

  if (count === 0) return null;
  const main = media[0];
  const current = media[index];

  return (
    <div className={className}>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => show(0)}
          className="group relative col-span-4 aspect-[16/10] overflow-hidden rounded-xl sm:col-span-3 sm:aspect-auto sm:h-[26rem]"
          aria-label={t("openImage", { n: 1, total: count })}
        >
          <Image
            src={main.posterUrl ?? main.url!}
            alt={pick(main.alt, locale) || title}
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
          {main.kind === "video" && <PlayBadge />}
        </button>
        <div className="col-span-4 grid grid-cols-4 gap-2 sm:col-span-1 sm:grid-cols-1 sm:gap-3">
          {media.slice(1, 5).map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => show(i + 1)}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg sm:aspect-auto sm:h-[calc((26rem-2.25rem)/4)]"
              aria-label={t("openImage", { n: i + 2, total: count })}
            >
              <Image
                src={m.posterUrl ?? m.url!}
                alt={pick(m.alt, locale) || title}
                fill
                sizes="(min-width: 1024px) 15vw, 25vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              {m.kind === "video" && <PlayBadge small />}
              {i === 3 && count > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-navy-950/60 font-heading text-lg text-sand-50">
                  +{count - 5}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="dark h-[92vh] w-[96vw] max-w-6xl border-navy-800 bg-navy-950 p-0 text-sand-50 sm:max-w-6xl"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
            setTouchX(null);
          }}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-sand-100/70">
                {index + 1} / {count}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-full p-2 hover:bg-navy-800">
                <X className="size-5" />
              </button>
            </div>
            <div className="relative flex-1">
              {current.kind === "video" ? (
                <video src={current.url} poster={current.posterUrl} controls autoPlay playsInline className="h-full w-full object-contain" />
              ) : (
                <Image src={current.url!} alt={pick(current.alt, locale) || title} fill sizes="96vw" className="object-contain" />
              )}
              {count > 1 && (
                <>
                  <button type="button" onClick={prev} aria-label={t("prev")} className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-900/80 p-2 hover:bg-navy-800">
                    <ChevronLeft className="size-6 rtl-flip" />
                  </button>
                  <button type="button" onClick={next} aria-label={t("next")} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-900/80 p-2 hover:bg-navy-800">
                    <ChevronRight className="size-6 rtl-flip" />
                  </button>
                </>
              )}
            </div>
            <p className="px-4 py-2 text-center text-sm text-sand-100/70">{pick(current.alt, locale)}</p>
            {count > 1 && (
              <div
                ref={stripRef}
                role="tablist"
                aria-label={t("thumbnails")}
                className="flex w-full max-w-full gap-2 overflow-x-auto border-t border-navy-800 px-4 py-3 [scrollbar-width:thin] [scrollbar-color:var(--color-navy-700)_transparent]"
              >
                {media.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    data-index={i}
                    aria-selected={i === index}
                    aria-label={t("openImage", { n: i + 1, total: count })}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "relative h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition sm:h-16 sm:w-24",
                      i === index ? "ring-gold-500 opacity-100" : "ring-transparent opacity-60 hover:opacity-100",
                    )}
                  >
                    <Image src={m.posterUrl ?? m.url!} alt="" fill sizes="96px" className="object-cover" />
                    {m.kind === "video" && <PlayBadge small />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayBadge({ small = false }: { small?: boolean }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className={cn("flex items-center justify-center rounded-full bg-navy-950/70 text-gold-400 ring-1 ring-gold-500/60", small ? "size-8" : "size-16")}>
        <Play className={cn("fill-current", small ? "size-3.5" : "size-7")} />
      </span>
    </span>
  );
}
