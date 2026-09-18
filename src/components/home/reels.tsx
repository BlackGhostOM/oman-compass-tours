"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { pick, type LocalizedString } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/section-heading";
import { SocialLinks } from "@/components/shared/social-links";

export type ReelItem = { url?: string; posterUrl?: string; alt: LocalizedString; caption?: LocalizedString };

/** Vertical short-video card (9:16) with tap-to-play and mute toggle. */
export function Reel({ item, className }: { item: ReelItem; className?: string }) {
  const locale = useLocale();
  const t = useTranslations("home.reels");
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const hasVideo = !!item.url;

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <figure className={cn("group relative aspect-[9/16] overflow-hidden rounded-xl border border-navy-800 bg-navy-900", className)}>
      {hasVideo ? (
        <video
          ref={ref}
          src={item.url}
          poster={item.posterUrl}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onEnded={() => setPlaying(false)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Image src={item.posterUrl ?? "/media/placeholders/reel-1.jpg"} alt={pick(item.alt, locale)} fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent" />
      {hasVideo && (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t("pause") : t("play")} title={playing ? t("pause") : t("play")}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className={cn("flex size-14 items-center justify-center rounded-full bg-navy-950/70 text-gold-400 ring-1 ring-gold-500/60 transition", playing && "opacity-0 group-hover:opacity-100")}>
              {playing ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? t("unmute") : t("mute")} title={muted ? t("unmute") : t("mute")}
            className="absolute end-3 top-3 rounded-full bg-navy-950/70 p-2 text-sand-50"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </>
      )}
      {item.caption && (
        <figcaption className="absolute inset-x-0 bottom-0 p-4 text-sm text-sand-50">{pick(item.caption, locale)}</figcaption>
      )}
    </figure>
  );
}

export function ReelsSection({ items }: { items: ReelItem[] }) {
  const t = useTranslations("home.reels");
  if (items.length === 0) return null;
  return (
    <section className="cv-auto surface-dark py-20 sm:py-24">
      <div className="container-brand">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} tone="dark" />
        <div className="scrollbar-none mt-12 flex snap-x gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {items.map((item, i) => (
            <Reel key={i} item={item} className="w-[62vw] shrink-0 snap-center sm:w-[40vw] lg:w-auto" />
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-sm text-sand-100/70">{t("follow")}</p>
          <SocialLinks />
        </div>
      </div>
    </section>
  );
}
